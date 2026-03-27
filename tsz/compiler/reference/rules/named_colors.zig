//! CSS named color → RGB mapping rules.
//!
//! To add a new named color: add one entry to the array.

pub const Entry = struct { name: []const u8, r: u8, g: u8, b: u8 };

pub const colors = [_]Entry{
    .{ .name = "black", .r = 0, .g = 0, .b = 0 },
    .{ .name = "white", .r = 255, .g = 255, .b = 255 },
    .{ .name = "red", .r = 255, .g = 0, .b = 0 },
    .{ .name = "green", .r = 0, .g = 128, .b = 0 },
    .{ .name = "blue", .r = 0, .g = 0, .b = 255 },
    .{ .name = "yellow", .r = 255, .g = 255, .b = 0 },
    .{ .name = "cyan", .r = 0, .g = 255, .b = 255 },
    .{ .name = "magenta", .r = 255, .g = 0, .b = 255 },
    .{ .name = "gray", .r = 128, .g = 128, .b = 128 },
    .{ .name = "grey", .r = 128, .g = 128, .b = 128 },
    .{ .name = "silver", .r = 192, .g = 192, .b = 192 },
    .{ .name = "orange", .r = 255, .g = 165, .b = 0 },
    .{ .name = "transparent", .r = 0, .g = 0, .b = 0 },
};
