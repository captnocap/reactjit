// tsz/runtime/localstore.zig
//
// SQLite-backed namespaced key/value store.
// Mirrors love2d/lua/localstore.lua: (namespace, key) → text value with timestamp.
// Used by the compiler-generated useLocalStore() hook for persistent state.
//
// Depends on: fs.zig (data directory), sqlite.zig (database).
// fs.init() must be called before localstore.init().

const std = @import("std");
const fs = @import("fs.zig");
const sqlite = @import("../modules/sqlite.zig");

pub const MAX_KEY = 256;
pub const MAX_VALUE = 8192;
pub const MAX_KEYS = 256;

pub const KeyEntry = struct {
    buf: [MAX_KEY]u8 = undefined,
    len: u16 = 0,

    pub fn key(self: *const KeyEntry) []const u8 {
        return self.buf[0..self.len];
    }
};

// -- Module state --

var db: ?sqlite.Database = null;

// -- Init / Deinit --

/// Initialize the local store. Opens (or creates) localstore.db in the app data directory.
/// Requires fs.init() to have been called first.
pub fn init() !void {
    if (db != null) return;

    const data_path = try fs.dataDirPath();
    var path_buf: [fs.MAX_PATH]u8 = undefined;
    const path = std.fmt.bufPrint(&path_buf, "{s}/localstore.db", .{data_path}) catch
        return error.NameTooLong;

    var database = try sqlite.Database.open(path);

    database.exec(
        "CREATE TABLE IF NOT EXISTS store (" ++
            "namespace TEXT NOT NULL, " ++
            "key TEXT NOT NULL, " ++
            "value TEXT, " ++
            "updated_at INTEGER NOT NULL, " ++
            "PRIMARY KEY (namespace, key))",
    ) catch |err| {
        database.close();
        return err;
    };

    db = database;
}

pub fn deinit() void {
    if (db) |*d| d.close();
    db = null;
}

pub fn isInitialized() bool {
    return db != null;
}

// -- Get --

/// Get a value by namespace and key. Returns bytes written to buf, or null if not found.
pub fn get(namespace: []const u8, key: []const u8, buf: []u8) !?usize {
    var d = db orelse return error.NotInitialized;
    var stmt = try d.prepare("SELECT value FROM store WHERE namespace = ? AND key = ?");
    defer stmt.deinit();

    try stmt.bindText(1, namespace);
    try stmt.bindText(2, key);

    if (!try stmt.step()) return null; // key not found

    const val = stmt.columnText(0) orelse return null;
    if (val.len > buf.len) return error.BufferTooSmall;
    @memcpy(buf[0..val.len], val);
    return val.len;
}

/// Get a stored integer value. Returns null if not found.
pub fn getInt(namespace: []const u8, key: []const u8) !?i64 {
    var buf: [64]u8 = undefined;
    const len = (try get(namespace, key, &buf)) orelse return null;
    return std.fmt.parseInt(i64, buf[0..len], 10) catch null;
}

/// Get a stored float value. Returns null if not found.
pub fn getFloat(namespace: []const u8, key: []const u8) !?f64 {
    var buf: [64]u8 = undefined;
    const len = (try get(namespace, key, &buf)) orelse return null;
    return std.fmt.parseFloat(f64, buf[0..len]) catch null;
}

/// Get a stored boolean value. Returns null if not found.
pub fn getBool(namespace: []const u8, key: []const u8) !?bool {
    var buf: [8]u8 = undefined;
    const len = (try get(namespace, key, &buf)) orelse return null;
    const s = buf[0..len];
    if (std.mem.eql(u8, s, "true") or std.mem.eql(u8, s, "1")) return true;
    if (std.mem.eql(u8, s, "false") or std.mem.eql(u8, s, "0")) return false;
    return null;
}

// -- Set --

/// Set a text value for namespace + key. Creates or replaces.
pub fn set(namespace: []const u8, key: []const u8, value: []const u8) !void {
    var d = db orelse return error.NotInitialized;
    var stmt = try d.prepare(
        "INSERT OR REPLACE INTO store (namespace, key, value, updated_at) VALUES (?, ?, ?, ?)",
    );
    defer stmt.deinit();

    try stmt.bindText(1, namespace);
    try stmt.bindText(2, key);
    try stmt.bindText(3, value);
    try stmt.bindInt(4, std.time.timestamp());

    _ = try stmt.step();
}

/// Set an integer value.
pub fn setInt(namespace: []const u8, key: []const u8, value: i64) !void {
    var buf: [64]u8 = undefined;
    const s = std.fmt.bufPrint(&buf, "{d}", .{value}) catch return error.BufferTooSmall;
    return set(namespace, key, s);
}

/// Set a float value.
pub fn setFloat(namespace: []const u8, key: []const u8, value: f64) !void {
    var buf: [64]u8 = undefined;
    const s = std.fmt.bufPrint(&buf, "{d}", .{value}) catch return error.BufferTooSmall;
    return set(namespace, key, s);
}

/// Set a boolean value.
pub fn setBool(namespace: []const u8, key: []const u8, value: bool) !void {
    return set(namespace, key, if (value) "true" else "false");
}

