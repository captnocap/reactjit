//! Text rendering pipeline — FreeType glyph atlas + instanced textured quads.
//!
//! Owns the GlyphInstance struct, atlas texture, glyph cache, FreeType
//! handles, CPU-side glyph batch, GPU buffer, pipeline, and bind group.

const std = @import("std");
const wgpu = @import("wgpu");
const c = @import("../c.zig").imports;
const shaders = @import("shaders.zig");
const core = @import("gpu.zig");
const rects = @import("rects.zig");

// ════════════════════════════════════════════════════════════════════════
// Types
// ════════════════════════════════════════════════════════════════════════

/// Per-instance glyph data — matches the text WGSL struct layout.
pub const GlyphInstance = extern struct {
    pos_x: f32,
    pos_y: f32,
    size_w: f32,
    size_h: f32,
    uv_x: f32,
    uv_y: f32,
    uv_w: f32,
    uv_h: f32,
    color_r: f32,
    color_g: f32,
    color_b: f32,
    color_a: f32,
};

// ════════════════════════════════════════════════════════════════════════
// Constants
// ════════════════════════════════════════════════════════════════════════

pub const MAX_GLYPHS = 32768;
const ATLAS_SIZE = 2048;
const MAX_ATLAS_GLYPHS = 2048;

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

// ════════════════════════════════════════════════════════════════════════
// Atlas cache types
// ════════════════════════════════════════════════════════════════════════

const AtlasGlyphKey = struct {
    codepoint: u32,
    size_px: u16,
};

const AtlasGlyphInfo = struct {
    uv_x: f32,
    uv_y: f32,
    uv_w: f32,
    uv_h: f32,
    bearing_x: i32,
    bearing_y: i32,
    advance: i32,
    width: i32,
    height: i32,
};

// ════════════════════════════════════════════════════════════════════════
// State
// ════════════════════════════════════════════════════════════════════════

// GPU resources
var g_text_pipeline: ?*wgpu.RenderPipeline = null;
var g_text_buffer: ?*wgpu.Buffer = null;
var g_text_bind_group: ?*wgpu.BindGroup = null;
var g_text_bind_group_layout: ?*wgpu.BindGroupLayout = null;
var g_atlas_texture: ?*wgpu.Texture = null;
var g_atlas_view: ?*wgpu.TextureView = null;
var g_atlas_sampler: ?*wgpu.Sampler = null;

// CPU-side glyph batch
var g_glyphs: [MAX_GLYPHS]GlyphInstance = undefined;
var g_glyph_count: usize = 0;
var g_last_glyph_count: usize = 0;

// Inline glyph slot recording — filled by drawTextWrapped/drawTextLine,
// read by engine.paintNode to render polygons into text slots.
const node_layout = @import("../layout.zig");
pub const MAX_RECORDED_SLOTS = node_layout.MAX_INLINE_SLOTS;
pub var g_inline_slots: [MAX_RECORDED_SLOTS]node_layout.InlineSlot = [_]node_layout.InlineSlot{.{}} ** MAX_RECORDED_SLOTS;
pub var g_inline_slot_count: u8 = 0;

pub fn resetInlineSlots() void {
    g_inline_slot_count = 0;
}

// Active text effect — when set, glyph colors are sampled from effect pixel buffer
var g_text_effect_pixels: ?[*]const u8 = null;
var g_text_effect_w: u32 = 0;
var g_text_effect_h: u32 = 0;
var g_text_effect_sx: f32 = 0; // screen-space origin of effect texture
var g_text_effect_sy: f32 = 0;

pub fn setTextEffect(pixels: ?[*]const u8, w: u32, h: u32, sx: f32, sy: f32) void {
    g_text_effect_pixels = pixels;
    g_text_effect_w = w;
    g_text_effect_h = h;
    g_text_effect_sx = sx;
    g_text_effect_sy = sy;
}

pub fn clearTextEffect() void {
    g_text_effect_pixels = null;
}

/// Sample RGB from the active text effect at a screen position.
/// Uses screen position modulo effect size to tile the effect across text.
fn sampleTextEffect(screen_x: f32, screen_y: f32) ?[3]f32 {
    const pixels = g_text_effect_pixels orelse return null;
    const w = g_text_effect_w;
    const h = g_text_effect_h;
    if (w == 0 or h == 0) return null;
    const wf = @as(f32, @floatFromInt(w));
    const hf = @as(f32, @floatFromInt(h));
    // Tile: use screen position modulo effect texture size
    var ux = @mod(screen_x, wf);
    var vy = @mod(screen_y, hf);
    if (ux < 0) ux += wf;
    if (vy < 0) vy += hf;
    const ui: u32 = @min(@as(u32, @intFromFloat(ux)), w - 1);
    const vi: u32 = @min(@as(u32, @intFromFloat(vy)), h - 1);
    const idx = (vi * w + ui) * 4;
    return .{
        @as(f32, @floatFromInt(pixels[idx])) / 255.0,
        @as(f32, @floatFromInt(pixels[idx + 1])) / 255.0,
        @as(f32, @floatFromInt(pixels[idx + 2])) / 255.0,
    };
}

