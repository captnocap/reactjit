//! Lua stack discipline wrapper for raw C API calls.
//!
//! Prevents stack leaks by tracking stack height at creation and
//! asserting (debug) or restoring (release) it on deinit.
//!
//! Typical usage:
//!   const guard = lua_guard.StackGuard.init(L);
//!   defer guard.deinit();
//!   if (guard.getGlobalFn("myFn") != null) {
//!       guard.pcallSafe(0, 0, "myFn") catch {};
//!   }
//!
//! For load+call sequences (evalScript / evalExpr):
//!   const guard = lua_guard.StackGuard.init(L);
//!   defer guard.deinit();
//!   if (lua.luaL_loadbuffer(L, src.ptr, src.len, "<name>") != 0) {
//!       lua_guard.logLuaError(L, "load error");
//!       lua.lua_pop(L, 1);
//!       return;
//!   }
//!   guard.pcallSafe(0, 0, "run") catch {};

const std = @import("std");
const builtin = @import("builtin");

/// Shared Lua C bindings. Import this in luajit_runtime.zig via:
///   const lua = @import("lua_guard.zig").lua;
/// to ensure both files use the same lua_State type.
pub const lua = @cImport({
    @cInclude("lua.h");
    @cInclude("lauxlib.h");
    @cInclude("lualib.h");
});

/// Log the error at stack top with context. Does NOT pop the error.
pub fn logLuaError(L: *lua.lua_State, context: []const u8) void {
    var len: usize = 0;
    const err = lua.lua_tolstring(L, -1, &len);
    if (err != null) {
        const msg: []const u8 = @as([*]const u8, @ptrCast(err))[0..len];
        std.log.err("[luajit-runtime] {s}: {s}", .{ context, msg });
    }
}

pub const StackGuard = struct {
    L: *lua.lua_State,
    expected: c_int,

    /// Capture the current stack top. Call before pushing anything for this operation.
    pub fn init(L: *lua.lua_State) StackGuard {
        return .{
            .L = L,
            .expected = lua.lua_gettop(L),
        };
    }

    /// Debug: assert stack matches expected height (panics on imbalance).
    /// Release: lua_settop to silently restore any imbalance.
    pub fn deinit(self: StackGuard) void {
        if (builtin.mode == .Debug) {
            const top = lua.lua_gettop(self.L);
            if (top != self.expected) {
                std.log.err("[lua-guard] stack imbalance: expected {d}, got {d}", .{ self.expected, top });
            }
            std.debug.assert(top == self.expected);
        } else {
            lua.lua_settop(self.L, self.expected);
        }
    }

    /// Wrap lua_pcall. On failure: log with context, pop error, return error.LuaError.
    /// Caller never needs to manually pop error messages.
    pub fn pcallSafe(self: StackGuard, nargs: c_int, nresults: c_int, context: []const u8) error{LuaError}!void {
        if (lua.lua_pcall(self.L, nargs, nresults, 0) != 0) {
            logLuaError(self.L, context);
            lua.lua_pop(self.L, 1);
            return error.LuaError;
        }
    }

    /// lua_getglobal + isfunction check.
    /// Returns {} (non-null) and leaves the function on stack for the caller to pcallSafe.
    /// Returns null and pops if the global is not a function.
    pub fn getGlobalFn(self: StackGuard, name: [*:0]const u8) ?void {
        _ = lua.lua_getglobal(self.L, name);
        if (lua.lua_isfunction(self.L, -1)) {
            return {};
        }
        lua.lua_pop(self.L, 1);
        return null;
    }
};
