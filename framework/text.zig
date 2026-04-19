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
    is_color: bool, // true for color emoji (BGRA bitmap) — don't tint with text color
    scale: f32, // 1.0 for normal glyphs; <1.0 for bitmap strikes scaled down
};

const MAX_CACHED_GLYPHS = 512;

// ── UTF-8 decoding ──────────────────────────────────────────────────────────

const Utf8Char = struct {
    codepoint: u32,
    len: u3, // 1–4 bytes consumed
};

/// Decode one UTF-8 codepoint from the start of `bytes`.
/// Returns the codepoint and how many bytes it consumed.
/// Invalid sequences return U+FFFD (replacement character) and advance 1 byte.
fn decodeUtf8(bytes: []const u8) Utf8Char {
    if (bytes.len == 0) return .{ .codepoint = 0xFFFD, .len = 1 };
    const b0 = bytes[0];
    if (b0 < 0x80) {
        return .{ .codepoint = b0, .len = 1 };
    } else if (b0 < 0xC0) {
        return .{ .codepoint = 0xFFFD, .len = 1 }; // stray continuation byte
    } else if (b0 < 0xE0) {
        if (bytes.len < 2) return .{ .codepoint = 0xFFFD, .len = 1 };
        return .{ .codepoint = (@as(u32, b0 & 0x1F) << 6) | @as(u32, bytes[1] & 0x3F), .len = 2 };
    } else if (b0 < 0xF0) {
        if (bytes.len < 3) return .{ .codepoint = 0xFFFD, .len = 1 };
        return .{ .codepoint = (@as(u32, b0 & 0x0F) << 12) | (@as(u32, bytes[1] & 0x3F) << 6) | @as(u32, bytes[2] & 0x3F), .len = 3 };
    } else {
        if (bytes.len < 4) return .{ .codepoint = 0xFFFD, .len = 1 };
        return .{ .codepoint = (@as(u32, b0 & 0x07) << 18) | (@as(u32, bytes[1] & 0x3F) << 12) | (@as(u32, bytes[2] & 0x3F) << 6) | @as(u32, bytes[3] & 0x3F), .len = 4 };
    }
}

fn inlineGlyphSentinelLen(text: []const u8, i: usize) usize {
    if (i >= text.len) return 0;
    if (text[i] == 0x01) return 1;
    if (text[i] != '\\') return 0;
    if (i + 2 < text.len and text[i + 1] == '\\' and text[i + 2] == '1') return 3;
    if (i + 4 < text.len and text[i + 1] == '\\' and text[i + 2] == 'x' and text[i + 3] == '0' and text[i + 4] == '1') return 5;
    if (i + 1 < text.len and text[i + 1] == '1') return 2;
    if (i + 3 < text.len and text[i + 1] == 'x' and text[i + 2] == '0' and text[i + 3] == '1') return 4;
    return 0;
}

// ── Color Span (for syntax highlighting) ─────────────────────────────────────

pub const ColorSpan = struct {
    text: []const u8,
    color: layout.Color,
};

// ── Text Engine ─────────────────────────────────────────────────────────────

const MAX_FALLBACK_FONTS = 8;

// ── Fontconfig resolution ───────────────────────────────────────────────────
// Uses `fc-match` to resolve font paths from the system's fontconfig database.
// This respects user font preferences and works across distros.

const FC_BUF_SIZE = 512;

/// Run `fc-match <pattern> -f '%{file}'` and return the path as a
/// null-terminated string in a static buffer. Returns null if fc-match fails.
var fc_buf: [FC_BUF_SIZE]u8 = undefined;

fn fcMatch(pattern: [*:0]const u8) ?[*:0]u8 {
    // Skip fc-match on macOS — it deadlocks when spawned before the Cocoa event loop.
    // Fallback fonts are handled via HARDCODED_FALLBACK_PATHS below.
    if (comptime @import("builtin").os.tag == .macos) return null;
    const result = std.process.Child.run(.{
        .allocator = std.heap.page_allocator,
        .argv = &[_][]const u8{ "fc-match", std.mem.span(pattern), "-f", "%{file}" },
    }) catch return null;
    defer std.heap.page_allocator.free(result.stdout);
    defer std.heap.page_allocator.free(result.stderr);

    if (result.stdout.len == 0 or result.stdout.len >= FC_BUF_SIZE - 1) return null;
    @memcpy(fc_buf[0..result.stdout.len], result.stdout);
    fc_buf[result.stdout.len] = 0;
    return @ptrCast(&fc_buf);
}

/// Resolve a fontconfig pattern to a FreeType face. Returns null if not found.
fn fcLoadFace(library: c.FT_Library, pattern: [*:0]const u8) ?c.FT_Face {
    const path: [*:0]const u8 = fcMatch(pattern) orelse return null;
    var face: c.FT_Face = undefined;
    if (c.FT_New_Face(library, path, 0, &face) == 0) {
        return face;
    }
    return null;
}

/// Fontconfig patterns for fallback fonts (resolved at runtime).
const FC_FALLBACK_PATTERNS = [_][*:0]const u8{
    ":lang=ja", // CJK — :lang=ja reliably finds Noto Sans CJK
    "Noto Color Emoji",
    "Noto Sans Symbols 2",
};

/// Hardcoded fallback paths in case fc-match is not available.
const HARDCODED_FALLBACK_PATHS = if (@import("builtin").os.tag == .macos) [_][*:0]const u8{
    "/System/Library/Fonts/Supplemental/Arial Unicode.ttf",
    "/System/Library/Fonts/Apple Color Emoji.ttc",
    "/System/Library/Fonts/Supplemental/Courier New.ttf",
} else [_][*:0]const u8{
    "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc",
    "/usr/share/fonts/noto-cjk/NotoSansCJK-Regular.ttc",
    "/usr/share/fonts/truetype/noto/NotoColorEmoji.ttf",
    "/usr/share/fonts/truetype/noto/NotoSansSymbols2-Regular.ttf",
    "/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc",
};

