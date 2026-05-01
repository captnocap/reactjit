//! framework/pg.zig — Postgres client for cart-side `usePostgres` / `pg.ts`.
//!
//! Owns one `pg.Pool` per connection URI (cached process-wide). The
//! `__pg_*` host bindings in v8_bindings_pg.zig are thin wrappers around
//! the helpers below — all SQL travels through here so we can centralise
//! sanitization and connection lifetime.
//!
//! Default connection (URI = "") talks to the framework's embedded
//! postgres at `~/.cache/reactjit-embed/embed-pg-sock/.s.PGSQL.5432`. If
//! the data dir already exists (initdb was run by `experiments/embed-bench`
//! at some point) but `postgres` is not currently listening, we spawn it
//! as a child process and wait for the socket. Initialising a fresh data
//! dir from scratch via `initdb` is intentionally NOT done here — the
//! first-run bootstrap remains a one-shot script the user runs once. The
//! framework only re-launches an already-prepared cluster.

const std = @import("std");
const pg = @import("pg");

pub const PgError = error{
    NotInitialized,
    ConnectFailed,
    InvalidHandle,
    OutOfMemory,
    QueryFailed,
};

const max_handles: usize = 32;

const Slot = struct {
    pool: ?*pg.Pool,
    uri: []u8,
    last_changes: i64,
};

var slots: [max_handles]Slot = blk: {
    var s: [max_handles]Slot = undefined;
    for (&s) |*it| it.* = .{ .pool = null, .uri = &.{}, .last_changes = 0 };
    break :blk s;
};

var gpa = std.heap.GeneralPurposeAllocator(.{}){};
var gpa_ready = false;

fn allocator() std.mem.Allocator {
    if (!gpa_ready) gpa_ready = true;
    return gpa.allocator();
}

const default_socket_subpath = ".cache/reactjit-embed/embed-pg-sock";
const default_data_subpath = ".cache/reactjit-embed/embed-pg";
const default_user = "embed";
const default_database = "embed_bench";

/// Find a free slot. Returns 0 if none available.
fn allocSlot() usize {
    var i: usize = 1; // 0 is the "invalid" sentinel returned to JS
    while (i < max_handles) : (i += 1) {
        if (slots[i].pool == null) return i;
    }
    return 0;
}

pub fn connect(uri: []const u8) usize {
    const a = allocator();

    // Reuse an existing pool if the same URI is already open.
    var i: usize = 1;
    while (i < max_handles) : (i += 1) {
        if (slots[i].pool != null and std.mem.eql(u8, slots[i].uri, uri)) return i;
    }

    const idx = allocSlot();
    if (idx == 0) return 0;

    const pool = if (uri.len == 0)
        connectDefault(a) catch return 0
    else
        connectUri(a, uri) catch return 0;

    const uri_owned = a.dupe(u8, uri) catch {
        pool.deinit();
        return 0;
    };

    slots[idx] = .{ .pool = pool, .uri = uri_owned, .last_changes = 0 };
    return idx;
}

fn connectDefault(a: std.mem.Allocator) !*pg.Pool {
    const home = std.posix.getenv("HOME") orelse "/root";
    const sock_path = try std.fmt.allocPrint(a, "{s}/{s}/.s.PGSQL.5432", .{ home, default_socket_subpath });
    defer a.free(sock_path);

    if (pg.Pool.init(a, .{
        .size = 16,
        .connect = .{ .host = sock_path },
        .auth = .{ .username = default_user, .database = default_database },
    })) |pool| {
        return pool;
    } else |_| {}

    // Fall back: try to (re)spawn postgres pointing at the existing data dir.
    spawnEmbeddedPostgres(a) catch return error.ConnectFailed;
    waitForSocket(sock_path, 30) catch return error.ConnectFailed;

    return pg.Pool.init(a, .{
        .size = 16,
        .connect = .{ .host = sock_path },
        .auth = .{ .username = default_user, .database = default_database },
    }) catch return error.ConnectFailed;
}

fn connectUri(a: std.mem.Allocator, uri: []const u8) !*pg.Pool {
    // pg.zig accepts a connection URI via `Pool.initUri`. The signature is
    // `(allocator, std.Uri, Opts)` so we parse here.
    const parsed = std.Uri.parse(uri) catch return error.ConnectFailed;
    return pg.Pool.initUri(a, parsed, .{ .size = 16, .timeout = 10_000 }) catch return error.ConnectFailed;
}

fn spawnEmbeddedPostgres(a: std.mem.Allocator) !void {
    const home = std.posix.getenv("HOME") orelse return error.ConnectFailed;
    const data_dir = try std.fmt.allocPrint(a, "{s}/{s}", .{ home, default_data_subpath });
    defer a.free(data_dir);
    const sock_dir = try std.fmt.allocPrint(a, "{s}/{s}", .{ home, default_socket_subpath });
    defer a.free(sock_dir);

    // Bail out cleanly if the cluster was never prepared. Caller surfaces
    // the failure as "ConnectFailed" — the cart should print a hint that
    // the user needs to run the one-shot bootstrap.
    std.fs.cwd().access(data_dir, .{}) catch return error.ConnectFailed;
    std.fs.cwd().makePath(sock_dir) catch {};

    var child = std.process.Child.init(&.{
        "postgres",
        "-D",
        data_dir,
        "-k",
        sock_dir,
        "-c",
        "listen_addresses=",
    }, a);
    child.stdout_behavior = .Ignore;
    child.stderr_behavior = .Ignore;
    child.stdin_behavior = .Ignore;
    try child.spawn();
    // Detach — postgres double-forks itself into its supervisor on
    // success, so the immediate child becomes a wait()-able shell.
}

