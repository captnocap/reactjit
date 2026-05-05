//! event_bus.zig — single-door observability sink.
//!
//! Why: this codebase has at least four independent JSON channels (V8↔Zig,
//! IPC NDJSON, http/ws servers, embed protocol). Every "took two days to
//! find" bug we've shipped was a transient structural failure where the
//! symptom was N hops downstream of the cause and there was no event trail
//! connecting them. The 3.5MB cliff (RecvBuffer truncation surfacing as
//! "blank window, no error log") is the canonical example. The orphan
//! watcher hijack is another.
//!
//! Design borrowed wholesale from engaige's eventBus (see
//! old-project-ideas.md §2): one append-only log + auto-importance from
//! event-type substring match + causal chains via parent_id. Local twist:
//! NDJSON to a per-session file under ~/.cache/reactjit/ instead of
//! SQLite — cheaper, tail-able with `tail -f`, no schema migrations. We
//! upgrade to SQLite the day query speed becomes the bottleneck.
//!
//! Contract:
//!   - Single writer (main thread). No locks. Polling other threads call
//!     emit() at their own risk; today nothing does.
//!   - Best-effort. If init fails (no $HOME, can't make .cache), all
//!     subsequent emit() calls silently no-op. The runtime keeps working.
//!   - event_type and source must be ASCII identifier-ish (no quotes, no
//!     backslashes). They are not JSON-escaped on write. Caller's job.
//!   - payload_json is spliced verbatim into the line. Caller MUST pass
//!     valid JSON ({} for empty). std.json.stringify or hand-built; we
//!     don't validate.
//!
//! Auto-importance from substring match (no manual tuning per call):
//!   overflow|fatal|crash|panic              → 0.95
//!   error|dropped|failed|reject             → 0.85
//!   warn|stale|orphan|truncated             → 0.70
//!   boot|spawn|bundle|kill|reload           → 0.60
//!   recv|tick|poll                          → 0.20
//!   anything else                           → 0.50
//!
//! Importance is what a future eventlog cart sorts/filters by. High-volume
//! events (recv, tick) persist to disk but stay below the default console
//! gate, so logs don't drown.

const std = @import("std");

const alloc = std.heap.c_allocator;

const RING_SIZE: usize = 4096;

const RingEntry = struct {
    id: u64 = 0,
    ts_ms: i64 = 0,
    importance: f32 = 0,
    parent_id: ?u64 = null,
    event_type: []u8 = &.{},
    source: []u8 = &.{},
    payload: []u8 = &.{},
};

var g_inited: bool = false;
var g_session_buf: [16]u8 = undefined;
var g_session_len: usize = 0;
var g_log_path_buf: [512]u8 = undefined;
var g_log_path_len: usize = 0;
var g_log_file: ?std.fs.File = null;
var g_next_id: u64 = 1;
var g_ring: [RING_SIZE]RingEntry = undefined;
var g_ring_inited: bool = false;
var g_ring_count: u64 = 0;

pub fn isInitialized() bool {
    return g_inited;
}

pub fn sessionId() []const u8 {
    if (!g_inited) return "";
    return g_session_buf[0..g_session_len];
}

pub fn logPath() []const u8 {
    if (!g_inited) return "";
    return g_log_path_buf[0..g_log_path_len];
}

/// Initialize the bus. Idempotent. Safe to call before any cart code runs.
/// On any failure (no $HOME, can't create dir, can't open file) the bus
/// stays uninitialized and emit() becomes a no-op.
pub fn init() void {
    if (g_inited) return;

    // Session id: random u64 from monotonic-ns seed. Stable for the
    // process; rolls on every boot.
    const seed_i128 = std.time.nanoTimestamp();
    const seed: u64 = @truncate(@as(u128, @bitCast(seed_i128)));
    var prng = std.Random.DefaultPrng.init(seed);
    const sid = prng.random().int(u64);
    const sid_str = std.fmt.bufPrint(&g_session_buf, "{x:0>16}", .{sid}) catch return;
    g_session_len = sid_str.len;

    const home = std.posix.getenv("HOME") orelse return;
    var dir_buf: [256]u8 = undefined;
    const dir_path = std.fmt.bufPrint(&dir_buf, "{s}/.cache/reactjit", .{home}) catch return;
    std.fs.makeDirAbsolute(dir_path) catch |e| switch (e) {
        error.PathAlreadyExists => {},
        else => return,
    };

    const log_path = std.fmt.bufPrint(&g_log_path_buf, "{s}/events-{s}.ndjson", .{ dir_path, sid_str }) catch return;
    g_log_path_len = log_path.len;

    const file = std.fs.createFileAbsolute(log_path, .{ .truncate = false }) catch return;
    file.seekFromEnd(0) catch {};
    g_log_file = file;

    for (&g_ring) |*e| e.* = .{};
    g_ring_inited = true;
    g_inited = true;

    _ = emitWithImportance("bus.boot", "framework/event_bus.zig", 0.6, null, "{}");
}

