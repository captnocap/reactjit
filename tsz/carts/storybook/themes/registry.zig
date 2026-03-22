//! Theme palette registry — all 17 standard themes ported from love2d.
//!
//! Each palette maps to the 18 semantic tokens used by `theme-*` references
//! in .tsz classifiers. Swap at runtime via `Theme.setPalette(palettes.dracula)`.

const Theme = @import("../../../framework/theme.zig");
const Color = @import("../../../framework/layout.zig").Color;
const build = Theme.buildPalette;
const rgb = Color.rgb;

// ── Catppuccin ───────────────────────────────────────────────────────

pub const catppuccin_latte: Theme.Palette = build(.{
    .bg = rgb(239, 241, 245),
    .bg_alt = rgb(230, 233, 239),
    .bg_elevated = rgb(204, 208, 218),
    .text = rgb(76, 79, 105),
    .text_secondary = rgb(92, 95, 119),
    .text_dim = rgb(108, 111, 133),
    .primary = rgb(30, 102, 245),
    .primary_hover = rgb(32, 159, 181),
    .primary_pressed = rgb(4, 165, 229),
    .surface = rgb(204, 208, 218),
    .surface_hover = rgb(188, 192, 204),
    .border = rgb(188, 192, 204),
    .border_focus = rgb(30, 102, 245),
    .accent = rgb(136, 57, 239),
    .@"error" = rgb(210, 15, 57),
    .warning = rgb(254, 100, 11),
    .success = rgb(64, 160, 43),
    .info = rgb(4, 165, 229),
});

pub const catppuccin_frappe: Theme.Palette = build(.{
    .bg = rgb(48, 52, 70),
    .bg_alt = rgb(41, 44, 60),
    .bg_elevated = rgb(65, 69, 89),
    .text = rgb(198, 208, 245),
    .text_secondary = rgb(181, 191, 226),
    .text_dim = rgb(165, 173, 206),
    .primary = rgb(140, 170, 238),
    .primary_hover = rgb(133, 193, 220),
    .primary_pressed = rgb(153, 209, 219),
    .surface = rgb(65, 69, 89),
    .surface_hover = rgb(81, 87, 109),
    .border = rgb(81, 87, 109),
    .border_focus = rgb(140, 170, 238),
    .accent = rgb(202, 158, 230),
    .@"error" = rgb(231, 130, 132),
    .warning = rgb(239, 159, 118),
    .success = rgb(166, 209, 137),
    .info = rgb(153, 209, 219),
});

pub const catppuccin_macchiato: Theme.Palette = build(.{
    .bg = rgb(36, 39, 58),
    .bg_alt = rgb(30, 32, 48),
    .bg_elevated = rgb(54, 58, 79),
    .text = rgb(202, 211, 245),
    .text_secondary = rgb(184, 192, 224),
    .text_dim = rgb(165, 173, 203),
    .primary = rgb(138, 173, 244),
    .primary_hover = rgb(125, 196, 228),
    .primary_pressed = rgb(145, 215, 227),
    .surface = rgb(54, 58, 79),
    .surface_hover = rgb(73, 77, 100),
    .border = rgb(73, 77, 100),
    .border_focus = rgb(138, 173, 244),
    .accent = rgb(198, 160, 246),
    .@"error" = rgb(237, 135, 150),
    .warning = rgb(245, 169, 127),
    .success = rgb(166, 218, 149),
    .info = rgb(145, 215, 227),
});

pub const catppuccin_mocha: Theme.Palette = build(.{
    .bg = rgb(30, 30, 46),
    .bg_alt = rgb(24, 24, 37),
    .bg_elevated = rgb(49, 50, 68),
    .text = rgb(205, 214, 244),
    .text_secondary = rgb(186, 194, 222),
    .text_dim = rgb(166, 173, 200),
    .primary = rgb(137, 180, 250),
    .primary_hover = rgb(116, 199, 236),
    .primary_pressed = rgb(137, 220, 235),
    .surface = rgb(49, 50, 68),
    .surface_hover = rgb(69, 71, 90),
    .border = rgb(69, 71, 90),
    .border_focus = rgb(137, 180, 250),
    .accent = rgb(203, 166, 247),
    .@"error" = rgb(243, 139, 168),
    .warning = rgb(250, 179, 135),
    .success = rgb(166, 227, 161),
    .info = rgb(137, 220, 235),
});

// ── Dracula ──────────────────────────────────────────────────────────

