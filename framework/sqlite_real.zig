// tsz/runtime/sqlite.zig
//
// Zig wrapper over the SQLite3 C library.
// Modeled on love2d/lua/sqlite.lua: open/close, exec/query, prepared statements,
// parameter binding, BUSY/LOCKED retry, WAL mode.
//
// Only compiled into the binary when a .tsz app uses storage features.
// The compiler writes "sqlite3" to ffi_libs.txt so build.zig links it.

const std = @import("std");

const sql = @cImport({
    @cInclude("sqlite3.h");
});

// SQLITE_TRANSIENT: tells sqlite3 to make its own copy of bound data.
// Defined in C as ((sqlite3_destructor_type)-1), which is a function pointer
// with the value of max usize (all bits set).
const SQLITE_TRANSIENT_VAL = @as(sql.sqlite3_destructor_type, @ptrFromInt(std.math.maxInt(usize)));

pub const SqliteError = error{
    CantOpen,
    Busy,
    Locked,
    Corrupt,
    Constraint,
    Mismatch,
    NoMem,
    Prepare,
    Step,
    Bind,
    Generic,
};

fn mapError(rc: c_int) SqliteError {
    return switch (rc) {
        sql.SQLITE_BUSY => SqliteError.Busy,
        sql.SQLITE_LOCKED => SqliteError.Locked,
        sql.SQLITE_CORRUPT, sql.SQLITE_NOTADB => SqliteError.Corrupt,
        sql.SQLITE_CONSTRAINT => SqliteError.Constraint,
        sql.SQLITE_MISMATCH => SqliteError.Mismatch,
        sql.SQLITE_NOMEM => SqliteError.NoMem,
        sql.SQLITE_CANTOPEN => SqliteError.CantOpen,
        else => SqliteError.Generic,
    };
}

pub const ColumnType = enum {
    integer,
    float,
    text,
    blob,
    null_val,
};

fn mapColumnType(t: c_int) ColumnType {
    return switch (t) {
        sql.SQLITE_INTEGER => .integer,
        sql.SQLITE_FLOAT => .float,
        sql.SQLITE_TEXT => .text,
        sql.SQLITE_BLOB => .blob,
        else => .null_val,
    };
}

// -- Statement --

pub const Statement = struct {
    stmt: *sql.sqlite3_stmt,

    /// Finalize (free) the prepared statement.
    pub fn deinit(self: *Statement) void {
        _ = sql.sqlite3_finalize(self.stmt);
    }

    /// Bind a text value at 1-based parameter index.
    pub fn bindText(self: *Statement, idx: c_int, text: []const u8) SqliteError!void {
        const rc = sql.sqlite3_bind_text(
            self.stmt,
            idx,
            text.ptr,
            @intCast(text.len),
            SQLITE_TRANSIENT_VAL,
        );
        if (rc != sql.SQLITE_OK) return SqliteError.Bind;
    }

    /// Bind an integer value at 1-based parameter index.
    pub fn bindInt(self: *Statement, idx: c_int, val: i64) SqliteError!void {
        const rc = sql.sqlite3_bind_int64(self.stmt, idx, val);
        if (rc != sql.SQLITE_OK) return SqliteError.Bind;
    }

    /// Bind a float value at 1-based parameter index.
    pub fn bindFloat(self: *Statement, idx: c_int, val: f64) SqliteError!void {
        const rc = sql.sqlite3_bind_double(self.stmt, idx, val);
        if (rc != sql.SQLITE_OK) return SqliteError.Bind;
    }

    /// Bind NULL at 1-based parameter index.
    pub fn bindNull(self: *Statement, idx: c_int) SqliteError!void {
        const rc = sql.sqlite3_bind_null(self.stmt, idx);
        if (rc != sql.SQLITE_OK) return SqliteError.Bind;
    }

    /// Step the statement. Returns true if a row is available, false if done.
    pub fn step(self: *Statement) SqliteError!bool {
        const rc = sql.sqlite3_step(self.stmt);
        if (rc == sql.SQLITE_ROW) return true;
        if (rc == sql.SQLITE_DONE) return false;
        return mapError(rc);
    }

    /// Reset the statement for re-use with new bindings.
    pub fn reset(self: *Statement) SqliteError!void {
        const rc = sql.sqlite3_reset(self.stmt);
        if (rc != sql.SQLITE_OK) return mapError(rc);
        _ = sql.sqlite3_clear_bindings(self.stmt);
    }

    /// Get a text column value. Valid until next step/reset/finalize.
    pub fn columnText(self: *const Statement, idx: c_int) ?[]const u8 {
        const ptr = sql.sqlite3_column_text(self.stmt, idx);
        if (ptr == null) return null;
        const len = sql.sqlite3_column_bytes(self.stmt, idx);
        if (len <= 0) return "";
        return @as([*]const u8, @ptrCast(ptr))[0..@intCast(len)];
    }

    /// Get an integer column value.
    pub fn columnInt(self: *const Statement, idx: c_int) i64 {
        return sql.sqlite3_column_int64(self.stmt, idx);
    }

    /// Get a float column value.
    pub fn columnFloat(self: *const Statement, idx: c_int) f64 {
        return sql.sqlite3_column_double(self.stmt, idx);
    }

    /// Get the type of a column value.
    pub fn columnType(self: *const Statement, idx: c_int) ColumnType {
        return mapColumnType(sql.sqlite3_column_type(self.stmt, idx));
    }

    /// Get the number of columns in the result set.
    pub fn columnCount(self: *const Statement) c_int {
        return sql.sqlite3_column_count(self.stmt);
    }
};

