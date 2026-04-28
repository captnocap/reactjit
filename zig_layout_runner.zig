//! bench/zig_layout_runner.zig — drives framework/layout.zig over the bench
//! fixture set so the Python harness can compare its output to the browser
//! oracle. Reads a JSON fixture on stdin, emits child boxes on stdout.
//!
//! Build:
//!   zig build-exe bench/zig_layout_runner.zig \
//!       -O ReleaseFast -lfreetype -lc \
//!       -I/usr/include/freetype2 \
//!       -femit-bin=bench/zig_layout_runner
//!
//! Run:
//!   echo '{...fixture...}' | ./bench/zig_layout_runner

const std = @import("std");
const layout = @import("framework/layout.zig");

const c = @cImport({
    @cInclude("ft2build.h");
    @cInclude("freetype/freetype.h");
    @cInclude("freetype/tttables.h");
});

// ─────────────────────────────────────────────────────────────────────
// FreeType-backed text measurement
// ─────────────────────────────────────────────────────────────────────

var ft_lib: c.FT_Library = undefined;
var ft_face: c.FT_Face = undefined;
var ft_loaded_size: u32 = 0;

const FONT_PATHS = [_][*:0]const u8{
    "/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf",
    "/usr/share/fonts/dejavu/DejaVuSansMono.ttf",
    "/System/Library/Fonts/Menlo.ttc",
    "/usr/share/fonts/TTF/DejaVuSansMono.ttf",
};

fn initFreeType() !void {
    if (c.FT_Init_FreeType(&ft_lib) != 0) return error.FreeTypeInitFailed;
    for (FONT_PATHS) |p| {
        var f: c.FT_Face = undefined;
        if (c.FT_New_Face(ft_lib, p, 0, &f) == 0) {
            ft_face = f;
            return;
        }
    }
    return error.FontLoadFailed;
}

fn ensurePixelSize(size_px: u32) void {
    if (ft_loaded_size == size_px) return;
    _ = c.FT_Set_Pixel_Sizes(ft_face, 0, size_px);
    ft_loaded_size = size_px;
}

fn glyphAdvance(codepoint: u32, size_px: u32) f32 {
    ensurePixelSize(size_px);
    const gi = c.FT_Get_Char_Index(ft_face, codepoint);
    if (gi == 0) return @as(f32, @floatFromInt(size_px)) * 0.6;
    // FT_LOAD_NO_HINTING: skip pixel-grid snapping so the advance reflects
    // the EM-scaled subpixel value — matches Chromium's text shaping more
    // closely than the default hinted advance (which rounds to integer px).
    if (c.FT_Load_Glyph(ft_face, gi, c.FT_LOAD_NO_HINTING) != 0) return 0;
    const adv = ft_face.*.glyph.*.advance.x;
    return @as(f32, @floatFromInt(adv)) / 64.0;
}

fn lineHeight(size_px: u32) f32 {
    ensurePixelSize(size_px);
    // Browsers (Chromium with USE_TYPO_METRICS) compute `line-height: normal`
    // from OS/2 sTypoAscender + |sTypoDescender| + sTypoLineGap, then floor.
    // FreeType's `metrics.height` uses hhea ascent/descent which is a different
    // (smaller, for DejaVu Sans Mono) value — so the line height drifts by ~1px
    // around boundaries like fs=20 (23.28 vs 24.00). Match the browser path.
    const os2_raw = c.FT_Get_Sfnt_Table(ft_face, c.FT_SFNT_OS2);
    if (os2_raw) |p| {
        const os2: *c.TT_OS2 = @ptrCast(@alignCast(p));
        const total_em: i32 = @as(i32, os2.sTypoAscender) - @as(i32, os2.sTypoDescender) + @as(i32, os2.sTypoLineGap);
        const upem = ft_face.*.units_per_EM;
        if (upem > 0) {
            const lh = @as(f32, @floatFromInt(total_em)) * @as(f32, @floatFromInt(size_px)) / @as(f32, @floatFromInt(upem));
            return @floor(lh);
        }
    }
    const m = ft_face.*.size.*.metrics;
    return @as(f32, @floatFromInt(m.height)) / 64.0;
}

fn ascent(size_px: u32) f32 {
    ensurePixelSize(size_px);
    const m = ft_face.*.size.*.metrics;
    return @as(f32, @floatFromInt(m.ascender)) / 64.0;
}

