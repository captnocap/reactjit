//! Compile-time Bootstrap utility class parser
//!
//! Parses Bootstrap utility classes and returns Zig style field strings.
//! Runs at compile time in the tsz compiler — zero runtime cost.
//!
//! Supports: spacing (p-0..p-5, m-0..m-5), display (d-flex, d-none),
//! flex (flex-row, flex-column, justify-content-*, align-items-*),
//! sizing (w-100, h-100), gap, text alignment, rounded, colors.

const std = @import("std");

/// Parse a space-separated Bootstrap class string into Zig style fields.
/// Returns a comma-separated list like ".padding = 16, .flex_direction = .row"
pub fn parse(alloc: std.mem.Allocator, classes: []const u8) ![]const u8 {
    var fields: std.ArrayListUnmanaged(u8) = .{};

    var iter = std.mem.splitScalar(u8, classes, ' ');
    while (iter.next()) |cls| {
        const trimmed = std.mem.trim(u8, cls, &[_]u8{ ' ', '\t', '\n', '\r' });
        if (trimmed.len == 0) continue;

        const field = parseClass(alloc, trimmed) catch continue;
        if (field.len == 0) continue;

        if (fields.items.len > 0) try fields.appendSlice(alloc, ", ");
        try fields.appendSlice(alloc, field);
    }

    return try alloc.dupe(u8, fields.items);
}

fn parseClass(alloc: std.mem.Allocator, cls: []const u8) ![]const u8 {
    // ── Display ──
    if (eql(cls, "d-flex")) return ".display = .flex";
    if (eql(cls, "d-none")) return ".display = .none";

    // ── Flex direction ──
    if (eql(cls, "flex-row")) return ".flex_direction = .row";
    if (eql(cls, "flex-column")) return ".flex_direction = .column";

    // ── Flex grow/shrink ──
    if (eql(cls, "flex-grow-0")) return ".flex_grow = 0";
    if (eql(cls, "flex-grow-1")) return ".flex_grow = 1";
    if (eql(cls, "flex-shrink-0")) return ".flex_shrink = 0";
    if (eql(cls, "flex-shrink-1")) return ".flex_shrink = 1";

    // ── Justify content ──
    if (eql(cls, "justify-content-start")) return ".justify_content = .start";
    if (eql(cls, "justify-content-center")) return ".justify_content = .center";
    if (eql(cls, "justify-content-end")) return ".justify_content = .end_";
    if (eql(cls, "justify-content-between")) return ".justify_content = .space_between";
    if (eql(cls, "justify-content-around")) return ".justify_content = .space_around";
    if (eql(cls, "justify-content-evenly")) return ".justify_content = .space_evenly";

    // ── Align items ──
    if (eql(cls, "align-items-start")) return ".align_items = .start";
    if (eql(cls, "align-items-center")) return ".align_items = .center";
    if (eql(cls, "align-items-end")) return ".align_items = .end_";
    if (eql(cls, "align-items-stretch")) return ".align_items = .stretch";

    // ── Padding (Bootstrap 0-5 scale) ──
    if (startsWith(cls, "px-")) {
        const val = bootstrapSpacing(cls[3..]) orelse return "";
        return try std.fmt.allocPrint(alloc, ".padding_left = {d}, .padding_right = {d}", .{ val, val });
    }
    if (startsWith(cls, "py-")) {
        const val = bootstrapSpacing(cls[3..]) orelse return "";
        return try std.fmt.allocPrint(alloc, ".padding_top = {d}, .padding_bottom = {d}", .{ val, val });
    }
    if (startsWith(cls, "ps-")) return try spacingField(alloc, ".padding_left", cls[3..]);
    if (startsWith(cls, "pe-")) return try spacingField(alloc, ".padding_right", cls[3..]);
    if (startsWith(cls, "pt-")) return try spacingField(alloc, ".padding_top", cls[3..]);
    if (startsWith(cls, "pb-")) return try spacingField(alloc, ".padding_bottom", cls[3..]);
    if (startsWith(cls, "p-")) return try spacingField(alloc, ".padding", cls[2..]);

    // ── Margin (Bootstrap 0-5 scale) ──
    if (startsWith(cls, "mx-")) {
        if (eql(cls[3..], "auto")) return ""; // mx-auto not directly mappable
        const val = bootstrapSpacing(cls[3..]) orelse return "";
        return try std.fmt.allocPrint(alloc, ".margin_left = {d}, .margin_right = {d}", .{ val, val });
    }
    if (startsWith(cls, "my-")) {
        const val = bootstrapSpacing(cls[3..]) orelse return "";
        return try std.fmt.allocPrint(alloc, ".margin_top = {d}, .margin_bottom = {d}", .{ val, val });
    }
    if (startsWith(cls, "ms-")) return try spacingField(alloc, ".margin_left", cls[3..]);
    if (startsWith(cls, "me-")) return try spacingField(alloc, ".margin_right", cls[3..]);
    if (startsWith(cls, "mt-")) return try spacingField(alloc, ".margin_top", cls[3..]);
    if (startsWith(cls, "mb-")) return try spacingField(alloc, ".margin_bottom", cls[3..]);
    if (startsWith(cls, "m-")) return try spacingField(alloc, ".margin", cls[2..]);

    // ── Gap ──
    if (startsWith(cls, "gap-")) return try spacingField(alloc, ".gap", cls[4..]);

    // ── Sizing ──
    if (eql(cls, "w-100")) return ".width = @as(f32, 100.0)";
    if (eql(cls, "w-75")) return ".width = @as(f32, 75.0)";
    if (eql(cls, "w-50")) return ".width = @as(f32, 50.0)";
    if (eql(cls, "w-25")) return ".width = @as(f32, 25.0)";
    if (eql(cls, "h-100")) return ".height = @as(f32, 100.0)";
    if (eql(cls, "h-75")) return ".height = @as(f32, 75.0)";
    if (eql(cls, "h-50")) return ".height = @as(f32, 50.0)";
    if (eql(cls, "h-25")) return ".height = @as(f32, 25.0)";

    // ── Text alignment ──
    if (eql(cls, "text-start")) return ".text_align = .left";
    if (eql(cls, "text-center")) return ".text_align = .center";
    if (eql(cls, "text-end")) return ".text_align = .right";

    // ── Border radius ──
    if (eql(cls, "rounded")) return ".border_radius = 4";
    if (eql(cls, "rounded-0")) return ".border_radius = 0";
    if (eql(cls, "rounded-1")) return ".border_radius = 4";
    if (eql(cls, "rounded-2")) return ".border_radius = 8";
    if (eql(cls, "rounded-3")) return ".border_radius = 12";
    if (eql(cls, "rounded-circle")) return ".border_radius = 9999";
    if (eql(cls, "rounded-pill")) return ".border_radius = 9999";

    // ── Background colors ──
    if (startsWith(cls, "bg-")) return try bootstrapColorField(alloc, ".background_color", cls[3..]);

    // ── Text colors ──
    if (startsWith(cls, "text-")) {
        const color_part = cls[5..];
        // Only handle color names, not text-start/center/end (handled above)
        if (bootstrapColor(color_part)) |rgb| {
            return try std.fmt.allocPrint(alloc, ".text_color = Color.rgb({d}, {d}, {d})", .{ rgb[0], rgb[1], rgb[2] });
        }
    }

    // Unrecognized — skip silently
    return "";
}

