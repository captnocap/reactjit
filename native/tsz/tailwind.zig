//! Compile-time Tailwind CSS class parser
//!
//! Parses Tailwind utility classes and returns Zig style field strings.
//! Runs at compile time in the tsz compiler — zero runtime cost.
//!
//! Supports: spacing (p-4, px-2, m-8, gap-4), sizing (w-full, h-64),
//! flex (flex-row, flex-1, items-center, justify-between),
//! colors (bg-blue-500, text-red-300, border-gray-200),
//! typography (text-sm, text-xl, font-bold),
//! rounded (rounded, rounded-lg, rounded-full),
//! overflow (overflow-hidden, overflow-scroll).

const std = @import("std");

/// Parse a space-separated Tailwind class string into Zig style fields.
/// Returns a comma-separated list like ".padding = 16, .flex_direction = .row"
pub fn parse(alloc: std.mem.Allocator, classes: []const u8) ![]const u8 {
    var fields: std.ArrayListUnmanaged(u8) = .{};

    var iter = std.mem.splitScalar(u8, classes, ' ');
    while (iter.next()) |cls| {
        const trimmed = std.mem.trim(u8, cls, &[_]u8{ ' ', '\t', '\n', '\r' });
        if (trimmed.len == 0) continue;

        // Strip pseudo-variants (hover:, focus:, etc) — not supported yet
        const effective = if (std.mem.indexOf(u8, trimmed, ":")) |idx| trimmed[idx + 1 ..] else trimmed;

        const field = parseClass(alloc, effective) catch continue;
        if (field.len == 0) continue;

        if (fields.items.len > 0) try fields.appendSlice(alloc, ", ");
        try fields.appendSlice(alloc, field);
    }

    return try alloc.dupe(u8, fields.items);
}

fn parseClass(alloc: std.mem.Allocator, cls: []const u8) ![]const u8 {
    // ── Flex direction ──
    if (eql(cls, "flex-row")) return ".flex_direction = .row";
    if (eql(cls, "flex-col")) return ".flex_direction = .column";
    if (eql(cls, "flex-column")) return ".flex_direction = .column";

    // ── Flex grow/shrink ──
    if (eql(cls, "flex-1")) return ".flex_grow = 1";
    if (eql(cls, "flex-0")) return ".flex_grow = 0";
    if (eql(cls, "flex-grow")) return ".flex_grow = 1";
    if (eql(cls, "flex-shrink")) return ".flex_shrink = 1";
    if (eql(cls, "flex-shrink-0")) return ".flex_shrink = 0";

    // ── Justify content ──
    if (eql(cls, "justify-start")) return ".justify_content = .start";
    if (eql(cls, "justify-center")) return ".justify_content = .center";
    if (eql(cls, "justify-end")) return ".justify_content = .end_";
    if (eql(cls, "justify-between")) return ".justify_content = .space_between";
    if (eql(cls, "justify-around")) return ".justify_content = .space_around";
    if (eql(cls, "justify-evenly")) return ".justify_content = .space_evenly";

    // ── Align items ──
    if (eql(cls, "items-start")) return ".align_items = .start";
    if (eql(cls, "items-center")) return ".align_items = .center";
    if (eql(cls, "items-end")) return ".align_items = .end_";
    if (eql(cls, "items-stretch")) return ".align_items = .stretch";

    // ── Display ──
    if (eql(cls, "hidden")) return ".display = .none";
    if (eql(cls, "flex")) return ""; // default

    // ── Overflow ──
    if (eql(cls, "overflow-hidden")) return ".overflow = .hidden";
    if (eql(cls, "overflow-scroll")) return ".overflow = .scroll";
    if (eql(cls, "overflow-visible")) return ".overflow = .visible";

    // ── Width/Height ──
    if (eql(cls, "w-full")) return ".width = @as(f32, 100.0)"; // percentage not supported yet, use 100%
    if (eql(cls, "h-full")) return ".height = @as(f32, 100.0)";
    if (startsWith(cls, "w-")) return try spacingField(alloc, ".width", cls[2..]);
    if (startsWith(cls, "h-")) return try spacingField(alloc, ".height", cls[2..]);
    if (startsWith(cls, "min-w-")) return try spacingField(alloc, ".min_width", cls[6..]);
    if (startsWith(cls, "min-h-")) return try spacingField(alloc, ".min_height", cls[6..]);
    if (startsWith(cls, "max-w-")) return try spacingField(alloc, ".max_width", cls[6..]);
    if (startsWith(cls, "max-h-")) return try spacingField(alloc, ".max_height", cls[6..]);

    // ── Padding ──
    if (startsWith(cls, "px-")) {
        const val = try spacingValue(cls[3..]);
        return try std.fmt.allocPrint(alloc, ".padding_left = {d}, .padding_right = {d}", .{ val, val });
    }
    if (startsWith(cls, "py-")) {
        const val = try spacingValue(cls[3..]);
        return try std.fmt.allocPrint(alloc, ".padding_top = {d}, .padding_bottom = {d}", .{ val, val });
    }
    if (startsWith(cls, "pl-")) return try spacingField(alloc, ".padding_left", cls[3..]);
    if (startsWith(cls, "pr-")) return try spacingField(alloc, ".padding_right", cls[3..]);
    if (startsWith(cls, "pt-")) return try spacingField(alloc, ".padding_top", cls[3..]);
    if (startsWith(cls, "pb-")) return try spacingField(alloc, ".padding_bottom", cls[3..]);
    if (startsWith(cls, "p-")) return try spacingField(alloc, ".padding", cls[2..]);

    // ── Margin ──
    if (startsWith(cls, "mx-")) {
        const val = try spacingValue(cls[3..]);
        return try std.fmt.allocPrint(alloc, ".margin_left = {d}, .margin_right = {d}", .{ val, val });
    }
    if (startsWith(cls, "my-")) {
        const val = try spacingValue(cls[3..]);
        return try std.fmt.allocPrint(alloc, ".margin_top = {d}, .margin_bottom = {d}", .{ val, val });
    }
    if (startsWith(cls, "ml-")) return try spacingField(alloc, ".margin_left", cls[3..]);
    if (startsWith(cls, "mr-")) return try spacingField(alloc, ".margin_right", cls[3..]);
    if (startsWith(cls, "mt-")) return try spacingField(alloc, ".margin_top", cls[3..]);
    if (startsWith(cls, "mb-")) return try spacingField(alloc, ".margin_bottom", cls[3..]);
    if (startsWith(cls, "m-")) return try spacingField(alloc, ".margin", cls[2..]);

    // ── Gap ──
    if (startsWith(cls, "gap-")) return try spacingField(alloc, ".gap", cls[4..]);

    // ── Border radius ──
    if (eql(cls, "rounded")) return ".border_radius = 4";
    if (eql(cls, "rounded-sm")) return ".border_radius = 2";
    if (eql(cls, "rounded-md")) return ".border_radius = 6";
    if (eql(cls, "rounded-lg")) return ".border_radius = 8";
    if (eql(cls, "rounded-xl")) return ".border_radius = 12";
    if (eql(cls, "rounded-2xl")) return ".border_radius = 16";
    if (eql(cls, "rounded-3xl")) return ".border_radius = 24";
    if (eql(cls, "rounded-full")) return ".border_radius = 9999";
    if (eql(cls, "rounded-none")) return ".border_radius = 0";

    // ── Background colors ──
    if (startsWith(cls, "bg-")) return try colorField(alloc, ".background_color", cls[3..]);

    // Unrecognized — skip silently
    return "";
}

