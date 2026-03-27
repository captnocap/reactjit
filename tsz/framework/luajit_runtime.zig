//! LuaJIT Runtime — main-thread logic VM for .tsz script blocks.
//!
//! Replaces QuickJS for the logic layer. LuaJIT's trace compiler JITs hot paths
//! to native code — 2-11x faster than QuickJS on conditionals, .map(), state, compute.
//!
//! Architecture:
//!   - Main-thread LuaJIT VM (NOT the background worker — this runs event handlers)
//!   - Host functions mirror qjs_runtime.zig: state get/set, input, mouse, telemetry
//!   - tsl_stdlib loaded at init (.map, .filter, .find, merge, etc.)
//!   - evalExpr() for event handlers, tick() for per-frame logic
//!
//! The compiler can emit Lua instead of JS for script blocks. The engine calls
//! luajit_runtime.tick() each frame and luajit_runtime.evalExpr() on events.

const std = @import("std");
const state = @import("state.zig");
const input_mod = @import("input.zig");

const lua = @cImport({
    @cInclude("lua.h");
    @cInclude("lauxlib.h");
    @cInclude("lualib.h");
});

// ── Global VM state ─────────────────────────────────────────────────────

var g_lua: ?*lua.lua_State = null;

// ── Telemetry (read from engine.zig) ────────────────────────────────────

pub var telemetry_fps: u32 = 0;
pub var telemetry_layout_us: u64 = 0;
pub var telemetry_paint_us: u64 = 0;
pub var telemetry_tick_us: u64 = 0;
pub var bridge_calls_this_second: u64 = 0;
var bridge_last_reset: i64 = 0;

// ── Host functions ──────────────────────────────────────────────────────

fn hostSetState(L: ?*lua.lua_State) callconv(.c) c_int {
    const slot = lua.lua_tointeger(L, 1);
    if (slot < 0 or slot >= state.MAX_SLOTS) return 0;
    switch (state.getSlotKind(@intCast(slot))) {
        .string => {
            var len: usize = 0;
            const ptr = lua.lua_tolstring(L, 2, &len);
            if (ptr == null) return 0;
            const s: []const u8 = @as([*]const u8, @ptrCast(ptr))[0..len];
            state.setSlotString(@intCast(slot), s);
        },
        .float => {
            const val = lua.lua_tonumber(L, 2);
            state.setSlotFloat(@intCast(slot), val);
        },
        .boolean => {
            state.setSlotBool(@intCast(slot), lua.lua_toboolean(L, 2) != 0);
        },
        .int => {
            state.setSlot(@intCast(slot), lua.lua_tointeger(L, 2));
        },
    }
    state.markDirty();
    bridge_calls_this_second += 1;
    return 0;
}

fn hostGetState(L: ?*lua.lua_State) callconv(.c) c_int {
    const slot = lua.lua_tointeger(L, 1);
    if (slot < 0 or slot >= state.MAX_SLOTS) {
        lua.lua_pushnumber(L, 0);
        return 1;
    }
    switch (state.getSlotKind(@intCast(slot))) {
        .float => lua.lua_pushnumber(L, state.getSlotFloat(@intCast(slot))),
        .boolean => lua.lua_pushnumber(L, if (state.getSlotBool(@intCast(slot))) 1 else 0),
        .int => lua.lua_pushnumber(L, @floatFromInt(state.getSlot(@intCast(slot)))),
        .string => lua.lua_pushnumber(L, 0),
    }
    return 1;
}

fn hostSetStateString(L: ?*lua.lua_State) callconv(.c) c_int {
    const slot = lua.lua_tointeger(L, 1);
    if (slot < 0 or slot >= state.MAX_SLOTS) return 0;
    var len: usize = 0;
    const ptr = lua.lua_tolstring(L, 2, &len);
    if (ptr == null) return 0;
    const s: []const u8 = @as([*]const u8, @ptrCast(ptr))[0..len];
    state.setSlotString(@intCast(slot), s);
    state.markDirty();
    bridge_calls_this_second += 1;
    return 0;
}

fn hostGetStateString(L: ?*lua.lua_State) callconv(.c) c_int {
    const slot = lua.lua_tointeger(L, 1);
    if (slot < 0 or slot >= state.MAX_SLOTS) {
        lua.lua_pushstring(L, "");
        return 1;
    }
    const s = state.getSlotString(@intCast(slot));
    lua.lua_pushlstring(L, s.ptr, @intCast(s.len));
    return 1;
}

