//! Test cart using framework/api.zig — zero framework source compilation.

const std = @import("std");
const api = @import("framework/api.zig");
const Node = api.Node;
const Style = api.Style;
const Color = api.Color;

var _arr_0 = [_]Node{
    .{ .text = "Hello from API cart!", .font_size = 24, .text_color = Color.rgb(255, 255, 255) },
};

var _root = Node{
    .style = .{ .width = 800, .height = 600, .padding = 32, .background_color = Color.rgb(30, 30, 42) },
    .children = &_arr_0,
};

const JS_LOGIC =
    \\
;
const LUA_LOGIC =
    \\
;

fn _appInit() void {
    _ = api.state.createSlot(0);
}
fn _appTick(now: u32) void {
    _ = now;
    if (api.state.isDirty()) api.state.clearDirty();
}

export fn app_get_root() *Node { return &_root; }
export fn app_get_init() ?*const fn () void { return _appInit; }
export fn app_get_tick() ?*const fn (u32) void { return _appTick; }
export fn app_get_js_logic() [*]const u8 { return JS_LOGIC.ptr; }
export fn app_get_js_logic_len() usize { return JS_LOGIC.len; }
export fn app_get_lua_logic() [*]const u8 { return LUA_LOGIC.ptr; }
export fn app_get_lua_logic_len() usize { return LUA_LOGIC.len; }
export fn app_get_title() [*:0]const u8 { return "test-api"; }
export fn app_state_count() usize { return 1; }
