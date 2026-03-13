//! Engine bridge — minimal SDL2/FreeType bindings for the tsz GUI.
//!
//! Instead of importing from native/engine/ (cross-module boundary issue),
//! this file provides direct @cImport access to the same C libraries.
//! The GUI does its own layout and painting — it's simple enough to not
//! need the full flex engine.

const std = @import("std");

pub const c = @cImport({
    @cInclude("SDL2/SDL.h");
    @cInclude("GL/gl.h");
    @cInclude("ft2build.h");
    @cInclude("freetype/freetype.h");
});

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
        for (text) |byte| {
            if (self.rasterizeGlyph(@as(u32, byte), size_px)) |g| {
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
        }
    }

    pub fn textWidth(self: *TextEngine, text: []const u8, size_px: u16) f32 {
        var w: f32 = 0;
        for (text) |byte| {
            if (self.rasterizeGlyph(@as(u32, byte), size_px)) |g| {
                w += @floatFromInt(g.advance);
            }
        }
        return w;
    }

    pub fn lineHeight(self: *TextEngine, size_px: u16) f32 {
        self.setSize(size_px);
        const m = self.face.*.size.*.metrics;
        return @as(f32, @floatFromInt(m.ascender - m.descender)) / 64.0;
    }
};