pub const dracula: Theme.Palette = build(.{
    .bg = rgb(40, 42, 54),
    .bg_alt = rgb(33, 34, 44),
    .bg_elevated = rgb(68, 71, 90),
    .text = rgb(248, 248, 242),
    .text_secondary = rgb(191, 191, 191),
    .text_dim = rgb(98, 114, 164),
    .primary = rgb(189, 147, 249),
    .primary_hover = rgb(202, 164, 250),
    .primary_pressed = rgb(212, 181, 251),
    .surface = rgb(68, 71, 90),
    .surface_hover = rgb(77, 80, 94),
    .border = rgb(68, 71, 90),
    .border_focus = rgb(189, 147, 249),
    .accent = rgb(255, 121, 198),
    .@"error" = rgb(255, 85, 85),
    .warning = rgb(255, 184, 108),
    .success = rgb(80, 250, 123),
    .info = rgb(139, 233, 253),
});

pub const dracula_soft: Theme.Palette = build(.{
    .bg = rgb(45, 47, 63),
    .bg_alt = rgb(37, 39, 55),
    .bg_elevated = rgb(68, 71, 90),
    .text = rgb(242, 242, 232),
    .text_secondary = rgb(184, 184, 176),
    .text_dim = rgb(98, 114, 164),
    .primary = rgb(189, 147, 249),
    .primary_hover = rgb(202, 164, 250),
    .primary_pressed = rgb(212, 181, 251),
    .surface = rgb(68, 71, 90),
    .surface_hover = rgb(77, 80, 94),
    .border = rgb(68, 71, 90),
    .border_focus = rgb(189, 147, 249),
    .accent = rgb(255, 121, 198),
    .@"error" = rgb(255, 85, 85),
    .warning = rgb(255, 184, 108),
    .success = rgb(80, 250, 123),
    .info = rgb(139, 233, 253),
});

// ── Gruvbox ──────────────────────────────────────────────────────────

pub const gruvbox_dark: Theme.Palette = build(.{
    .bg = rgb(40, 40, 40),
    .bg_alt = rgb(60, 56, 54),
    .bg_elevated = rgb(80, 73, 69),
    .text = rgb(235, 219, 178),
    .text_secondary = rgb(213, 196, 161),
    .text_dim = rgb(146, 131, 116),
    .primary = rgb(131, 165, 152),
    .primary_hover = rgb(142, 192, 124),
    .primary_pressed = rgb(184, 187, 38),
    .surface = rgb(60, 56, 54),
    .surface_hover = rgb(80, 73, 69),
    .border = rgb(80, 73, 69),
    .border_focus = rgb(131, 165, 152),
    .accent = rgb(211, 134, 155),
    .@"error" = rgb(251, 73, 52),
    .warning = rgb(254, 128, 25),
    .success = rgb(184, 187, 38),
    .info = rgb(131, 165, 152),
});

pub const gruvbox_light: Theme.Palette = build(.{
    .bg = rgb(251, 241, 199),
    .bg_alt = rgb(235, 219, 178),
    .bg_elevated = rgb(213, 196, 161),
    .text = rgb(60, 56, 54),
    .text_secondary = rgb(80, 73, 69),
    .text_dim = rgb(146, 131, 116),
    .primary = rgb(7, 102, 120),
    .primary_hover = rgb(66, 123, 88),
    .primary_pressed = rgb(121, 116, 14),
    .surface = rgb(235, 219, 178),
    .surface_hover = rgb(213, 196, 161),
    .border = rgb(213, 196, 161),
    .border_focus = rgb(7, 102, 120),
    .accent = rgb(143, 63, 113),
    .@"error" = rgb(157, 0, 6),
    .warning = rgb(175, 58, 3),
    .success = rgb(121, 116, 14),
    .info = rgb(7, 102, 120),
});

// ── Nord ─────────────────────────────────────────────────────────────

pub const nord: Theme.Palette = build(.{
    .bg = rgb(46, 52, 64),
    .bg_alt = rgb(59, 66, 82),
    .bg_elevated = rgb(67, 76, 94),
    .text = rgb(236, 239, 244),
    .text_secondary = rgb(216, 222, 233),
    .text_dim = rgb(76, 86, 106),
    .primary = rgb(136, 192, 208),
    .primary_hover = rgb(143, 188, 187),
    .primary_pressed = rgb(129, 161, 193),
    .surface = rgb(59, 66, 82),
    .surface_hover = rgb(67, 76, 94),
    .border = rgb(67, 76, 94),
    .border_focus = rgb(136, 192, 208),
    .accent = rgb(180, 142, 173),
    .@"error" = rgb(191, 97, 106),
    .warning = rgb(208, 135, 112),
    .success = rgb(163, 190, 140),
    .info = rgb(94, 129, 172),
});