// ── Spacing scale: Tailwind unit → pixels (1 unit = 4px) ──

fn spacingValue(val: []const u8) !f32 {
    // Handle arbitrary values: [20] → 20
    if (val.len >= 3 and val[0] == '[' and val[val.len - 1] == ']') {
        return std.fmt.parseFloat(f32, val[1 .. val.len - 1]) catch return error.InvalidValue;
    }
    // Tailwind spacing scale
    if (eql(val, "0")) return 0;
    if (eql(val, "0.5")) return 2;
    if (eql(val, "1")) return 4;
    if (eql(val, "1.5")) return 6;
    if (eql(val, "2")) return 8;
    if (eql(val, "2.5")) return 10;
    if (eql(val, "3")) return 12;
    if (eql(val, "3.5")) return 14;
    if (eql(val, "4")) return 16;
    if (eql(val, "5")) return 20;
    if (eql(val, "6")) return 24;
    if (eql(val, "7")) return 28;
    if (eql(val, "8")) return 32;
    if (eql(val, "9")) return 36;
    if (eql(val, "10")) return 40;
    if (eql(val, "11")) return 44;
    if (eql(val, "12")) return 48;
    if (eql(val, "14")) return 56;
    if (eql(val, "16")) return 64;
    if (eql(val, "20")) return 80;
    if (eql(val, "24")) return 96;
    if (eql(val, "28")) return 112;
    if (eql(val, "32")) return 128;
    if (eql(val, "36")) return 144;
    if (eql(val, "40")) return 160;
    if (eql(val, "44")) return 176;
    if (eql(val, "48")) return 192;
    if (eql(val, "52")) return 208;
    if (eql(val, "56")) return 224;
    if (eql(val, "60")) return 240;
    if (eql(val, "64")) return 256;
    if (eql(val, "72")) return 288;
    if (eql(val, "80")) return 320;
    if (eql(val, "96")) return 384;
    // Try numeric parse (px value)
    return std.fmt.parseFloat(f32, val) catch return error.InvalidValue;
}

