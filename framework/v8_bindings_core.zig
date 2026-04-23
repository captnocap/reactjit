const std = @import("std");
const v8 = @import("v8");
const build_options = @import("build_options");

comptime {
    _ = @hasDecl(build_options, "is_lib");
}

const v8_runtime = @import("v8_runtime.zig");
const state = @import("state.zig");
const input = @import("input.zig");
const luajit_runtime = @import("luajit_runtime.zig");
const qjs_runtime = @import("qjs_runtime.zig");
const exec_async = @import("exec_async.zig");
const vterm = @import("vterm.zig");
const c = @import("c.zig").imports;

var g_content_store: std.AutoHashMap(u32, []u8) = undefined;
var g_content_store_inited: bool = false;
var g_content_store_next_id: u32 = 1;
var g_pending_flush: std.ArrayList([]u8) = .{};

fn ensureContentStore() void {
    if (!g_content_store_inited) {
        g_content_store = std.AutoHashMap(u32, []u8).init(std.heap.c_allocator);
        g_content_store_inited = true;
    }
}

fn infoCtx(info: v8.FunctionCallbackInfo) v8.Context {
    return info.getIsolate().getCurrentContext();
}

fn argToStringAlloc(info: v8.FunctionCallbackInfo, idx: u32) ?[]u8 {
    if (idx >= info.length()) return null;
    const iso = info.getIsolate();
    const ctx = infoCtx(info);
    const s = info.getArg(idx).toString(ctx) catch return null;
    const n = s.lenUtf8(iso);
    const buf = std.heap.c_allocator.alloc(u8, n) catch return null;
    _ = s.writeUtf8(iso, buf);
    return buf;
}

fn setReturnString(info: v8.FunctionCallbackInfo, text: []const u8) void {
    const iso = info.getIsolate();
    info.getReturnValue().set(v8.String.initUtf8(iso, text));
}

fn setReturnNumber(info: v8.FunctionCallbackInfo, value: f64) void {
    const iso = info.getIsolate();
    info.getReturnValue().set(v8.Number.init(iso, value));
}

fn newObject(info: v8.FunctionCallbackInfo) v8.Object {
    return v8.Object.init(info.getIsolate());
}

fn objectSetNumber(obj: v8.Object, ctx: v8.Context, key: []const u8, value: f64) void {
    const iso = ctx.getIsolate();
    _ = obj.setValue(ctx, v8.String.initUtf8(iso, key), v8.Number.init(iso, value));
}

fn objectSetString(obj: v8.Object, ctx: v8.Context, key: []const u8, value: []const u8) void {
    const iso = ctx.getIsolate();
    _ = obj.setValue(ctx, v8.String.initUtf8(iso, key), v8.String.initUtf8(iso, value));
}

fn argToI32(info: v8.FunctionCallbackInfo, idx: u32) ?i32 {
    if (idx >= info.length()) return null;
    return info.getArg(idx).toI32(infoCtx(info)) catch return null;
}

fn argToF64(info: v8.FunctionCallbackInfo, idx: u32) ?f64 {
    if (idx >= info.length()) return null;
    return info.getArg(idx).toF64(infoCtx(info)) catch return null;
}

fn hostFlush(info_c: ?*const v8.c.FunctionCallbackInfo) callconv(.c) void {
    const info = v8.FunctionCallbackInfo.initFromV8(info_c);
    if (info.length() < 1) return;
    const payload = argToStringAlloc(info, 0) orelse return;
    defer std.heap.c_allocator.free(payload);

    const owned = std.heap.c_allocator.dupe(u8, payload) catch return;
    g_pending_flush.append(std.heap.c_allocator, owned) catch {
        std.heap.c_allocator.free(owned);
        return;
    };
}

fn hostTerminalSetCwd(info_c: ?*const v8.c.FunctionCallbackInfo) callconv(.c) void {
    const info = v8.FunctionCallbackInfo.initFromV8(info_c);
    const path = argToStringAlloc(info, 0) orelse return;
    defer std.heap.c_allocator.free(path);
    vterm.setSpawnCwd(path);
}

fn hostGetInputTextForNode(info_c: ?*const v8.c.FunctionCallbackInfo) callconv(.c) void {
    const info = v8.FunctionCallbackInfo.initFromV8(info_c);
    if (info.length() < 1) {
        setReturnString(info, "");
        return;
    }
    const node_id = argToI32(info, 0) orelse {
        setReturnString(info, "");
        return;
    };
    if (node_id <= 0) {
        setReturnString(info, "");
        return;
    }
    const text = input.getText(@intCast(@max(0, node_id)));
    if (text.len == 0) {
        setReturnString(info, "");
        return;
    }
    setReturnString(info, text);
}

