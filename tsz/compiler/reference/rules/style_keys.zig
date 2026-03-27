//! Style key mapping rules — camelCase CSS property names → snake_case Zig field names.
//!
//! To add a new style property: add one entry to the appropriate array.
//! f32_keys  → numeric properties (width, padding, margin, etc.)
//! i16_keys  → small integer properties (zIndex)
//! color_keys → color properties (backgroundColor, borderColor, etc.)

pub const Entry = struct { css: []const u8, zig: []const u8 };

pub const f32_keys = [_]Entry{
    // Sizing
    .{ .css = "width", .zig = "width" },
    .{ .css = "height", .zig = "height" },
    .{ .css = "minWidth", .zig = "min_width" },
    .{ .css = "maxWidth", .zig = "max_width" },
    .{ .css = "minHeight", .zig = "min_height" },
    .{ .css = "maxHeight", .zig = "max_height" },
    // Flex
    .{ .css = "flexGrow", .zig = "flex_grow" },
    .{ .css = "flexShrink", .zig = "flex_shrink" },
    .{ .css = "flexBasis", .zig = "flex_basis" },
    .{ .css = "gap", .zig = "gap" },
    .{ .css = "order", .zig = "order" },
    // Padding
    .{ .css = "padding", .zig = "padding" },
    .{ .css = "paddingLeft", .zig = "padding_left" },
    .{ .css = "paddingRight", .zig = "padding_right" },
    .{ .css = "paddingTop", .zig = "padding_top" },
    .{ .css = "paddingBottom", .zig = "padding_bottom" },
    // Margin
    .{ .css = "margin", .zig = "margin" },
    .{ .css = "marginLeft", .zig = "margin_left" },
    .{ .css = "marginRight", .zig = "margin_right" },
    .{ .css = "marginTop", .zig = "margin_top" },
    .{ .css = "marginBottom", .zig = "margin_bottom" },
    // Border
    .{ .css = "borderRadius", .zig = "border_radius" },
    .{ .css = "borderWidth", .zig = "border_width" },
    .{ .css = "borderLeftWidth", .zig = "border_left_width" },
    .{ .css = "borderRightWidth", .zig = "border_right_width" },
    .{ .css = "borderTopWidth", .zig = "border_top_width" },
    .{ .css = "borderBottomWidth", .zig = "border_bottom_width" },
    // Visual
    .{ .css = "opacity", .zig = "opacity" },
    .{ .css = "shadowOffsetX", .zig = "shadow_offset_x" },
    .{ .css = "shadowOffsetY", .zig = "shadow_offset_y" },
    .{ .css = "shadowBlur", .zig = "shadow_blur" },
    // Position
    .{ .css = "top", .zig = "top" },
    .{ .css = "left", .zig = "left" },
    .{ .css = "right", .zig = "right" },
    .{ .css = "bottom", .zig = "bottom" },
    // Transform
    .{ .css = "aspectRatio", .zig = "aspect_ratio" },
    .{ .css = "rotation", .zig = "rotation" },
    .{ .css = "scaleX", .zig = "scale_x" },
    .{ .css = "scaleY", .zig = "scale_y" },
};

pub const i16_keys = [_]Entry{
    .{ .css = "zIndex", .zig = "z_index" },
};

pub const color_keys = [_]Entry{
    .{ .css = "backgroundColor", .zig = "background_color" },
    .{ .css = "borderColor", .zig = "border_color" },
    .{ .css = "shadowColor", .zig = "shadow_color" },
    .{ .css = "gradientColorEnd", .zig = "gradient_color_end" },
};