// Atlas packer state
var g_atlas_row_x: u32 = 0;
var g_atlas_row_y: u32 = 0;
var g_atlas_row_h: u32 = 0;

// Atlas glyph cache
var g_atlas_keys: [MAX_ATLAS_GLYPHS]AtlasGlyphKey = undefined;
var g_atlas_vals: [MAX_ATLAS_GLYPHS]AtlasGlyphInfo = undefined;
var g_atlas_count: usize = 0;

// FreeType handles
var g_ft_library: c.FT_Library = null;
var g_ft_face: c.FT_Face = null;
var g_ft_fallbacks: [8]c.FT_Face = undefined;
var g_ft_fallback_count: usize = 0;
var g_ft_current_size: u16 = 0;

// ════════════════════════════════════════════════════════════════════════
// Public API
// ════════════════════════════════════════════════════════════════════════

/// Initialize text rendering. Call after gpu.init() and after TextEngine is created.
pub fn initText(library: c.FT_Library, face: c.FT_Face, fallbacks: anytype, fallback_count: usize) void {
    g_ft_library = library;
    g_ft_face = face;
    g_ft_fallback_count = @min(fallback_count, 8);
    for (0..g_ft_fallback_count) |i| {
        g_ft_fallbacks[i] = fallbacks[i];
    }
    g_ft_current_size = 0;

    const device = core.getDevice() orelse return;

    // Create atlas texture (RGBA8, 2048x2048)
    g_atlas_texture = device.createTexture(&.{
        .label = wgpu.StringView.fromSlice("glyph_atlas"),
        .size = .{ .width = ATLAS_SIZE, .height = ATLAS_SIZE, .depth_or_array_layers = 1 },
        .mip_level_count = 1,
        .sample_count = 1,
        .dimension = .@"2d",
        .format = .rgba8_unorm,
        .usage = wgpu.TextureUsages.texture_binding | wgpu.TextureUsages.copy_dst,
    });

    if (g_atlas_texture) |tex| {
        g_atlas_view = tex.createView(null);
    }

    g_atlas_sampler = device.createSampler(&.{
        .address_mode_u = .clamp_to_edge,
        .address_mode_v = .clamp_to_edge,
        .mag_filter = .linear,
        .min_filter = .linear,
    });

    // Create text instance buffer
    g_text_buffer = device.createBuffer(&.{
        .label = wgpu.StringView.fromSlice("glyph_instances"),
        .size = MAX_GLYPHS * @sizeOf(GlyphInstance),
        .usage = wgpu.BufferUsages.vertex | wgpu.BufferUsages.copy_dst,
        .mapped_at_creation = 0,
    });

    initPipeline(device);
}

