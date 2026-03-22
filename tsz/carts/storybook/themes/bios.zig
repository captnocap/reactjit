//! BIOS theme — AMI BIOS blue, cyan selection bars, monospace terminal feel.
//!
//! Full classifier variant: not just recolored, but restructured.
//! borderRadius: 0 everywhere, box-drawing borders, tight spacing.

const Theme = @import("../../../framework/theme.zig");
const Color = @import("../../../framework/layout.zig").Color;
const build = Theme.buildPalette;
const buildStyle = Theme.buildStylePalette;
const rgb = Color.rgb;

pub const palette: Theme.Palette = build(.{
    .bg = rgb(0, 0, 170), // #0000AA — classic AMI BIOS blue
    .bg_alt = rgb(0, 0, 136), // #000088
    .bg_elevated = rgb(17, 17, 187), // #1111BB
    .text = rgb(170, 170, 170), // #AAAAAA — gray on blue
    .text_secondary = rgb(136, 136, 136), // #888888
    .text_dim = rgb(85, 85, 85), // #555555
    .primary = rgb(0, 170, 170), // #00AAAA — cyan selection bars
    .primary_hover = rgb(85, 255, 255), // #55FFFF
    .primary_pressed = rgb(255, 255, 255), // #FFFFFF — white on active
    .surface = rgb(0, 0, 136), // #000088
    .surface_hover = rgb(0, 0, 170), // #0000AA
    .border = rgb(85, 85, 85), // #555555 — box-drawing gray
    .border_focus = rgb(0, 170, 170), // #00AAAA
    .accent = rgb(255, 255, 85), // #FFFF55 — yellow highlight
    .@"error" = rgb(255, 85, 85), // #FF5555
    .warning = rgb(255, 170, 0), // #FFAA00
    .success = rgb(85, 255, 85), // #55FF55
    .info = rgb(85, 255, 255), // #55FFFF
});

/// Sharp, tight, zero radius — terminal/BIOS feel.
pub const styles: Theme.StylePalette = buildStyle(.{
    .radius_sm = 0,
    .radius_md = 0,
    .radius_lg = 0,
    .spacing_sm = 4,
    .spacing_md = 8,
    .spacing_lg = 12,
    .border_thin = 1,
    .border_medium = 1,
    .font_sm = 12,
    .font_md = 14,
    .font_lg = 16,
});