// -- Database --

pub const Database = struct {
    db: *sql.sqlite3,

    /// Open (or create) a database at the given path.
    /// Enables WAL mode and fails fast when the database is locked.
    pub fn open(path: []const u8) !Database {
        // Null-terminate the path on the stack
        var path_buf: [std.fs.max_path_bytes + 1]u8 = undefined;
        if (path.len >= path_buf.len) return error.NameTooLong;
        @memcpy(path_buf[0..path.len], path);
        path_buf[path.len] = 0;
        const path_z: [*:0]const u8 = @ptrCast(path_buf[0..path.len]);

        var db_ptr: ?*sql.sqlite3 = null;
        const rc = sql.sqlite3_open(path_z, &db_ptr);
        if (rc != sql.SQLITE_OK) {
            if (db_ptr) |db| _ = sql.sqlite3_close(db);
            return SqliteError.CantOpen;
        }
        const db = db_ptr orelse return SqliteError.CantOpen;

        var self = Database{ .db = db };

        // Host functions run on the UI thread. A long busy timeout here stalls
        // the whole app when another process or stale handle holds the DB lock.
        _ = sql.sqlite3_busy_timeout(db, 0);

        // Enable WAL mode for concurrent reads + crash safety
        self.exec("PRAGMA journal_mode=WAL") catch {};

        // Enable foreign keys
        self.exec("PRAGMA foreign_keys=ON") catch {};

        return self;
    }

    /// Open an in-memory database.
    pub fn openMemory() !Database {
        return open(":memory:");
    }

    /// Close the database. Safe to call multiple times.
    pub fn close(self: *Database) void {
        _ = sql.sqlite3_close(self.db);
    }

    /// Execute a SQL statement with no result rows (DDL, INSERT, UPDATE, DELETE).
    pub fn exec(self: *Database, sql_str: [*:0]const u8) SqliteError!void {
        var errmsg: [*c]u8 = null;
        const rc = sql.sqlite3_exec(self.db, sql_str, null, null, &errmsg);
        if (errmsg != null) sql.sqlite3_free(errmsg);
        if (rc != sql.SQLITE_OK) return mapError(rc);
    }

    /// Prepare a SQL statement for execution.
    pub fn prepare(self: *Database, sql_str: [*:0]const u8) SqliteError!Statement {
        var stmt_ptr: ?*sql.sqlite3_stmt = null;
        const rc = sql.sqlite3_prepare_v2(
            self.db,
            sql_str,
            -1, // read until null terminator
            &stmt_ptr,
            null, // ignore tail
        );
        if (rc != sql.SQLITE_OK) return SqliteError.Prepare;
        return Statement{ .stmt = stmt_ptr orelse return SqliteError.Prepare };
    }

    /// Number of rows changed by the last INSERT/UPDATE/DELETE.
    pub fn changes(self: *const Database) i32 {
        return sql.sqlite3_changes(self.db);
    }

    /// Rowid of the last successful INSERT.
    pub fn lastInsertRowId(self: *const Database) i64 {
        return sql.sqlite3_last_insert_rowid(self.db);
    }

    /// Get the last error message.
    pub fn errMsg(self: *const Database) [*:0]const u8 {
        return sql.sqlite3_errmsg(self.db);
    }

    /// Execute a statement inside a transaction. Rolls back on error.
    pub fn transaction(self: *Database, comptime func: fn (*Database) SqliteError!void) SqliteError!void {
        self.exec("BEGIN") catch |err| return err;
        func(self) catch |err| {
            self.exec("ROLLBACK") catch {};
            return err;
        };
        self.exec("COMMIT") catch |err| {
            self.exec("ROLLBACK") catch {};
            return err;
        };
    }
};

// -- Tests --

test "open and close in-memory database" {
    var db = try Database.openMemory();
    defer db.close();
}