/// Draw a single line of text at (x, y) with the given font size and color.
pub fn drawTextLine(text: []const u8, x: f32, y: f32, size_px: u16, cr: f32, cg: f32, cb: f32, ca: f32) void {
    if (g_ft_face == null or core.g_gpu_ops >= core.GPU_OPS_BUDGET) return;
    core.g_gpu_ops += 1;

    const transform = core.getTransform();
    const s = transform.scale;
    const has_transform = transform.active;

    // When canvas transform is active, rasterize at scaled size for crisp text.
    const render_size: u16 = if (has_transform)
        @intFromFloat(@max(4, @min(200, @round(@as(f32, @floatFromInt(size_px)) * s))))
    else
        size_px;

    if (g_ft_current_size != render_size) {
        _ = c.FT_Set_Pixel_Sizes(g_ft_face, 0, render_size);
        g_ft_current_size = render_size;
    }

    const face = g_ft_face;
    const ascent: f32 = @as(f32, @floatFromInt(face.*.size.*.metrics.ascender)) / 64.0;

    // Pen position: transform the starting point, then advance in screen space.
    // Round to integer pixels so glyph quads align to texel boundaries —
    // fractional canvas translation (e.g. 0.5px from odd-dimension center)
    // causes linear atlas sampling to blend edge rows with transparent
    // background, visually clipping the top/bottom 1px of text.
    var pen_x: f32 = if (has_transform) @round((x - transform.ox) * s + transform.ox + transform.tx) else x;
    const start_y: f32 = if (has_transform) @round((y - transform.oy) * s + transform.oy + transform.ty) else y;
    const baseline_y = start_y + ascent;

    var i: usize = 0;
    while (i < text.len) {
        // Inline glyph sentinel — record slot position, advance by fontSize
        const sentinel_len = inlineGlyphSentinelLen(text, i);
        if (sentinel_len > 0) {
            if (g_inline_slot_count < MAX_RECORDED_SLOTS) {
                const slot_size: f32 = @floatFromInt(size_px);
                g_inline_slots[g_inline_slot_count] = .{
                    .x = pen_x, .y = start_y, .size = slot_size,
                    .glyph_index = g_inline_slot_count,
                };
                g_inline_slot_count += 1;
            }
            pen_x += @floatFromInt(size_px);
            i += sentinel_len;
            continue;
        }
        const ch = decodeUtf8(text[i..]);
        if (ch.codepoint == '\n') {
            i += ch.len;
            continue;
        }

        if (cacheGlyph(ch.codepoint, render_size)) |glyph| {
            if (glyph.width > 0 and glyph.height > 0) {
                if (g_glyph_count < MAX_GLYPHS) {
                    const gx = pen_x + @as(f32, @floatFromInt(glyph.bearing_x));
                    const gy = baseline_y - @as(f32, @floatFromInt(glyph.bearing_y));
                    // Sample effect color at glyph center if text effect is active
                    const ecol = sampleTextEffect(gx + @as(f32, @floatFromInt(glyph.width)) / 2, gy + @as(f32, @floatFromInt(glyph.height)) / 2);
                    g_glyphs[g_glyph_count] = .{
                        .pos_x = gx,
                        .pos_y = gy,
                        .size_w = @floatFromInt(glyph.width),
                        .size_h = @floatFromInt(glyph.height),
                        .uv_x = glyph.uv_x,
                        .uv_y = glyph.uv_y,
                        .uv_w = glyph.uv_w,
                        .uv_h = glyph.uv_h,
                        .color_r = if (ecol) |e| e[0] else cr,
                        .color_g = if (ecol) |e| e[1] else cg,
                        .color_b = if (ecol) |e| e[2] else cb,
                        .color_a = ca,
                    };
                    g_glyph_count += 1;
                }
            }
            pen_x += @floatFromInt(glyph.advance);
        }
        i += ch.len;
    }
}

/// Draw text with word-wrapping at max_width. Returns total height drawn.
pub fn drawTextWrapped(text: []const u8, x: f32, y: f32, size_px: u16, max_width: f32, cr: f32, cg: f32, cb: f32, ca: f32, max_lines: u16) f32 {
    if (g_ft_face == null or core.g_gpu_ops >= core.GPU_OPS_BUDGET) return 0;
    core.g_gpu_ops += 1;
    if (max_width <= 0) {
        drawTextLine(text, x, y, size_px, cr, cg, cb, ca);
        return @as(f32, @floatFromInt(size_px));
    }

    if (g_ft_current_size != size_px) {
        _ = c.FT_Set_Pixel_Sizes(g_ft_face, 0, size_px);
        g_ft_current_size = size_px;
    }

    const face = g_ft_face;
    const line_h: f32 = @as(f32, @floatFromInt(face.*.size.*.metrics.height)) / 64.0;

    var pen_x: f32 = 0;
    var pen_y: f32 = y;
    var line_start: usize = 0;
    var last_break: usize = 0;
    var last_break_pen_x: f32 = 0;
    var i: usize = 0;
    var lines_drawn: u16 = 0;

    while (i < text.len) {
        if (max_lines > 0 and lines_drawn >= max_lines) break;
        // Inline glyph sentinel — treat as non-wrappable char with fontSize advance
        const sentinel_len = inlineGlyphSentinelLen(text, i);
        if (sentinel_len > 0) {
            const advance: f32 = @floatFromInt(size_px);
            if (pen_x + advance > max_width and pen_x > 0) {
                if (last_break > line_start) {
                    drawTextLine(text[line_start..last_break], x, pen_y, size_px, cr, cg, cb, ca);
                    lines_drawn += 1;
                    pen_y += line_h;
                    line_start = last_break + 1;
                    pen_x = 0;
                    var j: usize = line_start;
                    while (j < i) {
                        const j_sentinel_len = inlineGlyphSentinelLen(text, j);
                        if (j_sentinel_len > 0) { pen_x += @floatFromInt(size_px); j += j_sentinel_len; continue; }
                        const jch = decodeUtf8(text[j..]);
                        if (cacheGlyph(jch.codepoint, size_px)) |g| pen_x += @floatFromInt(g.advance);
                        j += jch.len;
                    }
                    last_break = line_start;
                    last_break_pen_x = 0;
                }
            }
            pen_x += advance;
            i += sentinel_len;
            continue;
        }
        const ch = decodeUtf8(text[i..]);

        // Explicit newline
        if (ch.codepoint == '\n') {
            drawTextLine(text[line_start..i], x, pen_y, size_px, cr, cg, cb, ca);
            lines_drawn += 1;
            pen_y += line_h;
            i += ch.len;
            line_start = i;
            last_break = i;
            pen_x = 0;
            last_break_pen_x = 0;
            continue;
        }

        // Track word boundaries
        if (ch.codepoint == ' ') {
            last_break = i;
            last_break_pen_x = pen_x;
        }

        // Measure this glyph
        var advance: f32 = 0;
        if (cacheGlyph(ch.codepoint, size_px)) |glyph| {
            advance = @floatFromInt(glyph.advance);
        }

        if (pen_x + advance > max_width and pen_x > 0) {
            // Wrap at last word boundary if possible
            if (last_break > line_start) {
                drawTextLine(text[line_start..last_break], x, pen_y, size_px, cr, cg, cb, ca);
                lines_drawn += 1;
                pen_y += line_h;
                // Skip the space
                line_start = last_break + 1;
                pen_x = pen_x - last_break_pen_x - advance;
                // Re-measure from line_start to current position
                pen_x = 0;
                var j: usize = line_start;
                while (j < i) {
                    const j_sentinel_len = inlineGlyphSentinelLen(text, j);
                    if (j_sentinel_len > 0) { pen_x += @floatFromInt(size_px); j += j_sentinel_len; continue; }
                    const jch = decodeUtf8(text[j..]);
                    if (cacheGlyph(jch.codepoint, size_px)) |g| pen_x += @floatFromInt(g.advance);
                    j += jch.len;
                }
                last_break = line_start;
                last_break_pen_x = 0;
            } else {
                // No break point — force break at current position
                drawTextLine(text[line_start..i], x, pen_y, size_px, cr, cg, cb, ca);
                lines_drawn += 1;
                pen_y += line_h;
                line_start = i;
                last_break = i;
                pen_x = 0;
                last_break_pen_x = 0;
            }
        }

        pen_x += advance;
        i += ch.len;
    }

    // Draw remaining text (if not truncated)
    if (line_start < text.len and (max_lines == 0 or lines_drawn < max_lines)) {
        drawTextLine(text[line_start..], x, pen_y, size_px, cr, cg, cb, ca);
        pen_y += line_h;
    }

    return pen_y - y;
}