fn waitForSocket(sock_path: []const u8, max_seconds: u32) !void {
    var elapsed: u32 = 0;
    while (elapsed < max_seconds) : (elapsed += 1) {
        if (std.fs.cwd().access(sock_path, .{})) {
            return;
        } else |_| {}
        std.Thread.sleep(1 * std.time.ns_per_s);
    }
    return error.ConnectFailed;
}

pub fn close(handle: usize) void {
    if (handle == 0 or handle >= max_handles) return;
    if (slots[handle].pool) |p| p.deinit();
    if (slots[handle].uri.len > 0) allocator().free(slots[handle].uri);
    slots[handle] = .{ .pool = null, .uri = &.{}, .last_changes = 0 };
}

fn poolFor(handle: usize) ?*pg.Pool {
    if (handle == 0 or handle >= max_handles) return null;
    return slots[handle].pool;
}

/// DDL or write. Returns true on success, false on failure (caller can't
/// distinguish the failure mode; check stderr for the pg error). Updates
/// `last_changes` for `changes()`.
pub fn exec(handle: usize, sql: []const u8, _: []const u8) bool {
    const pool = poolFor(handle) orelse return false;
    const affected_opt = pool.exec(sql, .{}) catch return false;
    slots[handle].last_changes = if (affected_opt) |n| n else 0;
    return true;
}

pub fn changes(handle: usize) i64 {
    if (handle == 0 or handle >= max_handles) return 0;
    return slots[handle].last_changes;
}

/// Run a SELECT and return the result rows as a JSON string allocated with
/// `out_alloc`. Each row is a JSON object keyed by column name. Columns of
/// numeric / boolean type are emitted as JSON primitives; text and unknown
/// types are emitted as quoted strings (escaped). Caller owns the returned
/// slice.
pub fn queryJson(
    out_alloc: std.mem.Allocator,
    handle: usize,
    sql: []const u8,
    _: []const u8,
) ![]u8 {
    const pool = poolFor(handle) orelse return error.InvalidHandle;
    var result = pool.queryOpts(sql, .{}, .{ .column_names = true }) catch return error.QueryFailed;
    defer result.deinit();

    var buf = std.array_list.Managed(u8).init(out_alloc);
    errdefer buf.deinit();
    try buf.append('[');

    var first_row = true;
    const col_names = result.column_names;
    while (try result.next()) |row| {
        if (!first_row) try buf.append(',');
        first_row = false;
        try buf.append('{');
        var ci: usize = 0;
        while (ci < col_names.len) : (ci += 1) {
            if (ci > 0) try buf.append(',');
            try buf.append('"');
            try jsonEscape(&buf, col_names[ci]);
            try buf.appendSlice("\":");
            try emitColumnValue(&buf, row, ci);
        }
        try buf.append('}');
    }
    try buf.append(']');
    return buf.toOwnedSlice();
}

fn emitColumnValue(buf: *std.array_list.Managed(u8), row: anytype, ci: usize) !void {
    // Try a few common pg.zig column types in order. Whatever first decodes
    // wins. If everything fails, emit null. pg.zig returns errors when the
    // requested type doesn't match — that's how we narrow the actual type.
    if (row.get(?i64, ci)) |maybe| {
        if (maybe) |v| {
            try buf.writer().print("{d}", .{v});
            return;
        }
        try buf.appendSlice("null");
        return;
    } else |_| {}
    if (row.get(?f64, ci)) |maybe| {
        if (maybe) |v| {
            try buf.writer().print("{d}", .{v});
            return;
        }
        try buf.appendSlice("null");
        return;
    } else |_| {}
    if (row.get(?bool, ci)) |maybe| {
        if (maybe) |v| {
            try buf.appendSlice(if (v) "true" else "false");
            return;
        }
        try buf.appendSlice("null");
        return;
    } else |_| {}
    if (row.get(?[]const u8, ci)) |maybe| {
        if (maybe) |v| {
            try buf.append('"');
            try jsonEscape(buf, v);
            try buf.append('"');
            return;
        }
        try buf.appendSlice("null");
        return;
    } else |_| {}
    try buf.appendSlice("null");
}

fn jsonEscape(buf: *std.array_list.Managed(u8), s: []const u8) !void {
    for (s) |c| switch (c) {
        '"' => try buf.appendSlice("\\\""),
        '\\' => try buf.appendSlice("\\\\"),
        '\n' => try buf.appendSlice("\\n"),
        '\r' => try buf.appendSlice("\\r"),
        '\t' => try buf.appendSlice("\\t"),
        0x00...0x08, 0x0B, 0x0C, 0x0E...0x1F => try buf.writer().print("\\u{x:0>4}", .{c}),
        else => try buf.append(c),
    };
}

/// Public accessor used by framework/embed.zig — it shares the pool that
/// `__pg_connect("")` already opened so embedding upserts and ad-hoc
/// queries don't compete for connections.
pub fn defaultPool() ?*pg.Pool {
    const idx = connect("");
    if (idx == 0) return null;
    return slots[idx].pool;
}
