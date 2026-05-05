//! Unified worker bindings for V8.
//!
//! Five host fns expose worker_contract.WorkerStore + per-backend SDK
//! Sessions as one normalized agent surface to JS:
//!
//!   __worker_start(backend_name, opts_json)               → worker_id ("" on fail)
//!   __worker_send(worker_id, text)                        → bool
//!   __worker_poll(worker_id)                              → WorkerEvent[] | undefined
//!   __worker_respond(worker_id, request_id, payload_json) → bool
//!   __worker_close(worker_id)                             → void
//!
//! Each WorkerEvent on the JS side is the normalized Zig WorkerEvent
//! row, monotonically id'd. Poll returns events that arrived since
//! the last poll for that worker id.
//!
//! Phase 1 backends:
//!   - "claude_code"     — claude CLI subprocess via claude_sdk
//!   - "kimi_cli_wire"   — kimi --wire subprocess via kimi_wire_sdk
//!
//! "codex_app_server" is recognized but __worker_start returns "" until
//! its V8 bridge lands. local-runtime needs a Backend enum extension and
//! ingest function — handled in a follow-on phase.

const std = @import("std");
const v8 = @import("v8");
const v8rt = @import("v8_runtime.zig");

const worker_contract = @import("worker_contract.zig");
const claude_sdk = @import("claude_sdk/mod.zig");
const kimi_wire_sdk = @import("kimi_wire_sdk.zig");
const local_ai_runtime = @import("local_ai_runtime.zig");
const codex_sdk = @import("codex_sdk.zig");

const Backend = worker_contract.Backend;

// ── Codex session (threaded) ────────────────────────────────────────────
//
// Codex's app-server speaks JSON-RPC over stdio with no non-blocking
// poll path. To stay friendly to the JS event loop, each CodexSession
// owns a background thread that runs turn.next() while `__worker_poll`
// non-blocking-drains the resulting Notifications.

const CodexSession = struct {
    allocator: std.mem.Allocator,
    codex: codex_sdk.Codex,
    thread: codex_sdk.Thread,

    pending: std.ArrayList([]u8) = .{},
    pending_mutex: std.Thread.Mutex = .{},
    pending_signal: std.Thread.ResetEvent = .{},

    inbox: std.ArrayList(codex_sdk.Notification) = .{},
    inbox_mutex: std.Thread.Mutex = .{},

    worker: ?std.Thread = null,
    stop: std.atomic.Value(bool) = std.atomic.Value(bool).init(false),

    pub fn destroy(self: *CodexSession) void {
        self.stop.store(true, .seq_cst);
        self.pending_signal.set();
        if (self.worker) |t| {
            t.join();
            self.worker = null;
        }

        self.pending_mutex.lock();
        for (self.pending.items) |item| self.allocator.free(item);
        self.pending.deinit(self.allocator);
        self.pending_mutex.unlock();

        self.inbox_mutex.lock();
        for (self.inbox.items) |*notification| notification.deinit();
        self.inbox.deinit(self.allocator);
        self.inbox_mutex.unlock();

        self.thread.deinit();
        self.codex.deinit();
        const allocator = self.allocator;
        allocator.destroy(self);
    }

    pub fn enqueue(self: *CodexSession, text: []const u8) !void {
        const dup = try self.allocator.dupe(u8, text);
        errdefer self.allocator.free(dup);
        self.pending_mutex.lock();
        defer self.pending_mutex.unlock();
        try self.pending.append(self.allocator, dup);
        self.pending_signal.set();
    }

    pub fn drainInbox(self: *CodexSession) ![]codex_sdk.Notification {
        self.inbox_mutex.lock();
        defer self.inbox_mutex.unlock();
        return self.inbox.toOwnedSlice(self.allocator);
    }

    fn workerEntry(self: *CodexSession) void {
        while (!self.stop.load(.seq_cst)) {
            self.pending_signal.wait();
            self.pending_signal.reset();

            while (!self.stop.load(.seq_cst)) {
                self.pending_mutex.lock();
                const text_opt: ?[]u8 = if (self.pending.items.len > 0)
                    self.pending.orderedRemove(0)
                else
                    null;
                self.pending_mutex.unlock();

                const text = text_opt orelse break;
                defer self.allocator.free(text);

                var handle = self.thread.turn(.{ .text = text }, .{}) catch continue;
                defer handle.deinit();

                while (true) {
                    const maybe = handle.next() catch break;
                    var notif = maybe orelse break;
                    self.inbox_mutex.lock();
                    self.inbox.append(self.allocator, notif) catch {
                        notif.deinit();
                        self.inbox_mutex.unlock();
                        continue;
                    };
                    self.inbox_mutex.unlock();
                    if (handle.completed) break;
                }
            }
        }
    }
};

