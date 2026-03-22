//! Win95 Vaporwave theme — gray chrome, 3D bevel borders, gradient purple title bars.
//!
//! Full classifier variant: not just recolored, but restructured.
//! No borderRadius, chunky 3D borders (light top-left, dark bottom-right),
//! vaporwave purple accents over classic Win95 silver chrome.

const Theme = @import("../../../framework/theme.zig");
const Color = @import("../../../framework/layout.zig").Color;
const build = Theme.buildPalette;
const buildStyle = Theme.buildStylePalette;
const rgb = Color.rgb;

pub const palette: Theme.Palette = build(.{
    .bg = rgb(192, 192, 192), // #C0C0C0 — classic silver chrome
    .bg_alt = rgb(160, 160, 160), // #A0A0A0
    .bg_elevated = rgb(223, 223, 223), // #DFDFDF — raised surface
    .text = rgb(0, 0, 0), // #000000 — black text on gray
    .text_secondary = rgb(64, 64, 64), // #404040
    .text_dim = rgb(128, 128, 128), // #808080
    .primary = rgb(0, 0, 128), // #000080 — navy title bar
    .primary_hover = rgb(128, 0, 176), // #8000B0 — vaporwave purple gradient
    .primary_pressed = rgb(160, 32, 240), // #A020F0 — bright vaporwave purple
    .surface = rgb(255, 255, 255), // #FFFFFF — window background
    .surface_hover = rgb(232, 232, 232), // #E8E8E8
    .border = rgb(128, 128, 128), // #808080 — 3D bevel base
    .border_focus = rgb(0, 0, 128), // #000080
    .accent = rgb(153, 0, 204), // #9900CC — vaporwave purple accent
    .@"error" = rgb(255, 0, 0), // #FF0000
    .warning = rgb(255, 136, 0), // #FF8800
    .success = rgb(0, 128, 0), // #008000
    .info = rgb(0, 0, 255), // #0000FF
});

/// Sharp, chunky — Win95 3D bevel feel.
pub const styles: Theme.StylePalette = buildStyle(.{
    .radius_sm = 0,
    .radius_md = 0,
    .radius_lg = 0,
    .spacing_sm = 4,
    .spacing_md = 6,
    .spacing_lg = 10,
    .border_thin = 2,
    .border_medium = 3,
    .font_sm = 11,
    .font_md = 13,
    .font_lg = 16,
});
