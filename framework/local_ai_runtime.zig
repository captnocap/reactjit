//! Local AI runtime — subprocess-based llama.cpp inference service.
//!
//! Architecture (post-rewrite):
//!   - Each Session spawns one `rjit-llm-worker` child process (built
//!     from framework/ffi/llm_worker.cpp against the bundled libllama).
//!   - The worker owns its own VkInstance for ggml-vulkan inference,
//!     so renderer wgpu/Vulkan never fights with llama's compute path.
//!   - We talk to it over stdin/stdout in a tiny line-delimited
//!     protocol (LOAD/CHAT/READY/TOK/DONE/ERR — see llm_worker.cpp).
//!   - The Session's worker thread translates between the host-side
//!     request queue / event ring and the subprocess pipes.
//!
//! Public API is identical to the previous in-process version
//! (SessionOptions, SubmitOptions, EventKind, OwnedEvent, Session)
//! so v8_bindings_sdk + qjs_runtime + the JS hook (useLocalChat)
//! work unchanged.
//!
//! Worker binary lookup order:
//!   1. RJIT_LLM_WORKER env var (absolute path) — dev override
//!   2. <exe_dir>/rjit-llm-worker — bundled next to cart binary
//!   3. <exe_dir>/../lib/rjit-llm-worker — self-extracting cart layout
//!   4. zig-out/bin/rjit-llm-worker — repo dev fallback

const std = @import("std");
const RingBuffer = @import("net/ring_buffer.zig").RingBuffer;

pub const SessionOptions = struct {
    cwd: ?[]const u8 = null,
    model_path: []const u8,
    session_id: ?[]const u8 = null,
    system_prompt: ?[]const u8 = null,
    n_ctx: u32 = 2048,
    n_batch: u32 = 512,
    n_ubatch: u32 = 256,
    n_threads: i32 = 4,
    n_threads_batch: i32 = 4,
    n_gpu_layers: i32 = 99,
    max_history_messages: usize = 24,
    verbose: bool = true,
};

pub const TaskKind = enum { chat };

pub const SubmitOptions = struct {
    text: []const u8,
    task: TaskKind = .chat,
    system_prompt: ?[]const u8 = null,
    max_tokens: u32 = 256,
};

pub const EventKind = enum {
    system,
    assistant_part,
    status,
    result,
};

pub const OwnedEvent = struct {
    allocator: std.mem.Allocator = undefined,
    kind: EventKind,
    text: ?[]u8 = null,
    model: ?[]u8 = null,
    session_id: ?[]u8 = null,
    part_type: ?[]const u8 = null,
    is_error: bool = false,

    pub fn deinit(self: *OwnedEvent) void {
        if (self.text) |value| self.allocator.free(value);
        if (self.model) |value| self.allocator.free(value);
        if (self.session_id) |value| self.allocator.free(value);
    }
};

const Request = struct {
    text: []u8,
    task: TaskKind,
    system_prompt: ?[]u8,
    max_tokens: u32,

    fn deinit(self: *Request, allocator: std.mem.Allocator) void {
        allocator.free(self.text);
        if (self.system_prompt) |value| allocator.free(value);
    }
};