// ── Per-backend session container ───────────────────────────────────────

const KimiSession = struct {
    inner: kimi_wire_sdk.Session,

    pub fn deinit(self: *KimiSession) void {
        self.inner.close() catch {};
        self.inner.deinit();
    }
};

const BackendSession = union(Backend) {
    claude_code: claude_sdk.Session,
    codex_app_server: *CodexSession,
    kimi_cli_wire: KimiSession,
    local_ai: *local_ai_runtime.Session,

    pub fn deinit(self: *BackendSession) void {
        switch (self.*) {
            .claude_code => {
                self.claude_code.close() catch {};
                self.claude_code.deinit();
            },
            .codex_app_server => self.codex_app_server.destroy(),
            .kimi_cli_wire => self.kimi_cli_wire.deinit(),
            .local_ai => {
                self.local_ai.close();
                self.local_ai.destroy();
            },
        }
    }
};

// ── Worker registry ─────────────────────────────────────────────────────

const WorkerEntry = struct {
    id: []u8,
    backend: Backend,
    store: worker_contract.WorkerStore,
    session: BackendSession,
    last_emitted_event_id: u64 = 0,

    pub fn destroy(self: *WorkerEntry, allocator: std.mem.Allocator) void {
        self.session.deinit();
        self.store.deinit();
        allocator.free(self.id);
        allocator.destroy(self);
    }
};

var g_workers: ?std.StringHashMap(*WorkerEntry) = null;
var g_worker_seq: u64 = 0;

fn registry() *std.StringHashMap(*WorkerEntry) {
    if (g_workers == null) {
        g_workers = std.StringHashMap(*WorkerEntry).init(std.heap.c_allocator);
    }
    return &g_workers.?;
}

fn lookup(id: []const u8) ?*WorkerEntry {
    if (g_workers == null) return null;
    return g_workers.?.get(id);
}

// ── Backend name dispatch ───────────────────────────────────────────────

fn parseBackend(name: []const u8) ?Backend {
    if (std.mem.eql(u8, name, "claude_code")) return .claude_code;
    if (std.mem.eql(u8, name, "codex_app_server")) return .codex_app_server;
    if (std.mem.eql(u8, name, "kimi_cli_wire")) return .kimi_cli_wire;
    if (std.mem.eql(u8, name, "local_ai")) return .local_ai;
    return null;
}

fn backendName(b: Backend) []const u8 {
    return switch (b) {
        .claude_code => "claude_code",
        .codex_app_server => "codex_app_server",
        .kimi_cli_wire => "kimi_cli_wire",
        .local_ai => "local_ai",
    };
}

// ── Tiny V8 helpers (mirrors v8_bindings_sdk.zig) ───────────────────────

fn callbackCtx(info: v8.FunctionCallbackInfo) struct { iso: v8.Isolate, ctx: v8.Context } {
    const iso = info.getIsolate();
    return .{ .iso = iso, .ctx = iso.getCurrentContext() };
}

fn setReturnUndefined(info: v8.FunctionCallbackInfo, iso: v8.Isolate) void {
    info.getReturnValue().set(v8.initUndefined(iso));
}

fn setReturnBool(info: v8.FunctionCallbackInfo, iso: v8.Isolate, val: bool) void {
    info.getReturnValue().set(v8.Boolean.init(iso, val));
}

fn setReturnString(info: v8.FunctionCallbackInfo, iso: v8.Isolate, text: []const u8) void {
    info.getReturnValue().set(v8.String.initUtf8(iso, text));
}

fn jsStringArg(alloc: std.mem.Allocator, info: v8.FunctionCallbackInfo, idx: u32) ?[]u8 {
    if (idx >= info.length()) return null;
    const cx = callbackCtx(info);
    const s = info.getArg(idx).toString(cx.ctx) catch return null;
    const len = s.lenUtf8(cx.iso);
    const buf = alloc.alloc(u8, len) catch return null;
    _ = s.writeUtf8(cx.iso, buf);
    return buf;
}