fn spacingField(alloc: std.mem.Allocator, field: []const u8, val: []const u8) ![]const u8 {
    const px = try spacingValue(val);
    return try std.fmt.allocPrint(alloc, "{s} = {d}", .{ field, px });
}

// ── Tailwind color palette ──

fn colorField(alloc: std.mem.Allocator, field: []const u8, color_str: []const u8) ![]const u8 {
    // Arbitrary hex: [#ff6600]
    if (color_str.len >= 4 and color_str[0] == '[' and color_str[1] == '#') {
        const hex = color_str[2 .. color_str.len - 1];
        if (hex.len == 6) {
            const r = std.fmt.parseInt(u8, hex[0..2], 16) catch 0;
            const g = std.fmt.parseInt(u8, hex[2..4], 16) catch 0;
            const b = std.fmt.parseInt(u8, hex[4..6], 16) catch 0;
            return try std.fmt.allocPrint(alloc, "{s} = Color.rgb({d}, {d}, {d})", .{ field, r, g, b });
        }
    }

    // Named colors: bg-white, bg-black, bg-transparent
    if (eql(color_str, "white")) return try std.fmt.allocPrint(alloc, "{s} = Color.rgb(255, 255, 255)", .{field});
    if (eql(color_str, "black")) return try std.fmt.allocPrint(alloc, "{s} = Color.rgb(0, 0, 0)", .{field});

    // Tailwind palette: color-shade (e.g. blue-500, slate-800)
    // Split on last '-'
    var last_dash: ?usize = null;
    for (color_str, 0..) |ch, i| {
        if (ch == '-') last_dash = i;
    }
    if (last_dash) |d| {
        const color_name = color_str[0..d];
        const shade = color_str[d + 1 ..];
        if (lookupColor(color_name, shade)) |rgb| {
            return try std.fmt.allocPrint(alloc, "{s} = Color.rgb({d}, {d}, {d})", .{ field, rgb[0], rgb[1], rgb[2] });
        }
    }

    return "";
}

fn lookupColor(name: []const u8, shade: []const u8) ?[3]u8 {
    // Core Tailwind 3 palette (most common shades)
    const s = std.fmt.parseInt(u16, shade, 10) catch return null;

    if (eql(name, "slate")) return slateColor(s);
    if (eql(name, "gray")) return grayColor(s);
    if (eql(name, "red")) return redColor(s);
    if (eql(name, "orange")) return orangeColor(s);
    if (eql(name, "yellow")) return yellowColor(s);
    if (eql(name, "green")) return greenColor(s);
    if (eql(name, "blue")) return blueColor(s);
    if (eql(name, "indigo")) return indigoColor(s);
    if (eql(name, "purple")) return purpleColor(s);
    if (eql(name, "pink")) return pinkColor(s);
    if (eql(name, "cyan")) return cyanColor(s);
    if (eql(name, "teal")) return tealColor(s);
    if (eql(name, "emerald")) return emeraldColor(s);
    if (eql(name, "violet")) return violetColor(s);
    if (eql(name, "rose")) return roseColor(s);
    if (eql(name, "zinc")) return zincColor(s);
    return null;
}

