//! Theme system — semantic color tokens resolved at runtime.
//!
//! The compiler emits `Theme.get(.bg)` instead of `Color.rgb(...)` when it sees
//! `backgroundColor: 'theme-bg'` in .tsz source. The engine holds the active
//! palette and can swap it at runtime — every node that uses theme tokens
//! automatically picks up the new colors on the next frame.

const Color = @import("layout.zig").Color;

/// Semantic color tokens — mirrors the Lua theme system.
/// These are the tokens that .tsz files can reference via the `theme-` prefix.
pub const Token = enum(u8) {
    bg,
    bg_alt,
    bg_elevated,
    surface,
    surface_hover,
    border,
    border_focus,
    text,
    text_secondary,
    text_dim,
    primary,
    primary_hover,
    primary_pressed,
    accent,
    @"error",
    warning,
    success,
    info,

    pub const count = @typeInfo(Token).@"enum".fields.len;
};

/// A complete theme palette — one Color per token.
pub const Palette = [Token.count]Color;

/// Map camelCase token name (from .tsz source) to Token enum.
/// Returns null if the name is not a recognized token.
pub fn tokenFromName(name: []const u8) ?Token {
    const mappings = .{
        .{ "bg", .bg },
        .{ "bgAlt", .bg_alt },
        .{ "bgElevated", .bg_elevated },
        .{ "surface", .surface },
        .{ "surfaceHover", .surface_hover },
        .{ "border", .border },
        .{ "borderFocus", .border_focus },
        .{ "text", .text },
        .{ "textSecondary", .text_secondary },
        .{ "textDim", .text_dim },
        .{ "primary", .primary },
        .{ "primaryHover", .primary_hover },
        .{ "primaryPressed", .primary_pressed },
        .{ "accent", .accent },
        .{ "error", .@"error" },
        .{ "warning", .warning },
        .{ "success", .success },
        .{ "info", .info },
    };
    inline for (mappings) |m| {
        if (std.mem.eql(u8, name, m[0])) return m[1];
    }
    return null;
}

const std = @import("std");

// ── Built-in palettes ─────────────────────────────────────────────────

/// Catppuccin Mocha — default dark theme.
pub const catppuccin_mocha: Palette = buildPalette(.{
    .bg = Color.rgb(30, 30, 46), // #1e1e2e
    .bg_alt = Color.rgb(24, 24, 37), // #181825
    .bg_elevated = Color.rgb(49, 50, 68), // #313244
    .surface = Color.rgb(49, 50, 68), // #313244
    .surface_hover = Color.rgb(69, 71, 90), // #45475a
    .border = Color.rgb(69, 71, 90), // #45475a
    .border_focus = Color.rgb(137, 180, 250), // #89b4fa
    .text = Color.rgb(205, 214, 244), // #cdd6f4
    .text_secondary = Color.rgb(186, 194, 222), // #bac2de
    .text_dim = Color.rgb(166, 173, 200), // #a6adc8
    .primary = Color.rgb(137, 180, 250), // #89b4fa
    .primary_hover = Color.rgb(116, 199, 236), // #74c7ec
    .primary_pressed = Color.rgb(137, 220, 235), // #89dceb
    .accent = Color.rgb(203, 166, 247), // #cba6f7
    .@"error" = Color.rgb(243, 139, 168), // #f38ba8
    .warning = Color.rgb(250, 179, 135), // #fab387
    .success = Color.rgb(166, 227, 161), // #a6e3a1
    .info = Color.rgb(137, 220, 235), // #89dceb
});

/// Catppuccin Latte — default light theme.
pub const catppuccin_latte: Palette = buildPalette(.{
    .bg = Color.rgb(239, 241, 245), // #eff1f5
    .bg_alt = Color.rgb(230, 233, 239), // #e6e9ef
    .bg_elevated = Color.rgb(204, 208, 218), // #ccd0da
    .surface = Color.rgb(204, 208, 218), // #ccd0da
    .surface_hover = Color.rgb(188, 192, 204), // #bcc0cc
    .border = Color.rgb(188, 192, 204), // #bcc0cc
    .border_focus = Color.rgb(30, 102, 245), // #1e66f5
    .text = Color.rgb(76, 79, 105), // #4c4f69
    .text_secondary = Color.rgb(92, 95, 119), // #5c5f77
    .text_dim = Color.rgb(108, 111, 133), // #6c6f85
    .primary = Color.rgb(30, 102, 245), // #1e66f5
    .primary_hover = Color.rgb(32, 159, 181), // #209fb5
    .primary_pressed = Color.rgb(4, 165, 229), // #04a5e5
    .accent = Color.rgb(136, 57, 239), // #8839ef
    .@"error" = Color.rgb(210, 15, 57), // #d20f39
    .warning = Color.rgb(254, 100, 11), // #fe640b
    .success = Color.rgb(64, 160, 43), // #40a02b
    .info = Color.rgb(4, 165, 229), // #04a5e5
});