pub const nord_light: Theme.Palette = build(.{
    .bg = rgb(236, 239, 244),
    .bg_alt = rgb(229, 233, 240),
    .bg_elevated = rgb(216, 222, 233),
    .text = rgb(46, 52, 64),
    .text_secondary = rgb(59, 66, 82),
    .text_dim = rgb(76, 86, 106),
    .primary = rgb(94, 129, 172),
    .primary_hover = rgb(129, 161, 193),
    .primary_pressed = rgb(136, 192, 208),
    .surface = rgb(216, 222, 233),
    .surface_hover = rgb(229, 233, 240),
    .border = rgb(216, 222, 233),
    .border_focus = rgb(94, 129, 172),
    .accent = rgb(180, 142, 173),
    .@"error" = rgb(191, 97, 106),
    .warning = rgb(208, 135, 112),
    .success = rgb(163, 190, 140),
    .info = rgb(94, 129, 172),
});

// ── One Dark ─────────────────────────────────────────────────────────

pub const one_dark: Theme.Palette = build(.{
    .bg = rgb(40, 44, 52),
    .bg_alt = rgb(33, 37, 43),
    .bg_elevated = rgb(44, 49, 58),
    .text = rgb(171, 178, 191),
    .text_secondary = rgb(157, 165, 180),
    .text_dim = rgb(92, 99, 112),
    .primary = rgb(97, 175, 239),
    .primary_hover = rgb(86, 182, 194),
    .primary_pressed = rgb(152, 195, 121),
    .surface = rgb(44, 49, 58),
    .surface_hover = rgb(51, 56, 66),
    .border = rgb(62, 68, 82),
    .border_focus = rgb(97, 175, 239),
    .accent = rgb(198, 120, 221),
    .@"error" = rgb(224, 108, 117),
    .warning = rgb(209, 154, 102),
    .success = rgb(152, 195, 121),
    .info = rgb(86, 182, 194),
});

// ── Rose Pine ────────────────────────────────────────────────────────

pub const rose_pine: Theme.Palette = build(.{
    .bg = rgb(25, 23, 36),
    .bg_alt = rgb(31, 29, 46),
    .bg_elevated = rgb(38, 35, 58),
    .text = rgb(224, 222, 244),
    .text_secondary = rgb(144, 140, 170),
    .text_dim = rgb(110, 106, 134),
    .primary = rgb(49, 116, 143),
    .primary_hover = rgb(156, 207, 216),
    .primary_pressed = rgb(235, 188, 186),
    .surface = rgb(31, 29, 46),
    .surface_hover = rgb(38, 35, 58),
    .border = rgb(38, 35, 58),
    .border_focus = rgb(49, 116, 143),
    .accent = rgb(196, 167, 231),
    .@"error" = rgb(235, 111, 146),
    .warning = rgb(246, 193, 119),
    .success = rgb(49, 116, 143),
    .info = rgb(156, 207, 216),
});

pub const rose_pine_dawn: Theme.Palette = build(.{
    .bg = rgb(250, 244, 237),
    .bg_alt = rgb(255, 250, 243),
    .bg_elevated = rgb(242, 233, 225),
    .text = rgb(87, 82, 121),
    .text_secondary = rgb(121, 117, 147),
    .text_dim = rgb(152, 147, 165),
    .primary = rgb(40, 105, 131),
    .primary_hover = rgb(86, 148, 159),
    .primary_pressed = rgb(215, 130, 126),
    .surface = rgb(255, 250, 243),
    .surface_hover = rgb(242, 233, 225),
    .border = rgb(223, 218, 217),
    .border_focus = rgb(40, 105, 131),
    .accent = rgb(144, 122, 169),
    .@"error" = rgb(180, 99, 122),
    .warning = rgb(234, 157, 52),
    .success = rgb(40, 105, 131),
    .info = rgb(86, 148, 159),
});

// ── Solarized ────────────────────────────────────────────────────────

pub const solarized_dark: Theme.Palette = build(.{
    .bg = rgb(0, 43, 54),
    .bg_alt = rgb(7, 54, 66),
    .bg_elevated = rgb(7, 54, 66),
    .text = rgb(131, 148, 150),
    .text_secondary = rgb(147, 161, 161),
    .text_dim = rgb(88, 110, 117),
    .primary = rgb(38, 139, 210),
    .primary_hover = rgb(42, 161, 152),
    .primary_pressed = rgb(133, 153, 0),
    .surface = rgb(7, 54, 66),
    .surface_hover = rgb(7, 54, 66),
    .border = rgb(88, 110, 117),
    .border_focus = rgb(38, 139, 210),
    .accent = rgb(108, 113, 196),
    .@"error" = rgb(220, 50, 47),
    .warning = rgb(203, 75, 22),
    .success = rgb(133, 153, 0),
    .info = rgb(42, 161, 152),
});