fn decodeUtf8(bytes: []const u8) struct { cp: u32, len: usize } {
    if (bytes.len == 0) return .{ .cp = 0xFFFD, .len = 1 };
    const b0 = bytes[0];
    if (b0 < 0x80) return .{ .cp = b0, .len = 1 };
    if (b0 < 0xC0) return .{ .cp = 0xFFFD, .len = 1 };
    if (b0 < 0xE0) {
        if (bytes.len < 2) return .{ .cp = 0xFFFD, .len = 1 };
        return .{ .cp = (@as(u32, b0 & 0x1F) << 6) | @as(u32, bytes[1] & 0x3F), .len = 2 };
    }
    if (b0 < 0xF0) {
        if (bytes.len < 3) return .{ .cp = 0xFFFD, .len = 1 };
        return .{ .cp = (@as(u32, b0 & 0x0F) << 12) | (@as(u32, bytes[1] & 0x3F) << 6) | @as(u32, bytes[2] & 0x3F), .len = 3 };
    }
    if (bytes.len < 4) return .{ .cp = 0xFFFD, .len = 1 };
    return .{
        .cp = (@as(u32, b0 & 0x07) << 18) | (@as(u32, bytes[1] & 0x3F) << 12) | (@as(u32, bytes[2] & 0x3F) << 6) | @as(u32, bytes[3] & 0x3F),
        .len = 4,
    };
}

fn measureLineWidth(text: []const u8, size_px: u32, letter_spacing: f32) f32 {
    var w: f32 = 0;
    var i: usize = 0;
    while (i < text.len) {
        const d = decodeUtf8(text[i..]);
        w += glyphAdvance(d.cp, size_px) + letter_spacing;
        i += d.len;
    }
    if (text.len > 0 and letter_spacing > 0) w -= letter_spacing;
    return w;
}

/// Word-wrap measurement: walks `text`, breaks on whitespace, wraps when the
/// next word would exceed `max_width`. Single overflowing word stays on its
/// own line. Returns the natural box for the wrapped text.
fn measureWrapped(
    text: []const u8,
    font_size: u16,
    max_width: f32,
    letter_spacing: f32,
    line_height_override: f32,
    max_lines: u16,
    no_wrap: bool,
    bold: bool,
) layout.TextMetrics {
    _ = bold;
    const size_px: u32 = @intCast(font_size);
    if (text.len == 0) return .{};

    const lh = if (line_height_override > 0) line_height_override else lineHeight(size_px);
    const asc = ascent(size_px);

    if (no_wrap or max_width <= 0) {
        const w = measureLineWidth(text, size_px, letter_spacing);
        return .{ .width = w, .height = lh, .ascent = asc };
    }

    // word-by-word wrap
    var widest: f32 = 0;
    var cur_w: f32 = 0;
    var line_count: u32 = 1;
    var i: usize = 0;
    var word_start: usize = 0;
    var in_word = false;

    while (i <= text.len) : (i += 1) {
        const at_end = i == text.len;
        const ch = if (at_end) ' ' else text[i];
        const is_break = (ch == ' ' or ch == '\t' or ch == '\n');
        if (!is_break) {
            if (!in_word) {
                word_start = i;
                in_word = true;
            }
            continue;
        }
        if (in_word) {
            const word = text[word_start..i];
            const ww = measureLineWidth(word, size_px, letter_spacing);
            const space_w: f32 = if (cur_w > 0) glyphAdvance(' ', size_px) + letter_spacing else 0;
            if (cur_w == 0) {
                cur_w = ww;
            } else if (cur_w + space_w + ww <= max_width) {
                cur_w += space_w + ww;
            } else {
                if (cur_w > widest) widest = cur_w;
                line_count += 1;
                cur_w = ww;
            }
            in_word = false;
        }
        if (ch == '\n' and !at_end) {
            if (cur_w > widest) widest = cur_w;
            line_count += 1;
            cur_w = 0;
        }
    }
    if (cur_w > widest) widest = cur_w;

    if (max_lines > 0 and line_count > max_lines) line_count = max_lines;

    const h: f32 = lh * @as(f32, @floatFromInt(line_count));
    return .{ .width = widest, .height = h, .ascent = asc };
}

fn measureCallback(
    text: []const u8,
    font_size: u16,
    max_width: f32,
    letter_spacing: f32,
    line_height_override: f32,
    max_lines: u16,
    no_wrap: bool,
    bold: bool,
) layout.TextMetrics {
    return measureWrapped(text, font_size, max_width, letter_spacing, line_height_override, max_lines, no_wrap, bold);
}