test "create table and insert" {
    var db = try Database.openMemory();
    defer db.close();

    try db.exec("CREATE TABLE test (id INTEGER PRIMARY KEY, name TEXT, value REAL)");

    var stmt = try db.prepare("INSERT INTO test (id, name, value) VALUES (?, ?, ?)");
    defer stmt.deinit();

    try stmt.bindInt(1, 42);
    try stmt.bindText(2, "hello");
    try stmt.bindFloat(3, 3.14);
    const has_row = try stmt.step();
    try std.testing.expect(!has_row); // INSERT returns no rows

    try std.testing.expectEqual(@as(i32, 1), db.changes());
}

test "query rows" {
    var db = try Database.openMemory();
    defer db.close();

    try db.exec("CREATE TABLE kv (key TEXT PRIMARY KEY, val TEXT)");
    try db.exec("INSERT INTO kv VALUES ('a', 'alpha')");
    try db.exec("INSERT INTO kv VALUES ('b', 'beta')");

    var stmt = try db.prepare("SELECT key, val FROM kv ORDER BY key");
    defer stmt.deinit();

    // First row
    try std.testing.expect(try stmt.step());
    try std.testing.expectEqualStrings("a", stmt.columnText(0) orelse "");
    try std.testing.expectEqualStrings("alpha", stmt.columnText(1) orelse "");

    // Second row
    try std.testing.expect(try stmt.step());
    try std.testing.expectEqualStrings("b", stmt.columnText(0) orelse "");
    try std.testing.expectEqualStrings("beta", stmt.columnText(1) orelse "");

    // Done
    try std.testing.expect(!try stmt.step());
}

test "parameterized query" {
    var db = try Database.openMemory();
    defer db.close();

    try db.exec("CREATE TABLE store (ns TEXT, key TEXT, val TEXT, PRIMARY KEY(ns, key))");
    {
        var stmt = try db.prepare("INSERT INTO store VALUES (?, ?, ?)");
        defer stmt.deinit();
        try stmt.bindText(1, "app");
        try stmt.bindText(2, "theme");
        try stmt.bindText(3, "dark");
        _ = try stmt.step();
    }

    {
        var stmt = try db.prepare("SELECT val FROM store WHERE ns = ? AND key = ?");
        defer stmt.deinit();
        try stmt.bindText(1, "app");
        try stmt.bindText(2, "theme");
        try std.testing.expect(try stmt.step());
        try std.testing.expectEqualStrings("dark", stmt.columnText(0) orelse "");
    }
}

test "column types" {
    var db = try Database.openMemory();
    defer db.close();

    try db.exec("CREATE TABLE types (i INTEGER, f REAL, t TEXT, n BLOB)");
    try db.exec("INSERT INTO types VALUES (42, 3.14, 'hello', NULL)");

    var stmt = try db.prepare("SELECT * FROM types");
    defer stmt.deinit();

    try std.testing.expect(try stmt.step());
    try std.testing.expectEqual(ColumnType.integer, stmt.columnType(0));
    try std.testing.expectEqual(ColumnType.float, stmt.columnType(1));
    try std.testing.expectEqual(ColumnType.text, stmt.columnType(2));
    try std.testing.expectEqual(ColumnType.null_val, stmt.columnType(3));

    try std.testing.expectEqual(@as(i64, 42), stmt.columnInt(0));
    try std.testing.expect(std.math.approxEqAbs(f64, 3.14, stmt.columnFloat(1), 0.001));
    try std.testing.expectEqualStrings("hello", stmt.columnText(2) orelse "");
    try std.testing.expect(stmt.columnText(3) == null);
}

test "transaction commit" {
    var db = try Database.openMemory();
    defer db.close();

    try db.exec("CREATE TABLE t (x INTEGER)");

    try db.transaction(struct {
        fn f(d: *Database) SqliteError!void {
            d.exec("INSERT INTO t VALUES (1)") catch return SqliteError.Generic;
            d.exec("INSERT INTO t VALUES (2)") catch return SqliteError.Generic;
        }
    }.f);

    var stmt = try db.prepare("SELECT COUNT(*) FROM t");
    defer stmt.deinit();
    _ = try stmt.step();
    try std.testing.expectEqual(@as(i64, 2), stmt.columnInt(0));
}

test "statement reset and reuse" {
    var db = try Database.openMemory();
    defer db.close();

    try db.exec("CREATE TABLE items (name TEXT)");

    var stmt = try db.prepare("INSERT INTO items VALUES (?)");
    defer stmt.deinit();

    // First use
    try stmt.bindText(1, "one");
    _ = try stmt.step();
    try stmt.reset();

    // Reuse
    try stmt.bindText(1, "two");
    _ = try stmt.step();
    try stmt.reset();

    // Verify both inserted
    var q = try db.prepare("SELECT COUNT(*) FROM items");
    defer q.deinit();
    _ = try q.step();
    try std.testing.expectEqual(@as(i64, 2), q.columnInt(0));
}
