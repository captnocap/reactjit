//! Test cart — uses @import("framework") module instead of file paths.
//! Built with: zig build cart-fast -Dapp-source=test_cart_fast.zig -Dapp-name=test-fast

const std = @import("std");
const build_options = @import("build_options");
const IS_LIB = if (@hasDecl(build_options, "is_lib")) build_options.is_lib else false;

const framework = @import("framework");
const layout = framework.layout;
const Node = layout.Node;
const Style = layout.Style;
const Color = layout.Color;
const state = framework.state;
const engine = framework.engine;

// ── Generated node tree ─────────────────────────────────────────
var _arr_0 = [_]Node{
    .{ .text = "Hello from fast cart!", .font_size = 24, .text_color = Color.rgb(255, 255, 255) },
};

var _root = Node{
    .style = .{ .width = 800, .height = 600, .padding = 32, .background_color = Color.rgb(30, 30, 42) },
    .children = &_arr_0,
};

// ── Embedded JS logic ────────────────────────────────────────────
const JS_LOGIC =
    \\
;

// ── Embedded Lua logic ───────────────────────────────────────────
const LUA_LOGIC =
    \\
;

fn _appInit() void {}
fn _appTick(now: u32) void { _ = now; }

export fn app_get_root() *Node { return &_root; }
export fn app_get_init() ?*const fn () void { return _appInit; }
export fn app_get_tick() ?*const fn (u32) void { return _appTick; }
export fn app_get_js_logic() [*]const u8 { return JS_LOGIC.ptr; }
export fn app_get_js_logic_len() usize { return JS_LOGIC.len; }
export fn app_get_lua_logic() [*]const u8 { return LUA_LOGIC.ptr; }
export fn app_get_lua_logic_len() usize { return LUA_LOGIC.len; }
export fn app_get_title() [*:0]const u8 { return "test-fast"; }
export fn app_state_count() usize { return 0; }

// Standalone mode
pub fn main() !void {
    if (IS_LIB) return;
    try engine.run(.{
        .title = "test-fast",
        .root = &_root,
        .js_logic = JS_LOGIC,
        .lua_logic = LUA_LOGIC,
        .init = _appInit,
        .tick = _appTick,
    });
}
