//! Bouncing Balls — hand-authored physics demo
//! This is what the compiler will eventually generate for a .tsz with Physics.* elements.
//! Build: copy to generated_app.zig and run `zig build app`

const std = @import("std");
const layout = @import("framework/layout.zig");
const engine = @import("framework/engine.zig");
const physics2d = @import("framework/physics2d.zig");
const Node = layout.Node;
const Style = layout.Style;
const Color = layout.Color;
const state = @import("framework/state.zig");

// ── State manifest ──────────────────────────────────────────────
// slot 0: ball_count (int)
comptime { if (1 != 1) @compileError("state slot count mismatch"); }

// ── Node tree ───────────────────────────────────────────────────
// Physics.World (gravity=[0, 980])
//   Physics.Body type="static" x=400 y=580
//     Physics.Collider shape="rectangle" width=800 height=40
//     Box (platform visual)
//   Physics.Body type="dynamic" x=200 y=100
//     Physics.Collider shape="circle" radius=20
//     Box (ball visual)
//   ... more balls

// Ball visuals (positioned by physics)
var _ball_0 = [_]Node{.{ .style = .{ .width = 40, .height = 40, .border_radius = 20, .background_color = Color.rgb(239, 68, 68) } }};
var _ball_1 = [_]Node{.{ .style = .{ .width = 40, .height = 40, .border_radius = 20, .background_color = Color.rgb(59, 130, 246) } }};
var _ball_2 = [_]Node{.{ .style = .{ .width = 40, .height = 40, .border_radius = 20, .background_color = Color.rgb(34, 197, 94) } }};
var _ball_3 = [_]Node{.{ .style = .{ .width = 40, .height = 40, .border_radius = 20, .background_color = Color.rgb(245, 158, 11) } }};
var _ball_4 = [_]Node{.{ .style = .{ .width = 40, .height = 40, .border_radius = 20, .background_color = Color.rgb(168, 85, 247) } }};

// Platform visual
var _platform = [_]Node{.{ .style = .{ .width = 800, .height = 40, .background_color = Color.rgb(68, 64, 60), .border_radius = 4 } }};

// Physics body containers — children include collider (invisible) + visual
var _body_floor = [_]Node{.{ .physics_body = true, .physics_body_type = 0, .physics_x = 400, .physics_y = 560, .children = &_platform }};
var _body_ball_0 = [_]Node{.{ .physics_body = true, .physics_body_type = 2, .physics_x = 200, .physics_y = 80, .children = &_ball_0 }};
var _body_ball_1 = [_]Node{.{ .physics_body = true, .physics_body_type = 2, .physics_x = 350, .physics_y = 40, .children = &_ball_1 }};
var _body_ball_2 = [_]Node{.{ .physics_body = true, .physics_body_type = 2, .physics_x = 500, .physics_y = 120, .children = &_ball_2 }};
var _body_ball_3 = [_]Node{.{ .physics_body = true, .physics_body_type = 2, .physics_x = 650, .physics_y = 60, .children = &_ball_3 }};
var _body_ball_4 = [_]Node{.{ .physics_body = true, .physics_body_type = 2, .physics_x = 300, .physics_y = 160, .children = &_ball_4 }};

// Header
var _header = [_]Node{
    .{ .text = "2D Physics — Bouncing Balls", .font_size = 20, .text_color = Color.rgb(231, 229, 228) },
    .{ .text = "", .font_size = 12, .text_color = Color.rgb(120, 113, 108) },
};

// Physics world container
var _physics_world = [_]Node{
    .{ .physics_world = true, .physics_gravity_x = 0, .physics_gravity_y = 980, .style = .{ .flex_grow = 1 }, .children = &_bodies },
};

// All bodies in the world
var _bodies = [_]Node{
    .{ .physics_body = true, .physics_body_type = 0, .physics_x = 400, .physics_y = 560, .children = &_platform },
    .{ .physics_body = true, .physics_body_type = 2, .physics_x = 200, .physics_y = 80, .children = &_ball_0 },
    .{ .physics_body = true, .physics_body_type = 2, .physics_x = 350, .physics_y = 40, .children = &_ball_1 },
    .{ .physics_body = true, .physics_body_type = 2, .physics_x = 500, .physics_y = 120, .children = &_ball_2 },
    .{ .physics_body = true, .physics_body_type = 2, .physics_x = 650, .physics_y = 60, .children = &_ball_3 },
    .{ .physics_body = true, .physics_body_type = 2, .physics_x = 300, .physics_y = 160, .children = &_ball_4 },
};

// Root
var _root = Node{ .style = .{ .width = -1, .height = -1, .flex_direction = .column, .background_color = Color.rgb(12, 10, 9), .padding = 12, .gap = 8 }, .children = &_root_children };
var _root_children = [_]Node{
    .{ .text = "2D Physics — Bouncing Balls", .font_size = 20, .text_color = Color.rgb(231, 229, 228) },
    .{ .text = "", .font_size = 12, .text_color = Color.rgb(120, 113, 108) },
    .{ .physics_world = true, .physics_gravity_x = 0, .physics_gravity_y = 980, .style = .{ .flex_grow = 1 }, .children = &_bodies },
};

// Dynamic text buffer for body count
var _dyn_buf_0: [64]u8 = undefined;
var _dyn_text_0: []const u8 = "";

fn _initPhysics() void {
    // Create world
    physics2d.init(0, 980);

    // Floor — static body with box collider
    if (physics2d.createBody(.static_body, 400, 560, 0, &_bodies[0].children[0])) |idx| {
        physics2d.addBoxCollider(idx, 800, 40, 0, 0.3, 0.1);
    }

    // Ball 0 — dynamic with circle collider
    if (physics2d.createBody(.dynamic, 200, 80, 0, &_bodies[1].children[0])) |idx| {
        physics2d.addCircleCollider(idx, 20, 1.0, 0.3, 0.6);
    }
    // Ball 1
    if (physics2d.createBody(.dynamic, 350, 40, 0, &_bodies[2].children[0])) |idx| {
        physics2d.addCircleCollider(idx, 20, 1.0, 0.3, 0.7);
    }
    // Ball 2
    if (physics2d.createBody(.dynamic, 500, 120, 0, &_bodies[3].children[0])) |idx| {
        physics2d.addCircleCollider(idx, 20, 1.0, 0.3, 0.5);
    }
    // Ball 3
    if (physics2d.createBody(.dynamic, 650, 60, 0, &_bodies[4].children[0])) |idx| {
        physics2d.addCircleCollider(idx, 20, 1.0, 0.3, 0.8);
    }
    // Ball 4
    if (physics2d.createBody(.dynamic, 300, 160, 0, &_bodies[5].children[0])) |idx| {
        physics2d.addCircleCollider(idx, 20, 1.0, 0.3, 0.65);
    }
}

fn _initState() void {
    _ = state.createSlot(5); // ball count
}

fn _updateDynamicTexts() void {
    _dyn_text_0 = std.fmt.bufPrint(&_dyn_buf_0, "Bodies: {d}", .{physics2d.activeCount()}) catch "";
    _root_children[1].text = _dyn_text_0;
}

const JS_LOGIC =
    \\
;

fn _appInit() void {
    _initState();
    _initPhysics();
}

fn _appTick(now: u32) void {
    _ = now;
    _updateDynamicTexts();
}

pub fn main() !void {
    try engine.run(.{
        .title = "Bouncing Balls",
        .root = &_root,
        .js_logic = JS_LOGIC,
        .init = _appInit,
        .tick = _appTick,
    });
}