fn setStrProp(iso: v8.Isolate, ctx: v8.Context, obj: v8.Object, key: []const u8, val: []const u8) void {
    _ = obj.setValue(ctx, v8.String.initUtf8(iso, key), v8.String.initUtf8(iso, val));
}

fn setNumProp(iso: v8.Isolate, ctx: v8.Context, obj: v8.Object, key: []const u8, val: f64) void {
    _ = obj.setValue(ctx, v8.String.initUtf8(iso, key), v8.Number.init(iso, val));
}

fn setIntProp(iso: v8.Isolate, ctx: v8.Context, obj: v8.Object, key: []const u8, val: i64) void {
    setNumProp(iso, ctx, obj, key, @floatFromInt(val));
}

// ── opts_json helpers ───────────────────────────────────────────────────

fn jsonStrField(value: std.json.Value, key: []const u8) ?[]const u8 {
    const obj = switch (value) {
        .object => |o| o,
        else => return null,
    };
    const v = obj.get(key) orelse return null;
    return switch (v) {
        .string => |s| if (s.len > 0) s else null,
        else => null,
    };
}

fn jsonBoolField(value: std.json.Value, key: []const u8) ?bool {
    const obj = switch (value) {
        .object => |o| o,
        else => return null,
    };
    const v = obj.get(key) orelse return null;
    return switch (v) {
        .bool => |b| b,
        else => null,
    };
}

fn jsonIntField(value: std.json.Value, key: []const u8) ?i64 {
    const obj = switch (value) {
        .object => |o| o,
        else => return null,
    };
    const v = obj.get(key) orelse return null;
    return switch (v) {
        .integer => |i| i,
        else => null,
    };
}

// ── WorkerEvent → JS object ─────────────────────────────────────────────

fn workerEventToJs(iso: v8.Isolate, ctx: v8.Context, ev: *const worker_contract.WorkerEvent) v8.Object {
    const obj = v8.Object.init(iso);
    setIntProp(iso, ctx, obj, "id", @intCast(ev.id));
    setStrProp(iso, ctx, obj, "worker_id", ev.worker_id);
    setStrProp(iso, ctx, obj, "session_id", ev.session_id);
    setStrProp(iso, ctx, obj, "backend", backendName(ev.backend));
    setStrProp(iso, ctx, obj, "kind", @tagName(ev.kind));
    if (ev.role) |r| setStrProp(iso, ctx, obj, "role", @tagName(r));
    if (ev.model) |v| setStrProp(iso, ctx, obj, "model", v);
    if (ev.phase) |v| setStrProp(iso, ctx, obj, "phase", v);
    if (ev.text) |v| setStrProp(iso, ctx, obj, "text", v);
    if (ev.payload_json) |v| setStrProp(iso, ctx, obj, "payload_json", v);
    if (ev.turn_id) |v| setStrProp(iso, ctx, obj, "turn_id", v);
    if (ev.thread_id) |v| setStrProp(iso, ctx, obj, "thread_id", v);
    if (ev.external_session_id) |v| setStrProp(iso, ctx, obj, "external_session_id", v);
    if (ev.status_text) |v| setStrProp(iso, ctx, obj, "status_text", v);
    if (ev.cost_usd_delta != 0) setNumProp(iso, ctx, obj, "cost_usd_delta", ev.cost_usd_delta);
    setIntProp(iso, ctx, obj, "created_at_ms", ev.created_at_ms);

    const u = ev.usage_delta;
    if (u.input_tokens > 0 or u.output_tokens > 0 or u.cache_creation_input_tokens > 0 or u.cache_read_input_tokens > 0) {
        const usage = v8.Object.init(iso);
        setIntProp(iso, ctx, usage, "input_tokens", @intCast(u.input_tokens));
        setIntProp(iso, ctx, usage, "output_tokens", @intCast(u.output_tokens));
        setIntProp(iso, ctx, usage, "cache_creation_input_tokens", @intCast(u.cache_creation_input_tokens));
        setIntProp(iso, ctx, usage, "cache_read_input_tokens", @intCast(u.cache_read_input_tokens));
        _ = obj.setValue(ctx, v8.String.initUtf8(iso, "usage"), usage.toValue());
    }
    return obj;
}

