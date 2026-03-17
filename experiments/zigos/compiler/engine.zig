//! Engine bridge — minimal SDL2/FreeType bindings for the tsz GUI.
//!
//! Instead of importing from native/engine/ (cross-module boundary issue),
//! this file provides direct @cImport access to the same C libraries.
//! The GUI does its own layout and painting — it's simple enough to not
//! need the full flex engine.

const std = @import("std");
const builtin = @import("builtin");

pub const c = @cImport({
    if (builtin.os.tag == .windows) {
        @cInclude("SDL.h");
    } else {
        @cInclude("SDL2/SDL.h");
    }
    if (builtin.os.tag == .macos) {
        @cInclude("OpenGL/gl.h");
    } else {
        @cInclude("GL/gl.h");
    }
    @cInclude("ft2build.h");
    @cInclude("freetype/freetype.h");
});

// ── UTF-8 decoding ──────────────────────────────────────────────────────

fn decodeUtf8(bytes: []const u8) struct { codepoint: u32, len: u3 } {
    if (bytes.len == 0) return .{ .codepoint = 0xFFFD, .len = 1 };
    const b0 = bytes[0];
    if (b0 < 0x80) return .{ .codepoint = b0, .len = 1 };
    if (b0 < 0xC0) return .{ .codepoint = 0xFFFD, .len = 1 };
    if (b0 < 0xE0) {
        if (bytes.len < 2) return .{ .codepoint = 0xFFFD, .len = 1 };
        return .{ .codepoint = (@as(u32, b0 & 0x1F) << 6) | @as(u32, bytes[1] & 0x3F), .len = 2 };
    }
    if (b0 < 0xF0) {
        if (bytes.len < 3) return .{ .codepoint = 0xFFFD, .len = 1 };
        return .{ .codepoint = (@as(u32, b0 & 0x0F) << 12) | (@as(u32, bytes[1] & 0x3F) << 6) | @as(u32, bytes[2] & 0x3F), .len = 3 };
    }
    if (bytes.len < 4) return .{ .codepoint = 0xFFFD, .len = 1 };
    return .{ .codepoint = (@as(u32, b0 & 0x07) << 18) | (@as(u32, bytes[1] & 0x3F) << 12) | (@as(u32, bytes[2] & 0x3F) << 6) | @as(u32, bytes[3] & 0x3F), .len = 4 };
}

pub const Color = struct {
    r: u8,
    g: u8,
    b: u8,
    a: u8 = 255,

    pub fn rgb(r: u8, g: u8, b: u8) Color {
        return .{ .r = r, .g = g, .b = b, .a = 255 };
    }
    pub fn rgba(r: u8, g: u8, b: u8, a: u8) Color {
        return .{ .r = r, .g = g, .b = b, .a = a };
    }
};

// ── Minimal text engine (simplified from engine/text.zig) ────────────────

const GlyphKey = struct { codepoint: u32, size_px: u16 };
const GlyphInfo = struct {
    texture: ?*c.SDL_Texture,
    width: i32,
    height: i32,
    bearing_x: i32,
    bearing_y: i32,
    advance: i32,
};
const MAX_GLYPHS = 256;

