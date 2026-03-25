//! Winamp theme — dark chrome, neon green text, transport bar aesthetic.
//!
//! Full classifier variant: not just recolored, but restructured.
//! Tight spacing, small radii, classic media player chrome. The iconic
//! #00FF00 on near-black with dark gray panels and bright orange accents.

const Theme = @import("../../../framework/theme.zig");
const Color = @import("../../../framework/layout.zig").Color;
const build = Theme.buildPalette;
const buildStyle = Theme.buildStylePalette;
const rgb = Color.rgb;

pub const palette: Theme.Palette = build(.{
    .bg = rgb(18, 18, 18), // #121212 — near-black chrome body
    .bg_alt = rgb(28, 28, 28), // #1C1C1C — panel recesses
    .bg_elevated = rgb(40, 40, 40), // #282828 — raised button areas
    .text = rgb(0, 255, 0), // #00FF00 — classic neon green
    .text_secondary = rgb(0, 204, 0), // #00CC00 — dimmer green
    .text_dim = rgb(0, 128, 0), // #008000 — faded green
    .primary = rgb(0, 255, 0), // #00FF00 — neon green primary
    .primary_hover = rgb(102, 255, 102), // #66FF66 — brighter on hover
    .primary_pressed = rgb(204, 255, 0), // #CCFF00 — yellow-green on press
    .surface = rgb(32, 32, 32), // #202020 — transport bar surface
    .surface_hover = rgb(48, 48, 48), // #303030 — button hover state
    .border = rgb(64, 64, 64), // #404040 — subtle chrome edges
    .border_focus = rgb(0, 255, 0), // #00FF00 — neon green focus ring
    .accent = rgb(255, 153, 0), // #FF9900 — orange accent (seek bar, highlights)
    .@"error" = rgb(255, 51, 51), // #FF3333 — red stop button
    .warning = rgb(255, 204, 0), // #FFCC00 — amber caution
    .success = rgb(0, 255, 0), // #00FF00 — green = go
    .info = rgb(51, 204, 255), // #33CCFF — icy blue info
});

/// Tight, compact, small radii — media player chrome feel.
pub const styles: Theme.StylePalette = buildStyle(.{
    .radius_sm = 1,
    .radius_md = 2,
    .radius_lg = 3,
    .spacing_sm = 2,
    .spacing_md = 4,
    .spacing_lg = 8,
    .border_thin = 1,
    .border_medium = 1,
    .font_sm = 10,
    .font_md = 12,
    .font_lg = 14,
});