/// Draw selection highlight rectangles for a byte range within wrapped text.
pub fn drawSelectionRects(text: []const u8, x: f32, y: f32, size_px: u16, max_width: f32, sel_start: usize, sel_end: usize) void {
    if (g_ft_face == null or sel_start >= sel_end) return;

    if (g_ft_current_size != size_px) {
        _ = c.FT_Set_Pixel_Sizes(g_ft_face, 0, size_px);
        g_ft_current_size = size_px;
    }

    const face = g_ft_face;
    const line_h: f32 = @as(f32, @floatFromInt(face.*.size.*.metrics.height)) / 64.0;

    var pen_x: f32 = 0;
    var line_start: usize = 0;
    var last_break: usize = 0;
    var last_break_pen_x: f32 = 0;

    // Selection highlight color: blue with alpha
    const sel_r: f32 = 0.2;
    const sel_g: f32 = 0.4;
    const sel_b: f32 = 0.8;
    const sel_a: f32 = 0.4;

    var cur_line_y: f32 = y;
    var cur_x: f32 = 0;
    var sel_line_start_x: f32 = -1;
    var in_selection: bool = false;
    var i: usize = 0;
    line_start = 0;
    pen_x = 0;

    while (i < text.len) {
        const ch = decodeUtf8(text[i..]);

        if (ch.codepoint == '\n') {
            // End of line — flush selection rect if active
            if (in_selection and sel_line_start_x >= 0) {
                rects.drawRect(x + sel_line_start_x, cur_line_y, cur_x - sel_line_start_x, line_h, sel_r, sel_g, sel_b, sel_a, 0, 0, 0, 0, 0, 0);
            }
            cur_line_y += line_h;
            i += ch.len;
            line_start = i;
            last_break = i;
            pen_x = 0;
            cur_x = 0;
            last_break_pen_x = 0;
            if (in_selection) sel_line_start_x = 0;
            continue;
        }

        if (ch.codepoint == ' ') {
            last_break = i;
            last_break_pen_x = pen_x;
        }

        var advance: f32 = 0;
        if (cacheGlyph(ch.codepoint, size_px)) |glyph| {
            advance = @floatFromInt(glyph.advance);
        }

        // Check for word wrap
        if (max_width > 0 and pen_x + advance > max_width and pen_x > 0) {
            // Flush selection rect for this line
            if (in_selection and sel_line_start_x >= 0) {
                rects.drawRect(x + sel_line_start_x, cur_line_y, cur_x - sel_line_start_x, line_h, sel_r, sel_g, sel_b, sel_a, 0, 0, 0, 0, 0, 0);
            }
            cur_line_y += line_h;

            if (last_break > line_start) {
                // Re-measure from line_start to current
                pen_x = 0;
                var j: usize = last_break + 1;
                while (j < i) {
                    const jch = decodeUtf8(text[j..]);
                    if (cacheGlyph(jch.codepoint, size_px)) |g| {
                        pen_x += @floatFromInt(g.advance);
                    }
                    j += jch.len;
                }
                cur_x = pen_x;
                line_start = last_break + 1;
            } else {
                line_start = i;
                pen_x = 0;
                cur_x = 0;
            }
            last_break = line_start;
            last_break_pen_x = 0;
            if (in_selection) sel_line_start_x = 0;
        }

        cur_x = pen_x;

        // Check selection transitions
        if (!in_selection and i >= sel_start and i < sel_end) {
            in_selection = true;
            sel_line_start_x = cur_x;
        }
        if (in_selection and i >= sel_end) {
            // End selection
            rects.drawRect(x + sel_line_start_x, cur_line_y, cur_x - sel_line_start_x, line_h, sel_r, sel_g, sel_b, sel_a, 0, 0, 0, 0, 0, 0);
            in_selection = false;
        }

        pen_x += advance;
        cur_x = pen_x;
        i += ch.len;
    }

    // Flush final selection rect
    if (in_selection and sel_line_start_x >= 0) {
        rects.drawRect(x + sel_line_start_x, cur_line_y, cur_x - sel_line_start_x, line_h, sel_r, sel_g, sel_b, sel_a, 0, 0, 0, 0, 0, 0);
    }
}