// ─────────────────────────────────────────────────────────────────────
// JSON fixture parsing → Node tree
// ─────────────────────────────────────────────────────────────────────

const FlexDir = layout.FlexDirection;
const Justify = layout.JustifyContent;
const AlignI = layout.AlignItems;
const Wrap = layout.FlexWrap;

fn parseDirection(s: []const u8) FlexDir {
    if (std.mem.eql(u8, s, "column")) return .column;
    if (std.mem.eql(u8, s, "row_reverse")) return .row_reverse;
    if (std.mem.eql(u8, s, "column_reverse")) return .column_reverse;
    return .row;
}

fn parseJustify(s: []const u8) Justify {
    if (std.mem.eql(u8, s, "center")) return .center;
    if (std.mem.eql(u8, s, "flex-end")) return .end;
    if (std.mem.eql(u8, s, "space-between")) return .space_between;
    if (std.mem.eql(u8, s, "space-around")) return .space_around;
    return .start;
}

fn parseAlign(s: []const u8) AlignI {
    if (std.mem.eql(u8, s, "center")) return .center;
    if (std.mem.eql(u8, s, "flex-end")) return .end;
    if (std.mem.eql(u8, s, "stretch")) return .stretch;
    return .start;
}

fn parseWrap(s: []const u8) Wrap {
    if (std.mem.eql(u8, s, "wrap")) return .wrap;
    return .no_wrap;
}

fn jObj(v: std.json.Value) std.json.ObjectMap {
    return v.object;
}

fn jStr(v: std.json.Value) []const u8 {
    return v.string;
}

fn jOptF32(map: *const std.json.ObjectMap, key: []const u8) ?f32 {
    const e = map.get(key) orelse return null;
    return switch (e) {
        .null => null,
        .integer => |i| @as(f32, @floatFromInt(i)),
        .float => |f| @as(f32, @floatCast(f)),
        else => null,
    };
}

fn jF32(map: *const std.json.ObjectMap, key: []const u8, default: f32) f32 {
    const e = map.get(key) orelse return default;
    return switch (e) {
        .null => default,
        .integer => |i| @as(f32, @floatFromInt(i)),
        .float => |f| @as(f32, @floatCast(f)),
        else => default,
    };
}

fn jU16(map: *const std.json.ObjectMap, key: []const u8, default: u16) u16 {
    const e = map.get(key) orelse return default;
    return switch (e) {
        .integer => |i| @intCast(i),
        else => default,
    };
}

fn applyFlexProps(n: *layout.Node, map: *const std.json.ObjectMap) void {
    if (map.get("direction")) |v| if (v == .string) {
        n.style.flex_direction = parseDirection(v.string);
    };
    if (map.get("justify")) |v| if (v == .string) {
        n.style.justify_content = parseJustify(v.string);
    };
    if (map.get("align")) |v| if (v == .string) {
        n.style.align_items = parseAlign(v.string);
    };
    if (map.get("wrap")) |v| if (v == .string) {
        n.style.flex_wrap = parseWrap(v.string);
    };
    if (map.get("gap")) |v| switch (v) {
        .integer => |i| n.style.gap = @as(f32, @floatFromInt(i)),
        .float => |f| n.style.gap = @as(f32, @floatCast(f)),
        else => {},
    };
}

fn buildChild(allocator: std.mem.Allocator, map: *const std.json.ObjectMap) !layout.Node {
    var n = layout.Node{};
    n.style.padding = jF32(map, "padding", 0);
    n.style.margin = jF32(map, "margin", 0);
    n.style.flex_grow = jF32(map, "grow", 0);
    n.style.flex_shrink = jF32(map, "shrink", 1);

    if (map.get("basis")) |b| switch (b) {
        .integer => |i| n.style.flex_basis = @as(f32, @floatFromInt(i)),
        .float => |f| n.style.flex_basis = @as(f32, @floatCast(f)),
        .string => {}, // "auto" → leave null
        else => {},
    };

    if (jOptF32(map, "width")) |w| n.style.width = w;
    if (jOptF32(map, "height")) |h| n.style.height = h;

    n.font_size = jU16(map, "font_size", 16);

    if (map.get("text")) |t| switch (t) {
        .string => |s| n.text = try allocator.dupe(u8, s),
        else => {},
    };

    // Nested-tree extensions: children that are themselves flex containers
    // pick up direction/justify/align/gap/wrap, plus an inner `children` array.
    applyFlexProps(&n, map);
    if (map.get("children")) |kids| if (kids == .array) {
        const arr = kids.array;
        const buf = try allocator.alloc(layout.Node, arr.items.len);
        for (arr.items, 0..) |item, i| {
            if (item == .object) {
                buf[i] = try buildChild(allocator, &item.object);
            } else {
                buf[i] = .{};
            }
        }
        n.children = buf;
    };

    return n;
}

