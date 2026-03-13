//! ReactJIT Text Renderer — Phase 2
//!
//! FreeType glyph rasterization → SDL2 texture cache → screen.
//! Measures text for the layout engine, renders it for the painter.

const std = @import("std");
const c = @import("c.zig").imports;
const layout = @import("layout.zig");

// ── Glyph cache ─────────────────────────────────────────────────────────────

const GlyphKey = struct {
    codepoint: u32,
    size_px: u16,
};

const GlyphInfo = struct {
    texture: ?*c.SDL_Texture,
    width: i32,
    height: i32,
    bearing_x: i32,
    bearing_y: i32,
    advance: i32, // in pixels (pre-divided from 26.6 fixed point)
};

const MAX_CACHED_GLYPHS = 512;

// ── Text Engine ─────────────────────────────────────────────────────────────

pub const TextEngine = struct {
    library: c.FT_Library,
    face: c.FT_Face,
    renderer: *c.SDL_Renderer,
    current_size: u16,

    // Simple flat cache — good enough for Phase 2
    cache_keys: [MAX_CACHED_GLYPHS]GlyphKey,
    cache_vals: [MAX_CACHED_GLYPHS]GlyphInfo,
    cache_count: usize,

    pub fn init(renderer: *c.SDL_Renderer, font_path: [*:0]const u8) !TextEngine {
        var library: c.FT_Library = undefined;
        if (c.FT_Init_FreeType(&library) != 0) {
            return error.FreeTypeInitFailed;
        }

        var face: c.FT_Face = undefined;
        if (c.FT_New_Face(library, font_path, 0, &face) != 0) {
            return error.FontLoadFailed;
        }

        // Default size
        _ = c.FT_Set_Pixel_Sizes(face, 0, 16);

        return TextEngine{
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
        // Free cached textures
        for (0..self.cache_count) |i| {
            if (self.cache_vals[i].texture) |tex| {
                c.SDL_DestroyTexture(tex);
            }
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

    fn lookupGlyph(self: *TextEngine, codepoint: u32, size_px: u16) ?*const GlyphInfo {
        for (0..self.cache_count) |i| {
            if (self.cache_keys[i].codepoint == codepoint and self.cache_keys[i].size_px == size_px) {
                return &self.cache_vals[i];
            }
        }
        return null;
    }

    fn rasterizeGlyph(self: *TextEngine, codepoint: u32, size_px: u16) ?*const GlyphInfo {
        // Check cache first
        if (self.lookupGlyph(codepoint, size_px)) |g| return g;

        // Cache full — evict oldest (simple FIFO)
        if (self.cache_count >= MAX_CACHED_GLYPHS) {
            if (self.cache_vals[0].texture) |tex| {
                c.SDL_DestroyTexture(tex);
            }
            // Shift everything down
            for (0..self.cache_count - 1) |i| {
                self.cache_keys[i] = self.cache_keys[i + 1];
                self.cache_vals[i] = self.cache_vals[i + 1];
            }
            self.cache_count -= 1;
        }

        self.setSize(size_px);

        if (c.FT_Load_Char(self.face, codepoint, c.FT_LOAD_RENDER) != 0) {
            return null;
        }

        const glyph = self.face.*.glyph;
        const bitmap = glyph.*.bitmap;
        const bw: i32 = @intCast(bitmap.width);
        const bh: i32 = @intCast(bitmap.rows);

        var texture: ?*c.SDL_Texture = null;

        if (bw > 0 and bh > 0) {
            // Create an RGBA surface from the grayscale bitmap
            const surface = c.SDL_CreateRGBSurfaceWithFormat(
                0,
                bw,
                bh,
                32,
                c.SDL_PIXELFORMAT_RGBA8888,
            );
            if (surface == null) return null;
            defer c.SDL_FreeSurface(surface);

            // Copy FreeType bitmap (8-bit alpha) into RGBA surface
            const pixels: [*]u8 = @ptrCast(surface.*.pixels);
            const pitch: usize = @intCast(surface.*.pitch);
            const src_pitch: usize = @intCast(bitmap.pitch);

            for (0..@intCast(bh)) |row| {
                for (0..@intCast(bw)) |col| {
                    const alpha = bitmap.buffer[row * src_pitch + col];
                    const dst_offset = row * pitch + col * 4;
                    // RGBA8888: R, G, B, A
                    pixels[dst_offset + 0] = 255; // R
                    pixels[dst_offset + 1] = 255; // G
                    pixels[dst_offset + 2] = 255; // B
                    pixels[dst_offset + 3] = alpha; // A
                }
            }

            texture = c.SDL_CreateTextureFromSurface(self.renderer, surface);
            if (texture) |tex| {
                _ = c.SDL_SetTextureBlendMode(tex, c.SDL_BLENDMODE_BLEND);
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
            .advance = @intCast(glyph.*.advance.x >> 6), // 26.6 fixed → pixels
        };
        self.cache_count += 1;

        return &self.cache_vals[idx];
    }

    /// Measure a string's width and height at the given font size.
    pub fn measureText(self: *TextEngine, text: []const u8, size_px: u16) layout.TextMetrics {
        self.setSize(size_px);

        var width: f32 = 0;
        var max_ascent: f32 = 0;
        var max_descent: f32 = 0;

        for (text) |byte| {
            const codepoint: u32 = byte; // ASCII for Phase 2
            if (self.rasterizeGlyph(codepoint, size_px)) |g| {
                width += @floatFromInt(g.advance);
                const ascent: f32 = @floatFromInt(g.bearing_y);
                const descent: f32 = @floatFromInt(g.height - g.bearing_y);
                if (ascent > max_ascent) max_ascent = ascent;
                if (descent > max_descent) max_descent = descent;
            }
        }

        return .{
            .width = width,
            .height = max_ascent + max_descent,
            .ascent = max_ascent,
        };
    }

    /// Draw a string at (x, y) with the given color and size.
    /// y is the top of the text bounding box (not baseline).
    pub fn drawText(self: *TextEngine, text: []const u8, x: f32, y: f32, size_px: u16, color: layout.Color) void {
        self.setSize(size_px);

        // First pass: find max ascent for baseline calculation
        var max_ascent: f32 = 0;
        for (text) |byte| {
            const codepoint: u32 = byte;
            if (self.rasterizeGlyph(codepoint, size_px)) |g| {
                const ascent: f32 = @floatFromInt(g.bearing_y);
                if (ascent > max_ascent) max_ascent = ascent;
            }
        }

        // Second pass: render
        var pen_x = x;
        const baseline_y = y + max_ascent;

        for (text) |byte| {
            const codepoint: u32 = byte;
            if (self.rasterizeGlyph(codepoint, size_px)) |g| {
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
};