pub fn deinit() void {
    if (!g_inited) return;
    if (g_log_file) |f| f.close();
    g_log_file = null;
    if (g_ring_inited) {
        for (&g_ring) |*e| {
            if (e.event_type.len > 0) alloc.free(e.event_type);
            if (e.source.len > 0) alloc.free(e.source);
            if (e.payload.len > 0) alloc.free(e.payload);
        }
        g_ring_inited = false;
    }
    g_inited = false;
}

fn containsAny(haystack: []const u8, needles: []const []const u8) bool {
    for (needles) |n| {
        if (std.mem.indexOf(u8, haystack, n) != null) return true;
    }
    return false;
}

/// Pure function — exposed so callers (and tests) can preview what
/// importance a given event_type will land on without emitting.
pub fn autoImportance(event_type: []const u8) f32 {
    if (containsAny(event_type, &.{ "overflow", "fatal", "crash", "panic" })) return 0.95;
    if (containsAny(event_type, &.{ "error", "dropped", "failed", "reject" })) return 0.85;
    if (containsAny(event_type, &.{ "warn", "stale", "orphan", "truncated" })) return 0.70;
    if (containsAny(event_type, &.{ "boot", "spawn", "bundle", "kill", "reload" })) return 0.60;
    if (containsAny(event_type, &.{ "recv", "tick", "poll" })) return 0.20;
    return 0.50;
}

/// Standard emission path. Returns the assigned event id (for parent_id
/// chaining), or 0 if the bus is uninitialized.
pub fn emit(event_type: []const u8, source: []const u8, parent_id: ?u64, payload_json: []const u8) u64 {
    return emitWithImportance(event_type, source, autoImportance(event_type), parent_id, payload_json);
}

/// Override importance manually. Use when you know better than the
/// substring match (e.g. an "ipc.recv" you want flagged because the
/// payload is suspiciously large).
pub fn emitWithImportance(
    event_type: []const u8,
    source: []const u8,
    importance: f32,
    parent_id: ?u64,
    payload_json: []const u8,
) u64 {
    if (!g_inited) return 0;

    const id = g_next_id;
    g_next_id += 1;
    const ts = std.time.milliTimestamp();
    const safe_payload = if (payload_json.len == 0) "{}" else payload_json;

    if (g_log_file) |f| writeLine(f, id, ts, event_type, source, importance, parent_id, safe_payload);

    if (g_ring_inited) {
        const slot: usize = @intCast(g_ring_count % RING_SIZE);
        const e = &g_ring[slot];
        if (e.event_type.len > 0) alloc.free(e.event_type);
        if (e.source.len > 0) alloc.free(e.source);
        if (e.payload.len > 0) alloc.free(e.payload);
        e.* = .{
            .id = id,
            .ts_ms = ts,
            .importance = importance,
            .parent_id = parent_id,
            .event_type = alloc.dupe(u8, event_type) catch &.{},
            .source = alloc.dupe(u8, source) catch &.{},
            .payload = alloc.dupe(u8, safe_payload) catch &.{},
        };
        g_ring_count += 1;
    }

    return id;
}