fn buildTree(allocator: std.mem.Allocator, fixture: *const std.json.ObjectMap) !struct { root: *layout.Node, child_count: usize, has_height: bool } {
    const parent = jObj(fixture.get("parent").?);
    const root = try allocator.create(layout.Node);
    root.* = .{};
    root.style.padding = jF32(&parent, "padding", 0);
    root.style.gap = jF32(&parent, "gap", 0);
    root.style.flex_direction = parseDirection(jStr(parent.get("direction").?));
    root.style.justify_content = parseJustify(jStr(parent.get("justify").?));
    root.style.align_items = parseAlign(jStr(parent.get("align").?));
    root.style.flex_wrap = parseWrap(jStr(parent.get("wrap").?));
    root.style.width = jF32(&parent, "width", 0);
    var has_height = false;
    if (jOptF32(&parent, "height")) |h| {
        root.style.height = h;
        has_height = true;
    }

    const children_arr = fixture.get("children").?.array;
    const n = children_arr.items.len;
    const buf = try allocator.alloc(layout.Node, n);
    for (children_arr.items, 0..) |item, i| {
        const m = jObj(item);
        buf[i] = try buildChild(allocator, &m);
    }
    root.children = buf;
    return .{ .root = root, .child_count = n, .has_height = has_height };
}

// ─────────────────────────────────────────────────────────────────────
// Output emission
// ─────────────────────────────────────────────────────────────────────

fn round2(x: f32) f32 {
    return std.math.round(x * 100.0) / 100.0;
}

fn emit(writer: anytype, root: *const layout.Node) !void {
    try writer.writeAll("[");
    for (root.children, 0..) |child, i| {
        if (i > 0) try writer.writeAll(",");
        // x/y are absolute (we passed root at origin); subtract root's content-box
        // origin to match the harness contract (relative to parent content box).
        const ox = root.computed.x + root.style.padLeft();
        const oy = root.computed.y + root.style.padTop();
        try writer.print("{{\"x\":{d:.2},\"y\":{d:.2},\"w\":{d:.2},\"h\":{d:.2}}}", .{
            round2(child.computed.x - ox),
            round2(child.computed.y - oy),
            round2(child.computed.w),
            round2(child.computed.h),
        });
    }
    try writer.writeAll("]");
}

// ─────────────────────────────────────────────────────────────────────
// main
// ─────────────────────────────────────────────────────────────────────

pub fn main() !void {
    try initFreeType();
    layout.setMeasureFn(&measureCallback);

    var arena = std.heap.ArenaAllocator.init(std.heap.page_allocator);
    defer arena.deinit();
    const allocator = arena.allocator();

    var stdin_buffer: [4096]u8 = undefined;
    var stdin_reader = std.fs.File.stdin().reader(&stdin_buffer);
    const input = try stdin_reader.interface.allocRemaining(allocator, .unlimited);

    var parsed = try std.json.parseFromSlice(std.json.Value, allocator, input, .{});
    defer parsed.deinit();

    const fixture = jObj(parsed.value);
    const built = try buildTree(allocator, &fixture);
    const root = built.root;

    const parent = jObj(fixture.get("parent").?);
    const w = jF32(&parent, "width", 0);

    if (built.has_height) {
        // Explicit cross size — public entry sets _stretch_h and align-content
        // honors the available room (CSS `align-content: stretch` semantics).
        const h = root.style.height.?;
        layout.layout(root, 0, 0, w, h);
    } else {
        // Auto cross size — bypass `layout()` so `_stretch_h` stays null and
        // the engine's `autoHeight` branch (estimateIntrinsicHeight, line 1180+)
        // packs wrap lines tight instead of stretching them across a sentinel.
        // ph is only used for percentage resolution; nothing in the bench uses %.
        root._flex_w = w;
        layout.layoutNode(root, 0, 0, w, 100000);
    }

    var stdout_buffer: [4096]u8 = undefined;
    var stdout_writer = std.fs.File.stdout().writer(&stdout_buffer);
    try emit(&stdout_writer.interface, root);
    try stdout_writer.interface.writeAll("\n");
    try stdout_writer.interface.flush();
}