fn hostLoadFileToBuffer(info_c: ?*const v8.c.FunctionCallbackInfo) callconv(.c) void {
    const info = v8.FunctionCallbackInfo.initFromV8(info_c);
    if (info.length() < 1) {
        setReturnNumber(info, 0);
        return;
    }
    const path = argToStringAlloc(info, 0) orelse {
        setReturnNumber(info, 0);
        return;
    };
    defer std.heap.c_allocator.free(path);
    if (path.len == 0) {
        setReturnNumber(info, 0);
        return;
    }

    ensureContentStore();
    const data = std.fs.cwd().readFileAlloc(std.heap.c_allocator, path, 64 * 1024 * 1024) catch |e| {
        std.log.warn("[content-store] read failed path={s}: {}", .{ path, e });
        setReturnNumber(info, 0);
        return;
    };

    const next_id = g_content_store_next_id;
    g_content_store_next_id = next_id + 1;
    g_content_store.put(next_id, data) catch {
        std.heap.c_allocator.free(data);
        setReturnNumber(info, 0);
        return;
    };
    setReturnNumber(info, @floatFromInt(next_id));
}

fn hostReleaseFileBuffer(info_c: ?*const v8.c.FunctionCallbackInfo) callconv(.c) void {
    const info = v8.FunctionCallbackInfo.initFromV8(info_c);
    if (info.length() < 1) return;
    const id = argToI32(info, 0) orelse return;
    if (id <= 0) return;
    if (!g_content_store_inited) return;
    if (g_content_store.fetchRemove(@intCast(id))) |entry| {
        std.heap.c_allocator.free(entry.value);
    }
}

fn hostLog(info_c: ?*const v8.c.FunctionCallbackInfo) callconv(.c) void {
    const info = v8.FunctionCallbackInfo.initFromV8(info_c);
    if (info.length() < 2) return;
    const msg = argToStringAlloc(info, 1) orelse return;
    defer std.heap.c_allocator.free(msg);
    std.log.info("[JS] {s}", .{msg});
}

fn hostJsEval(info_c: ?*const v8.c.FunctionCallbackInfo) callconv(.c) void {
    const info = v8.FunctionCallbackInfo.initFromV8(info_c);
    if (info.length() < 1) {
        setReturnString(info, "");
        return;
    }
    const code = argToStringAlloc(info, 0) orelse {
        setReturnString(info, "");
        return;
    };
    defer std.heap.c_allocator.free(code);
    var buf: [16384]u8 = undefined;
    const result = v8_runtime.evalToString(code, buf[0..]);
    setReturnString(info, result);
}

fn hostLuaEval(info_c: ?*const v8.c.FunctionCallbackInfo) callconv(.c) void {
    const info = v8.FunctionCallbackInfo.initFromV8(info_c);
    if (info.length() < 1) return;
    const code = argToStringAlloc(info, 0) orelse return;
    defer std.heap.c_allocator.free(code);
    luajit_runtime.evalExpr(code);
}

fn hostSetState(info_c: ?*const v8.c.FunctionCallbackInfo) callconv(.c) void {
    const info = v8.FunctionCallbackInfo.initFromV8(info_c);
    const ctx = infoCtx(info);
    if (info.length() < 2) return;
    const slot_id = argToI32(info, 0) orelse return;
    if (slot_id < 0 or slot_id >= state.MAX_SLOTS) return;
    switch (state.getSlotKind(@intCast(slot_id))) {
        .string => {
            const s = argToStringAlloc(info, 1) orelse return;
            defer std.heap.c_allocator.free(s);
            state.setSlotString(@intCast(slot_id), s);
        },
        .float => {
            const f = argToF64(info, 1) orelse return;
            state.setSlotFloat(@intCast(slot_id), f);
        },
        .boolean => {
            state.setSlotBool(@intCast(slot_id), info.getArg(1).toBool(info.getIsolate()));
        },
        .int => {
            const f = argToF64(info, 1) orelse return;
            state.setSlot(@intCast(slot_id), @intFromFloat(f));
        },
    }
    state.markDirty();
    _ = ctx;
}