fn writeLine(
    f: std.fs.File,
    id: u64,
    ts: i64,
    event_type: []const u8,
    source: []const u8,
    importance: f32,
    parent_id: ?u64,
    payload: []const u8,
) void {
    var buf: std.ArrayList(u8) = .{};
    defer buf.deinit(alloc);
    const w = buf.writer(alloc);
    if (parent_id) |pid| {
        w.print(
            "{{\"id\":{d},\"ts\":{d},\"sid\":\"{s}\",\"type\":\"{s}\",\"src\":\"{s}\",\"imp\":{d:.3},\"par\":{d},\"payload\":{s}}}\n",
            .{ id, ts, g_session_buf[0..g_session_len], event_type, source, importance, pid, payload },
        ) catch return;
    } else {
        w.print(
            "{{\"id\":{d},\"ts\":{d},\"sid\":\"{s}\",\"type\":\"{s}\",\"src\":\"{s}\",\"imp\":{d:.3},\"par\":null,\"payload\":{s}}}\n",
            .{ id, ts, g_session_buf[0..g_session_len], event_type, source, importance, payload },
        ) catch return;
    }
    f.writeAll(buf.items) catch {};
}

// ── std.log adapter ────────────────────────────────────────────────────
//
// Wire as `pub const std_options = .{ .logFn = event_bus.fromStdLog }`
// in v8_app.zig. Every `std.log.info/warn/err/debug` call in the
// framework then routes through here — bus first, optional stderr
// fallthrough for warns/errs so the terminal still surfaces real
// problems even if the eventlog window is closed.
//
// Importance map (level → imp):
//   .err   → 0.85   (eligible for stderr)
//   .warn  → 0.70   (eligible for stderr)
//   .info  → 0.30   (bus-only)
//   .debug → 0.15   (bus-only)
//
// Re-entrancy: every helper inside swallows errors with `catch`; nothing
// here calls `std.log.*`, so there's no recursion into the override.

fn writeJsonString(writer: anytype, s: []const u8) !void {
    try writer.writeByte('"');
    for (s) |c| switch (c) {
        '"' => try writer.writeAll("\\\""),
        '\\' => try writer.writeAll("\\\\"),
        '\n' => try writer.writeAll("\\n"),
        '\r' => try writer.writeAll("\\r"),
        '\t' => try writer.writeAll("\\t"),
        0x00...0x07, 0x0B, 0x0E...0x1F => try writer.print("\\u{x:0>4}", .{c}),
        else => try writer.writeByte(c),
    };
    try writer.writeByte('"');
}

pub fn fromStdLog(
    comptime level: std.log.Level,
    comptime scope: @TypeOf(.enum_literal),
    comptime format: []const u8,
    args: anytype,
) void {
    var msg_buf: [4096]u8 = undefined;
    const msg_full: []const u8 = std.fmt.bufPrint(&msg_buf, format, args) catch blk: {
        // Format too long — truncate. (Don't try to mark with an ellipsis;
        // we'd need three bytes for U+2026 and the bounds tracking isn't
        // worth it. Truncated logs are rare and obviously truncated.)
        const n = msg_buf.len;
        msg_buf[n - 3] = '.';
        msg_buf[n - 2] = '.';
        msg_buf[n - 1] = '.';
        break :blk msg_buf[0..];
    };

    const lvl_str = @tagName(level);
    const scope_str = @tagName(scope);

    // Console gate — errors and warns ALWAYS hit stderr regardless of bus
    // state. This guarantees boot-time failures (before init() runs) are
    // visible. Lower levels are bus-only; if the bus is dead they're lost,
    // which is the documented best-effort contract.
    if (level == .err or level == .warn) {
        const stderr = std.fs.File.stderr();
        var line_buf: [4200]u8 = undefined;
        const line = std.fmt.bufPrint(&line_buf, "[{s}/{s}] {s}\n", .{ lvl_str, scope_str, msg_full }) catch msg_full;
        stderr.writeAll(line) catch {};
    }

    if (!g_inited) return;

    const importance: f32 = switch (level) {
        .err => 0.85,
        .warn => 0.70,
        .info => 0.30,
        .debug => 0.15,
    };

    var pbuf: std.ArrayList(u8) = .{};
    defer pbuf.deinit(alloc);
    const w = pbuf.writer(alloc);
    w.writeAll("{\"msg\":") catch return;
    writeJsonString(w, msg_full) catch return;
    w.writeAll(",\"scope\":") catch return;
    writeJsonString(w, scope_str) catch return;
    w.writeAll(",\"level\":") catch return;
    writeJsonString(w, lvl_str) catch return;
    w.writeAll("}") catch return;

    var src_buf: [80]u8 = undefined;
    const src = std.fmt.bufPrint(&src_buf, "log:{s}", .{scope_str}) catch "log:?";

    const event_type = switch (level) {
        .err => "log.err",
        .warn => "log.warn",
        .info => "log.info",
        .debug => "log.debug",
    };

    _ = emitWithImportance(event_type, src, importance, null, pbuf.items);
}