pub const Session = struct {
    allocator: std.mem.Allocator,
    options: SessionOptions,
    requests: RingBuffer(Request, 32) = .{},
    events: RingBuffer(OwnedEvent, 1024) = .{},
    worker: ?std.Thread = null,
    should_stop: std.atomic.Value(bool) = std.atomic.Value(bool).init(false),

    pub fn create(allocator: std.mem.Allocator, options: SessionOptions) !*Session {
        const session = try allocator.create(Session);
        errdefer allocator.destroy(session);

        session.* = .{
            .allocator = allocator,
            .options = .{
                .cwd = if (options.cwd) |value| try allocator.dupe(u8, value) else null,
                .model_path = try allocator.dupe(u8, options.model_path),
                .session_id = if (options.session_id) |value| try allocator.dupe(u8, value) else null,
                .system_prompt = if (options.system_prompt) |value| try allocator.dupe(u8, value) else null,
                .n_ctx = options.n_ctx,
                .n_batch = options.n_batch,
                .n_ubatch = options.n_ubatch,
                .n_threads = options.n_threads,
                .n_threads_batch = options.n_threads_batch,
                .n_gpu_layers = options.n_gpu_layers,
                .max_history_messages = options.max_history_messages,
                .verbose = options.verbose,
            },
        };
        errdefer session.deinitInternal();

        session.worker = try std.Thread.spawn(.{ .stack_size = 4 * 1024 * 1024 }, workerMain, .{session});
        return session;
    }

    pub fn destroy(self: *Session) void {
        self.close();
        self.deinitInternal();
        self.allocator.destroy(self);
    }

    pub fn close(self: *Session) void {
        self.should_stop.store(true, .seq_cst);
        if (self.worker) |thread| {
            thread.join();
            self.worker = null;
        }
    }

    pub fn submit(self: *Session, options: SubmitOptions) !void {
        if (self.should_stop.load(.seq_cst)) return error.SessionClosed;

        var req = Request{
            .text = try self.allocator.dupe(u8, options.text),
            .task = options.task,
            .system_prompt = if (options.system_prompt) |value| try self.allocator.dupe(u8, value) else null,
            .max_tokens = options.max_tokens,
        };
        errdefer req.deinit(self.allocator);

        if (!self.requests.push(req)) return error.QueueFull;
    }

    pub fn poll(self: *Session) ?OwnedEvent {
        return self.events.pop();
    }

    fn pushAssistantPart(self: *Session, text: []const u8) !void {
        try self.pushEvent(.{
            .kind = .assistant_part,
            .text = try self.allocator.dupe(u8, text),
            .part_type = "text",
        });
    }

    fn pushSystem(self: *Session, model: []const u8, session_id: []const u8) !void {
        try self.pushEvent(.{
            .kind = .system,
            .model = try self.allocator.dupe(u8, model),
            .session_id = try self.allocator.dupe(u8, session_id),
        });
    }

    fn pushStatus(self: *Session, text: []const u8, is_error: bool) !void {
        try self.pushEvent(.{
            .kind = .status,
            .text = try self.allocator.dupe(u8, text),
            .is_error = is_error,
        });
    }

    fn pushResult(self: *Session, text: ?[]const u8, is_error: bool) !void {
        try self.pushEvent(.{
            .kind = .result,
            .text = if (text) |value| try self.allocator.dupe(u8, value) else null,
            .is_error = is_error,
        });
    }

    fn pushEvent(self: *Session, event: OwnedEvent) !void {
        var owned = event;
        owned.allocator = self.allocator;
        if (!self.events.push(owned)) {
            owned.deinit();
            return error.EventQueueFull;
        }
    }

    fn deinitInternal(self: *Session) void {
        if (self.options.cwd) |value| self.allocator.free(value);
        self.allocator.free(self.options.model_path);
        if (self.options.session_id) |value| self.allocator.free(value);
        if (self.options.system_prompt) |value| self.allocator.free(value);

        while (self.requests.pop()) |item| {
            var req = item;
            req.deinit(self.allocator);
        }
        while (self.events.pop()) |item| {
            var evt = item;
            evt.deinit();
        }
    }
};

// ── worker binary path resolution ────────────────────────────────────

fn resolveWorkerPathAlloc(allocator: std.mem.Allocator) ![]u8 {
    if (std.process.getEnvVarOwned(allocator, "RJIT_LLM_WORKER")) |p| {
        return p;
    } else |_| {}

    const exe_path = try std.fs.selfExePathAlloc(allocator);
    defer allocator.free(exe_path);
    const exe_dir = std.fs.path.dirname(exe_path) orelse return error.NoExeDir;

    const candidates = [_][]const u8{
        "rjit-llm-worker",
        "../lib/rjit-llm-worker",
    };

    for (candidates) |rel| {
        const path = try std.fs.path.join(allocator, &.{ exe_dir, rel });
        if (std.fs.cwd().access(path, .{})) |_| return path else |_| allocator.free(path);
    }

    // Repo dev fallback.
    const dev_path = "/home/siah/creative/reactjit/zig-out/bin/rjit-llm-worker";
    if (std.fs.cwd().access(dev_path, .{})) |_| return allocator.dupe(u8, dev_path) else |_| {}

    return error.WorkerBinaryNotFound;
}