// ── Measurement cache types ──────────────────────────────────────────────────

const MCACHE_SIZE = 512;

const MeasureCacheKey = struct {
    text_ptr: usize,
    text_len: usize,
    size_px: u16,
    max_width_i: i32,
    letter_spacing_i: i16,
    line_height_i: i16,
    max_lines: u16,
};

pub const TextEngine = struct {
    library: c.FT_Library,
    face: c.FT_Face,
    renderer: ?*c.SDL_Renderer,
    current_size: u16,
    fallback_size: u16,
    headless: bool = false,

    // Fallback fonts for glyphs missing from the primary face
    fallback_faces: [MAX_FALLBACK_FONTS]c.FT_Face,
    fallback_count: usize,

    // Simple flat cache — good enough for Phase 2
    cache_keys: [MAX_CACHED_GLYPHS]GlyphKey,
    cache_vals: [MAX_CACHED_GLYPHS]GlyphInfo,
    cache_count: usize,

    // Text measurement cache — avoids re-measuring identical text every frame
    measure_cache_keys: [MCACHE_SIZE]MeasureCacheKey,
    measure_cache_vals: [MCACHE_SIZE]layout.TextMetrics,
    measure_cache_valid: [MCACHE_SIZE]bool,

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

        // Load fallback fonts via fontconfig first, then hardcoded paths
        var fallbacks: [MAX_FALLBACK_FONTS]c.FT_Face = undefined;
        var fb_count: usize = 0;

        // Try fontconfig patterns first
        for (FC_FALLBACK_PATTERNS) |pattern| {
            if (fb_count >= MAX_FALLBACK_FONTS) break;
            if (fcLoadFace(library, pattern)) |fb_face| {
                _ = c.FT_Set_Pixel_Sizes(fb_face, 0, 16);
                fallbacks[fb_count] = fb_face;
                fb_count += 1;
            }
        }

        // If fontconfig didn't find much, try hardcoded paths
        if (fb_count < 2) {
            for (HARDCODED_FALLBACK_PATHS) |fb_path| {
                if (fb_count >= MAX_FALLBACK_FONTS) break;
                var fb_face: c.FT_Face = undefined;
                if (c.FT_New_Face(library, fb_path, 0, &fb_face) == 0) {
                    _ = c.FT_Set_Pixel_Sizes(fb_face, 0, 16);
                    fallbacks[fb_count] = fb_face;
                    fb_count += 1;
                }
            }
        }

        return TextEngine{
            .library = library,
            .face = face,
            .renderer = renderer,
            .current_size = 16,
            .fallback_size = 16,
            .fallback_faces = fallbacks,
            .fallback_count = fb_count,
            .cache_keys = undefined,
            .cache_vals = undefined,
            .cache_count = 0,
            .measure_cache_keys = undefined,
            .measure_cache_vals = undefined,
            .measure_cache_valid = [_]bool{false} ** MCACHE_SIZE,
        };
    }

    /// Initialize TextEngine for measurement only (no SDL_Renderer needed).
    /// Use when GPU rendering handles drawing — TextEngine only does FreeType measurement.
    pub fn initHeadless(font_path: [*:0]const u8) !TextEngine {
        var library: c.FT_Library = undefined;
        if (c.FT_Init_FreeType(&library) != 0) return error.FreeTypeInitFailed;

        var face: c.FT_Face = undefined;
        if (c.FT_New_Face(library, font_path, 0, &face) != 0) return error.FontLoadFailed;
        _ = c.FT_Set_Pixel_Sizes(face, 0, 16);

        var fallbacks: [MAX_FALLBACK_FONTS]c.FT_Face = undefined;
        var fb_count: usize = 0;
        for (FC_FALLBACK_PATTERNS) |pattern| {
            if (fb_count >= MAX_FALLBACK_FONTS) break;
            if (fcLoadFace(library, pattern)) |fb_face| {
                _ = c.FT_Set_Pixel_Sizes(fb_face, 0, 16);
                fallbacks[fb_count] = fb_face;
                fb_count += 1;
            }
        }
        if (fb_count < 2) {
            for (HARDCODED_FALLBACK_PATHS) |fb_path| {
                if (fb_count >= MAX_FALLBACK_FONTS) break;
                var fb_face: c.FT_Face = undefined;
                if (c.FT_New_Face(library, fb_path, 0, &fb_face) == 0) {
                    _ = c.FT_Set_Pixel_Sizes(fb_face, 0, 16);
                    fallbacks[fb_count] = fb_face;
                    fb_count += 1;
                }
            }
        }

        return TextEngine{
            .library = library,
            .face = face,
            .renderer = null,
            .headless = true,
            .current_size = 16,
            .fallback_size = 16,
            .fallback_faces = fallbacks,
            .fallback_count = fb_count,
            .cache_keys = undefined,
            .cache_vals = undefined,
            .cache_count = 0,
            .measure_cache_keys = undefined,
            .measure_cache_vals = undefined,
            .measure_cache_valid = [_]bool{false} ** MCACHE_SIZE,
        };
    }

    /// Clear the measurement cache (call on font changes or major state resets).
    pub fn clearMeasureCache(self: *TextEngine) void {
        @memset(&self.measure_cache_valid, false);
    }

    fn measureCacheHash(key: MeasureCacheKey) usize {
        var h: usize = key.text_ptr;
        h = h *% 31 +% key.text_len;
        h = h *% 31 +% @as(usize, key.size_px);
        h = h *% 31 +% @as(usize, @intCast(@as(u32, @bitCast(key.max_width_i))));
        h = h *% 31 +% @as(usize, @intCast(@as(u16, @bitCast(key.letter_spacing_i))));
        h = h *% 31 +% @as(usize, @intCast(@as(u16, @bitCast(key.line_height_i))));
        h = h *% 31 +% @as(usize, key.max_lines);
        return h % MCACHE_SIZE;
    }

    fn measureCacheLookup(self: *TextEngine, key: MeasureCacheKey) ?layout.TextMetrics {
        const idx = measureCacheHash(key);
        if (self.measure_cache_valid[idx] and
            std.meta.eql(self.measure_cache_keys[idx], key))
        {
            return self.measure_cache_vals[idx];
        }
        return null;
    }

    fn measureCacheStore(self: *TextEngine, key: MeasureCacheKey, val: layout.TextMetrics) void {
        const idx = measureCacheHash(key);
        self.measure_cache_keys[idx] = key;
        self.measure_cache_vals[idx] = val;
        self.measure_cache_valid[idx] = true;
    }

    pub fn deinit(self: *TextEngine) void {
        // Free cached textures
        for (0..self.cache_count) |i| {
            if (self.cache_vals[i].texture) |tex| {
                c.SDL_DestroyTexture(tex);
            }
        }
        for (0..self.fallback_count) |i| {
            _ = c.FT_Done_Face(self.fallback_faces[i]);
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

    fn setFallbackSize(self: *TextEngine, size_px: u16) void {
        if (self.fallback_size != size_px) {
            for (0..self.fallback_count) |i| {
                const fb = self.fallback_faces[i];
                // For bitmap strike fonts (like Noto Color Emoji), select the
                // first available strike instead of setting pixel size directly.
                if (fb.*.num_fixed_sizes > 0) {
                    _ = c.FT_Select_Size(fb, 0);
                } else {
                    _ = c.FT_Set_Pixel_Sizes(fb, 0, size_px);
                }
            }
            self.fallback_size = size_px;
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

        // Try primary face first; fall back to secondary faces if glyph is missing
        // OR if a fallback has a color version (prefer color emoji over monochrome)
        self.setSize(size_px);
        const glyph_index = c.FT_Get_Char_Index(self.face, codepoint);
        var use_face = self.face;

        var is_bitmap_strike = false;
        if (self.fallback_count > 0) {
            const need_fallback = (glyph_index == 0);
            // For codepoints above U+2000, also check if a color fallback exists
            // (prefer color emoji over monochrome dingbats from the primary font)
            const want_color = (!need_fallback and codepoint >= 0x2000);

            if (need_fallback or want_color) {
                self.setFallbackSize(size_px);
                for (0..self.fallback_count) |fi| {
                    const fb = self.fallback_faces[fi];
                    const fb_idx = c.FT_Get_Char_Index(fb, codepoint);
                    if (fb_idx != 0) {
                        if (need_fallback) {
                            // Primary doesn't have it — use first fallback that does
                            use_face = fb;
                            is_bitmap_strike = (fb.*.num_fixed_sizes > 0);
                            break;
                        } else if (want_color and fb.*.num_fixed_sizes > 0) {
                            // Primary has it but fallback has a color bitmap — prefer color
                            use_face = fb;
                            is_bitmap_strike = true;
                            break;
                        }
                    }
                }
            }
        }

        // For bitmap strike fonts (color emoji), select the strike first
        if (is_bitmap_strike) {
            _ = c.FT_Select_Size(use_face, 0);
        }

        // Try color load first (for emoji), fall back to grayscale
        var is_color = false;
        if (c.FT_Load_Char(use_face, codepoint, c.FT_LOAD_COLOR | c.FT_LOAD_RENDER) != 0) {
            // Color load failed — try plain grayscale
            if (c.FT_Load_Char(use_face, codepoint, c.FT_LOAD_RENDER) != 0) {
                return null;
            }
        }

        const glyph = use_face.*.glyph;
        const bitmap = glyph.*.bitmap;
        const bw: i32 = @intCast(bitmap.width);
        const bh: i32 = @intCast(bitmap.rows);

        // Detect color bitmap (BGRA — used by color emoji fonts)
        // FT_PIXEL_MODE_BGRA = 7
        if (bitmap.pixel_mode == 7) {
            is_color = true;
        }

        var texture: ?*c.SDL_Texture = null;

        if (bw > 0 and bh > 0) {
            const surface = c.SDL_CreateSurface(
                bw,
                bh,
                c.SDL_PIXELFORMAT_ARGB8888,
            );
            if (surface == null) return null;
            defer c.SDL_DestroySurface(surface);

            const pixels: [*]u8 = @ptrCast(surface.*.pixels);
            const pitch: usize = @intCast(surface.*.pitch);
            const src_pitch: usize = @intCast(bitmap.pitch);

            if (is_color) {
                // Color emoji: BGRA source → ARGB8888 dest
                // FreeType BGRA: B, G, R, A per pixel (4 bytes)
                // SDL ARGB8888 little-endian memory: B, G, R, A — same layout!
                for (0..@intCast(bh)) |row| {
                    const src_row = bitmap.buffer + row * src_pitch;
                    const dst_row = pixels + row * pitch;
                    @memcpy(dst_row[0..@intCast(@as(usize, @intCast(bw)) * 4)], src_row[0..@intCast(@as(usize, @intCast(bw)) * 4)]);
                }
            } else {
                // Grayscale: 8-bit alpha → white + alpha
                for (0..@intCast(bh)) |row| {
                    for (0..@intCast(bw)) |col| {
                        const alpha = bitmap.buffer[row * src_pitch + col];
                        const dst_offset = row * pitch + col * 4;
                        pixels[dst_offset + 0] = 255; // B
                        pixels[dst_offset + 1] = 255; // G
                        pixels[dst_offset + 2] = 255; // R
                        pixels[dst_offset + 3] = alpha; // A
                    }
                }
            }

            if (!self.headless) {
                if (self.renderer) |r| {
                    texture = c.SDL_CreateTextureFromSurface(r, surface);
                    if (texture) |tex| {
                        _ = c.SDL_SetTextureBlendMode(tex, c.SDL_BLENDMODE_BLEND);
                    }
                }
            }
        }

        // For bitmap strike fonts, compute scale factor: desired_size / strike_size
        const glyph_scale: f32 = if (is_bitmap_strike and bh > 0)
            @as(f32, @floatFromInt(size_px)) / @as(f32, @floatFromInt(bh))
        else
            1.0;

        // Scale the advance for bitmap strikes
        const raw_advance: f32 = @floatFromInt(glyph.*.advance.x >> 6);
        const scaled_advance: i32 = if (is_bitmap_strike)
            @intFromFloat(raw_advance * glyph_scale)
        else
            @intCast(glyph.*.advance.x >> 6);

        const idx = self.cache_count;
        self.cache_keys[idx] = .{ .codepoint = codepoint, .size_px = size_px };
        self.cache_vals[idx] = .{
            .texture = texture,
            .width = bw,
            .height = bh,
            .bearing_x = glyph.*.bitmap_left,
            .bearing_y = glyph.*.bitmap_top,
            .advance = scaled_advance,
            .is_color = is_color,
            .scale = glyph_scale,
        };
        self.cache_count += 1;

        return &self.cache_vals[idx];
    }

    /// Get the advance width of a single Unicode codepoint.
    fn cpAdvance(self: *TextEngine, codepoint: u32, size_px: u16) f32 {
        if (self.rasterizeGlyph(codepoint, size_px)) |g| {
            return @floatFromInt(g.advance);
        }
        return 0;
    }

    /// Get font-level line metrics for the current size.
    pub fn lineMetrics(self: *TextEngine, size_px: u16) struct { ascent: f32, height: f32 } {
        self.setSize(size_px);
        const metrics = self.face.*.size.*.metrics;
        const ascent: f32 = @as(f32, @floatFromInt(metrics.ascender)) / 64.0;
        // Use FreeType's full line height (ascent + descent + line gap) to match
        // gpu.zig's line spacing. Using ascent + descent alone clips descenders
        // by 1-2px because the line gap accounts for glyph overshoot.
        const height: f32 = @as(f32, @floatFromInt(metrics.height)) / 64.0;
        return .{ .ascent = ascent, .height = height };
    }

    // ── Word wrapping ───────────────────────────────────────────────────

    const MAX_WRAP_LINES = 256;

    const WrapResult = struct {
        line_starts: [MAX_WRAP_LINES]usize = undefined,
        line_ends: [MAX_WRAP_LINES]usize = undefined,
        count: usize = 0,

        fn addLine(self: *WrapResult, start: usize, end: usize) void {
            if (self.count < MAX_WRAP_LINES) {
                self.line_starts[self.count] = start;
                self.line_ends[self.count] = end;
                self.count += 1;
            }
        }
    };

    /// Compute word-wrap line breaks for text within max_width.
    /// Words are delimited by spaces. Newlines force a break.
    /// Words wider than max_width get their own line (no mid-word break).
    /// Iterates by UTF-8 codepoints so multi-byte characters stay intact.
    fn wordWrap(self: *TextEngine, text: []const u8, size_px: u16, max_width: f32) WrapResult {
        var result = WrapResult{};

        if (text.len == 0) {
            result.addLine(0, 0);
            return result;
        }

        self.setSize(size_px);
        const space_w = self.cpAdvance(' ', size_px);

        var line_start: usize = 0;
        var line_width: f32 = 0;
        var last_word_end: usize = 0;
        var i: usize = 0;

        while (i < text.len) {
            // Handle newline — explicit line break
            if (text[i] == '\n') {
                const end = if (last_word_end > line_start) last_word_end else i;
                result.addLine(line_start, end);
                i += 1;
                line_start = i;
                last_word_end = i;
                line_width = 0;
                continue;
            }

            // Skip spaces
            if (text[i] == ' ') {
                i += 1;
                continue;
            }

            // Found start of a word — measure the whole word (UTF-8 aware)
            const word_start = i;
            var word_width: f32 = 0;
            while (i < text.len and text[i] != ' ' and text[i] != '\n') {
                const sentinel_len = inlineGlyphSentinelLen(text, i);
                if (sentinel_len > 0) {
                    word_width += @floatFromInt(size_px);
                    i += sentinel_len;
                    continue;
                }
                const ch = decodeUtf8(text[i..]);
                word_width += self.cpAdvance(ch.codepoint, size_px);
                i += ch.len;
            }
            const word_end = i;

            // Would adding this word overflow the line?
            const need_space = (line_width > 0);
            const with_word = line_width + (if (need_space) space_w else @as(f32, 0)) + word_width;

            if (need_space and with_word > max_width) {
                // Wrap: emit current line, start new line at this word
                result.addLine(line_start, last_word_end);
                line_start = word_start;
                line_width = word_width;
                last_word_end = word_end;
            } else {
                line_width = with_word;
                last_word_end = word_end;
            }
        }

        // Emit final line
        if (line_start <= text.len) {
            const end = if (last_word_end > line_start) last_word_end else text.len;
            result.addLine(line_start, end);
        }

        if (result.count == 0) {
            result.addLine(0, text.len);
        }

        return result;
    }

    // ── Measurement ─────────────────────────────────────────────────────

    /// Measure a line's width accounting for letter spacing.
    fn measureLineWidth(self: *TextEngine, text: []const u8, size_px: u16, letter_spacing: f32) f32 {
        var width: f32 = 0;
        var char_count: usize = 0;
        var i: usize = 0;
        while (i < text.len) {
            // Inline glyph sentinel — occupies fontSize×fontSize square
            const sentinel_len = inlineGlyphSentinelLen(text, i);
            if (sentinel_len > 0) {
                width += @floatFromInt(size_px);
                char_count += 1;
                i += sentinel_len;
                continue;
            }
            const ch = decodeUtf8(text[i..]);
            if (self.rasterizeGlyph(ch.codepoint, size_px)) |g| {
                width += @floatFromInt(g.advance);
            }
            char_count += 1;
            i += ch.len;
        }
        // Add letter spacing between characters (not after the last)
        if (letter_spacing != 0 and char_count > 1) {
            width += letter_spacing * @as(f32, @floatFromInt(char_count - 1));
        }
        return width;
    }

    /// Measure a string's width and height at the given font size.
    /// Height uses the font's line metrics (consistent per font size),
    /// not per-glyph ink bounds (which vary by character and cause overlap).
    pub fn measureText(self: *TextEngine, text: []const u8, size_px: u16) layout.TextMetrics {
        return self.measureTextEx(text, size_px, 0, 0, 0);
    }

    /// Measure text with extended parameters: letter spacing, line height override, max lines.
    pub fn measureTextEx(self: *TextEngine, text: []const u8, size_px: u16, letter_spacing: f32, line_height_override: f32, _: u16) layout.TextMetrics {
        const lm = self.lineMetrics(size_px);
        const effective_lh: f32 = if (line_height_override > 0) line_height_override else lm.height;

        const width = self.measureLineWidth(text, size_px, letter_spacing);

        return .{
            .width = width,
            .height = effective_lh,
            .ascent = lm.ascent,
        };
    }

    /// Measure text with word wrapping within max_width.
    /// Returns the widest wrapped line's width and total wrapped height.
    /// If max_width <= 0, falls back to unwrapped measureText.
    pub fn measureTextWrapped(self: *TextEngine, text: []const u8, size_px: u16, max_width: f32) layout.TextMetrics {
        return self.measureTextWrappedEx(text, size_px, max_width, 0, 0, 0);
    }

    /// Measure text with wrapping + extended params. Uses measurement cache.
    pub fn measureTextWrappedEx(self: *TextEngine, text: []const u8, size_px: u16, max_width: f32, letter_spacing: f32, line_height_override: f32, max_lines: u16, no_wrap: bool) layout.TextMetrics {
        // noWrap: force single-line measurement regardless of max_width
        if (max_width <= 0 or no_wrap) {
            const m = self.measureTextEx(text, size_px, letter_spacing, line_height_override, max_lines);
            if (no_wrap and max_width > 0) {
                // Clamp width to max_width but keep single-line height
                return .{ .width = @min(m.width, max_width), .height = m.height, .ascent = m.ascent };
            }
            return m;
        }

        // Check measurement cache
        const cache_key = MeasureCacheKey{
            .text_ptr = @intFromPtr(text.ptr),
            .text_len = text.len,
            .size_px = size_px,
            .max_width_i = @intFromFloat(max_width * 10),
            .letter_spacing_i = @intFromFloat(letter_spacing * 10),
            .line_height_i = @intFromFloat(line_height_override * 10),
            .max_lines = max_lines,
        };
        if (self.measureCacheLookup(cache_key)) |cached| {
            return cached;
        }

        const lm = self.lineMetrics(size_px);
        const effective_lh: f32 = if (line_height_override > 0) line_height_override else lm.height;

        // When letter spacing is set, reduce wrap width to account for wider chars
        var wrap_width = max_width;
        if (letter_spacing > 0) {
            // Approximate: each char is wider by letter_spacing
            const avg_adv = self.cpAdvance('M', size_px);
            if (avg_adv > 0) {
                const ratio = avg_adv / (avg_adv + letter_spacing);
                wrap_width = max_width * ratio;
            }
        }

        const wrap = self.wordWrap(text, size_px, wrap_width);

        // Clamp line count
        var line_count = wrap.count;
        if (max_lines > 0 and line_count > max_lines) {
            line_count = max_lines;
        }

        // Find the widest line
        var widest: f32 = 0;
        for (0..line_count) |li| {
            const line = text[wrap.line_starts[li]..wrap.line_ends[li]];
            const lw = self.measureLineWidth(line, size_px, letter_spacing);
            if (lw > widest) widest = lw;
        }

        const result = layout.TextMetrics{
            .width = @min(widest, max_width),
            .height = effective_lh * @as(f32, @floatFromInt(line_count)),
            .ascent = lm.ascent,
        };
        self.measureCacheStore(cache_key, result);
        return result;
    }

    /// Measure the min-content width of text (width of the longest word).
    /// Used by layout for CSS min-width: auto floor in flex items.
    pub fn measureMinContentWidth(self: *TextEngine, text: []const u8, size_px: u16, letter_spacing: f32) f32 {
        var max_word_w: f32 = 0;
        var i: usize = 0;

        while (i < text.len) {
            // Skip whitespace
            while (i < text.len and (text[i] == ' ' or text[i] == '\n')) : (i += 1) {}
            if (i >= text.len) break;

            // Measure word
            var word_w: f32 = 0;
            var char_count: usize = 0;
            while (i < text.len and text[i] != ' ' and text[i] != '\n') {
                const sentinel_len = inlineGlyphSentinelLen(text, i);
                if (sentinel_len > 0) { word_w += @floatFromInt(size_px); char_count += 1; i += sentinel_len; continue; }
                const ch = decodeUtf8(text[i..]);
                word_w += self.cpAdvance(ch.codepoint, size_px);
                char_count += 1;
                i += ch.len;
            }
            if (letter_spacing != 0 and char_count > 1) {
                word_w += letter_spacing * @as(f32, @floatFromInt(char_count - 1));
            }
            if (word_w > max_word_w) max_word_w = word_w;
        }

        return max_word_w;
    }

    // ── Truncation ────────────────────────────────────────────────────────

    /// Find the byte offset where text should be truncated to fit within
    /// max_width minus the width of "...". Returns text.len if it fits.
    fn findTruncationPoint(self: *TextEngine, text: []const u8, size_px: u16, max_width: f32, letter_spacing: f32) usize {
        const ellipsis = "...";
        const ellipsis_w = self.measureLineWidth(ellipsis, size_px, letter_spacing);
        const avail = max_width - ellipsis_w;
        if (avail <= 0) return 0;

        // Linear scan (UTF-8 aware) — accumulate width until overflow
        var pen: f32 = 0;
        var last_ok: usize = 0;
        var i: usize = 0;
        var char_count: usize = 0;
        while (i < text.len) {
            const sentinel_len = inlineGlyphSentinelLen(text, i);
            if (sentinel_len > 0) {
                var adv: f32 = @floatFromInt(size_px);
                if (char_count > 0) adv += letter_spacing;
                if (pen + adv > avail) break;
                pen += adv;
                i += sentinel_len;
                char_count += 1;
                last_ok = i;
                continue;
            }
            const ch = decodeUtf8(text[i..]);
            var adv: f32 = 0;
            if (self.rasterizeGlyph(ch.codepoint, size_px)) |g| {
                adv = @floatFromInt(g.advance);
            }
            if (char_count > 0) adv += letter_spacing;
            if (pen + adv > avail) break;
            pen += adv;
            i += ch.len;
            char_count += 1;
            last_ok = i;
        }
        return last_ok;
    }

    /// Draw a single line of text truncated with "..." if it exceeds max_width.
    pub fn drawTextTruncated(self: *TextEngine, text: []const u8, x: f32, y: f32, size_px: u16, max_width: f32, color: layout.Color, letter_spacing: f32) void {
        const full_w = self.measureLineWidth(text, size_px, letter_spacing);
        if (full_w <= max_width) {
            self.drawTextEx(text, x, y, size_px, color, letter_spacing);
            return;
        }

        const trunc = self.findTruncationPoint(text, size_px, max_width, letter_spacing);
        if (trunc == 0) {
            self.drawTextEx("...", x, y, size_px, color, letter_spacing);
            return;
        }

        self.drawTextEx(text[0..trunc], x, y, size_px, color, letter_spacing);
        const prefix_w = self.measureLineWidth(text[0..trunc], size_px, letter_spacing);
        self.drawTextEx("...", x + prefix_w, y, size_px, color, letter_spacing);
    }

    // ── Drawing ──────────────────────────────────────────────────────────

    /// Draw a single line of text at (x, y) with the given color and size.
    /// y is the top of the text bounding box (not baseline).
    pub fn drawText(self: *TextEngine, text: []const u8, x: f32, y: f32, size_px: u16, color: layout.Color) void {
        self.drawTextEx(text, x, y, size_px, color, 0);
    }

    /// Draw a single line of text with letter spacing.
    pub fn drawTextEx(self: *TextEngine, text: []const u8, x: f32, y: f32, size_px: u16, color: layout.Color, letter_spacing: f32) void {
        const lm = self.lineMetrics(size_px);

        var pen_x = x;
        const baseline_y = y + lm.ascent;

        var i: usize = 0;
        var char_count: usize = 0;
        while (i < text.len) {
            const sentinel_len = inlineGlyphSentinelLen(text, i);
            if (sentinel_len > 0) {
                pen_x += @floatFromInt(size_px);
                if (char_count > 0 or i + sentinel_len < text.len) pen_x += letter_spacing;
                i += sentinel_len;
                char_count += 1;
                continue;
            }
            const ch = decodeUtf8(text[i..]);
            if (self.rasterizeGlyph(ch.codepoint, size_px)) |g| {
                if (g.texture) |tex| {
                    if (g.is_color) {
                        // Color emoji — render as-is, don't tint
                        _ = c.SDL_SetTextureColorMod(tex, 255, 255, 255);
                        _ = c.SDL_SetTextureAlphaMod(tex, 255);
                    } else {
                        // Monochrome glyph — tint with text color
                        _ = c.SDL_SetTextureColorMod(tex, color.r, color.g, color.b);
                        _ = c.SDL_SetTextureAlphaMod(tex, color.a);
                    }

                    // Scale bitmap strike glyphs (e.g. 128px emoji → 24px)
                    const dw: i32 = if (g.scale < 1.0)
                        @intFromFloat(@as(f32, @floatFromInt(g.width)) * g.scale)
                    else
                        g.width;
                    const dh: i32 = if (g.scale < 1.0)
                        @intFromFloat(@as(f32, @floatFromInt(g.height)) * g.scale)
                    else
                        g.height;
                    const dbx: f32 = @as(f32, @floatFromInt(g.bearing_x)) * g.scale;
                    const dby: f32 = @as(f32, @floatFromInt(g.bearing_y)) * g.scale;

                    var dst = c.SDL_FRect{
                        .x = pen_x + dbx,
                        .y = baseline_y - dby,
                        .w = @floatFromInt(dw),
                        .h = @floatFromInt(dh),
                    };
                    if (self.renderer) |r| _ = c.SDL_RenderTexture(r, tex, null, &dst);
                }
                pen_x += @floatFromInt(g.advance);
            }
            if (char_count > 0 or i + ch.len < text.len) pen_x += letter_spacing;
            i += ch.len;
            char_count += 1;
        }
    }

    /// Draw text with word wrapping within max_width.
    /// If max_width <= 0, falls back to single-line drawText.
    pub fn drawTextWrapped(self: *TextEngine, text: []const u8, x: f32, y: f32, size_px: u16, max_width: f32, color: layout.Color) void {
        self.drawTextWrappedAligned(text, x, y, size_px, max_width, color, .left);
    }

    /// Draw text with word wrapping, alignment, letter spacing, line height, and line limit.
    pub fn drawTextWrappedFull(self: *TextEngine, text: []const u8, x: f32, y: f32, size_px: u16, max_width: f32, color: layout.Color, text_align: layout.TextAlign, letter_spacing: f32, line_height_override: f32, max_lines: u16) void {
        if (max_width <= 0) {
            self.drawTextEx(text, x, y, size_px, color, letter_spacing);
            return;
        }

        const lm = self.lineMetrics(size_px);
        const effective_lh: f32 = if (line_height_override > 0) line_height_override else lm.height;

        // Adjust wrap width for letter spacing
        var wrap_width = max_width;
        if (letter_spacing > 0) {
            const avg_adv = self.cpAdvance('M', size_px);
            if (avg_adv > 0) {
                const ratio = avg_adv / (avg_adv + letter_spacing);
                wrap_width = max_width * ratio;
            }
        }

        const wrap = self.wordWrap(text, size_px, wrap_width);
        const total_lines = wrap.count;
        var line_count = total_lines;
        const is_truncated = (max_lines > 0 and line_count > max_lines);
        if (is_truncated) {
            line_count = max_lines;
        }

        for (0..line_count) |li| {
            const line = text[wrap.line_starts[li]..wrap.line_ends[li]];
            const line_y = y + effective_lh * @as(f32, @floatFromInt(li));
            const is_last_truncated = is_truncated and li + 1 == line_count;

            var line_x = x;
            if (text_align != .left and !is_last_truncated) {
                const line_w = self.measureLineWidth(line, size_px, letter_spacing);
                if (text_align == .center) {
                    line_x = x + (max_width - line_w) / 2.0;
                } else {
                    line_x = x + max_width - line_w;
                }
            }

            if (is_last_truncated) {
                // Truncate last visible line with "..."
                self.drawTextTruncated(line, line_x, line_y, size_px, max_width, color, letter_spacing);
            } else {
                self.drawTextEx(line, line_x, line_y, size_px, color, letter_spacing);
            }
        }
    }

    /// Draw text with word wrapping and alignment within max_width.
    pub fn drawTextWrappedAligned(self: *TextEngine, text: []const u8, x: f32, y: f32, size_px: u16, max_width: f32, color: layout.Color, text_align: layout.TextAlign) void {
        if (max_width <= 0) {
            self.drawText(text, x, y, size_px, color);
            return;
        }

        const lm = self.lineMetrics(size_px);
        const wrap = self.wordWrap(text, size_px, max_width);

        for (0..wrap.count) |li| {
            const line = text[wrap.line_starts[li]..wrap.line_ends[li]];
            const line_y = y + lm.height * @as(f32, @floatFromInt(li));

            // Compute line x offset for alignment
            var line_x = x;
            if (text_align != .left) {
                var line_w: f32 = 0;
                var j: usize = 0;
                while (j < line.len) {
                    const ch = decodeUtf8(line[j..]);
                    line_w += self.cpAdvance(ch.codepoint, size_px);
                    j += ch.len;
                }
                if (text_align == .center) {
                    line_x = x + (max_width - line_w) / 2.0;
                } else { // .right
                    line_x = x + max_width - line_w;
                }
            }

            self.drawText(line, line_x, line_y, size_px, color);
        }
    }

    // ── Multi-Color Span Rendering ─────────────────────────────────────

    /// Render a sequence of colored text spans on a single line.
    /// Each span picks up where the previous one left off (x advances).
    pub fn drawColorSpans(self: *TextEngine, spans: []const ColorSpan, x: f32, y: f32, size_px: u16) void {
        var cx = x;
        for (spans) |span| {
            self.drawText(span.text, cx, y, size_px, span.color);
            cx += self.measureLineWidth(span.text, size_px, 0);
        }
    }

    // ── Text Selection ──────────────────────────────────────────────────

    /// Map a local (x, y) coordinate (relative to text origin) to a byte
    /// index in the text. Accounts for word wrapping, UTF-8, and alignment.
    /// Returns the byte index closest to the click position.
    pub fn hitTestWrapped(self: *TextEngine, text: []const u8, local_x: f32, local_y: f32, size_px: u16, max_width: f32) usize {
        return self.hitTestWrappedAligned(text, local_x, local_y, size_px, max_width, .left);
    }

    pub fn hitTestWrappedAligned(self: *TextEngine, text: []const u8, local_x: f32, local_y: f32, size_px: u16, max_width: f32, text_align: layout.TextAlign) usize {
        if (text.len == 0) return 0;

        const lm = self.lineMetrics(size_px);
        const wrap = if (max_width > 0)
            self.wordWrap(text, size_px, max_width)
        else blk: {
            var w = WrapResult{};
            w.addLine(0, text.len);
            break :blk w;
        };

        // Determine which wrapped line was clicked
        var line_idx: usize = 0;
        if (lm.height > 0) {
            const li = @as(usize, @intFromFloat(@max(0, local_y) / lm.height));
            line_idx = @min(li, if (wrap.count > 0) wrap.count - 1 else 0);
        }

        // Hit test within that line
        const line_start = wrap.line_starts[line_idx];
        const line_end = wrap.line_ends[line_idx];
        const line = text[line_start..line_end];

        // Compute alignment offset for this line
        var align_offset: f32 = 0;
        if (text_align != .left and max_width > 0) {
            var line_w: f32 = 0;
            var lj: usize = 0;
            while (lj < line.len) {
                const lch = decodeUtf8(line[lj..]);
                line_w += self.cpAdvance(lch.codepoint, size_px);
                lj += lch.len;
            }
            if (text_align == .center) {
                align_offset = (max_width - line_w) / 2.0;
            } else {
                align_offset = max_width - line_w;
            }
        }

        // Adjust click x by alignment offset
        const adjusted_x = local_x - align_offset;

        var pen_x: f32 = 0;
        var i: usize = 0;
        var last_byte: usize = 0;

        while (i < line.len) {
            const ch = decodeUtf8(line[i..]);
            const adv = self.cpAdvance(ch.codepoint, size_px);

            // If click is before the midpoint of this char, select before it
            if (pen_x + adv / 2.0 > adjusted_x) {
                return line_start + last_byte;
            }

            pen_x += adv;
            last_byte = i;
            i += ch.len;
        }

        // Past end of line — return end
        return line_end;
    }

    /// Get the x offset of a byte index within the text, on its wrapped line.
    /// Returns {x_offset, line_y} relative to text origin.
    pub fn byteToPos(self: *TextEngine, text: []const u8, byte_idx: usize, size_px: u16, max_width: f32) struct { x: f32, y: f32 } {
        if (text.len == 0) return .{ .x = 0, .y = 0 };

        const lm = self.lineMetrics(size_px);
        const wrap = if (max_width > 0)
            self.wordWrap(text, size_px, max_width)
        else blk: {
            var w = WrapResult{};
            w.addLine(0, text.len);
            break :blk w;
        };

        // Find which line contains this byte index
        var line_idx: usize = 0;
        for (0..wrap.count) |li| {
            if (byte_idx >= wrap.line_starts[li] and byte_idx <= wrap.line_ends[li]) {
                line_idx = li;
                break;
            }
            // If past this line, keep going
            if (li + 1 < wrap.count and byte_idx >= wrap.line_starts[li + 1]) {
                continue;
            }
            line_idx = li;
            break;
        }

        // Measure x within the line up to byte_idx
        const line_start = wrap.line_starts[line_idx];
        const target = if (byte_idx > line_start) byte_idx - line_start else 0;
        const line = text[line_start..wrap.line_ends[line_idx]];

        var pen_x: f32 = 0;
        var i: usize = 0;
        while (i < line.len and i < target) {
            const ch = decodeUtf8(line[i..]);
            pen_x += self.cpAdvance(ch.codepoint, size_px);
            i += ch.len;
        }

        return .{
            .x = pen_x,
            .y = lm.height * @as(f32, @floatFromInt(line_idx)),
        };
    }

    /// Draw selection highlight rectangles for the given byte range.
    /// Handles multi-line selections across wrapped text and alignment.
    pub fn drawSelectionRects(self: *TextEngine, text: []const u8, x: f32, y: f32, size_px: u16, max_width: f32, sel_start: usize, sel_end: usize, highlight_color: layout.Color) void {
        self.drawSelectionRectsAligned(text, x, y, size_px, max_width, sel_start, sel_end, highlight_color, .left);
    }

    /// Draw selection highlight rectangles with text alignment support.
    pub fn drawSelectionRectsAligned(self: *TextEngine, text: []const u8, x: f32, y: f32, size_px: u16, max_width: f32, sel_start: usize, sel_end: usize, highlight_color: layout.Color, text_align: layout.TextAlign) void {
        if (sel_start == sel_end or text.len == 0) return;

        const s0 = @min(sel_start, sel_end);
        const s1 = @max(sel_start, sel_end);

        const lm = self.lineMetrics(size_px);
        const wrap = if (max_width > 0)
            self.wordWrap(text, size_px, max_width)
        else blk: {
            var w = WrapResult{};
            w.addLine(0, text.len);
            break :blk w;
        };

        const r = self.renderer orelse return;
        _ = c.SDL_SetRenderDrawBlendMode(r, c.SDL_BLENDMODE_BLEND);
        _ = c.SDL_SetRenderDrawColor(r, highlight_color.r, highlight_color.g, highlight_color.b, highlight_color.a);

        for (0..wrap.count) |li| {
            const ls = wrap.line_starts[li];
            const le = wrap.line_ends[li];

            // Skip lines outside selection range
            if (le <= s0 or ls >= s1) continue;

            // Clamp selection to this line
            const sel_line_start = if (s0 > ls) s0 - ls else 0;
            const sel_line_end = if (s1 < le) s1 - ls else le - ls;

            const line = text[ls..le];
            const line_y = y + lm.height * @as(f32, @floatFromInt(li));

            // Compute alignment offset for this line (same logic as drawTextWrappedAligned)
            var align_offset: f32 = 0;
            if (text_align != .left and max_width > 0) {
                var line_w: f32 = 0;
                var lj: usize = 0;
                while (lj < line.len) {
                    const lch = decodeUtf8(line[lj..]);
                    line_w += self.cpAdvance(lch.codepoint, size_px);
                    lj += lch.len;
                }
                if (text_align == .center) {
                    align_offset = (max_width - line_w) / 2.0;
                } else { // .right
                    align_offset = max_width - line_w;
                }
            }

            // Measure x at sel start and sel end within the line
            var x0: f32 = 0;
            var x1: f32 = 0;
            var pen: f32 = 0;
            var bi: usize = 0;
            while (bi < line.len) {
                if (bi == sel_line_start) x0 = pen;
                const ch = decodeUtf8(line[bi..]);
                pen += self.cpAdvance(ch.codepoint, size_px);
                bi += ch.len;
                if (bi == sel_line_end) {
                    x1 = pen;
                    break;
                }
            }
            // If sel_line_end is at line end
            if (sel_line_end >= line.len) x1 = pen;
            if (sel_line_start == 0 and x0 == 0 and sel_line_end == 0) continue;

            var rect = c.SDL_FRect{
                .x = x + align_offset + x0,
                .y = line_y,
                .w = x1 - x0,
                .h = lm.height,
            };
            if (self.renderer) |rr| _ = c.SDL_RenderFillRect(rr, &rect);
        }
    }

    /// Find word boundaries around a byte index. Words are runs of non-space chars.
    /// Returns {start, end} byte indices.
    pub fn wordBoundsAt(text: []const u8, byte_idx: usize) struct { start: usize, end: usize } {
        if (text.len == 0) return .{ .start = 0, .end = 0 };
        const idx = @min(byte_idx, text.len -| 1);

        // Scan backward to word start
        var start: usize = idx;
        while (start > 0 and text[start] != ' ' and text[start] != '\n') {
            // Don't split UTF-8 sequences — only break at ASCII boundaries
            if (text[start] >= 0x80 and start > 0 and text[start - 1] >= 0x80) {
                start -= 1;
            } else if (text[start] != ' ' and text[start] != '\n') {
                start -= 1;
            } else {
                break;
            }
        }
        if (start < text.len and (text[start] == ' ' or text[start] == '\n')) start += 1;

        // Scan forward to word end
        var end: usize = idx;
        while (end < text.len and text[end] != ' ' and text[end] != '\n') {
            end += 1;
        }

        return .{ .start = start, .end = end };
    }
};