// ── Host fn: __worker_start ─────────────────────────────────────────────

fn hostWorkerStart(info_c: ?*const v8.c.FunctionCallbackInfo) callconv(.c) void {
    const info = v8.FunctionCallbackInfo.initFromV8(info_c);
    const cx = callbackCtx(info);
    if (info.length() < 2) return setReturnString(info, cx.iso, "");

    const backend_name_arg = jsStringArg(std.heap.page_allocator, info, 0) orelse return setReturnString(info, cx.iso, "");
    defer std.heap.page_allocator.free(backend_name_arg);
    const opts_json = jsStringArg(std.heap.page_allocator, info, 1) orelse return setReturnString(info, cx.iso, "");
    defer std.heap.page_allocator.free(opts_json);

    const backend = parseBackend(backend_name_arg) orelse return setReturnString(info, cx.iso, "");

    var arena = std.heap.ArenaAllocator.init(std.heap.page_allocator);
    defer arena.deinit();
    const parsed = std.json.parseFromSlice(std.json.Value, arena.allocator(), opts_json, .{}) catch
        return setReturnString(info, cx.iso, "");

    const cwd_opt = jsonStrField(parsed.value, "cwd");
    const model = jsonStrField(parsed.value, "model");

    var session: BackendSession = switch (backend) {
        .claude_code => blk: {
            const cwd = cwd_opt orelse return setReturnString(info, cx.iso, "");
            const opts = claude_sdk.SessionOptions{
                .cwd = cwd,
                .model = model,
                .resume_session = jsonStrField(parsed.value, "resume_session"),
                .config_dir = jsonStrField(parsed.value, "config_dir"),
                .verbose = true,
                .permission_mode = .bypass_permissions,
                .inherit_stderr = true,
            };
            const sess = claude_sdk.Session.init(std.heap.c_allocator, opts) catch
                return setReturnString(info, cx.iso, "");
            break :blk .{ .claude_code = sess };
        },
        .kimi_cli_wire => blk: {
            const cwd = cwd_opt orelse return setReturnString(info, cx.iso, "");
            const k_opts = kimi_wire_sdk.SessionOptions{
                .cwd = cwd,
                .model = model,
                .session_id = jsonStrField(parsed.value, "session_id"),
                .yolo = jsonBoolField(parsed.value, "yolo") orelse true,
                .inherit_stderr = true,
            };
            var sess = kimi_wire_sdk.Session.init(std.heap.c_allocator, k_opts) catch
                return setReturnString(info, cx.iso, "");
            var init_result = sess.initialize(.{}) catch {
                sess.deinit();
                return setReturnString(info, cx.iso, "");
            };
            init_result.deinit();
            break :blk .{ .kimi_cli_wire = .{ .inner = sess } };
        },
        .codex_app_server => blk: {
            const cs = std.heap.c_allocator.create(CodexSession) catch
                return setReturnString(info, cx.iso, "");
            cs.* = .{
                .allocator = std.heap.c_allocator,
                .codex = codex_sdk.Codex.init(std.heap.c_allocator, .{ .cwd = cwd_opt }) catch {
                    std.heap.c_allocator.destroy(cs);
                    return setReturnString(info, cx.iso, "");
                },
                .thread = undefined,
            };
            cs.thread = cs.codex.threadStart(.{
                .cwd = cwd_opt,
                .model = model,
            }) catch {
                cs.codex.deinit();
                std.heap.c_allocator.destroy(cs);
                return setReturnString(info, cx.iso, "");
            };
            cs.worker = std.Thread.spawn(.{}, CodexSession.workerEntry, .{cs}) catch {
                cs.thread.deinit();
                cs.codex.deinit();
                std.heap.c_allocator.destroy(cs);
                return setReturnString(info, cx.iso, "");
            };
            break :blk .{ .codex_app_server = cs };
        },
        .local_ai => blk: {
            const model_path = jsonStrField(parsed.value, "model_path") orelse return setReturnString(info, cx.iso, "");
            const n_ctx_raw = jsonIntField(parsed.value, "n_ctx") orelse 2048;
            const n_ctx: u32 = if (n_ctx_raw > 0) @intCast(n_ctx_raw) else 2048;
            const opts = local_ai_runtime.SessionOptions{
                .cwd = cwd_opt,
                .model_path = model_path,
                .session_id = jsonStrField(parsed.value, "session_id"),
                .n_ctx = n_ctx,
                .verbose = false,
            };
            const sess = local_ai_runtime.Session.create(std.heap.c_allocator, opts) catch
                return setReturnString(info, cx.iso, "");
            break :blk .{ .local_ai = sess };
        },
    };

    const allocator = std.heap.c_allocator;
    g_worker_seq += 1;
    const id = std.fmt.allocPrint(allocator, "worker_{d}", .{g_worker_seq}) catch {
        session.deinit();
        return setReturnString(info, cx.iso, "");
    };

    var store = worker_contract.WorkerStore.init(allocator, .{ .worker_id = id }) catch {
        allocator.free(id);
        session.deinit();
        return setReturnString(info, cx.iso, "");
    };

    _ = store.beginSession(.{
        .backend = backend,
        .model = model,
        .reason_started = "worker started via __worker_start",
    }) catch {
        store.deinit();
        allocator.free(id);
        session.deinit();
        return setReturnString(info, cx.iso, "");
    };

    const entry = allocator.create(WorkerEntry) catch {
        store.deinit();
        allocator.free(id);
        session.deinit();
        return setReturnString(info, cx.iso, "");
    };
    entry.* = .{
        .id = id,
        .backend = backend,
        .store = store,
        .session = session,
    };

    registry().put(id, entry) catch {
        entry.destroy(allocator);
        return setReturnString(info, cx.iso, "");
    };

    setReturnString(info, cx.iso, id);
}

