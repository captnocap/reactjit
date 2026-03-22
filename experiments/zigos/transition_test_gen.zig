//! Manual test of transition codegen output.
//! This is what the compiler SHOULD generate for a .tsz with transition styles.
//! If this compiles, the codegen is correct.

const std = @import("std");
const layout = @import("framework/layout.zig");
const transition = @import("framework/transition.zig");
const Node = layout.Node;
const Color = layout.Color;

// Simulated state
var _mode: i32 = 0;

// Node tree (simplified)
var _arr_0 = [_]Node{
    // The animated box
    .{ .style = .{ .width = 100, .height = 40, .opacity = 0.3, .background_color = Color.rgb(239, 68, 68), .border_radius = 4 } },
    // Second animated box
    .{ .style = .{ .width = 80, .height = 80, .background_color = Color.rgb(139, 92, 246), .border_radius = 4 } },
};

// This is what the compiler emits in _appTick for DynStyles with transition_config:
fn _appTick() void {
    // DynStyle for width: transition.set() instead of direct assignment
    transition.set(&_arr_0[0], .width, .{ .float = if (_mode != 0) @as(f32, 400) else @as(f32, 100) }, .{ .duration_ms = 500, .delay_ms = 0, .easing = .{ .named = .ease_in_out } });

    // DynStyle for opacity
    transition.set(&_arr_0[0], .opacity, .{ .float = if (_mode != 0) @as(f32, 1.0) else @as(f32, 0.3) }, .{ .duration_ms = 300, .delay_ms = 0, .easing = .{ .named = .ease_out } });

    // DynStyle for borderRadius (bounce)
    transition.set(&_arr_0[1], .border_radius, .{ .float = if (_mode != 0) @as(f32, 40) else @as(f32, 4) }, .{ .duration_ms = 400, .delay_ms = 0, .easing = .{ .named = .bounce } });
}

test "transition codegen compiles" {
    transition.clear();

    // First tick with initial state — values match node defaults, no transitions start
    _mode = 0;
    _appTick();
    _ = transition.tick(1.0 / 60.0);
    try std.testing.expectEqual(@as(u32, 0), transition.activeCount());

    // Toggle state — values change, transitions should start
    _mode = 1;
    _appTick();
    try std.testing.expectEqual(@as(u32, 3), transition.activeCount());

    _ = transition.tick(1.0 / 60.0);

    // Width should have started moving from 100 toward 400
    try std.testing.expect(_arr_0[0].style.width.? > 100);

    // Opacity should have started moving from 0.3 toward 1.0
    try std.testing.expect(_arr_0[0].style.opacity > 0.3);

    // Run until completion
    for (0..120) |_| {
        _appTick();
        _ = transition.tick(1.0 / 60.0);
    }

    // Should have converged
    try std.testing.expect(@abs(_arr_0[0].style.width.? - 400) < 1);
    try std.testing.expect(@abs(_arr_0[0].style.opacity - 1.0) < 0.01);

    // Cleanup
    transition.clear();
}

test "retarget mid-animation" {
    transition.clear();
    // Reset node to initial state
    _arr_0[0].style.width = 100;
    _arr_0[0].style.opacity = 0.3;
    _arr_0[1].style.border_radius = 4;
    _mode = 1;
    _appTick();

    // Run halfway
    for (0..15) |_| {
        _ = transition.tick(1.0 / 60.0);
    }

    const mid_width = _arr_0[0].style.width.?;
    try std.testing.expect(mid_width > 100 and mid_width < 400);

    // Toggle back
    _mode = 0;
    _appTick(); // retargets from current value

    // Run a few more frames — should be heading back toward 100
    for (0..10) |_| {
        _ = transition.tick(1.0 / 60.0);
    }
    try std.testing.expect(_arr_0[0].style.width.? < mid_width);

    transition.clear();
}