/// Get the advance width of a character at a given font size.
pub fn getCharAdvance(codepoint: u32, size_px: u16) f32 {
    if (cacheGlyph(codepoint, size_px)) |glyph| {
        return @floatFromInt(glyph.advance);
    }
    return @floatFromInt(size_px / 2); // fallback
}

/// Get the line height (ascent + descent) for a given font size.
pub fn getLineHeight(size_px: u16) f32 {
    const face = g_ft_face orelse return @floatFromInt(size_px);
    if (g_ft_current_size != size_px) {
        _ = c.FT_Set_Pixel_Sizes(face, 0, size_px);
        g_ft_current_size = size_px;
    }
    // Use FreeType's metrics.height (ascent + descent + line gap) to match
    // TextEngine.lineMetrics(). The old formula (ascender - descender + 2.0)
    // diverged at certain zoom-scaled font sizes where the real line gap != 2px,
    // causing 1-2px descender clipping at specific canvas zoom levels.
    return @as(f32, @floatFromInt(face.*.size.*.metrics.height)) / 64.0;
}

/// Get the advance width of 'M' (monospace cell width) for a given font size.
pub fn getCharWidth(size_px: u16) f32 {
    const face = g_ft_face orelse return @as(f32, @floatFromInt(size_px)) * 0.6;
    if (g_ft_current_size != size_px) {
        _ = c.FT_Set_Pixel_Sizes(face, 0, size_px);
        g_ft_current_size = size_px;
    }
    // Load 'M' glyph to get its advance width
    if (c.FT_Load_Char(face, 'M', c.FT_LOAD_DEFAULT) == 0) {
        return @as(f32, @floatFromInt(face.*.glyph.*.advance.x)) / 64.0;
    }
    return @as(f32, @floatFromInt(size_px)) * 0.6; // fallback
}

/// Draw a single glyph at exact pixel position (for terminal cell-grid rendering).
/// Unlike drawTextLine, this does NOT use FreeType advance — the caller controls positioning.
pub fn drawGlyphAt(char_buf: []const u8, x: f32, y: f32, size_px: u16, cr: f32, cg: f32, cb: f32, ca: f32) void {
    if (g_ft_face == null) return;
    if (char_buf.len == 0) return;

    // Honor the active canvas transform the same way drawTextLine does — without
    // this, Terminal cells inside a Canvas.Node render at untransformed graph
    // coordinates and appear off-screen / at the wrong scale.
    const transform = core.getTransform();
    const s = transform.scale;
    const has_transform = transform.active;
    const render_size: u16 = if (has_transform)
        @intFromFloat(@max(4, @min(200, @round(@as(f32, @floatFromInt(size_px)) * s))))
    else
        size_px;

    if (g_ft_current_size != render_size) {
        _ = c.FT_Set_Pixel_Sizes(g_ft_face, 0, render_size);
        g_ft_current_size = render_size;
    }
    const face = g_ft_face;
    const ascent: f32 = @as(f32, @floatFromInt(face.*.size.*.metrics.ascender)) / 64.0;
    const ch = decodeUtf8(char_buf);

    const pen_x: f32 = if (has_transform) @round((x - transform.ox) * s + transform.ox + transform.tx) else x;
    const pen_y: f32 = if (has_transform) @round((y - transform.oy) * s + transform.oy + transform.ty) else y;

    if (cacheGlyph(ch.codepoint, render_size)) |glyph| {
        if (glyph.width > 0 and glyph.height > 0 and g_glyph_count < MAX_GLYPHS) {
            g_glyphs[g_glyph_count] = .{
                .pos_x = pen_x + @as(f32, @floatFromInt(glyph.bearing_x)),
                .pos_y = pen_y + ascent - @as(f32, @floatFromInt(glyph.bearing_y)),
                .size_w = @floatFromInt(glyph.width),
                .size_h = @floatFromInt(glyph.height),
                .uv_x = glyph.uv_x,
                .uv_y = glyph.uv_y,
                .uv_w = glyph.uv_w,
                .uv_h = glyph.uv_h,
                .color_r = cr,
                .color_g = cg,
                .color_b = cb,
                .color_a = ca,
            };
            g_glyph_count += 1;
        }
    }
}

