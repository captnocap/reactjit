//! Enum style property mapping rules.
//!
//! Maps camelCase CSS enum property names to Zig field names + value tables.
//! To add a new enum property: add an EnumKey entry and a values array.
//! To add a new value to an existing property: add an EnumValue entry.

pub const EnumKey = struct { css: []const u8, field: []const u8, prefix: []const u8 };
pub const EnumValue = struct { css: []const u8, zig: []const u8 };

/// CSS property name → Zig struct field + prefix for value lookup
pub const keys = [_]EnumKey{
    .{ .css = "flexDirection", .field = "flex_direction", .prefix = "fd" },
    .{ .css = "justifyContent", .field = "justify_content", .prefix = "jc" },
    .{ .css = "alignItems", .field = "align_items", .prefix = "ai" },
    .{ .css = "alignSelf", .field = "align_self", .prefix = "as" },
    .{ .css = "alignContent", .field = "align_content", .prefix = "ac" },
    .{ .css = "flexWrap", .field = "flex_wrap", .prefix = "fw" },
    .{ .css = "position", .field = "position", .prefix = "pos" },
    .{ .css = "display", .field = "display", .prefix = "d" },
    .{ .css = "textAlign", .field = "text_align", .prefix = "ta" },
    .{ .css = "overflow", .field = "overflow", .prefix = "ov" },
    .{ .css = "gradientDirection", .field = "gradient_direction", .prefix = "gd" },
};

// ── Value tables per prefix ──

pub const fd_values = [_]EnumValue{
    .{ .css = "row", .zig = ".row" },
    .{ .css = "column", .zig = ".column" },
};

pub const jc_values = [_]EnumValue{
    .{ .css = "start", .zig = ".start" },
    .{ .css = "center", .zig = ".center" },
    .{ .css = "end", .zig = ".end" },
    .{ .css = "space-between", .zig = ".space_between" },
    .{ .css = "spaceBetween", .zig = ".space_between" },
    .{ .css = "space-around", .zig = ".space_around" },
    .{ .css = "spaceAround", .zig = ".space_around" },
    .{ .css = "space-evenly", .zig = ".space_evenly" },
    .{ .css = "spaceEvenly", .zig = ".space_evenly" },
    .{ .css = "flex-start", .zig = ".start" },
    .{ .css = "flexStart", .zig = ".start" },
    .{ .css = "flex-end", .zig = ".end" },
    .{ .css = "flexEnd", .zig = ".end" },
};

pub const ai_values = [_]EnumValue{
    .{ .css = "start", .zig = ".start" },
    .{ .css = "flexStart", .zig = ".start" },
    .{ .css = "flex-start", .zig = ".start" },
    .{ .css = "center", .zig = ".center" },
    .{ .css = "end", .zig = ".end" },
    .{ .css = "flexEnd", .zig = ".end" },
    .{ .css = "flex-end", .zig = ".end" },
    .{ .css = "stretch", .zig = ".stretch" },
};

pub const as_values = [_]EnumValue{
    .{ .css = "auto", .zig = ".auto" },
    .{ .css = "start", .zig = ".start" },
    .{ .css = "flexStart", .zig = ".start" },
    .{ .css = "flex-start", .zig = ".start" },
    .{ .css = "center", .zig = ".center" },
    .{ .css = "end", .zig = ".end" },
    .{ .css = "flexEnd", .zig = ".end" },
    .{ .css = "flex-end", .zig = ".end" },
    .{ .css = "stretch", .zig = ".stretch" },
};

pub const ac_values = [_]EnumValue{
    .{ .css = "start", .zig = ".start" },
    .{ .css = "flex-start", .zig = ".start" },
    .{ .css = "center", .zig = ".center" },
    .{ .css = "end", .zig = ".end" },
    .{ .css = "flex-end", .zig = ".end" },
    .{ .css = "stretch", .zig = ".stretch" },
    .{ .css = "space-between", .zig = ".space_between" },
    .{ .css = "spaceBetween", .zig = ".space_between" },
    .{ .css = "space-around", .zig = ".space_around" },
    .{ .css = "spaceAround", .zig = ".space_around" },
    .{ .css = "space-evenly", .zig = ".space_evenly" },
    .{ .css = "spaceEvenly", .zig = ".space_evenly" },
};

pub const d_values = [_]EnumValue{
    .{ .css = "flex", .zig = ".flex" },
    .{ .css = "none", .zig = ".none" },
};

pub const ta_values = [_]EnumValue{
    .{ .css = "left", .zig = ".left" },
    .{ .css = "center", .zig = ".center" },
    .{ .css = "right", .zig = ".right" },
};

pub const fw_values = [_]EnumValue{
    .{ .css = "nowrap", .zig = ".no_wrap" },
    .{ .css = "noWrap", .zig = ".no_wrap" },
    .{ .css = "wrap", .zig = ".wrap" },
    .{ .css = "wrap-reverse", .zig = ".wrap_reverse" },
    .{ .css = "wrapReverse", .zig = ".wrap_reverse" },
};

pub const pos_values = [_]EnumValue{
    .{ .css = "relative", .zig = ".relative" },
    .{ .css = "absolute", .zig = ".absolute" },
};

pub const ov_values = [_]EnumValue{
    .{ .css = "visible", .zig = ".visible" },
    .{ .css = "hidden", .zig = ".hidden" },
    .{ .css = "scroll", .zig = ".scroll" },
};

pub const gd_values = [_]EnumValue{
    .{ .css = "vertical", .zig = ".vertical" },
    .{ .css = "horizontal", .zig = ".horizontal" },
    .{ .css = "none", .zig = ".none" },
};

/// Look up an enum value by prefix and CSS value string.
pub fn findValue(prefix: []const u8, value: []const u8) ?[]const u8 {
    const std = @import("std");
    const tables = .{
        .{ "fd", &fd_values },
        .{ "jc", &jc_values },
        .{ "ai", &ai_values },
        .{ "as", &as_values },
        .{ "ac", &ac_values },
        .{ "d", &d_values },
        .{ "ta", &ta_values },
        .{ "fw", &fw_values },
        .{ "pos", &pos_values },
        .{ "ov", &ov_values },
        .{ "gd", &gd_values },
    };
    inline for (tables) |t| {
        if (std.mem.eql(u8, prefix, t[0])) {
            inline for (t[1]) |v| {
                if (std.mem.eql(u8, value, v.css)) return v.zig;
            }
            return null;
        }
    }
    return null;
}
