//! framework/sqlite_stub.zig — no-op sqlite3 surface for builds that
//! aren't carrying libsqlite3. Matches the public API of sqlite_real.zig
//! exactly; every method returns an error, null, or zero. Selected by
//! framework/sqlite.zig when -Dhas-sqlite=false.

const std = @import("std");

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

pub const ColumnType = enum {
    integer,
    float,
    text,
    blob,
    null_val,
};

pub const Statement = struct {
    pub fn deinit(_: *Statement) void {}

    pub fn bindText(_: *Statement, _: c_int, _: []const u8) SqliteError!void {
        return SqliteError.Bind;
    }

    pub fn bindInt(_: *Statement, _: c_int, _: i64) SqliteError!void {
        return SqliteError.Bind;
    }

    pub fn bindFloat(_: *Statement, _: c_int, _: f64) SqliteError!void {
        return SqliteError.Bind;
    }

    pub fn bindNull(_: *Statement, _: c_int) SqliteError!void {
        return SqliteError.Bind;
    }

    pub fn step(_: *Statement) SqliteError!bool {
        return SqliteError.Step;
    }

    pub fn reset(_: *Statement) SqliteError!void {
        return SqliteError.Generic;
    }

    pub fn columnText(_: *const Statement, _: c_int) ?[]const u8 {
        return null;
    }

    pub fn columnInt(_: *const Statement, _: c_int) i64 {
        return 0;
    }

    pub fn columnFloat(_: *const Statement, _: c_int) f64 {
        return 0;
    }

    pub fn columnType(_: *const Statement, _: c_int) ColumnType {
        return .null_val;
    }

    pub fn columnCount(_: *const Statement) c_int {
        return 0;
    }

    pub fn columnName(_: *const Statement, _: c_int) ?[]const u8 {
        return null;
    }
};

pub const Database = struct {
    pub fn open(_: []const u8) SqliteError!Database {
        return SqliteError.CantOpen;
    }

    pub fn openMemory() SqliteError!Database {
        return SqliteError.CantOpen;
    }

    pub fn close(_: *Database) void {}

    pub fn exec(_: *Database, _: [*:0]const u8) SqliteError!void {
        return SqliteError.Generic;
    }

    pub fn prepare(_: *Database, _: [*:0]const u8) SqliteError!Statement {
        return SqliteError.Prepare;
    }

    pub fn changes(_: *const Database) i32 {
        return 0;
    }

    pub fn lastInsertRowId(_: *const Database) i64 {
        return 0;
    }

    pub fn errMsg(_: *const Database) [*:0]const u8 {
        return "sqlite disabled (build without -Dhas-sqlite)";
    }

    pub fn transaction(_: *Database, comptime _: fn (*Database) SqliteError!void) SqliteError!void {
        return SqliteError.Generic;
    }
};