// ── Style tokens (f32 theme values) ──────────────────────────────────

/// Style tokens — non-color theme values (radii, spacing, borders, font sizes).
/// .tsz files reference these via `theme-` prefix in f32 style positions:
///   borderRadius: 'theme-radiusMd' → Theme.getFloat(.radius_md)
pub const StyleToken = enum(u8) {
    radius_sm,
    radius_md,
    radius_lg,
    spacing_sm,
    spacing_md,
    spacing_lg,
    border_thin,
    border_medium,
    font_sm,
    font_md,
    font_lg,

    pub const count = @typeInfo(StyleToken).@"enum".fields.len;
};

/// A complete style palette — one f32 per style token.
pub const StylePalette = [StyleToken.count]f32;

/// Rounded, airy — default style preset.
pub const rounded_airy: StylePalette = buildStylePalette(.{
    .radius_sm = 4,
    .radius_md = 8,
    .radius_lg = 16,
    .spacing_sm = 8,
    .spacing_md = 16,
    .spacing_lg = 24,
    .border_thin = 1,
    .border_medium = 2,
    .font_sm = 11,
    .font_md = 13,
    .font_lg = 18,
});

/// Sharp, dense — compact style preset.
pub const sharp_dense: StylePalette = buildStylePalette(.{
    .radius_sm = 0,
    .radius_md = 2,
    .radius_lg = 4,
    .spacing_sm = 4,
    .spacing_md = 8,
    .spacing_lg = 12,
    .border_thin = 2,
    .border_medium = 3,
    .font_sm = 10,
    .font_md = 12,
    .font_lg = 16,
});

var active_styles: StylePalette = rounded_airy;

/// Get the active f32 value for a style token.
pub fn getFloat(token: StyleToken) f32 {
    return active_styles[@intFromEnum(token)];
}

/// Set the active style palette.
pub fn setStylePalette(palette: StylePalette) void {
    active_styles = palette;
}

/// Map camelCase style token name to StyleToken enum.
pub fn styleTokenFromName(name: []const u8) ?StyleToken {
    const mappings = .{
        .{ "radiusSm", .radius_sm },
        .{ "radiusMd", .radius_md },
        .{ "radiusLg", .radius_lg },
        .{ "spacingSm", .spacing_sm },
        .{ "spacingMd", .spacing_md },
        .{ "spacingLg", .spacing_lg },
        .{ "borderThin", .border_thin },
        .{ "borderMedium", .border_medium },
        .{ "fontSm", .font_sm },
        .{ "fontMd", .font_md },
        .{ "fontLg", .font_lg },
    };
    inline for (mappings) |m| {
        if (std.mem.eql(u8, name, m[0])) return m[1];
    }
    return null;
}

// ── Layout variants ──────────────────────────────────────────────────

var active_variant: u8 = 0;

/// Get the active layout variant index.
pub fn activeVariant() u8 {
    return active_variant;
}

/// Set the active layout variant.
pub fn setVariant(v: u8) void {
    active_variant = v;
}

// ── Theme presets ────────────────────────────────────────────────────

/// A complete theme preset — variant + colors + styles.
pub const ThemePreset = struct {
    variant: u8,
    colors: Palette,
    styles: StylePalette,
};

/// Apply a complete theme preset atomically.
pub fn applyPreset(preset: ThemePreset) void {
    active_variant = preset.variant;
    active = preset.colors;
    active_styles = preset.styles;
}

// ── Active palette ────────────────────────────────────────────────────

var active: Palette = catppuccin_mocha;

/// Get the active color for a semantic token.
/// At comptime (static node init), returns from the default palette.
/// At runtime, returns from the mutable active palette.
pub fn get(token: Token) Color {
    if (@inComptime()) {
        return catppuccin_mocha[@intFromEnum(token)];
    }
    return active[@intFromEnum(token)];
}

/// Set the active palette.
pub fn setPalette(palette: Palette) void {
    active = palette;
}

/// Set an individual token color in the active palette.
pub fn setToken(token: Token, color: Color) void {
    active[@intFromEnum(token)] = color;
}

/// Get a pointer to the active palette (for bulk operations).
pub fn getActivePalette() *Palette {
    return &active;
}

// ── Palette builder ───────────────────────────────────────────────────

/// Comptime helper: build a Palette from a struct of named colors.
pub fn buildPalette(colors: anytype) Palette {
    var p: Palette = undefined;
    inline for (@typeInfo(Token).@"enum".fields) |f| {
        const tok: Token = @enumFromInt(f.value);
        p[f.value] = @field(colors, f.name);
        _ = tok;
    }
    return p;
}

/// Comptime helper: build a StylePalette from a struct of named f32 values.
pub fn buildStylePalette(values: anytype) StylePalette {
    var p: StylePalette = undefined;
    inline for (@typeInfo(StyleToken).@"enum".fields) |f| {
        p[f.value] = @field(values, f.name);
    }
    return p;
}
