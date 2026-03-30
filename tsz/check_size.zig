const layout = @import("framework/layout.zig");
const std = @import("std");
pub fn main() void {
    std.debug.print("Node: {d} bytes\n", .{@sizeOf(layout.Node)});
    std.debug.print("Style: {d} bytes\n", .{@sizeOf(layout.Style)});
    std.debug.print("Color: {d} bytes\n", .{@sizeOf(layout.Color)});
    std.debug.print("LayoutRect: {d} bytes\n", .{@sizeOf(layout.LayoutRect)});
    std.debug.print("EventHandler: {d} bytes\n", .{@sizeOf(@import("framework/events.zig").EventHandler)});
}