// -- Delete --

/// Delete a single key from a namespace.
pub fn delete(namespace: []const u8, key: []const u8) !void {
    var d = db orelse return error.NotInitialized;
    var stmt = try d.prepare("DELETE FROM store WHERE namespace = ? AND key = ?");
    defer stmt.deinit();

    try stmt.bindText(1, namespace);
    try stmt.bindText(2, key);
    _ = try stmt.step();
}

// -- Keys --

/// List all keys in a namespace, sorted alphabetically.
/// Returns the number of keys written to `out`.
pub fn keys(namespace: []const u8, out: []KeyEntry) !usize {
    var d = db orelse return error.NotInitialized;
    var stmt = try d.prepare("SELECT key FROM store WHERE namespace = ? ORDER BY key");
    defer stmt.deinit();

    try stmt.bindText(1, namespace);

    var count: usize = 0;
    while (try stmt.step()) {
        if (count >= out.len) break;
        const k = stmt.columnText(0) orelse continue;
        const len: u16 = @intCast(@min(k.len, MAX_KEY));
        @memcpy(out[count].buf[0..len], k[0..len]);
        out[count].len = len;
        count += 1;
    }
    return count;
}

// -- Clear --

/// Clear all keys in a namespace. If namespace is null, clear everything.
pub fn clear(namespace: ?[]const u8) !void {
    var d = db orelse return error.NotInitialized;

    if (namespace) |ns| {
        var stmt = try d.prepare("DELETE FROM store WHERE namespace = ?");
        defer stmt.deinit();
        try stmt.bindText(1, ns);
        _ = try stmt.step();
    } else {
        try d.exec("DELETE FROM store");
    }
}

// -- Tests --

test "init requires fs" {
    // fs not initialized, so init should fail
    const result = init();
    try std.testing.expectError(error.NotInitialized, result);
}

test "round-trip text value" {
    try fs.init("tsz-localstore-test");
    defer fs.deinit();
    try init();
    defer deinit();

    try set("app", "theme", "dark");

    var buf: [256]u8 = undefined;
    const len = (try get("app", "theme", &buf)).?;
    try std.testing.expectEqualStrings("dark", buf[0..len]);
}

test "round-trip typed values" {
    try fs.init("tsz-localstore-test");
    defer fs.deinit();
    try init();
    defer deinit();

    // Integer
    try setInt("app", "count", 42);
    try std.testing.expectEqual(@as(?i64, 42), try getInt("app", "count"));

    // Float
    try setFloat("app", "ratio", 3.14);
    const f = (try getFloat("app", "ratio")).?;
    try std.testing.expect(std.math.approxEqAbs(f64, 3.14, f, 0.01));

    // Bool
    try setBool("app", "enabled", true);
    try std.testing.expectEqual(@as(?bool, true), try getBool("app", "enabled"));
}

test "get missing key returns null" {
    try fs.init("tsz-localstore-test");
    defer fs.deinit();
    try init();
    defer deinit();

    var buf: [256]u8 = undefined;
    const result = try get("app", "nonexistent", &buf);
    try std.testing.expect(result == null);
}

test "delete key" {
    try fs.init("tsz-localstore-test");
    defer fs.deinit();
    try init();
    defer deinit();

    try set("app", "temp", "value");
    try delete("app", "temp");

    var buf: [256]u8 = undefined;
    try std.testing.expect((try get("app", "temp", &buf)) == null);
}

test "keys listing" {
    try fs.init("tsz-localstore-test");
    defer fs.deinit();
    try init();
    defer deinit();

    // Clear first
    try clear("test-keys");

    try set("test-keys", "alpha", "1");
    try set("test-keys", "beta", "2");
    try set("test-keys", "gamma", "3");

    var entries: [16]KeyEntry = undefined;
    const count = try keys("test-keys", &entries);
    try std.testing.expectEqual(@as(usize, 3), count);
    try std.testing.expectEqualStrings("alpha", entries[0].key());
    try std.testing.expectEqualStrings("beta", entries[1].key());
    try std.testing.expectEqualStrings("gamma", entries[2].key());
}

test "clear namespace" {
    try fs.init("tsz-localstore-test");
    defer fs.deinit();
    try init();
    defer deinit();

    try set("clearme", "a", "1");
    try set("clearme", "b", "2");
    try set("keep", "c", "3");

    try clear("clearme");

    // clearme keys gone
    var buf: [256]u8 = undefined;
    try std.testing.expect((try get("clearme", "a", &buf)) == null);
    try std.testing.expect((try get("clearme", "b", &buf)) == null);

    // keep keys remain
    const len = (try get("keep", "c", &buf)).?;
    try std.testing.expectEqualStrings("3", buf[0..len]);
}

test "overwrite value" {
    try fs.init("tsz-localstore-test");
    defer fs.deinit();
    try init();
    defer deinit();

    try set("app", "version", "1.0");
    try set("app", "version", "2.0");

    var buf: [256]u8 = undefined;
    const len = (try get("app", "version", &buf)).?;
    try std.testing.expectEqualStrings("2.0", buf[0..len]);
}