fn hostSetStateString(info_c: ?*const v8.c.FunctionCallbackInfo) callconv(.c) void {
    const info = v8.FunctionCallbackInfo.initFromV8(info_c);
    if (info.length() < 2) return;
    const slot_id = argToI32(info, 0) orelse return;
    if (slot_id < 0 or slot_id >= state.MAX_SLOTS) return;
    const s = argToStringAlloc(info, 1) orelse return;
    defer std.heap.c_allocator.free(s);
    state.setSlotString(@intCast(slot_id), s);
    state.markDirty();
}

fn hostGetState(info_c: ?*const v8.c.FunctionCallbackInfo) callconv(.c) void {
    const info = v8.FunctionCallbackInfo.initFromV8(info_c);
    if (info.length() < 1) {
        setReturnNumber(info, 0);
        return;
    }
    const slot_id = argToI32(info, 0) orelse {
        setReturnNumber(info, 0);
        return;
    };
    if (slot_id < 0 or slot_id >= state.MAX_SLOTS) {
        setReturnNumber(info, 0);
        return;
    }
    switch (state.getSlotKind(@intCast(slot_id))) {
        .float => setReturnNumber(info, state.getSlotFloat(@intCast(slot_id))),
        .boolean => setReturnNumber(info, if (state.getSlotBool(@intCast(slot_id))) 1 else 0),
        .int => setReturnNumber(info, @floatFromInt(state.getSlot(@intCast(slot_id)))),
        .string => setReturnNumber(info, 0),
    }
}

fn hostGetStateString(info_c: ?*const v8.c.FunctionCallbackInfo) callconv(.c) void {
    const info = v8.FunctionCallbackInfo.initFromV8(info_c);
    if (info.length() < 1) {
        setReturnString(info, "");
        return;
    }
    const slot_id = argToI32(info, 0) orelse {
        setReturnString(info, "");
        return;
    };
    if (slot_id < 0 or slot_id >= state.MAX_SLOTS) {
        setReturnString(info, "");
        return;
    }
    setReturnString(info, state.getSlotString(@intCast(slot_id)));
}

fn hostMarkDirty(info_c: ?*const v8.c.FunctionCallbackInfo) callconv(.c) void {
    _ = info_c;
    state.markDirty();
}

fn hostGetMouseX(info_c: ?*const v8.c.FunctionCallbackInfo) callconv(.c) void {
    const info = v8.FunctionCallbackInfo.initFromV8(info_c);
    setReturnNumber(info, @floatCast(@field(qjs_runtime, "g_mouse_x")));
}

fn hostGetMouseY(info_c: ?*const v8.c.FunctionCallbackInfo) callconv(.c) void {
    const info = v8.FunctionCallbackInfo.initFromV8(info_c);
    setReturnNumber(info, @floatCast(@field(qjs_runtime, "g_mouse_y")));
}

fn hostGetMouseDown(info_c: ?*const v8.c.FunctionCallbackInfo) callconv(.c) void {
    const info = v8.FunctionCallbackInfo.initFromV8(info_c);
    setReturnNumber(info, if (@field(qjs_runtime, "g_mouse_down")) 1 else 0);
}

fn hostGetMouseRightDown(info_c: ?*const v8.c.FunctionCallbackInfo) callconv(.c) void {
    const info = v8.FunctionCallbackInfo.initFromV8(info_c);
    setReturnNumber(info, if (@field(qjs_runtime, "g_mouse_right_down")) 1 else 0);
}

fn hostIsKeyDown(info_c: ?*const v8.c.FunctionCallbackInfo) callconv(.c) void {
    const info = v8.FunctionCallbackInfo.initFromV8(info_c);
    if (info.length() < 1) {
        setReturnNumber(info, 0);
        return;
    }
    const scancode = argToI32(info, 0) orelse {
        setReturnNumber(info, 0);
        return;
    };
    const keys = c.SDL_GetKeyboardState(null);
    if (keys == null) {
        setReturnNumber(info, 0);
        return;
    }
    const pressed = keys[@intCast(scancode)];
    setReturnNumber(info, if (pressed) 1 else 0);
}

fn hostClipboardSet(info_c: ?*const v8.c.FunctionCallbackInfo) callconv(.c) void {
    const info = v8.FunctionCallbackInfo.initFromV8(info_c);
    if (info.length() < 1) return;
    const s = argToStringAlloc(info, 0) orelse return;
    defer std.heap.c_allocator.free(s);
    const z = std.heap.c_allocator.alloc(u8, s.len + 1) catch return;
    defer std.heap.c_allocator.free(z);
    @memcpy(z[0..s.len], s);
    z[s.len] = 0;
    _ = c.SDL_SetClipboardText(z.ptr);
}