/// Draw a batch of glyphs in the given instance range.
pub fn drawBatch(render_pass: *wgpu.RenderPassEncoder, start: u32, end: u32) void {
    if (end <= start) return;
    if (g_text_pipeline) |pipeline| {
        render_pass.setPipeline(pipeline);
        if (g_text_bind_group) |bg| render_pass.setBindGroup(0, bg, 0, null);
        if (g_text_buffer) |buf| {
            render_pass.setVertexBuffer(0, buf, 0, g_glyph_count * @sizeOf(GlyphInstance));
        }
        render_pass.draw(6, end - start, 0, start);
    }
}

/// Upload glyph instance data to the GPU.
pub fn upload(queue: *wgpu.Queue) void {
    if (g_glyph_count > 0) {
        if (g_text_buffer) |buf| {
            const byte_size = g_glyph_count * @sizeOf(GlyphInstance);
            queue.writeBuffer(buf, 0, @ptrCast(&g_glyphs), byte_size);
        }
    }
}

/// Recreate buffer + bind group to reclaim fragmented GPU memory.
pub fn drain(device: *wgpu.Device, globals_buffer: *wgpu.Buffer) void {
    if (g_text_bind_group) |bg| bg.release();
    if (g_text_buffer) |b| b.release();

    g_text_buffer = device.createBuffer(&.{
        .label = wgpu.StringView.fromSlice("glyph_instances"),
        .size = MAX_GLYPHS * @sizeOf(GlyphInstance),
        .usage = wgpu.BufferUsages.vertex | wgpu.BufferUsages.copy_dst,
        .mapped_at_creation = 0,
    });

    if (g_text_bind_group_layout) |layout| {
        const bind_entries = [_]wgpu.BindGroupEntry{
            .{ .binding = 0, .buffer = globals_buffer, .offset = 0, .size = 8 },
            .{ .binding = 1, .texture_view = g_atlas_view },
            .{ .binding = 2, .sampler = g_atlas_sampler },
        };
        g_text_bind_group = device.createBindGroup(&.{
            .layout = layout,
            .entry_count = bind_entries.len,
            .entries = &bind_entries,
        });
    }
}

/// Release all GPU resources.
pub fn deinit() void {
    if (g_text_bind_group) |bg| bg.release();
    if (g_text_bind_group_layout) |l| l.release();
    if (g_text_buffer) |b| b.release();
    if (g_text_pipeline) |p| p.release();
    if (g_atlas_sampler) |s| s.release();
    if (g_atlas_view) |v| v.release();
    if (g_atlas_texture) |t| t.destroy();
    g_text_bind_group = null;
    g_text_bind_group_layout = null;
    g_text_buffer = null;
    g_text_pipeline = null;
    g_atlas_sampler = null;
    g_atlas_view = null;
    g_atlas_texture = null;
}

/// Current number of queued glyphs.
pub fn count() usize {
    return g_glyph_count;
}

/// Last frame's glyph count (captured before reset).
pub fn lastCount() usize {
    return g_last_glyph_count;
}

/// Reset for next frame.
pub fn reset() void {
    g_last_glyph_count = g_glyph_count;
    g_glyph_count = 0;
}

/// Hash the current glyph instance data for dirty checking.
pub fn hashData() u64 {
    var h: u64 = @as(u64, g_glyph_count) *% 0x517cc1b727220a95;
    if (g_glyph_count > 0) {
        const len = g_glyph_count * @sizeOf(GlyphInstance);
        const bytes: [*]const u8 = @ptrCast(&g_glyphs);
        var i: usize = 0;
        while (i + 8 <= len) : (i += 8) {
            h ^= std.mem.readInt(u64, bytes[i..][0..8], .little);
            h = h *% 0x2127599bf4325c37 +% 0x880355f21e6d1965;
        }
    }
    return h;
}

/// Atlas stats for telemetry/diagnostics.
pub fn atlasCount() usize {
    return g_atlas_count;
}

pub fn atlasCapacity() usize {
    return MAX_ATLAS_GLYPHS;
}

pub fn atlasRowY() u32 {
    return g_atlas_row_y;
}

pub fn atlasSize() u32 {
    return ATLAS_SIZE;
}