// ── Bootstrap spacing scale: 0-5 → pixels ──

fn bootstrapSpacing(val: []const u8) ?f32 {
    if (eql(val, "0")) return 0;
    if (eql(val, "1")) return 4;
    if (eql(val, "2")) return 8;
    if (eql(val, "3")) return 16;
    if (eql(val, "4")) return 24;
    if (eql(val, "5")) return 48;
    return null;
}

fn spacingField(alloc: std.mem.Allocator, field: []const u8, val: []const u8) ![]const u8 {
    const px = bootstrapSpacing(val) orelse return "";
    return try std.fmt.allocPrint(alloc, "{s} = {d}", .{ field, px });
}

// ── Bootstrap color palette ──

fn bootstrapColor(name: []const u8) ?[3]u8 {
    if (eql(name, "primary")) return .{ 13, 110, 253 };
    if (eql(name, "secondary")) return .{ 108, 117, 125 };
    if (eql(name, "success")) return .{ 25, 135, 84 };
    if (eql(name, "danger")) return .{ 220, 53, 69 };
    if (eql(name, "warning")) return .{ 255, 193, 7 };
    if (eql(name, "info")) return .{ 13, 202, 240 };
    if (eql(name, "light")) return .{ 248, 249, 250 };
    if (eql(name, "dark")) return .{ 33, 37, 41 };
    if (eql(name, "white")) return .{ 255, 255, 255 };
    if (eql(name, "black")) return .{ 0, 0, 0 };
    return null;
}

fn bootstrapColorField(alloc: std.mem.Allocator, field: []const u8, color_name: []const u8) ![]const u8 {
    if (bootstrapColor(color_name)) |rgb| {
        return try std.fmt.allocPrint(alloc, "{s} = Color.rgb({d}, {d}, {d})", .{ field, rgb[0], rgb[1], rgb[2] });
    }
    return "";
}

// ── Helpers ──

fn eql(a: []const u8, b: []const u8) bool {
    return std.mem.eql(u8, a, b);
}

fn startsWith(haystack: []const u8, prefix: []const u8) bool {
    return std.mem.startsWith(u8, haystack, prefix);
}