pub const solarized_light: Theme.Palette = build(.{
    .bg = rgb(253, 246, 227),
    .bg_alt = rgb(238, 232, 213),
    .bg_elevated = rgb(238, 232, 213),
    .text = rgb(101, 123, 131),
    .text_secondary = rgb(88, 110, 117),
    .text_dim = rgb(147, 161, 161),
    .primary = rgb(38, 139, 210),
    .primary_hover = rgb(42, 161, 152),
    .primary_pressed = rgb(133, 153, 0),
    .surface = rgb(238, 232, 213),
    .surface_hover = rgb(238, 232, 213),
    .border = rgb(147, 161, 161),
    .border_focus = rgb(38, 139, 210),
    .accent = rgb(108, 113, 196),
    .@"error" = rgb(220, 50, 47),
    .warning = rgb(203, 75, 22),
    .success = rgb(133, 153, 0),
    .info = rgb(42, 161, 152),
});

// ── Tokyo Night ──────────────────────────────────────────────────────

pub const tokyo_night: Theme.Palette = build(.{
    .bg = rgb(26, 27, 38),
    .bg_alt = rgb(22, 22, 30),
    .bg_elevated = rgb(36, 40, 59),
    .text = rgb(192, 202, 245),
    .text_secondary = rgb(169, 177, 214),
    .text_dim = rgb(86, 95, 137),
    .primary = rgb(122, 162, 247),
    .primary_hover = rgb(125, 207, 255),
    .primary_pressed = rgb(42, 195, 222),
    .surface = rgb(36, 40, 59),
    .surface_hover = rgb(41, 46, 66),
    .border = rgb(41, 46, 66),
    .border_focus = rgb(122, 162, 247),
    .accent = rgb(187, 154, 247),
    .@"error" = rgb(247, 118, 142),
    .warning = rgb(224, 175, 104),
    .success = rgb(158, 206, 106),
    .info = rgb(125, 207, 255),
});

pub const tokyo_night_storm: Theme.Palette = build(.{
    .bg = rgb(36, 40, 59),
    .bg_alt = rgb(31, 35, 53),
    .bg_elevated = rgb(41, 46, 66),
    .text = rgb(192, 202, 245),
    .text_secondary = rgb(169, 177, 214),
    .text_dim = rgb(86, 95, 137),
    .primary = rgb(122, 162, 247),
    .primary_hover = rgb(125, 207, 255),
    .primary_pressed = rgb(42, 195, 222),
    .surface = rgb(41, 46, 66),
    .surface_hover = rgb(52, 59, 88),
    .border = rgb(52, 59, 88),
    .border_focus = rgb(122, 162, 247),
    .accent = rgb(187, 154, 247),
    .@"error" = rgb(247, 118, 142),
    .warning = rgb(224, 175, 104),
    .success = rgb(158, 206, 106),
    .info = rgb(125, 207, 255),
});

// ── Custom: BIOS ─────────────────────────────────────────────────────

pub const bios = @import("bios.zig");

// ── Custom: Win95 Vaporwave ──────────────────────────────────────────

pub const win95 = @import("win95.zig");

// ── Registry ─────────────────────────────────────────────────────────

pub const Entry = struct {
    name: []const u8,
    palette: Theme.Palette,
    styles: ?Theme.StylePalette = null,
};

/// All standard themes in display order.
pub const all = [_]Entry{
    .{ .name = "Catppuccin Mocha", .palette = catppuccin_mocha },
    .{ .name = "Catppuccin Macchiato", .palette = catppuccin_macchiato },
    .{ .name = "Catppuccin Frappe", .palette = catppuccin_frappe },
    .{ .name = "Catppuccin Latte", .palette = catppuccin_latte },
    .{ .name = "Dracula", .palette = dracula },
    .{ .name = "Dracula Soft", .palette = dracula_soft },
    .{ .name = "Gruvbox Dark", .palette = gruvbox_dark },
    .{ .name = "Gruvbox Light", .palette = gruvbox_light },
    .{ .name = "Nord", .palette = nord },
    .{ .name = "Nord Light", .palette = nord_light },
    .{ .name = "One Dark", .palette = one_dark },
    .{ .name = "Rose Pine", .palette = rose_pine },
    .{ .name = "Rose Pine Dawn", .palette = rose_pine_dawn },
    .{ .name = "Solarized Dark", .palette = solarized_dark },
    .{ .name = "Solarized Light", .palette = solarized_light },
    .{ .name = "Tokyo Night", .palette = tokyo_night },
    .{ .name = "Tokyo Night Storm", .palette = tokyo_night_storm },
    .{ .name = "BIOS", .palette = bios.palette, .styles = bios.styles },
    .{ .name = "Win95 Vaporwave", .palette = win95.palette, .styles = win95.styles },
};

pub const count = all.len;
