//! CSS easing name → Zig transition enum field mapping rules.
//!
//! To add a new easing function: add one entry to the array.

pub const Entry = struct { css: []const u8, zig: []const u8 };

pub const easings = [_]Entry{
    .{ .css = "linear", .zig = "linear" },
    .{ .css = "easeIn", .zig = "ease_in" },
    .{ .css = "easeOut", .zig = "ease_out" },
    .{ .css = "easeInOut", .zig = "ease_in_out" },
    .{ .css = "spring", .zig = "spring" },
    .{ .css = "bounce", .zig = "bounce" },
    .{ .css = "elastic", .zig = "elastic" },
    // CSS standard kebab-case names
    .{ .css = "ease-in", .zig = "ease_in" },
    .{ .css = "ease-out", .zig = "ease_out" },
    .{ .css = "ease-in-out", .zig = "ease_in_out" },
};

pub const default = "ease_in_out";