// ── stdout reader: line-buffered stream from child process ───────────

const LineReader = struct {
    file: std.fs.File,
    buf: [16 * 1024]u8 = undefined,
    len: usize = 0,
    eof: bool = false,

    /// Read one line (without trailing \n). Returns null on EOF / error.
    /// Caller does NOT own the returned slice — it points into self.buf
    /// and is invalidated by the next call.
    fn next(self: *LineReader) ?[]const u8 {
        while (true) {
            // Look for newline in current buffer
            var i: usize = 0;
            while (i < self.len) : (i += 1) {
                if (self.buf[i] == '\n') {
                    const line = self.buf[0..i];
                    // Shift remainder down
                    const remaining = self.len - (i + 1);
                    if (remaining > 0) {
                        std.mem.copyForwards(u8, self.buf[0..remaining], self.buf[(i + 1)..self.len]);
                    }
                    self.len = remaining;
                    return line;
                }
            }
            if (self.eof) return null;
            if (self.len == self.buf.len) {
                // line too long; truncate and surface what we have
                const line = self.buf[0..self.len];
                self.len = 0;
                return line;
            }
            // Read more
            const read = self.file.read(self.buf[self.len..]) catch {
                self.eof = true;
                return null;
            };
            if (read == 0) {
                self.eof = true;
                if (self.len > 0) {
                    const line = self.buf[0..self.len];
                    self.len = 0;
                    return line;
                }
                return null;
            }
            self.len += read;
        }
    }
};

// ── escape protocol ─────────────────────────────────────────────────

/// Reverse the worker's escape: \n → LF, \\ → \, otherwise pass through.
fn unescapePieceAlloc(allocator: std.mem.Allocator, piece: []const u8) ![]u8 {
    var out = std.ArrayList(u8){};
    defer out.deinit(allocator);
    var i: usize = 0;
    while (i < piece.len) : (i += 1) {
        if (piece[i] == '\\' and i + 1 < piece.len) {
            const nxt = piece[i + 1];
            if (nxt == 'n') {
                try out.append(allocator, '\n');
                i += 1;
                continue;
            }
            if (nxt == '\\') {
                try out.append(allocator, '\\');
                i += 1;
                continue;
            }
        }
        try out.append(allocator, piece[i]);
    }
    return try out.toOwnedSlice(allocator);
}

// ── worker thread main ──────────────────────────────────────────────

fn workerMain(session: *Session) void {
    workerMainInner(session) catch |err| {
        const msg = std.fmt.allocPrint(session.allocator, "worker fatal: {s}", .{@errorName(err)}) catch return;
        defer session.allocator.free(msg);
        session.pushStatus(msg, true) catch {};
        session.pushResult(msg, true) catch {};
    };
}