/// JS-side log adapter — paired with the __hostLog host fn. Severity:
///   0 = log/info  → js.log  imp 0.30 (bus-only)
///   1 = warn      → js.warn imp 0.70 (bus + stderr)
///   2 = error     → js.err  imp 0.85 (bus + stderr)
/// Stderr fallthrough fires regardless of bus state so JS-side errors
/// remain visible during pre-bus boot or post-deinit shutdown.
pub fn emitJsLog(severity: i32, msg: []const u8) u64 {
    if (severity >= 1) {
        const stderr = std.fs.File.stderr();
        var line_buf: [4200]u8 = undefined;
        const tag: []const u8 = if (severity >= 2) "[js.err]" else "[js.warn]";
        const line = std.fmt.bufPrint(&line_buf, "{s} {s}\n", .{ tag, msg }) catch msg;
        stderr.writeAll(line) catch {};
    }
    if (!g_inited) return 0;

    const importance: f32 = switch (severity) {
        2 => 0.85,
        1 => 0.70,
        else => 0.30,
    };
    const event_type: []const u8 = switch (severity) {
        2 => "js.err",
        1 => "js.warn",
        else => "js.log",
    };

    var pbuf: std.ArrayList(u8) = .{};
    defer pbuf.deinit(alloc);
    const w = pbuf.writer(alloc);
    w.writeAll("{\"msg\":") catch return 0;
    writeJsonString(w, msg) catch return 0;
    w.writeAll("}") catch return 0;

    return emitWithImportance(event_type, "js", importance, null, pbuf.items);
}

/// Build a JSON array of recent events with importance >= min_importance,
/// newest first, capped at max_count. Caller owns the returned slice.
/// Returns "[]" when uninitialized or when the ring is empty.
pub fn recentJson(allocator: std.mem.Allocator, max_count: usize, min_importance: f32) ![]u8 {
    var buf: std.ArrayList(u8) = .{};
    errdefer buf.deinit(allocator);
    try buf.append(allocator, '[');

    if (g_inited and g_ring_inited and g_ring_count > 0) {
        const live: u64 = @min(g_ring_count, RING_SIZE);
        var emitted: usize = 0;
        var i: u64 = 0;
        while (i < live and emitted < max_count) : (i += 1) {
            const idx: usize = @intCast((g_ring_count - 1 - i) % RING_SIZE);
            const e = &g_ring[idx];
            if (e.importance < min_importance) continue;
            if (emitted > 0) try buf.append(allocator, ',');
            const w = buf.writer(allocator);
            const payload_str = if (e.payload.len > 0) e.payload else "{}";
            if (e.parent_id) |pid| {
                try w.print(
                    "{{\"id\":{d},\"ts\":{d},\"type\":\"{s}\",\"src\":\"{s}\",\"imp\":{d:.3},\"par\":{d},\"payload\":{s}}}",
                    .{ e.id, e.ts_ms, e.event_type, e.source, e.importance, pid, payload_str },
                );
            } else {
                try w.print(
                    "{{\"id\":{d},\"ts\":{d},\"type\":\"{s}\",\"src\":\"{s}\",\"imp\":{d:.3},\"par\":null,\"payload\":{s}}}",
                    .{ e.id, e.ts_ms, e.event_type, e.source, e.importance, payload_str },
                );
            }
            emitted += 1;
        }
    }

    try buf.append(allocator, ']');
    return buf.toOwnedSlice(allocator);
}