fn hostMarkDirty(_: ?*lua.lua_State) callconv(.c) c_int {
    state.markDirty();
    return 0;
}

fn hostLog(L: ?*lua.lua_State) callconv(.c) c_int {
    var len: usize = 0;
    const ptr = lua.lua_tolstring(L, 1, &len);
    if (ptr != null) {
        const msg: []const u8 = @as([*]const u8, @ptrCast(ptr))[0..len];
        std.log.info("[Lua] {s}", .{msg});
    }
    return 0;
}

fn hostGetInputText(L: ?*lua.lua_State) callconv(.c) c_int {
    const id = lua.lua_tointeger(L, 1);
    const text = input_mod.getText(@intCast(@max(0, id)));
    if (text.len == 0) {
        lua.lua_pushstring(L, "");
    } else {
        lua.lua_pushlstring(L, text.ptr, @intCast(text.len));
    }
    return 1;
}

// ── Mouse/keyboard polling ──────────────────────────────────────────────

var g_mouse_x: f32 = 0;
var g_mouse_y: f32 = 0;
var g_mouse_down: bool = false;
var g_mouse_right_down: bool = false;

/// Called by engine.zig on mouse motion
pub fn updateMouse(x: f32, y: f32) void {
    g_mouse_x = x;
    g_mouse_y = y;
}

/// Called by engine.zig on mouse button events
pub fn updateMouseButton(down: bool, right: bool) void {
    if (right) {
        g_mouse_right_down = down;
    } else {
        g_mouse_down = down;
    }
}

fn hostGetMouseX(L: ?*lua.lua_State) callconv(.c) c_int {
    lua.lua_pushnumber(L, g_mouse_x);
    return 1;
}

fn hostGetMouseY(L: ?*lua.lua_State) callconv(.c) c_int {
    lua.lua_pushnumber(L, g_mouse_y);
    return 1;
}

fn hostGetMouseDown(L: ?*lua.lua_State) callconv(.c) c_int {
    lua.lua_pushboolean(L, if (g_mouse_down) 1 else 0);
    return 1;
}

fn hostGetMouseRightDown(L: ?*lua.lua_State) callconv(.c) c_int {
    lua.lua_pushboolean(L, if (g_mouse_right_down) 1 else 0);
    return 1;
}

// ── Telemetry host functions ────────────────────────────────────────────

fn hostGetFps(L: ?*lua.lua_State) callconv(.c) c_int {
    lua.lua_pushnumber(L, @floatFromInt(telemetry_fps));
    return 1;
}

fn hostGetLayoutUs(L: ?*lua.lua_State) callconv(.c) c_int {
    lua.lua_pushnumber(L, @floatFromInt(telemetry_layout_us));
    return 1;
}

fn hostGetPaintUs(L: ?*lua.lua_State) callconv(.c) c_int {
    lua.lua_pushnumber(L, @floatFromInt(telemetry_paint_us));
    return 1;
}

fn hostGetTickUs(L: ?*lua.lua_State) callconv(.c) c_int {
    lua.lua_pushnumber(L, @floatFromInt(telemetry_tick_us));
    return 1;
}

// ── TSL stdlib (embedded) ───────────────────────────────────────────────

