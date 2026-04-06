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
const qjs_runtime = @import("qjs_runtime.zig");
const layout = @import("layout.zig");
const Node = layout.Node;
const Style = layout.Style;
const Color = layout.Color;

pub const lua = @cImport({
    @cInclude("lua.h");
    @cInclude("lauxlib.h");
    @cInclude("lualib.h");
});

// ── Global VM state ─────────────────────────────────────────────────────

pub var g_lua: ?*lua.lua_State = null;

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

// ── AppleScript bridge (macOS only, no-op on Linux) ─────────────────────
const applescript = @import("applescript.zig");

fn hostApplescript(L: ?*lua.lua_State) callconv(.c) c_int {
    const script_ptr = lua.lua_tolstring(L, 1, null);
    if (script_ptr == null) {
        lua.lua_pushstring(L, "ERROR: missing script argument");
        return 1;
    }
    const script = std.mem.span(script_ptr.?);
    applescript.run(script, 0); // async, result delivered via pollResult
    lua.lua_pushstring(L, "Running...");
    return 1;
}

fn hostApplescriptFile(_: ?*lua.lua_State) callconv(.c) c_int {
    return 0;
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
    \\
    \\-- Map data is populated directly via pushJSValueToLua (zero-copy FFI).
    \\-- No JSON serialization needed. See qjs_runtime.zig:evalLuaMapData.
;

// ── Lua Map Node Stamping ───────────────────────────────────────────────
// LuaJIT-side .map() support. Lua iterates the array and builds a template
// table, then calls __declareChildren(wrapperPtr, tmpl) to stamp Zig Nodes.

var lua_node_arena: std.heap.ArenaAllocator = std.heap.ArenaAllocator.init(std.heap.page_allocator);

fn readLuaColor(L: ?*lua.lua_State, idx: c_int) ?Color {
    if (lua.lua_isnumber(L, idx) != 0) {
        const val: u32 = @intCast(@as(i64, @intFromFloat(lua.lua_tonumber(L, idx))));
        return Color.rgb(@intCast((val >> 16) & 0xFF), @intCast((val >> 8) & 0xFF), @intCast(val & 0xFF));
    }
    return null;
}

fn readLuaOptFloat(L: ?*lua.lua_State, idx: c_int, field: [*:0]const u8) ?f32 {
    lua.lua_getfield(L, idx, field);
    const result: ?f32 = if (lua.lua_isnumber(L, -1) != 0) @floatCast(lua.lua_tonumber(L, -1)) else null;
    lua.lua_pop(L, 1);
    return result;
}

fn readLuaStyle(L: ?*lua.lua_State, idx: c_int) Style {
    var s = Style{};
    if (!lua.lua_istable(L, idx)) return s;
    if (readLuaOptFloat(L, idx, "flex_grow")) |v| s.flex_grow = v;
    if (readLuaOptFloat(L, idx, "gap")) |v| s.gap = v;
    if (readLuaOptFloat(L, idx, "width")) |v| s.width = v;
    if (readLuaOptFloat(L, idx, "height")) |v| s.height = v;
    if (readLuaOptFloat(L, idx, "padding")) |v| { s.padding_top = v; s.padding_bottom = v; s.padding_left = v; s.padding_right = v; }
    if (readLuaOptFloat(L, idx, "padding_top")) |v| s.padding_top = v;
    if (readLuaOptFloat(L, idx, "padding_bottom")) |v| s.padding_bottom = v;
    if (readLuaOptFloat(L, idx, "padding_left")) |v| s.padding_left = v;
    if (readLuaOptFloat(L, idx, "padding_right")) |v| s.padding_right = v;
    if (readLuaOptFloat(L, idx, "margin_top")) |v| s.margin_top = v;
    if (readLuaOptFloat(L, idx, "margin_bottom")) |v| s.margin_bottom = v;
    if (readLuaOptFloat(L, idx, "margin_left")) |v| s.margin_left = v;
    if (readLuaOptFloat(L, idx, "border_radius")) |v| s.border_radius = v;
    if (readLuaOptFloat(L, idx, "border_width")) |v| s.border_width = v;
    // justify_content: check string
    lua.lua_getfield(L, idx, "justify_content");
    if (lua.lua_isstring(L, -1) != 0) {
        var jlen: usize = 0;
        const jptr = lua.lua_tolstring(L, -1, &jlen);
        if (jptr != null) {
            const jc: []const u8 = @as([*]const u8, @ptrCast(jptr))[0..jlen];
            if (std.mem.eql(u8, jc, "center")) s.justify_content = .center
            else if (std.mem.eql(u8, jc, "spaceBetween")) s.justify_content = .space_between
            else if (std.mem.eql(u8, jc, "spaceAround")) s.justify_content = .space_around
            else if (std.mem.eql(u8, jc, "end")) s.justify_content = .end;
        }
    }
    lua.lua_pop(L, 1);
    // flex_direction: check string
    lua.lua_getfield(L, idx, "flex_direction");
    if (lua.lua_isstring(L, -1) != 0) {
        var len: usize = 0;
        const ptr = lua.lua_tolstring(L, -1, &len);
        if (ptr != null) {
            const dir: []const u8 = @as([*]const u8, @ptrCast(ptr))[0..len];
            if (std.mem.eql(u8, dir, "row")) s.flex_direction = .row;
        }
    }
    lua.lua_pop(L, 1);
    // background_color
    lua.lua_getfield(L, idx, "background_color");
    s.background_color = readLuaColor(L, -1) orelse Color{};
    lua.lua_pop(L, 1);
    // border_color
    lua.lua_getfield(L, idx, "border_color");
    if (readLuaColor(L, -1)) |c| s.border_color = c;
    lua.lua_pop(L, 1);
    // align_items
    lua.lua_getfield(L, idx, "align_items");
    if (lua.lua_isstring(L, -1) != 0) {
        var len: usize = 0;
        const ptr = lua.lua_tolstring(L, -1, &len);
        if (ptr != null) {
            const v: []const u8 = @as([*]const u8, @ptrCast(ptr))[0..len];
            if (std.mem.eql(u8, v, "center")) s.align_items = .center
            else if (std.mem.eql(u8, v, "flexStart") or std.mem.eql(u8, v, "start")) s.align_items = .start
            else if (std.mem.eql(u8, v, "flexEnd") or std.mem.eql(u8, v, "end")) s.align_items = .end;
        }
    }
    lua.lua_pop(L, 1);
    // align_self
    lua.lua_getfield(L, idx, "align_self");
    if (lua.lua_isstring(L, -1) != 0) {
        var len: usize = 0;
        const ptr = lua.lua_tolstring(L, -1, &len);
        if (ptr != null) {
            const v: []const u8 = @as([*]const u8, @ptrCast(ptr))[0..len];
            if (std.mem.eql(u8, v, "center")) s.align_self = .center
            else if (std.mem.eql(u8, v, "flexStart") or std.mem.eql(u8, v, "start")) s.align_self = .start
            else if (std.mem.eql(u8, v, "flexEnd") or std.mem.eql(u8, v, "end")) s.align_self = .end;
        }
    }
    lua.lua_pop(L, 1);
    // flex_wrap
    lua.lua_getfield(L, idx, "flex_wrap");
    if (lua.lua_isstring(L, -1) != 0) {
        var len: usize = 0;
        const ptr = lua.lua_tolstring(L, -1, &len);
        if (ptr != null and std.mem.eql(u8, @as([*]const u8, @ptrCast(ptr))[0..len], "wrap")) {
            s.flex_wrap = .wrap;
        }
    }
    lua.lua_pop(L, 1);
    // flex_shrink
    if (readLuaOptFloat(L, idx, "flex_shrink")) |v| s.flex_shrink = v;
    // max_width / max_height
    if (readLuaOptFloat(L, idx, "max_width")) |v| s.max_width = v;
    if (readLuaOptFloat(L, idx, "max_height")) |v| s.max_height = v;
    // overflow
    lua.lua_getfield(L, idx, "overflow");
    if (lua.lua_isstring(L, -1) != 0) {
        var len: usize = 0;
        const ptr = lua.lua_tolstring(L, -1, &len);
        if (ptr != null) {
            const v: []const u8 = @as([*]const u8, @ptrCast(ptr))[0..len];
            if (std.mem.eql(u8, v, "scroll")) s.overflow = .scroll
            else if (std.mem.eql(u8, v, "hidden")) s.overflow = .hidden
            else if (std.mem.eql(u8, v, "auto")) s.overflow = .auto;
        }
    }
    lua.lua_pop(L, 1);
    // display: "none"
    lua.lua_getfield(L, idx, "display");
    if (lua.lua_isstring(L, -1) != 0) {
        var len: usize = 0;
        const ptr = lua.lua_tolstring(L, -1, &len);
        if (ptr != null and std.mem.eql(u8, @as([*]const u8, @ptrCast(ptr))[0..len], "none")) {
            s.display = .none;
        }
    }
    lua.lua_pop(L, 1);
    return s;
}

fn stampLuaNode(L: ?*lua.lua_State, idx: c_int, alloc: std.mem.Allocator) Node {
    var node = Node{};
    if (!lua.lua_istable(L, idx)) return node;
    // text
    lua.lua_getfield(L, idx, "text");
    if (lua.lua_isstring(L, -1) != 0) {
        var len: usize = 0;
        const ptr = lua.lua_tolstring(L, -1, &len);
        if (ptr != null) {
            const copy = alloc.alloc(u8, len) catch {
                lua.lua_pop(L, 1);
                return node;
            };
            @memcpy(copy, @as([*]const u8, @ptrCast(ptr))[0..len]);
            node.text = copy;
        }
    }
    lua.lua_pop(L, 1);
    // font_size
    lua.lua_getfield(L, idx, "font_size");
    if (lua.lua_isnumber(L, -1) != 0) node.font_size = @intCast(@as(i64, @intFromFloat(lua.lua_tonumber(L, -1))));
    lua.lua_pop(L, 1);
    // text_color
    lua.lua_getfield(L, idx, "text_color");
    node.text_color = readLuaColor(L, -1);
    lua.lua_pop(L, 1);
    // style
    lua.lua_getfield(L, idx, "style");
    if (lua.lua_istable(L, -1)) node.style = readLuaStyle(L, -1);
    lua.lua_pop(L, 1);
    // lua_on_press handler (string → null-terminated copy for Zig)
    lua.lua_getfield(L, idx, "lua_on_press");
    if (lua.lua_isstring(L, -1) != 0) {
        var len: usize = 0;
        const ptr = lua.lua_tolstring(L, -1, &len);
        if (ptr != null and len > 0) {
            const copy = alloc.alloc(u8, len + 1) catch {
                lua.lua_pop(L, 1);
                return node;
            };
            @memcpy(copy[0..len], @as([*]const u8, @ptrCast(ptr))[0..len]);
            copy[len] = 0;
            node.handlers.lua_on_press = @ptrCast(copy[0..len :0]);
        }
    }
    lua.lua_pop(L, 1);
    // children (recursive) — handles __isMapResult expansion
    lua.lua_getfield(L, idx, "children");
    if (lua.lua_istable(L, -1)) {
        const n: usize = @intCast(lua.lua_objlen(L, -1));
        if (n > 0) {
            // Pass 1: count total children (expand __isMapResult arrays)
            var total: usize = 0;
            for (0..n) |i| {
                lua.lua_rawgeti(L, -1, @intCast(i + 1));
                if (lua.lua_istable(L, -1)) {
                    lua.lua_getfield(L, -1, "__isMapResult");
                    const is_map = lua.lua_toboolean(L, -1) != 0;
                    lua.lua_pop(L, 1);
                    if (is_map) {
                        total += @intCast(lua.lua_objlen(L, -1));
                    } else {
                        total += 1;
                    }
                } else if (!lua.lua_isnil(L, -1)) {
                    total += 1;
                }
                lua.lua_pop(L, 1);
            }
            if (total > 0) {
                const kids = alloc.alloc(Node, total) catch {
                    lua.lua_pop(L, 1);
                    return node;
                };
                // Pass 2: fill children (expand map results inline)
                var ki: usize = 0;
                for (0..n) |i| {
                    lua.lua_rawgeti(L, -1, @intCast(i + 1));
                    if (lua.lua_istable(L, -1)) {
                        lua.lua_getfield(L, -1, "__isMapResult");
                        const is_map = lua.lua_toboolean(L, -1) != 0;
                        lua.lua_pop(L, 1);
                        if (is_map) {
                            const mn: usize = @intCast(lua.lua_objlen(L, -1));
                            for (0..mn) |mi| {
                                lua.lua_rawgeti(L, -1, @intCast(mi + 1));
                                if (ki < total) {
                                    kids[ki] = stampLuaNode(L, -1, alloc);
                                    ki += 1;
                                }
                                lua.lua_pop(L, 1);
                            }
                        } else {
                            if (ki < total) {
                                kids[ki] = stampLuaNode(L, -1, alloc);
                                ki += 1;
                            }
                        }
                    }
                    lua.lua_pop(L, 1);
                }
                node.children = kids[0..ki];
            }
        }
    }
    lua.lua_pop(L, 1);
    return node;
}

fn hostDeclareChildren(L: ?*lua.lua_State) callconv(.c) c_int {
    // Arg 1: wrapper node pointer (lightuserdata)
    const wrapper_ptr = lua.lua_touserdata(L, 1) orelse return 0;
    const wrapper: *Node = @ptrCast(@alignCast(wrapper_ptr));
    // Arg 2: Lua table array of child node descriptions
    if (!lua.lua_istable(L, 2)) return 0;
    const count: usize = @intCast(lua.lua_objlen(L, 2));
    if (count == 0) {
        wrapper.children = &.{};
        return 0;
    }
    const alloc = lua_node_arena.allocator();
    const kids = alloc.alloc(Node, count) catch return 0;
    for (0..count) |i| {
        lua.lua_rawgeti(L, 2, @intCast(i + 1));
        kids[i] = stampLuaNode(L, -1, alloc);
        lua.lua_pop(L, 1);
    }
    wrapper.children = kids;
    return 0;
}

fn hostClearLuaNodes(_: ?*lua.lua_State) callconv(.c) c_int {
    // Clear any wrapper nodes' children before resetting arena
    // (prevents dangling pointers during re-stamp)
    for (0..16) |i| {
        var buf: [16]u8 = undefined;
        const name = std.fmt.bufPrint(&buf, "__mw{d}", .{i}) catch break;
        buf[name.len] = 0;
        const L = g_lua orelse break;
        lua.lua_getglobal(L, @as([*:0]const u8, @ptrCast(buf[0..name.len :0])));
        if (lua.lua_isuserdata(L, -1) != 0) {
            const ptr = lua.lua_touserdata(L, -1);
            if (ptr) |p| {
                const node: *Node = @ptrCast(@alignCast(p));
                node.children = &.{};
            }
        }
        lua.lua_pop(L, 1);
    }
    _ = lua_node_arena.reset(.retain_capacity);
    return 0;
}

/// __eval(jsExpr) → evaluates JS expression in QJS, returns result as string/number to Lua
fn hostEval(L: ?*lua.lua_State) callconv(.c) c_int {
    var len: usize = 0;
    const ptr = lua.lua_tolstring(L, 1, &len);
    if (ptr == null or len == 0) {
        lua.lua_pushnil(L);
        return 1;
    }
    const code: []const u8 = @as([*]const u8, @ptrCast(ptr))[0..len];
    var buf: [256]u8 = undefined;
    const result = qjs_runtime.evalToString(code, &buf);
    if (result.len == 0) {
        lua.lua_pushnil(L);
    } else {
        // Try to push as number if it looks like one
        var is_num = true;
        var has_dot = false;
        for (result) |ch| {
            if (ch == '.') { has_dot = true; continue; }
            if (ch == '-' or (ch >= '0' and ch <= '9')) continue;
            is_num = false;
            break;
        }
        if (is_num and result.len > 0) {
            if (has_dot) {
                const f = std.fmt.parseFloat(f64, result) catch 0.0;
                lua.lua_pushnumber(L, f);
            } else {
                const i = std.fmt.parseInt(i64, result, 10) catch 0;
                lua.lua_pushinteger(L, @intCast(i));
            }
        } else if (std.mem.eql(u8, result, "true")) {
            lua.lua_pushboolean(L, 1);
        } else if (std.mem.eql(u8, result, "false")) {
            lua.lua_pushboolean(L, 0);
        } else {
            lua.lua_pushlstring(L, result.ptr, result.len);
        }
    }
    return 1;
}

/// Set a map wrapper node as a Lua global lightuserdata (__mw0, __mw1, etc.)
pub fn setMapWrapper(index: usize, ptr: *anyopaque) void {
    const L = g_lua orelse return;
    lua.lua_pushlightuserdata(L, ptr);
    var buf: [16]u8 = undefined;
    const name_slice = std.fmt.bufPrint(&buf, "__mw{d}", .{index}) catch return;
    buf[name_slice.len] = 0;
    lua.lua_setglobal(L, @as([*:0]const u8, @ptrCast(buf[0..name_slice.len :0])));
}

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
        .{ .name = "__applescript", .func = &hostApplescript },
        .{ .name = "__applescript_file", .func = &hostApplescriptFile },
        .{ .name = "__declareChildren", .func = &hostDeclareChildren },
        .{ .name = "__clearLuaNodes", .func = &hostClearLuaNodes },
        .{ .name = "__eval", .func = &hostEval },
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

/// Register a host function as a Lua global (mirrors qjs_runtime.registerHostFn).
/// Called from generated _appInit() for per-cart functions like __setObjArr0.
pub fn registerHostFn(name: [*:0]const u8, func: *const anyopaque, argc: c_int) void {
    _ = argc;
    const L = g_lua orelse return;
    const FnType = lua.lua_CFunction;
    const lua_fn: FnType = @ptrCast(@alignCast(func));
    lua.lua_pushcclosure(L, lua_fn, 0);
    lua.lua_setglobal(L, name);
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
