//! Glass theme — translucent panels, frosted glass effect, liquid glass aesthetic.
//!
//! Full classifier variant: not just recolored, but restructured.
//! High radii for pill shapes, generous spacing, thin bright borders,
//! cool blue-white tint throughout. Surfaces are light and airy with
//! subtle transparency suggested through pale tints over dark base.

const Theme = @import("../../../framework/theme.zig");
const Color = @import("../../../framework/layout.zig").Color;
const build = Theme.buildPalette;
const buildStyle = Theme.buildStylePalette;
const rgb = Color.rgb;

pub const palette: Theme.Palette = build(.{
    .bg = rgb(15, 20, 30), // #0F141E — deep blue-black base (behind the glass)
    .bg_alt = rgb(25, 32, 45), // #19202D — slightly lighter underlayer
    .bg_elevated = rgb(40, 50, 68), // #283244 — frosted panel (glass tint over dark)
    .text = rgb(235, 240, 255), // #EBF0FF — bright white with cool tint
    .text_secondary = rgb(180, 195, 220), // #B4C3DC — soft blue-gray
    .text_dim = rgb(120, 140, 170), // #788CAA — faded frost
    .primary = rgb(100, 180, 255), // #64B4FF — glowing blue highlight
    .primary_hover = rgb(140, 200, 255), // #8CC8FF — brighter blue on hover
    .primary_pressed = rgb(180, 220, 255), // #B4DCFF — near-white blue flash
    .surface = rgb(35, 45, 60), // #232D3C — frosted glass panel
    .surface_hover = rgb(50, 62, 80), // #323E50 — hover brightens the glass
    .border = rgb(80, 110, 150), // #506E96 — thin bright border (glass edge catch)
    .border_focus = rgb(100, 180, 255), // #64B4FF — glowing blue focus
    .accent = rgb(160, 140, 255), // #A08CFF — soft violet accent (refraction)
    .@"error" = rgb(255, 100, 120), // #FF6478 — soft coral error
    .warning = rgb(255, 200, 100), // #FFC864 — warm amber through glass
    .success = rgb(100, 230, 180), // #64E6B4 — mint green success
    .info = rgb(120, 200, 255), // #78C8FF — sky blue info
});

/// Rounded, airy, generous spacing — liquid glass feel.
pub const styles: Theme.StylePalette = buildStyle(.{
    .radius_sm = 8,
    .radius_md = 12,
    .radius_lg = 16,
    .spacing_sm = 6,
    .spacing_md = 10,
    .spacing_lg = 16,
    .border_thin = 1,
    .border_medium = 1,
    .font_sm = 12,
    .font_md = 14,
    .font_lg = 18,
});