fn workerMainInner(session: *Session) !void {
    const worker_path = resolveWorkerPathAlloc(session.allocator) catch |err| {
        const msg = try std.fmt.allocPrint(session.allocator, "worker binary missing: {s}", .{@errorName(err)});
        defer session.allocator.free(msg);
        try session.pushStatus(msg, true);
        try session.pushResult(msg, true);
        return;
    };
    defer session.allocator.free(worker_path);

    try session.pushStatus("spawning local inference worker...", false);

    var argv = [_][]const u8{worker_path};
    var child = std.process.Child.init(&argv, session.allocator);
    child.stdin_behavior = .Pipe;
    child.stdout_behavior = .Pipe;
    child.stderr_behavior = .Inherit;

    child.spawn() catch |err| {
        const msg = try std.fmt.allocPrint(session.allocator, "spawn {s} failed: {s}", .{ worker_path, @errorName(err) });
        defer session.allocator.free(msg);
        try session.pushStatus(msg, true);
        try session.pushResult(msg, true);
        return;
    };
    defer {
        _ = child.kill() catch {};
    }

    const stdin_file = child.stdin orelse return error.NoStdin;
    const stdout_file = child.stdout orelse return error.NoStdout;
    var reader = LineReader{ .file = stdout_file };

    // Send LOAD with absolute path
    const resolved_path = try resolveModelPathAlloc(session.allocator, session.options.cwd, session.options.model_path);
    defer session.allocator.free(resolved_path);

    {
        const cmd = try std.fmt.allocPrint(session.allocator, "LOAD {s}\n", .{resolved_path});
        defer session.allocator.free(cmd);
        try stdin_file.writeAll(cmd);
    }

    try session.pushStatus("loading model into VRAM...", false);

    // Wait for READY
    while (true) {
        const line = reader.next() orelse {
            try session.pushStatus("worker EOF before READY", true);
            try session.pushResult("worker EOF before READY", true);
            return;
        };
        if (std.mem.eql(u8, line, "READY")) break;
        if (std.mem.startsWith(u8, line, "ERR ")) {
            const e = line[4..];
            try session.pushStatus(e, true);
            try session.pushResult(e, true);
            return;
        }
        // Ignore other lines (TOK before READY shouldn't happen)
    }

    const sid = session.options.session_id orelse "local";
    try session.pushSystem(resolved_path, sid);
    try session.pushStatus("local model ready", false);

    // Main request loop
    while (!session.should_stop.load(.seq_cst)) {
        if (session.requests.pop()) |req| {
            var owned = req;
            defer owned.deinit(session.allocator);

            const sys_prompt = owned.system_prompt orelse session.options.system_prompt orelse "";

            const cmd = try std.fmt.allocPrint(
                session.allocator,
                "CHAT {d}\n{s}\n.\n{s}\n.\n",
                .{ owned.max_tokens, sys_prompt, owned.text },
            );
            defer session.allocator.free(cmd);
            try stdin_file.writeAll(cmd);

            // Stream tokens until DONE or ERR
            var assistant_buf = std.ArrayList(u8){};
            defer assistant_buf.deinit(session.allocator);

            while (true) {
                const line = reader.next() orelse {
                    try session.pushStatus("worker EOF mid-generation", true);
                    try session.pushResult("worker EOF mid-generation", true);
                    return;
                };

                if (std.mem.eql(u8, line, "DONE")) {
                    try session.pushResult(assistant_buf.items, false);
                    break;
                }
                if (std.mem.startsWith(u8, line, "ERR ")) {
                    const e = line[4..];
                    try session.pushStatus(e, true);
                    try session.pushResult(e, true);
                    break;
                }
                if (std.mem.startsWith(u8, line, "TOK ")) {
                    const piece_escaped = line[4..];
                    const piece = try unescapePieceAlloc(session.allocator, piece_escaped);
                    defer session.allocator.free(piece);
                    try session.pushAssistantPart(piece);
                    try assistant_buf.appendSlice(session.allocator, piece);
                    continue;
                }
                // Unknown line type — log and ignore
            }
        } else {
            std.Thread.sleep(2 * std.time.ns_per_ms);
        }
    }

    // Clean shutdown
    stdin_file.writeAll("QUIT\n") catch {};
    _ = child.wait() catch {};
}

// ── small helpers ───────────────────────────────────────────────────

fn resolveModelPathAlloc(allocator: std.mem.Allocator, cwd: ?[]const u8, model_path: []const u8) ![]u8 {
    if (std.fs.path.isAbsolute(model_path)) return allocator.dupe(u8, model_path);
    if (cwd) |value| return std.fs.path.join(allocator, &.{ value, model_path });
    return allocator.dupe(u8, model_path);
}

test "resolveModelPathAlloc joins cwd when relative" {
    const allocator = std.testing.allocator;
    const joined = try resolveModelPathAlloc(allocator, "/tmp/project", "models/qwen.gguf");
    defer allocator.free(joined);
    try std.testing.expectEqualStrings("/tmp/project/models/qwen.gguf", joined);
}

test "unescapePieceAlloc handles \\n" {
    const allocator = std.testing.allocator;
    const out = try unescapePieceAlloc(allocator, "hello\\nworld");
    defer allocator.free(out);
    try std.testing.expectEqualStrings("hello\nworld", out);
}
