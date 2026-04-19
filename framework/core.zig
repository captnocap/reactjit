//! ReactJIT Core — framework root module for shared library builds.
//!
//! Re-exports framework modules AND provides C-ABI wrappers that
//! cart executables link against. The cart uses framework/api.zig
//! (types + extern declarations) and resolves functions from this .so.

pub const layout = @import("layout.zig");
pub const state_mod = @import("state.zig");
pub const engine_mod = @import("engine.zig");
pub const qjs_runtime_mod = @import("qjs_runtime.zig");
pub const luajit_runtime_mod = @import("luajit_runtime.zig");
// NOTE: llama.cpp symbols are in a separate libllama_ffi.so, not in the engine.
// Carts that use llama FFI link it via scripts/build auto-detection.

// ── State C-ABI exports ─────────────────────────────────────────────

export fn rjit_state_create_slot(initial: i64) usize {
    return state_mod.createSlot(initial);
}
export fn rjit_state_create_slot_float(initial: f64) usize {
    return state_mod.createSlotFloat(initial);
}
export fn rjit_state_create_slot_bool(initial: bool) usize {
    return state_mod.createSlotBool(initial);
}
export fn rjit_state_create_slot_string(ptr: [*]const u8, len: usize) usize {
    return state_mod.createSlotString(ptr[0..len]);
}
export fn rjit_state_get_slot(id: usize) i64 {
    return state_mod.getSlot(id);
}
export fn rjit_state_set_slot(id: usize, val: i64) void {
    state_mod.setSlot(id, val);
}
export fn rjit_state_get_slot_float(id: usize) f64 {
    return state_mod.getSlotFloat(id);
}
export fn rjit_state_set_slot_float(id: usize, val: f64) void {
    state_mod.setSlotFloat(id, val);
}
export fn rjit_state_get_slot_bool(id: usize) bool {
    return state_mod.getSlotBool(id);
}
export fn rjit_state_set_slot_bool(id: usize, val: bool) void {
    state_mod.setSlotBool(id, val);
}
export fn rjit_state_get_slot_string_ptr(id: usize) [*]const u8 {
    return state_mod.getSlotString(id).ptr;
}
export fn rjit_state_get_slot_string_len(id: usize) usize {
    return state_mod.getSlotString(id).len;
}
export fn rjit_state_set_slot_string(id: usize, ptr: [*]const u8, len: usize) void {
    state_mod.setSlotString(id, ptr[0..len]);
}
export fn rjit_state_mark_dirty() void {
    state_mod.markDirty();
}
export fn rjit_state_is_dirty() bool {
    return state_mod.isDirty();
}
export fn rjit_state_clear_dirty() void {
    state_mod.clearDirty();
}

// ── Theme C-ABI exports ────────────────────────────────────────────

const theme_mod = @import("theme.zig");

export fn rjit_theme_active_variant() u8 {
    return theme_mod.activeVariant();
}
export fn rjit_theme_set_variant(v: u8) void {
    theme_mod.setVariant(v);
}

// ── Breakpoint C-ABI exports ───────────────────────────────────────

const bp_mod = @import("breakpoint.zig");

export fn rjit_breakpoint_current() u8 {
    return @intFromEnum(bp_mod.current());
}

// ── QJS Runtime C-ABI exports ───────────────────────────────────────

const std = @import("std");

export fn rjit_qjs_register_host_fn(name: [*:0]const u8, fn_ptr: ?*const anyopaque, argc: u8) void {
    if (fn_ptr) |p| {
        qjs_runtime_mod.registerHostFn(name, p, @as(c_int, argc));
    }
}
export fn rjit_qjs_call_global(name: [*:0]const u8) void {
    qjs_runtime_mod.callGlobal(name);
}
export fn rjit_qjs_call_global_str(name: [*:0]const u8, arg: [*:0]const u8) void {
    qjs_runtime_mod.callGlobalStr(name, arg);
}
export fn rjit_qjs_call_global_int(name: [*:0]const u8, arg: i64) void {
    qjs_runtime_mod.callGlobalInt(name, arg);
}
export fn rjit_qjs_eval_expr(expr: [*:0]const u8) void {
    qjs_runtime_mod.evalExpr(std.mem.span(expr));
}
export fn rjit_qjs_eval_to_string(expr: [*]const u8, expr_len: usize, buf: [*]u8, buf_len: usize) usize {
    var arr: [256]u8 = undefined;
    const result = qjs_runtime_mod.evalToString(expr[0..expr_len], &arr);
    const n = @min(result.len, buf_len);
    @memcpy(buf[0..n], result[0..n]);
    return n;
}
export fn rjit_qjs_eval_lua_map_data(index: usize, expr: [*]const u8, expr_len: usize) void {
    qjs_runtime_mod.evalLuaMapData(index, expr[0..expr_len]);
}
export fn rjit_qjs_sync_scalar_to_lua(name: [*:0]const u8) void {
    qjs_runtime_mod.syncScalarToLua(name);
}
export fn rjit_qjs_sync_lua_to_qjs(name: [*:0]const u8) void {
    qjs_runtime_mod.syncLuaToQjs(name);
}

// ── LuaJIT Runtime C-ABI exports ────────────────────────────────────
export fn rjit_lua_call_global(name: [*:0]const u8) void {
    luajit_runtime_mod.callGlobal(name);
}
export fn rjit_lua_set_map_wrapper(index: usize, ptr: *anyopaque) void {
    luajit_runtime_mod.setMapWrapper(index, ptr);
}
export fn rjit_lua_register_host_fn(name: [*:0]const u8, func: ?*const anyopaque, argc: c_int) void {
    luajit_runtime_mod.registerHostFn(name, func orelse return, argc);
}
export fn rjit_lua_set_global_int(name: [*:0]const u8, val: i64) void {
    luajit_runtime_mod.setGlobalInt(name, val);
}
export fn rjit_lua_set_effect_render(id: usize, fn_ptr: ?*const anyopaque) void {
    if (fn_ptr) |p| luajit_runtime_mod.setEffectRender(id, @ptrCast(@alignCast(p)));
}
export fn rjit_lua_set_effect_shader(id: usize, shader_ptr: ?*const anyopaque) void {
    if (shader_ptr) |p| luajit_runtime_mod.setEffectShader(id, @ptrCast(@alignCast(p)));
}

// ── Engine C-ABI export ──────��────────────────────────────────────���─

const api = @import("api.zig");

export fn rjit_engine_run(config: *const api.EngineConfig) c_int {
    engine_mod.run(.{
        .title = config.title,
        .root = @ptrCast(config.root),
        .js_logic = config.js_logic_ptr[0..config.js_logic_len],
        .lua_logic = config.lua_logic_ptr[0..config.lua_logic_len],
        .init = config.init,
        .tick = config.tick,
        .borderless = config.borderless,
    }) catch return 1;
    return 0;
}

// ── Window chrome C-ABI exports ─────────────────────────────────────

export fn rjit_window_close() void {
    engine_mod.windowClose();
}
export fn rjit_window_minimize() void {
    engine_mod.windowMinimize();
}
export fn rjit_window_maximize() void {
    engine_mod.windowMaximize();
}
export fn rjit_window_is_maximized() bool {
    return engine_mod.windowIsMaximized();
}
