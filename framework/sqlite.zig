//! framework/sqlite.zig — feature-gated dispatcher for the sqlite3 wrapper.
//!
//! When -Dhas-sqlite=true (passed by scripts/ship for carts whose source
//! triggers the `sqlite` feature in sdk/dependency-registry.json), this
//! re-exports framework/sqlite_real.zig (the real libsqlite3-backed
//! implementation). Otherwise it re-exports framework/sqlite_stub.zig,
//! whose methods all return errors/null/zero, and libsqlite3 isn't linked.
//!
//! The conditional `@import` ensures the unselected file isn't compiled,
//! so sqlite_real.zig's `@cImport({ @cInclude("sqlite3.h"); })` only runs
//! when the library is actually being linked.

const build_options = @import("build_options");

const HAS_SQLITE = if (@hasDecl(build_options, "has_sqlite"))
    build_options.has_sqlite
else
    false;

const impl = if (HAS_SQLITE)
    @import("sqlite_real.zig")
else
    @import("sqlite_stub.zig");

pub const SqliteError = impl.SqliteError;
pub const ColumnType = impl.ColumnType;
pub const Statement = impl.Statement;
pub const Database = impl.Database;