pub const TextEngine = struct {
    library: c.FT_Library,
    face: c.FT_Face,
    renderer: *c.SDL_Renderer,
    current_size: u16,
    cache_keys: [MAX_GLYPHS]GlyphKey,
    cache_vals: [MAX_GLYPHS]GlyphInfo,
    cache_count: usize,

    pub fn init(renderer: *c.SDL_Renderer, font_path: [*:0]const u8) !TextEngine {
        var library: c.FT_Library = undefined;
        if (c.FT_Init_FreeType(&library) != 0) return error.FreeTypeInitFailed;
        var face: c.FT_Face = undefined;
        if (c.FT_New_Face(library, font_path, 0, &face) != 0) return error.FontLoadFailed;
        _ = c.FT_Set_Pixel_Sizes(face, 0, 16);
        return .{
            .library = library,
            .face = face,
            .renderer = renderer,
            .current_size = 16,
            .cache_keys = undefined,
            .cache_vals = undefined,
            .cache_count = 0,
        };
    }

    pub fn deinit(self: *TextEngine) void {
        for (0..self.cache_count) |i| {
            if (self.cache_vals[i].texture) |tex| c.SDL_DestroyTexture(tex);
        }
        _ = c.FT_Done_Face(self.face);
        _ = c.FT_Done_FreeType(self.library);
    }

    fn setSize(self: *TextEngine, size_px: u16) void {
        if (self.current_size != size_px) {
            _ = c.FT_Set_Pixel_Sizes(self.face, 0, size_px);
            self.current_size = size_px;
        }
    }

    fn rasterizeGlyph(self: *TextEngine, codepoint: u32, size_px: u16) ?*const GlyphInfo {
        for (0..self.cache_count) |i| {
            if (self.cache_keys[i].codepoint == codepoint and self.cache_keys[i].size_px == size_px)
                return &self.cache_vals[i];
        }
        if (self.cache_count >= MAX_GLYPHS) {
            if (self.cache_vals[0].texture) |tex| c.SDL_DestroyTexture(tex);
            for (0..self.cache_count - 1) |i| {
                self.cache_keys[i] = self.cache_keys[i + 1];
                self.cache_vals[i] = self.cache_vals[i + 1];
            }
            self.cache_count -= 1;
        }
        self.setSize(size_px);
        if (c.FT_Load_Char(self.face, codepoint, c.FT_LOAD_RENDER) != 0) return null;
        const glyph = self.face.*.glyph;
        const bm = glyph.*.bitmap;
        const bw: i32 = @intCast(bm.width);
        const bh: i32 = @intCast(bm.rows);
        var texture: ?*c.SDL_Texture = null;
        if (bw > 0 and bh > 0) {
            const surface = c.SDL_CreateRGBSurfaceWithFormat(0, bw, bh, 32, c.SDL_PIXELFORMAT_ARGB8888);
            if (surface != null) {
                defer c.SDL_FreeSurface(surface);
                const pixels: [*]u8 = @ptrCast(surface.*.pixels);
                const pitch: usize = @intCast(surface.*.pitch);
                const src_pitch: usize = @intCast(bm.pitch);
                for (0..@intCast(bh)) |row| {
                    for (0..@intCast(bw)) |col| {
                        const alpha = bm.buffer[row * src_pitch + col];
                        const off = row * pitch + col * 4;
                        pixels[off] = 255;
                        pixels[off + 1] = 255;
                        pixels[off + 2] = 255;
                        pixels[off + 3] = alpha;
                    }
                }
                texture = c.SDL_CreateTextureFromSurface(self.renderer, surface);
                if (texture) |tex| _ = c.SDL_SetTextureBlendMode(tex, c.SDL_BLENDMODE_BLEND);
            }
        }
        const idx = self.cache_count;
        self.cache_keys[idx] = .{ .codepoint = codepoint, .size_px = size_px };
        self.cache_vals[idx] = .{
            .texture = texture,
            .width = bw,
            .height = bh,
            .bearing_x = glyph.*.bitmap_left,
            .bearing_y = glyph.*.bitmap_top,
            .advance = @intCast(glyph.*.advance.x >> 6),
        };
        self.cache_count += 1;
        return &self.cache_vals[idx];
    }

    pub fn drawText(self: *TextEngine, text: []const u8, x: f32, y: f32, size_px: u16, color: Color) void {
        self.setSize(size_px);
        const metrics = self.face.*.size.*.metrics;
        const ascent: f32 = @as(f32, @floatFromInt(metrics.ascender)) / 64.0;
        var pen_x = x;
        const baseline_y = y + ascent;
        var i: usize = 0;
        while (i < text.len) {
            const ch = decodeUtf8(text[i..]);
            if (self.rasterizeGlyph(ch.codepoint, size_px)) |g| {
                if (g.texture) |tex| {
                    _ = c.SDL_SetTextureColorMod(tex, color.r, color.g, color.b);
                    _ = c.SDL_SetTextureAlphaMod(tex, color.a);
                    var dst = c.SDL_Rect{
                        .x = @intFromFloat(pen_x + @as(f32, @floatFromInt(g.bearing_x))),
                        .y = @intFromFloat(baseline_y - @as(f32, @floatFromInt(g.bearing_y))),
                        .w = g.width,
                        .h = g.height,
                    };
                    _ = c.SDL_RenderCopy(self.renderer, tex, null, &dst);
                }
                pen_x += @floatFromInt(g.advance);
            }
            i += ch.len;
        }
    }

    pub fn textWidth(self: *TextEngine, text: []const u8, size_px: u16) f32 {
        var w: f32 = 0;
        var i: usize = 0;
        while (i < text.len) {
            const ch = decodeUtf8(text[i..]);
            if (self.rasterizeGlyph(ch.codepoint, size_px)) |g| {
                w += @floatFromInt(g.advance);
            }
            i += ch.len;
        }
        return w;
    }

    pub fn lineHeight(self: *TextEngine, size_px: u16) f32 {
        self.setSize(size_px);
        const m = self.face.*.size.*.metrics;
        return @as(f32, @floatFromInt(m.ascender - m.descender)) / 64.0;
    }

    /// Hit test: given a local x offset within a line of text, return the byte index.
    pub fn hitTestLine(self: *TextEngine, text: []const u8, local_x: f32, size_px: u16) usize {
        var pen: f32 = 0;
        var i: usize = 0;
        while (i < text.len) {
            const ch = decodeUtf8(text[i..]);
            const adv = if (self.rasterizeGlyph(ch.codepoint, size_px)) |g| @as(f32, @floatFromInt(g.advance)) else @as(f32, 0);
            if (pen + adv / 2.0 > local_x) return i;
            pen += adv;
            i += ch.len;
        }
        return text.len;
    }

    /// Draw a selection highlight rectangle for a range within a single line.
    pub fn drawSelectionRect(self: *TextEngine, text: []const u8, x: f32, y: f32, size_px: u16, sel_start: usize, sel_end: usize, color: Color) void {
        if (sel_start >= sel_end) return;
        const lh = self.lineHeight(size_px);
        // Measure x at sel_start
        var x0: f32 = 0;
        var x1: f32 = 0;
        var pen: f32 = 0;
        var i: usize = 0;
        while (i < text.len) {
            if (i == sel_start) x0 = pen;
            const ch = decodeUtf8(text[i..]);
            const adv = if (self.rasterizeGlyph(ch.codepoint, size_px)) |g| @as(f32, @floatFromInt(g.advance)) else @as(f32, 0);
            pen += adv;
            i += ch.len;
            if (i >= sel_end) { x1 = pen; break; }
        }
        if (sel_end >= text.len) x1 = pen;

        _ = c.SDL_SetRenderDrawBlendMode(self.renderer, c.SDL_BLENDMODE_BLEND);
        _ = c.SDL_SetRenderDrawColor(self.renderer, color.r, color.g, color.b, color.a);
        var rect = c.SDL_Rect{
            .x = @intFromFloat(x + x0),
            .y = @intFromFloat(y),
            .w = @intFromFloat(x1 - x0),
            .h = @intFromFloat(lh),
        };
        _ = c.SDL_RenderFillRect(self.renderer, &rect);
    }
};