// ════════════════════════════════════════════════════════════════════════
// Text pipeline setup
// ════════════════════════════════════════════════════════════════════════

fn initPipeline(device: *wgpu.Device) void {
    const shader_desc = wgpu.shaderModuleWGSLDescriptor(.{
        .label = "text_shader",
        .code = shaders.text_wgsl,
    });
    const shader_module = device.createShaderModule(&shader_desc) orelse {
        std.debug.print("Failed to create text shader module\n", .{});
        return;
    };
    defer shader_module.release();

    const atlas_view = g_atlas_view orelse return;
    const atlas_sampler = g_atlas_sampler orelse return;

    // Bind group layout: globals uniform + atlas texture + sampler
    const layout_entries = [_]wgpu.BindGroupLayoutEntry{
        .{ // binding 0: globals uniform
            .binding = 0,
            .visibility = wgpu.ShaderStages.vertex,
            .buffer = .{ .@"type" = .uniform, .has_dynamic_offset = 0, .min_binding_size = 8 },
        },
        .{ // binding 1: atlas texture
            .binding = 1,
            .visibility = wgpu.ShaderStages.fragment,
            .texture = .{
                .sample_type = .float,
                .view_dimension = .@"2d",
                .multisampled = 0,
            },
        },
        .{ // binding 2: sampler
            .binding = 2,
            .visibility = wgpu.ShaderStages.fragment,
            .sampler = .{ .@"type" = .filtering },
        },
    };

    const bind_group_layout = device.createBindGroupLayout(&.{
        .entry_count = layout_entries.len,
        .entries = &layout_entries,
    }) orelse return;
    g_text_bind_group_layout = bind_group_layout;

    // Bind group with actual resources
    const globals_buffer = core.getGlobalsBuffer() orelse return;
    const bind_entries = [_]wgpu.BindGroupEntry{
        .{ .binding = 0, .buffer = globals_buffer, .offset = 0, .size = 8 },
        .{ .binding = 1, .texture_view = atlas_view },
        .{ .binding = 2, .sampler = atlas_sampler },
    };

    g_text_bind_group = device.createBindGroup(&.{
        .layout = bind_group_layout,
        .entry_count = bind_entries.len,
        .entries = &bind_entries,
    });

    const pipeline_layout = device.createPipelineLayout(&.{
        .bind_group_layout_count = 1,
        .bind_group_layouts = @ptrCast(&bind_group_layout),
    }) orelse return;
    defer pipeline_layout.release();

    // Glyph instance vertex attributes
    const glyph_attrs = [_]wgpu.VertexAttribute{
        .{ .format = .float32x2, .offset = 0, .shader_location = 0 }, // pos
        .{ .format = .float32x2, .offset = 8, .shader_location = 1 }, // size
        .{ .format = .float32x2, .offset = 16, .shader_location = 2 }, // uv_pos
        .{ .format = .float32x2, .offset = 24, .shader_location = 3 }, // uv_size
        .{ .format = .float32x4, .offset = 32, .shader_location = 4 }, // color
    };

    const glyph_buffer_layout = wgpu.VertexBufferLayout{
        .step_mode = .instance,
        .array_stride = @sizeOf(GlyphInstance),
        .attribute_count = glyph_attrs.len,
        .attributes = &glyph_attrs,
    };

    const blend_state = wgpu.BlendState.premultiplied_alpha_blending;
    const color_target = wgpu.ColorTargetState{
        .format = core.getFormat(),
        .blend = &blend_state,
        .write_mask = wgpu.ColorWriteMasks.all,
    };

    const fragment_state = wgpu.FragmentState{
        .module = shader_module,
        .entry_point = wgpu.StringView.fromSlice("fs_main"),
        .target_count = 1,
        .targets = @ptrCast(&color_target),
    };

    g_text_pipeline = device.createRenderPipeline(&.{
        .layout = pipeline_layout,
        .vertex = .{
            .module = shader_module,
            .entry_point = wgpu.StringView.fromSlice("vs_main"),
            .buffer_count = 1,
            .buffers = @ptrCast(&glyph_buffer_layout),
        },
        .primitive = .{ .topology = .triangle_list },
        .multisample = .{},
        .fragment = &fragment_state,
    });

    if (g_text_pipeline == null) {
        std.debug.print("Failed to create text render pipeline\n", .{});
    }
}

// ════════════════════════════════════════════════════════════════════════
// Glyph atlas — FreeType rasterization -> wgpu texture
// ════════════════════════════════════════════════════════════════════════