// ── Host fn: __worker_send ──────────────────────────────────────────────

fn hostWorkerSend(info_c: ?*const v8.c.FunctionCallbackInfo) callconv(.c) void {
    const info = v8.FunctionCallbackInfo.initFromV8(info_c);
    const cx = callbackCtx(info);
    if (info.length() < 2) return setReturnBool(info, cx.iso, false);

    const id = jsStringArg(std.heap.page_allocator, info, 0) orelse return setReturnBool(info, cx.iso, false);
    defer std.heap.page_allocator.free(id);
    const text = jsStringArg(std.heap.page_allocator, info, 1) orelse return setReturnBool(info, cx.iso, false);
    defer std.heap.page_allocator.free(text);

    const entry = lookup(id) orelse return setReturnBool(info, cx.iso, false);

    switch (entry.session) {
        .claude_code => {
            entry.session.claude_code.send(text) catch return setReturnBool(info, cx.iso, false);
        },
        .kimi_cli_wire => {
            var token = entry.session.kimi_cli_wire.inner.prompt(.{ .text = text }) catch
                return setReturnBool(info, cx.iso, false);
            token.deinit();
        },
        .local_ai => {
            entry.session.local_ai.submit(.{ .text = text }) catch return setReturnBool(info, cx.iso, false);
        },
        .codex_app_server => {
            entry.session.codex_app_server.enqueue(text) catch return setReturnBool(info, cx.iso, false);
        },
    }
    setReturnBool(info, cx.iso, true);
}

// ── Host fn: __worker_poll ──────────────────────────────────────────────