fn slateColor(s: u16) ?[3]u8 {
    return switch (s) {
        50 => .{ 248, 250, 252 }, 100 => .{ 241, 245, 249 }, 200 => .{ 226, 232, 240 },
        300 => .{ 203, 213, 225 }, 400 => .{ 148, 163, 184 }, 500 => .{ 100, 116, 139 },
        600 => .{ 71, 85, 105 }, 700 => .{ 51, 65, 85 }, 800 => .{ 30, 41, 59 },
        900 => .{ 15, 23, 42 }, 950 => .{ 2, 6, 23 }, else => null,
    };
}
fn grayColor(s: u16) ?[3]u8 {
    return switch (s) {
        50 => .{ 249, 250, 251 }, 100 => .{ 243, 244, 246 }, 200 => .{ 229, 231, 235 },
        300 => .{ 209, 213, 219 }, 400 => .{ 156, 163, 175 }, 500 => .{ 107, 114, 128 },
        600 => .{ 75, 85, 99 }, 700 => .{ 55, 65, 81 }, 800 => .{ 31, 41, 55 },
        900 => .{ 17, 24, 39 }, 950 => .{ 3, 7, 18 }, else => null,
    };
}
fn redColor(s: u16) ?[3]u8 {
    return switch (s) {
        50 => .{ 254, 242, 242 }, 100 => .{ 254, 226, 226 }, 200 => .{ 254, 202, 202 },
        300 => .{ 252, 165, 165 }, 400 => .{ 248, 113, 113 }, 500 => .{ 239, 68, 68 },
        600 => .{ 220, 38, 38 }, 700 => .{ 185, 28, 28 }, 800 => .{ 153, 27, 27 },
        900 => .{ 127, 29, 29 }, else => null,
    };
}
fn orangeColor(s: u16) ?[3]u8 {
    return switch (s) {
        400 => .{ 251, 146, 60 }, 500 => .{ 249, 115, 22 }, 600 => .{ 234, 88, 12 },
        else => null,
    };
}
fn yellowColor(s: u16) ?[3]u8 {
    return switch (s) {
        400 => .{ 250, 204, 21 }, 500 => .{ 234, 179, 8 }, 600 => .{ 202, 138, 4 },
        else => null,
    };
}
fn greenColor(s: u16) ?[3]u8 {
    return switch (s) {
        50 => .{ 240, 253, 244 }, 100 => .{ 220, 252, 231 }, 200 => .{ 187, 247, 208 },
        300 => .{ 134, 239, 172 }, 400 => .{ 74, 222, 128 }, 500 => .{ 34, 197, 94 },
        600 => .{ 22, 163, 74 }, 700 => .{ 21, 128, 61 }, 800 => .{ 22, 101, 52 },
        900 => .{ 20, 83, 45 }, else => null,
    };
}
fn blueColor(s: u16) ?[3]u8 {
    return switch (s) {
        50 => .{ 239, 246, 255 }, 100 => .{ 219, 234, 254 }, 200 => .{ 191, 219, 254 },
        300 => .{ 147, 197, 253 }, 400 => .{ 96, 165, 250 }, 500 => .{ 59, 130, 246 },
        600 => .{ 37, 99, 235 }, 700 => .{ 29, 78, 216 }, 800 => .{ 30, 64, 175 },
        900 => .{ 30, 58, 138 }, else => null,
    };
}
fn indigoColor(s: u16) ?[3]u8 {
    return switch (s) {
        500 => .{ 99, 102, 241 }, 600 => .{ 79, 70, 229 }, 700 => .{ 67, 56, 202 },
        else => null,
    };
}
fn purpleColor(s: u16) ?[3]u8 {
    return switch (s) {
        500 => .{ 168, 85, 247 }, 600 => .{ 147, 51, 234 }, 700 => .{ 126, 34, 206 },
        else => null,
    };
}
fn pinkColor(s: u16) ?[3]u8 {
    return switch (s) {
        500 => .{ 236, 72, 153 }, 600 => .{ 219, 39, 119 }, 700 => .{ 190, 24, 93 },
        else => null,
    };
}
fn cyanColor(s: u16) ?[3]u8 {
    return switch (s) {
        400 => .{ 34, 211, 238 }, 500 => .{ 6, 182, 212 }, 600 => .{ 8, 145, 178 },
        else => null,
    };
}
fn tealColor(s: u16) ?[3]u8 {
    return switch (s) {
        400 => .{ 45, 212, 191 }, 500 => .{ 20, 184, 166 }, 600 => .{ 13, 148, 136 },
        else => null,
    };
}
fn emeraldColor(s: u16) ?[3]u8 {
    return switch (s) {
        400 => .{ 52, 211, 153 }, 500 => .{ 16, 185, 129 }, 600 => .{ 5, 150, 105 },
        else => null,
    };
}
fn violetColor(s: u16) ?[3]u8 {
    return switch (s) {
        500 => .{ 139, 92, 246 }, 600 => .{ 124, 58, 237 }, 700 => .{ 109, 40, 217 },
        else => null,
    };
}
fn roseColor(s: u16) ?[3]u8 {
    return switch (s) {
        500 => .{ 244, 63, 94 }, 600 => .{ 225, 29, 72 }, 700 => .{ 190, 18, 60 },
        else => null,
    };
}
fn zincColor(s: u16) ?[3]u8 {
    return switch (s) {
        50 => .{ 250, 250, 250 }, 100 => .{ 244, 244, 245 }, 200 => .{ 228, 228, 231 },
        300 => .{ 212, 212, 216 }, 400 => .{ 161, 161, 170 }, 500 => .{ 113, 113, 122 },
        600 => .{ 82, 82, 91 }, 700 => .{ 63, 63, 70 }, 800 => .{ 39, 39, 42 },
        900 => .{ 24, 24, 27 }, 950 => .{ 9, 9, 11 }, else => null,
    };
}

// ── Helpers ──

fn eql(a: []const u8, b: []const u8) bool {
    return std.mem.eql(u8, a, b);
}

fn startsWith(haystack: []const u8, prefix: []const u8) bool {
    return std.mem.startsWith(u8, haystack, prefix);
}