fn cacheGlyph(codepoint: u32, size_px: u16) ?*const AtlasGlyphInfo {
    // Check cache
    for (0..g_atlas_count) |i| {
        if (g_atlas_keys[i].codepoint == codepoint and g_atlas_keys[i].size_px == size_px) {
            return &g_atlas_vals[i];
        }
    }
    if (g_atlas_count >= MAX_ATLAS_GLYPHS) return null;

    const face = g_ft_face orelse return null;

    // Set size
    if (g_ft_current_size != size_px) {
        _ = c.FT_Set_Pixel_Sizes(face, 0, size_px);
        g_ft_current_size = size_px;
    }

    // Load glyph — try primary face, then fallbacks
    var use_face = face;
    if (c.FT_Get_Char_Index(face, codepoint) == 0) {
        for (0..g_ft_fallback_count) |fi| {
            const fb = g_ft_fallbacks[fi];
            if (c.FT_Get_Char_Index(fb, codepoint) != 0) {
                _ = c.FT_Set_Pixel_Sizes(fb, 0, size_px);
                use_face = fb;
                break;
            }
        }
    }

    if (c.FT_Load_Char(use_face, codepoint, c.FT_LOAD_RENDER) != 0) {
        return null;
    }

    const glyph = use_face.*.glyph;
    const bitmap = glyph.*.bitmap;
    const bw: u32 = @intCast(bitmap.width);
    const bh: u32 = @intCast(bitmap.rows);

    // Pack into atlas (row-based)
    var atlas_x: u32 = 0;
    var atlas_y: u32 = 0;

    if (bw > 0 and bh > 0) {
        // Check if glyph fits in current row
        if (g_atlas_row_x + bw + 1 > ATLAS_SIZE) {
            // Start new row
            g_atlas_row_y += g_atlas_row_h + 1;
            g_atlas_row_x = 0;
            g_atlas_row_h = 0;
        }
        if (g_atlas_row_y + bh > ATLAS_SIZE) {
            // Atlas full
            return null;
        }

        atlas_x = g_atlas_row_x;
        atlas_y = g_atlas_row_y;
        g_atlas_row_x += bw + 1;
        if (bh > g_atlas_row_h) g_atlas_row_h = bh;

        // Upload glyph bitmap to atlas texture
        uploadGlyphToAtlas(bitmap, atlas_x, atlas_y, bw, bh);
    }

    const idx = g_atlas_count;
    g_atlas_keys[idx] = .{ .codepoint = codepoint, .size_px = size_px };
    g_atlas_vals[idx] = .{
        .uv_x = @as(f32, @floatFromInt(atlas_x)) / @as(f32, ATLAS_SIZE),
        .uv_y = @as(f32, @floatFromInt(atlas_y)) / @as(f32, ATLAS_SIZE),
        .uv_w = @as(f32, @floatFromInt(bw)) / @as(f32, ATLAS_SIZE),
        .uv_h = @as(f32, @floatFromInt(bh)) / @as(f32, ATLAS_SIZE),
        .bearing_x = glyph.*.bitmap_left,
        .bearing_y = glyph.*.bitmap_top,
        .advance = @intCast(glyph.*.advance.x >> 6),
        .width = @intCast(bw),
        .height = @intCast(bh),
    };
    g_atlas_count += 1;

    return &g_atlas_vals[idx];
}

fn uploadGlyphToAtlas(bitmap: anytype, atlas_x: u32, atlas_y: u32, bw: u32, bh: u32) void {
    const queue = core.getQueue() orelse return;
    const atlas = g_atlas_texture orelse return;

    // Convert grayscale bitmap to RGBA
    const pixel_count = bw * bh;
    if (pixel_count == 0) return;

    // Stack buffer for small glyphs, otherwise skip (most glyphs are small)
    var rgba_buf: [256 * 256 * 4]u8 = undefined;
    if (pixel_count * 4 > rgba_buf.len) return;

    const src_pitch: usize = @intCast(bitmap.pitch);
    for (0..bh) |row| {
        for (0..bw) |col| {
            const alpha = bitmap.buffer[row * src_pitch + col];
            const dst = (row * bw + col) * 4;
            rgba_buf[dst + 0] = 255; // R
            rgba_buf[dst + 1] = 255; // G
            rgba_buf[dst + 2] = 255; // B
            rgba_buf[dst + 3] = alpha; // A
        }
    }

    // Upload to atlas via queue.writeTexture
    queue.writeTexture(
        &.{
            .texture = atlas,
            .mip_level = 0,
            .origin = .{ .x = atlas_x, .y = atlas_y, .z = 0 },
            .aspect = .all,
        },
        @ptrCast(&rgba_buf),
        bw * bh * 4,
        &.{
            .offset = 0,
            .bytes_per_row = bw * 4,
            .rows_per_image = bh,
        },
        &.{ .width = bw, .height = bh, .depth_or_array_layers = 1 },
    );
}

// ════════════════════════════════════════════════════════════════════════
// UTF-8 decoding
// ════════════════════════════════════════════════════════════════════════

const Utf8Char = struct {
    codepoint: u32,
    len: u3,
};

fn decodeUtf8(bytes: []const u8) Utf8Char {
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