fn hostWorkerPoll(info_c: ?*const v8.c.FunctionCallbackInfo) callconv(.c) void {
    const info = v8.FunctionCallbackInfo.initFromV8(info_c);
    const cx = callbackCtx(info);
    if (info.length() < 1) return setReturnUndefined(info, cx.iso);

    const id = jsStringArg(std.heap.page_allocator, info, 0) orelse return setReturnUndefined(info, cx.iso);
    defer std.heap.page_allocator.free(id);

    const entry = lookup(id) orelse return setReturnUndefined(info, cx.iso);

    // Drain inbound from the SDK Session into the WorkerStore. Bounded
    // per call to keep latency predictable; subsequent polls drain more.
    var pulled: usize = 0;
    while (pulled < 32) : (pulled += 1) {
        switch (entry.session) {
            .claude_code => {
                var owned = (entry.session.claude_code.poll() catch break) orelse break;
                defer owned.deinit();
                entry.store.ingestClaudeMessage(owned.msg) catch {};
            },
            .kimi_cli_wire => {
                var owned = (entry.session.kimi_cli_wire.inner.poll() catch break) orelse break;
                defer owned.deinit();
                entry.store.ingestKimiWireMessage(&owned.msg) catch {};
            },
            .local_ai => {
                var owned = entry.session.local_ai.poll() orelse break;
                defer owned.deinit();
                entry.store.ingestLocalAiEvent(&owned) catch {};
            },
            .codex_app_server => {
                const drained = entry.session.codex_app_server.drainInbox() catch break;
                defer std.heap.c_allocator.free(drained);
                if (drained.len == 0) break;
                for (drained) |notification| {
                    var n = notification;
                    entry.store.ingestCodexNotification(&n) catch {};
                    n.deinit();
                }
            },
        }
    }

    const events = entry.store.events.items;
    var first: usize = events.len;
    for (events, 0..) |ev, i| {
        if (ev.id > entry.last_emitted_event_id) {
            first = i;
            break;
        }
    }

    const new_count: u32 = if (first < events.len) @intCast(events.len - first) else 0;
    const arr = v8.Array.init(cx.iso, new_count);
    if (new_count > 0) {
        var out_idx: u32 = 0;
        var i = first;
        while (i < events.len) : (i += 1) {
            const obj = workerEventToJs(cx.iso, cx.ctx, &events[i]);
            _ = arr.castTo(v8.Object).setValueAtIndex(cx.ctx, out_idx, obj.toValue());
            out_idx += 1;
            entry.last_emitted_event_id = events[i].id;
        }
    }
    info.getReturnValue().set(arr.castTo(v8.Object).toValue());
}

// ── Host fn: __worker_respond ───────────────────────────────────────────
//
// Phase 1 stub. The cart-side `respond(requestId, payload)` path exists
// in the API surface, but the per-backend reply dispatch (Kimi
// approval/tool/question/hook, Codex approvals_reviewer) is wired up
// when those backends graduate from the legacy bindings.

fn hostWorkerRespond(info_c: ?*const v8.c.FunctionCallbackInfo) callconv(.c) void {
    const info = v8.FunctionCallbackInfo.initFromV8(info_c);
    const cx = callbackCtx(info);
    if (info.length() < 3) return setReturnBool(info, cx.iso, false);

    const id = jsStringArg(std.heap.page_allocator, info, 0) orelse return setReturnBool(info, cx.iso, false);
    defer std.heap.page_allocator.free(id);
    const request_id = jsStringArg(std.heap.page_allocator, info, 1) orelse return setReturnBool(info, cx.iso, false);
    defer std.heap.page_allocator.free(request_id);
    const payload = jsStringArg(std.heap.page_allocator, info, 2) orelse return setReturnBool(info, cx.iso, false);
    defer std.heap.page_allocator.free(payload);

    _ = lookup(id) orelse return setReturnBool(info, cx.iso, false);
    setReturnBool(info, cx.iso, false);
}

// ── Host fn: __worker_close ─────────────────────────────────────────────

fn hostWorkerClose(info_c: ?*const v8.c.FunctionCallbackInfo) callconv(.c) void {
    const info = v8.FunctionCallbackInfo.initFromV8(info_c);
    const cx = callbackCtx(info);
    if (info.length() < 1) return setReturnUndefined(info, cx.iso);

    const id = jsStringArg(std.heap.page_allocator, info, 0) orelse return setReturnUndefined(info, cx.iso);
    defer std.heap.page_allocator.free(id);

    const entry = lookup(id) orelse return setReturnUndefined(info, cx.iso);

    entry.store.endActiveSession(.ended, "worker closed via __worker_close") catch {};

    if (g_workers) |*map| {
        _ = map.remove(id);
    }
    entry.destroy(std.heap.c_allocator);

    setReturnUndefined(info, cx.iso);
}

// ── Registration ────────────────────────────────────────────────────────

pub fn register() void {
    v8rt.registerHostFn("__worker_start", hostWorkerStart);
    v8rt.registerHostFn("__worker_send", hostWorkerSend);
    v8rt.registerHostFn("__worker_poll", hostWorkerPoll);
    v8rt.registerHostFn("__worker_respond", hostWorkerRespond);
    v8rt.registerHostFn("__worker_close", hostWorkerClose);
}