fn hostClipboardGet(info_c: ?*const v8.c.FunctionCallbackInfo) callconv(.c) void {
    const info = v8.FunctionCallbackInfo.initFromV8(info_c);
    const clip = c.SDL_GetClipboardText();
    if (clip == null) {
        setReturnString(info, "");
        return;
    }
    defer c.SDL_free(@ptrCast(clip));
    setReturnString(info, std.mem.span(clip));
}

fn hostPollInputSubmit(info_c: ?*const v8.c.FunctionCallbackInfo) callconv(.c) void {
    const info = v8.FunctionCallbackInfo.initFromV8(info_c);
    const evt = input.consumeLastSubmit() orelse return;
    const ctx = infoCtx(info);
    const obj = newObject(info);
    objectSetNumber(obj, ctx, "id", @floatFromInt(evt.id));
    objectSetString(obj, ctx, "text", evt.text);
    info.getReturnValue().set(obj);
}

fn hostGetPreparedRightClick(info_c: ?*const v8.c.FunctionCallbackInfo) callconv(.c) void {
    const info = v8.FunctionCallbackInfo.initFromV8(info_c);
    const ctx = infoCtx(info);
    const obj = newObject(info);
    objectSetNumber(obj, ctx, "x", @floatCast(@field(qjs_runtime, "g_prepared_mouse_x")));
    objectSetNumber(obj, ctx, "y", @floatCast(@field(qjs_runtime, "g_prepared_mouse_y")));
    info.getReturnValue().set(obj);
}

fn hostGetPreparedScroll(info_c: ?*const v8.c.FunctionCallbackInfo) callconv(.c) void {
    const info = v8.FunctionCallbackInfo.initFromV8(info_c);
    const ctx = infoCtx(info);
    const obj = newObject(info);
    objectSetNumber(obj, ctx, "scrollX", @floatCast(@field(qjs_runtime, "g_prepared_scroll_x")));
    objectSetNumber(obj, ctx, "scrollY", @floatCast(@field(qjs_runtime, "g_prepared_scroll_y")));
    objectSetNumber(obj, ctx, "deltaX", @floatCast(@field(qjs_runtime, "g_prepared_scroll_dx")));
    objectSetNumber(obj, ctx, "deltaY", @floatCast(@field(qjs_runtime, "g_prepared_scroll_dy")));
    info.getReturnValue().set(obj);
}

// Async exec — __exec_async(cmd, rid). Spawns a detached thread that runs the
// command via popen; result is drained by execTickDrain() and delivered to JS
// via __ffiEmit('exec:<rid>', JSON.stringify({stdout, code})).
fn hostExecAsync(info_c: ?*const v8.c.FunctionCallbackInfo) callconv(.c) void {
    const info = v8.FunctionCallbackInfo.initFromV8(info_c);
    if (info.length() < 2) return;
    const cmd = argToStringAlloc(info, 0) orelse return;
    defer std.heap.c_allocator.free(cmd);
    const rid = argToStringAlloc(info, 1) orelse return;
    defer std.heap.c_allocator.free(rid);
    exec_async.spawn(rid, cmd);
}

fn emitExecResult(rid: []const u8, stdout: []const u8, code: i32) void {
    // Build JSON payload. Only escape the couple of chars we need for stdout;
    // stdout can be arbitrary text with quotes/newlines/backslashes.
    var buf: std.ArrayList(u8) = .{};
    defer buf.deinit(std.heap.c_allocator);
    const w = buf.writer(std.heap.c_allocator);
    w.print("{{\"code\":{d},\"stdout\":\"", .{code}) catch return;
    for (stdout) |ch| {
        switch (ch) {
            '"' => w.writeAll("\\\"") catch return,
            '\\' => w.writeAll("\\\\") catch return,
            '\n' => w.writeAll("\\n") catch return,
            '\r' => w.writeAll("\\r") catch return,
            '\t' => w.writeAll("\\t") catch return,
            0...8, 11, 12, 14...31 => w.print("\\u{x:0>4}", .{ch}) catch return,
            else => w.writeByte(ch) catch return,
        }
    }
    w.writeAll("\"}") catch return;
    const payload = buf.items;

    // Build channel string "exec:<rid>" nul-terminated for callGlobal2Str.
    var chan: std.ArrayList(u8) = .{};
    defer chan.deinit(std.heap.c_allocator);
    chan.appendSlice(std.heap.c_allocator, "exec:") catch return;
    chan.appendSlice(std.heap.c_allocator, rid) catch return;
    chan.append(std.heap.c_allocator, 0) catch return;
    const chan_z = chan.items[0 .. chan.items.len - 1 :0];

    var payload_arr: std.ArrayList(u8) = .{};
    defer payload_arr.deinit(std.heap.c_allocator);
    payload_arr.appendSlice(std.heap.c_allocator, payload) catch return;
    payload_arr.append(std.heap.c_allocator, 0) catch return;
    const payload_z = payload_arr.items[0 .. payload_arr.items.len - 1 :0];

    v8_runtime.callGlobal2Str("__ffiEmit", chan_z, payload_z);
}