const TSL_STDLIB =
    \\-- tsl_stdlib: JS array/object/string methods for LuaJIT
    \\-- Auto-loaded by luajit_runtime. Used by compiler Lua output.
    \\__tsl = {}
    \\
    \\function __tsl.map(arr, fn)
    \\  local result = {}
    \\  for i = 1, #arr do result[i] = fn(arr[i], i, arr) end
    \\  return result
    \\end
    \\
    \\function __tsl.filter(arr, fn)
    \\  local result, j = {}, 1
    \\  for i = 1, #arr do
    \\    if fn(arr[i], i, arr) then result[j] = arr[i]; j = j + 1 end
    \\  end
    \\  return result
    \\end
    \\
    \\function __tsl.find(arr, fn)
    \\  for i = 1, #arr do if fn(arr[i], i, arr) then return arr[i] end end
    \\  return nil
    \\end
    \\
    \\function __tsl.forEach(arr, fn)
    \\  for i = 1, #arr do fn(arr[i], i, arr) end
    \\end
    \\
    \\function __tsl.indexOf(arr, value)
    \\  for i = 1, #arr do if arr[i] == value then return i end end
    \\  return -1
    \\end
    \\
    \\function __tsl.merge(...)
    \\  local result = {}
    \\  for i = 1, select("#", ...) do
    \\    local t = select(i, ...)
    \\    if t then for k, v in pairs(t) do result[k] = v end end
    \\  end
    \\  return result
    \\end
    \\
    \\function __tsl.push(arr, val)
    \\  arr[#arr+1] = val
    \\  return #arr
    \\end
    \\
    \\function __tsl.join(arr, sep)
    \\  return table.concat(arr, sep or ",")
    \\end
    \\
    \\function __tsl.slice(arr, from, to)
    \\  local result = {}
    \\  from = from or 1
    \\  to = to or #arr
    \\  for i = from, to do result[#result+1] = arr[i] end
    \\  return result
    \\end
    \\
    \\function __tsl.includes(arr, val)
    \\  for i = 1, #arr do if arr[i] == val then return true end end
    \\  return false
    \\end
    \\
    \\function __tsl.reduce(arr, fn, init)
    \\  local acc = init
    \\  local start = 1
    \\  if acc == nil then acc = arr[1]; start = 2 end
    \\  for i = start, #arr do acc = fn(acc, arr[i], i, arr) end
    \\  return acc
    \\end
    \\
    \\function __tsl.keys(obj)
    \\  local result = {}
    \\  for k in pairs(obj) do result[#result+1] = k end
    \\  return result
    \\end
    \\
    \\function __tsl.values(obj)
    \\  local result = {}
    \\  for _, v in pairs(obj) do result[#result+1] = v end
    \\  return result
    \\end
    \\
    \\-- String methods
    \\function __tsl.split(s, sep)
    \\  local result = {}
    \\  for part in s:gmatch("[^" .. (sep or ",") .. "]+") do
    \\    result[#result+1] = part
    \\  end
    \\  return result
    \\end
    \\
    \\function __tsl.trim(s) return s:match("^%s*(.-)%s*$") end
    \\function __tsl.startsWith(s, prefix) return s:sub(1, #prefix) == prefix end
    \\function __tsl.endsWith(s, suffix) return s:sub(-#suffix) == suffix end
    \\function __tsl.toUpperCase(s) return s:upper() end
    \\function __tsl.toLowerCase(s) return s:lower() end
;

// ── Init / Deinit ───────────────────────────────────────────────────────

pub fn initVM() void {
    const L = lua.luaL_newstate() orelse {
        std.log.err("[luajit-runtime] Failed to create Lua state", .{});
        return;
    };
    lua.luaL_openlibs(L);
    g_lua = L;

    // Register host functions
    const funcs = [_]struct { name: [*:0]const u8, func: lua.lua_CFunction }{
        .{ .name = "__setState", .func = &hostSetState },
        .{ .name = "__getState", .func = &hostGetState },
        .{ .name = "__setStateString", .func = &hostSetStateString },
        .{ .name = "__getStateString", .func = &hostGetStateString },
        .{ .name = "__markDirty", .func = &hostMarkDirty },
        .{ .name = "__hostLog", .func = &hostLog },
        .{ .name = "getInputText", .func = &hostGetInputText },
        .{ .name = "getMouseX", .func = &hostGetMouseX },
        .{ .name = "getMouseY", .func = &hostGetMouseY },
        .{ .name = "getMouseDown", .func = &hostGetMouseDown },
        .{ .name = "getMouseRightDown", .func = &hostGetMouseRightDown },
        .{ .name = "getFps", .func = &hostGetFps },
        .{ .name = "getLayoutUs", .func = &hostGetLayoutUs },
        .{ .name = "getPaintUs", .func = &hostGetPaintUs },
        .{ .name = "getTickUs", .func = &hostGetTickUs },
    };

    for (funcs) |f| {
        lua.lua_pushcclosure(L, f.func, 0);
        lua.lua_setglobal(L, f.name);
    }

    // Load tsl_stdlib
    if (lua.luaL_loadstring(L, TSL_STDLIB) == 0) {
        if (lua.lua_pcall(L, 0, 0, 0) != 0) {
            logLuaError(L, "tsl_stdlib init");
            lua.lua_pop(L, 1);
        }
    } else {
        logLuaError(L, "tsl_stdlib load");
        lua.lua_pop(L, 1);
    }

    std.log.info("[luajit-runtime] VM initialized with tsl_stdlib", .{});
}

pub fn deinit() void {
    if (g_lua) |L| {
        lua.lua_close(L);
        g_lua = null;
    }
}

// ── Script evaluation ───────────────────────────────────────────────────

/// Load and run the app's Lua logic (equivalent to qjs_runtime.evalScript)
pub fn evalScript(lua_logic: []const u8) void {
    const L = g_lua orelse return;
    if (lua_logic.len == 0) return;

    if (lua.luaL_loadbuffer(L, lua_logic.ptr, lua_logic.len, "<app>") != 0) {
        logLuaError(L, "evalScript load");
        lua.lua_pop(L, 1);
        return;
    }
    if (lua.lua_pcall(L, 0, 0, 0) != 0) {
        logLuaError(L, "evalScript run");
        lua.lua_pop(L, 1);
    }
}

/// Eval a Lua expression (equivalent to qjs_runtime.evalExpr — called on events)
pub fn evalExpr(code: []const u8) void {
    const L = g_lua orelse return;
    if (code.len == 0) return;

    if (lua.luaL_loadbuffer(L, code.ptr, code.len, "<handler>") != 0) {
        logLuaError(L, "evalExpr");
        lua.lua_pop(L, 1);
        return;
    }
    if (lua.lua_pcall(L, 0, 0, 0) != 0) {
        logLuaError(L, "evalExpr");
        lua.lua_pop(L, 1);
    }
}

/// Call a global Lua function by name (no arguments)
pub fn callGlobal(name: [*:0]const u8) void {
    const L = g_lua orelse return;
    _ = lua.lua_getglobal(L, name);
    if (lua.lua_isfunction(L, -1)) {
        if (lua.lua_pcall(L, 0, 0, 0) != 0) {
            logLuaError(L, std.mem.span(name));
            lua.lua_pop(L, 1);
        }
    } else {
        lua.lua_pop(L, 1);
    }
}

/// Call a global Lua function with one string argument
pub fn callGlobalStr(name: [*:0]const u8, arg: [*:0]const u8) void {
    const L = g_lua orelse return;
    _ = lua.lua_getglobal(L, name);
    if (lua.lua_isfunction(L, -1)) {
        lua.lua_pushstring(L, arg);
        if (lua.lua_pcall(L, 1, 0, 0) != 0) {
            logLuaError(L, std.mem.span(name));
            lua.lua_pop(L, 1);
        }
    } else {
        lua.lua_pop(L, 1);
    }
}

/// Call a global Lua function with one integer argument
pub fn callGlobalInt(name: [*:0]const u8, arg: i64) void {
    const L = g_lua orelse return;
    _ = lua.lua_getglobal(L, name);
    if (lua.lua_isfunction(L, -1)) {
        lua.lua_pushinteger(L, @intCast(arg));
        if (lua.lua_pcall(L, 1, 0, 0) != 0) {
            logLuaError(L, std.mem.span(name));
            lua.lua_pop(L, 1);
        }
    } else {
        lua.lua_pop(L, 1);
    }
}

/// Check if a global Lua function exists
pub fn hasGlobal(name: [*:0]const u8) bool {
    const L = g_lua orelse return false;
    _ = lua.lua_getglobal(L, name);
    const is_fn = lua.lua_isfunction(L, -1);
    lua.lua_pop(L, 1);
    return is_fn;
}

/// Per-frame tick — calls __zigOS_tick if defined (same as QJS)
pub fn tick() void {
    const L = g_lua orelse return;
    const t0 = std.time.microTimestamp();

    _ = lua.lua_getglobal(L, "__zigOS_tick");
    if (lua.lua_isfunction(L, -1)) {
        if (lua.lua_pcall(L, 0, 0, 0) != 0) {
            logLuaError(L, "tick");
            lua.lua_pop(L, 1);
        }
    } else {
        lua.lua_pop(L, 1);
    }

    telemetry_tick_us = @intCast(std.time.microTimestamp() - t0);

    // Reset bridge call counter every second
    const now = std.time.microTimestamp();
    if (now - bridge_last_reset > 1_000_000) {
        bridge_calls_this_second = 0;
        bridge_last_reset = now;
    }
}

// ── Error helper ────────────────────────────────────────────────────────

fn logLuaError(L: *lua.lua_State, context: []const u8) void {
    var len: usize = 0;
    const err = lua.lua_tolstring(L, -1, &len);
    if (err != null) {
        const msg: []const u8 = @as([*]const u8, @ptrCast(err))[0..len];
        std.log.err("[luajit-runtime] {s}: {s}", .{ context, msg });
    }
}
