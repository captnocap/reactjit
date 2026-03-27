//! Theme and style token name → Zig enum field mapping rules.
//!
//! Theme tokens map to Color values via Theme.get(.field).
//! Style tokens map to f32 values via Theme.getFloat(.field).
//! To add a new token: add one entry to the appropriate array.

pub const Entry = struct { css: []const u8, zig: []const u8 };

/// Color theme tokens — used with Theme.get(.field)
pub const theme_tokens = [_]Entry{
    .{ .css = "bg", .zig = "bg" },
    .{ .css = "bgAlt", .zig = "bg_alt" },
    .{ .css = "bgElevated", .zig = "bg_elevated" },
    .{ .css = "surface", .zig = "surface" },
    .{ .css = "surfaceHover", .zig = "surface_hover" },
    .{ .css = "border", .zig = "border" },
    .{ .css = "borderFocus", .zig = "border_focus" },
    .{ .css = "text", .zig = "text" },
    .{ .css = "textSecondary", .zig = "text_secondary" },
    .{ .css = "textDim", .zig = "text_dim" },
    .{ .css = "primary", .zig = "primary" },
    .{ .css = "primaryHover", .zig = "primary_hover" },
    .{ .css = "primaryPressed", .zig = "primary_pressed" },
    .{ .css = "accent", .zig = "accent" },
    .{ .css = "error", .zig = "@\"error\"" },
    .{ .css = "warning", .zig = "warning" },
    .{ .css = "success", .zig = "success" },
    .{ .css = "info", .zig = "info" },
};

/// Numeric style tokens — used with Theme.getFloat(.field)
pub const style_tokens = [_]Entry{
    .{ .css = "radiusSm", .zig = "radius_sm" },
    .{ .css = "radiusMd", .zig = "radius_md" },
    .{ .css = "radiusLg", .zig = "radius_lg" },
    .{ .css = "spacingSm", .zig = "spacing_sm" },
    .{ .css = "spacingMd", .zig = "spacing_md" },
    .{ .css = "spacingLg", .zig = "spacing_lg" },
    .{ .css = "borderThin", .zig = "border_thin" },
    .{ .css = "borderMedium", .zig = "border_medium" },
    .{ .css = "fontSm", .zig = "font_sm" },
    .{ .css = "fontMd", .zig = "font_md" },
    .{ .css = "fontLg", .zig = "font_lg" },
};