pub fn execTickDrain() void {
    exec_async.drain(emitExecResult);
}

pub const DrainCallback = *const fn (bytes: []const u8) void;

pub fn drainPendingFlushes(apply: DrainCallback) void {
    if (g_pending_flush.items.len == 0) return;
    const batches = g_pending_flush.toOwnedSlice(std.heap.c_allocator) catch return;
    defer {
        for (batches) |b| std.heap.c_allocator.free(b);
        std.heap.c_allocator.free(batches);
    }
    for (batches) |b| apply(b);
}

pub fn contentStoreGet(id: u32) ?[]const u8 {
    if (!g_content_store_inited) return null;
    return g_content_store.get(id);
}

pub fn registerCore(vm: anytype) void {
    _ = vm;
    ensureContentStore();
    v8_runtime.registerHostFn("__hostFlush", hostFlush);
    v8_runtime.registerHostFn("__getInputTextForNode", hostGetInputTextForNode);
    v8_runtime.registerHostFn("__hostLoadFileToBuffer", hostLoadFileToBuffer);
    v8_runtime.registerHostFn("__hostReleaseFileBuffer", hostReleaseFileBuffer);
    v8_runtime.registerHostFn("__hostLog", hostLog);
    v8_runtime.registerHostFn("__js_eval", hostJsEval);
    v8_runtime.registerHostFn("__luaEval", hostLuaEval);
    v8_runtime.registerHostFn("__setState", hostSetState);
    v8_runtime.registerHostFn("__setStateString", hostSetStateString);
    v8_runtime.registerHostFn("__getState", hostGetState);
    v8_runtime.registerHostFn("__getStateString", hostGetStateString);
    v8_runtime.registerHostFn("__markDirty", hostMarkDirty);
    v8_runtime.registerHostFn("getMouseX", hostGetMouseX);
    v8_runtime.registerHostFn("getMouseY", hostGetMouseY);
    v8_runtime.registerHostFn("getMouseDown", hostGetMouseDown);
    v8_runtime.registerHostFn("getMouseRightDown", hostGetMouseRightDown);
    v8_runtime.registerHostFn("isKeyDown", hostIsKeyDown);
    v8_runtime.registerHostFn("getInputText", hostGetInputText);
    v8_runtime.registerHostFn("__setInputText", hostSetInputText);
    v8_runtime.registerHostFn("__pollInputSubmit", hostPollInputSubmit);
    v8_runtime.registerHostFn("__getPreparedRightClick", hostGetPreparedRightClick);
    v8_runtime.registerHostFn("__getPreparedScroll", hostGetPreparedScroll);
    v8_runtime.registerHostFn("__clipboard_set", hostClipboardSet);
    v8_runtime.registerHostFn("__clipboard_get", hostClipboardGet);
    v8_runtime.registerHostFn("__exec_async", hostExecAsync);
    v8_runtime.registerHostFn("__terminal_set_cwd", hostTerminalSetCwd);
}

fn hostGetInputText(info_c: ?*const v8.c.FunctionCallbackInfo) callconv(.c) void {
    const info = v8.FunctionCallbackInfo.initFromV8(info_c);
    if (info.length() < 1) {
        setReturnString(info, "");
        return;
    }
    const id = argToI32(info, 0) orelse {
        setReturnString(info, "");
        return;
    };
    const text = input.getText(@intCast(@max(0, id)));
    setReturnString(info, text);
}

fn hostSetInputText(info_c: ?*const v8.c.FunctionCallbackInfo) callconv(.c) void {
    const info = v8.FunctionCallbackInfo.initFromV8(info_c);
    if (info.length() < 2) return;
    const id = argToI32(info, 0) orelse return;
    if (id < 0) {
        input.setText(0, "");
        return;
    }
    const s = argToStringAlloc(info, 1) orelse {
        input.setText(@intCast(id), "");
        return;
    };
    defer std.heap.c_allocator.free(s);
    input.setText(@intCast(id), s);
}
