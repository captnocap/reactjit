//! ReactJIT Engine — Phase 0+1+2
//!
//! One pixel. Then rectangles. Then a layout engine. Then letters.
//! Then the world.
//!
//! SDL2 + FreeType + flex layout. Text is measured by FreeType,
//! positioned by the layout engine, rendered by the painter.

const std = @import("std");
const c = @import("c.zig").imports;
const layout = @import("layout.zig");
const text_mod = @import("text.zig");
const events = @import("events.zig");
const image_mod = @import("image.zig");
const Node = layout.Node;
const Style = layout.Style;
const Color = layout.Color;
const LayoutRect = layout.LayoutRect;
const TextEngine = text_mod.TextEngine;
const ImageCache = image_mod.ImageCache;
const syntax = @import("syntax.zig");
const ColorSpan = text_mod.ColorSpan;
const gpu = @import("gpu.zig");

// ── Global text engine (set during init, used by layout measure callback) ───
var g_text_engine: ?*TextEngine = null;

// ── Global image cache (set during init, used by layout measure callback) ───
var g_image_cache: ?*ImageCache = null;

fn measureCallback(t: []const u8, font_size: u16, max_width: f32, letter_spacing: f32, line_height: f32, max_lines: u16, no_wrap: bool) layout.TextMetrics {
    if (g_text_engine) |te| {
        return te.measureTextWrappedEx(t, font_size, max_width, letter_spacing, line_height, max_lines, no_wrap);
    }
    return .{};
}

fn measureImageCallback(path: []const u8) layout.ImageDims {
    if (g_image_cache) |cache| {
        if (cache.load(path)) |img| {
            return .{
                .width = @floatFromInt(img.width),
                .height = @floatFromInt(img.height),
            };
        }
    }
    return .{};
}

// ── Painter ─────────────────────────────────────────────────────────────────

// ── Hover state (module-level so Painter can read it) ────────────────────
var hovered_node: ?*Node = null;

// ── Text selection state ─────────────────────────────────────────────────
var sel_node: ?*Node = null;
var sel_end_node: ?*Node = null;
var sel_start: usize = 0;
var sel_end: usize = 0;
var sel_anchor: usize = 0;
var sel_dragging: bool = false;
var sel_last_click: u32 = 0;
var sel_click_count: u32 = 0;
var sel_all: bool = false;
var sel_paint_state: u8 = 0;

// ── Rounded rect support ────────────────────────────────────────────────────
// Pre-rendered quarter-circle texture for fast rounded corner blitting.

const CIRCLE_TEX_SIZE = 32;
var g_circle_tex: ?*c.SDL_Texture = null;

fn initCircleTexture(renderer: *c.SDL_Renderer) void {
    const surface = c.SDL_CreateRGBSurfaceWithFormat(0, CIRCLE_TEX_SIZE, CIRCLE_TEX_SIZE, 32, c.SDL_PIXELFORMAT_ARGB8888);
    if (surface == null) return;
    defer c.SDL_FreeSurface(surface);

    const pixels: [*]u8 = @ptrCast(surface.*.pixels);
    const pitch: usize = @intCast(surface.*.pitch);
    const r: f32 = @as(f32, CIRCLE_TEX_SIZE) / 2.0;

    for (0..CIRCLE_TEX_SIZE) |row| {
        for (0..CIRCLE_TEX_SIZE) |col| {
            const dx = @as(f32, @floatFromInt(col)) + 0.5 - r;
            const dy = @as(f32, @floatFromInt(row)) + 0.5 - r;
            const dist = @sqrt(dx * dx + dy * dy);
            const alpha: u8 = if (dist <= r - 0.5) 255 else if (dist <= r + 0.5) @intFromFloat((r + 0.5 - dist) * 255.0) else 0;
            const off = row * pitch + col * 4;
            pixels[off + 0] = 255; // B
            pixels[off + 1] = 255; // G
            pixels[off + 2] = 255; // R
            pixels[off + 3] = alpha; // A
        }
    }

    const tex = c.SDL_CreateTextureFromSurface(renderer, surface);
    if (tex) |t| {
        _ = c.SDL_SetTextureBlendMode(t, c.SDL_BLENDMODE_BLEND);
        g_circle_tex = t;
    }
}

fn fillRoundedRect(renderer: *c.SDL_Renderer, ix: i32, iy: i32, iw: i32, ih: i32, radius_raw: f32, col: Color, opacity: u8) void {
    const tex = g_circle_tex orelse {
        // Fallback: plain rect
        _ = c.SDL_SetRenderDrawColor(renderer, col.r, col.g, col.b, opacity);
        var r = c.SDL_Rect{ .x = ix, .y = iy, .w = iw, .h = ih };
        _ = c.SDL_RenderFillRect(renderer, &r);
        return;
    };

    const radius = @min(radius_raw, @as(f32, @floatFromInt(@min(iw, ih))) / 2.0);
    const ri: i32 = @intFromFloat(radius);
    if (ri <= 0) {
        _ = c.SDL_SetRenderDrawColor(renderer, col.r, col.g, col.b, opacity);
        var r = c.SDL_Rect{ .x = ix, .y = iy, .w = iw, .h = ih };
        _ = c.SDL_RenderFillRect(renderer, &r);
        return;
    }

    _ = c.SDL_SetRenderDrawColor(renderer, col.r, col.g, col.b, opacity);
    _ = c.SDL_SetTextureColorMod(tex, col.r, col.g, col.b);
    _ = c.SDL_SetTextureAlphaMod(tex, opacity);

    // Center rect (full width, between top/bottom radius rows)
    var center = c.SDL_Rect{ .x = ix, .y = iy + ri, .w = iw, .h = ih - ri * 2 };
    _ = c.SDL_RenderFillRect(renderer, &center);

    // Top strip (between corners)
    var top_r = c.SDL_Rect{ .x = ix + ri, .y = iy, .w = iw - ri * 2, .h = ri };
    _ = c.SDL_RenderFillRect(renderer, &top_r);

    // Bottom strip
    var bot_r = c.SDL_Rect{ .x = ix + ri, .y = iy + ih - ri, .w = iw - ri * 2, .h = ri };
    _ = c.SDL_RenderFillRect(renderer, &bot_r);

    // Quarter circles at corners (using half of circle texture)
    const half = CIRCLE_TEX_SIZE / 2;
    // Top-left
    var tl_src = c.SDL_Rect{ .x = 0, .y = 0, .w = half, .h = half };
    var tl_dst = c.SDL_Rect{ .x = ix, .y = iy, .w = ri, .h = ri };
    _ = c.SDL_RenderCopy(renderer, tex, &tl_src, &tl_dst);
    // Top-right
    var tr_src = c.SDL_Rect{ .x = half, .y = 0, .w = half, .h = half };
    var tr_dst = c.SDL_Rect{ .x = ix + iw - ri, .y = iy, .w = ri, .h = ri };
    _ = c.SDL_RenderCopy(renderer, tex, &tr_src, &tr_dst);
    // Bottom-left
    var bl_src = c.SDL_Rect{ .x = 0, .y = half, .w = half, .h = half };
    var bl_dst = c.SDL_Rect{ .x = ix, .y = iy + ih - ri, .w = ri, .h = ri };
    _ = c.SDL_RenderCopy(renderer, tex, &bl_src, &bl_dst);
    // Bottom-right
    var br_src = c.SDL_Rect{ .x = half, .y = half, .w = half, .h = half };
    var br_dst = c.SDL_Rect{ .x = ix + iw - ri, .y = iy + ih - ri, .w = ri, .h = ri };
    _ = c.SDL_RenderCopy(renderer, tex, &br_src, &br_dst);
}

/// Walk the tree and dispatch on_key to all nodes that have it, skipping the already-dispatched hovered node.
fn dispatchGlobalKeyHandlers(node: *layout.Node, key: c_int, mods: u16, skip: ?*layout.Node) void {
    if (node.style.display == .none) return;
    if (skip != null and node == skip.?) return;
    if (node.handlers.on_key) |handler| {
        handler(key, mods);
    }
    for (node.children) |*child| {
        dispatchGlobalKeyHandlers(child, key, mods, skip);
    }
}

fn lerpU8(a: u8, b: u8, t: f32) u8 {
    const fa: f32 = @floatFromInt(a);
    const fb: f32 = @floatFromInt(b);
    return @intFromFloat(fa + (fb - fa) * t);
}

fn fillGradientRect(renderer: *c.SDL_Renderer, ix: i32, iy: i32, iw: i32, ih: i32, c1: Color, c2: Color, dir: layout.GradientDirection, opacity: f32) void {
    const steps: u32 = if (dir == .vertical) @intCast(@max(1, ih)) else @intCast(@max(1, iw));
    const steps_f: f32 = @floatFromInt(steps);

    var step: u32 = 0;
    while (step < steps) : (step += 1) {
        const t: f32 = @as(f32, @floatFromInt(step)) / steps_f;
        const r = lerpU8(c1.r, c2.r, t);
        const g = lerpU8(c1.g, c2.g, t);
        const b = lerpU8(c1.b, c2.b, t);
        const a: u8 = @intFromFloat(@as(f32, @floatFromInt(lerpU8(c1.a, c2.a, t))) * opacity);
        _ = c.SDL_SetRenderDrawColor(renderer, r, g, b, a);

        if (dir == .vertical) {
            var rect = c.SDL_Rect{ .x = ix, .y = iy + @as(i32, @intCast(step)), .w = iw, .h = 1 };
            _ = c.SDL_RenderFillRect(renderer, &rect);
        } else {
            var rect = c.SDL_Rect{ .x = ix + @as(i32, @intCast(step)), .y = iy, .w = 1, .h = ih };
            _ = c.SDL_RenderFillRect(renderer, &rect);
        }
    }
}

const Painter = struct {
    renderer: *c.SDL_Renderer,
    text_engine: *TextEngine,
    image_cache: *ImageCache,

    pub fn clear(self: *Painter, color: Color) void {
        _ = c.SDL_SetRenderDrawColor(self.renderer, color.r, color.g, color.b, color.a);
        _ = c.SDL_RenderClear(self.renderer);
    }

    pub fn fillRect(self: *Painter, rect: LayoutRect, color: Color) void {
        _ = c.SDL_SetRenderDrawColor(self.renderer, color.r, color.g, color.b, color.a);
        var sdl_rect = c.SDL_Rect{
            .x = @intFromFloat(rect.x),
            .y = @intFromFloat(rect.y),
            .w = @intFromFloat(rect.w),
            .h = @intFromFloat(rect.h),
        };
        _ = c.SDL_RenderFillRect(self.renderer, &sdl_rect);
    }

    pub fn present(self: *Painter) void {
        c.SDL_RenderPresent(self.renderer);
    }

    /// Brighten a color by ~20% for hover feedback.
    fn brighten(color: Color) Color {
        return .{
            .r = @min(255, @as(u16, color.r) + 30),
            .g = @min(255, @as(u16, color.g) + 30),
            .b = @min(255, @as(u16, color.b) + 30),
            .a = color.a,
        };
    }

    /// Walk the node tree and paint backgrounds + text + images.
    /// Supports opacity propagation, box shadows, borders, and scissor clipping.
    pub fn paintTree(self: *Painter, node: *Node, scroll_offset_x: f32, scroll_offset_y: f32) void {
        self.paintTreeWithOpacity(node, scroll_offset_x, scroll_offset_y, 1.0);
    }

    fn paintTreeWithOpacity(self: *Painter, node: *Node, scroll_offset_x: f32, scroll_offset_y: f32, parent_opacity: f32) void {
        if (node.style.display == .none) return;

        // Opacity propagation: multiply down the tree
        const effective_opacity = parent_opacity * node.style.opacity;
        if (effective_opacity <= 0) return;

        const screen_x = node.computed.x - scroll_offset_x;
        const screen_y = node.computed.y - scroll_offset_y;
        const sx = @as(i32, @intFromFloat(screen_x));
        const sy = @as(i32, @intFromFloat(screen_y));
        const sw = @as(i32, @intFromFloat(node.computed.w));
        const sh = @as(i32, @intFromFloat(node.computed.h));
        const opacity_byte: u8 = @intFromFloat(@min(255.0, effective_opacity * 255.0));

        // ── Box shadow (painted before background) ──────────────
        if (node.style.shadow_color) |shadow_col| {
            if (node.style.shadow_blur > 0) {
                const blur = node.style.shadow_blur;
                const off_x = node.style.shadow_offset_x;
                const off_y = node.style.shadow_offset_y;
                var steps: i32 = @intFromFloat(@ceil(blur));
                if (steps > 10) steps = 10;
                if (steps < 1) steps = 1;

                var step: i32 = steps;
                while (step >= 1) : (step -= 1) {
                    const expand: i32 = step;
                    const alpha_f = @as(f32, @floatFromInt(shadow_col.a)) *
                        (1.0 - @as(f32, @floatFromInt(step)) / @as(f32, @floatFromInt(steps + 1))) *
                        effective_opacity;
                    const sa: u8 = @intFromFloat(@max(0, @min(255, alpha_f)));
                    _ = c.SDL_SetRenderDrawColor(self.renderer, shadow_col.r, shadow_col.g, shadow_col.b, sa);
                    var sr = c.SDL_Rect{
                        .x = sx + @as(i32, @intFromFloat(off_x)) - expand,
                        .y = sy + @as(i32, @intFromFloat(off_y)) - expand,
                        .w = sw + expand * 2,
                        .h = sh + expand * 2,
                    };
                    _ = c.SDL_RenderFillRect(self.renderer, &sr);
                }
            }
        }

        // ── Background ──────────────────────────────────────────
        if (node.style.gradient_direction != .none and node.style.background_color != null and node.style.gradient_color_end != null) {
            // Gradient background (takes priority)
            fillGradientRect(self.renderer, sx, sy, sw, sh, node.style.background_color.?, node.style.gradient_color_end.?, node.style.gradient_direction, effective_opacity);
        } else if (node.style.background_color) |color| {
            const is_hovered = (hovered_node != null and hovered_node.? == node);
            const paint_color = if (is_hovered) brighten(color) else color;
            const a: u8 = @intFromFloat(@as(f32, @floatFromInt(paint_color.a)) * effective_opacity);
            if (node.style.border_radius > 0) {
                fillRoundedRect(self.renderer, sx, sy, sw, sh, node.style.border_radius, paint_color, a);
            } else {
                _ = c.SDL_SetRenderDrawColor(self.renderer, paint_color.r, paint_color.g, paint_color.b, a);
                var bg_rect = c.SDL_Rect{ .x = sx, .y = sy, .w = sw, .h = sh };
                _ = c.SDL_RenderFillRect(self.renderer, &bg_rect);
            }
        }

        // ── Border ──────────────────────────────────────────────
        if (node.style.border_width > 0) {
            const bw = @as(i32, @intFromFloat(node.style.border_width));
            const bc = node.style.border_color orelse Color.rgb(255, 255, 255);
            const ba: u8 = @intFromFloat(@as(f32, @floatFromInt(bc.a)) * effective_opacity);
            _ = c.SDL_SetRenderDrawColor(self.renderer, bc.r, bc.g, bc.b, ba);
            // Top
            var top_r = c.SDL_Rect{ .x = sx, .y = sy, .w = sw, .h = bw };
            _ = c.SDL_RenderFillRect(self.renderer, &top_r);
            // Bottom
            var bot_r = c.SDL_Rect{ .x = sx, .y = sy + sh - bw, .w = sw, .h = bw };
            _ = c.SDL_RenderFillRect(self.renderer, &bot_r);
            // Left
            var left_r = c.SDL_Rect{ .x = sx, .y = sy + bw, .w = bw, .h = sh - bw * 2 };
            _ = c.SDL_RenderFillRect(self.renderer, &left_r);
            // Right
            var right_r = c.SDL_Rect{ .x = sx + sw - bw, .y = sy + bw, .w = bw, .h = sh - bw * 2 };
            _ = c.SDL_RenderFillRect(self.renderer, &right_r);
        }

        // ── Image ───────────────────────────────────────────────
        if (node.image_src) |src| {
            if (self.image_cache.load(src)) |img| {
                var dst = c.SDL_Rect{ .x = sx, .y = sy, .w = sw, .h = sh };
                if (opacity_byte < 255) {
                    _ = c.SDL_SetTextureAlphaMod(img.texture, opacity_byte);
                }
                _ = c.SDL_RenderCopy(self.renderer, img.texture, null, &dst);
                if (opacity_byte < 255) {
                    _ = c.SDL_SetTextureAlphaMod(img.texture, 255);
                }
            }
        }

        // ── Text ────────────────────────────────────────────────
        if (node.text) |txt| {
            const pad_l = node.style.padLeft();
            const pad_r = node.style.padRight();
            const pad_t = node.style.padTop();
            var color = node.text_color orelse Color.rgb(255, 255, 255);
            color.a = @intFromFloat(@as(f32, @floatFromInt(color.a)) * effective_opacity);
            const text_max_w = node.computed.w - pad_l - pad_r;
            // Selection highlights
            if (sel_all) {
                self.text_engine.drawSelectionRects(txt, screen_x + pad_l, screen_y + pad_t, node.font_size, text_max_w, 0, txt.len, Color.rgba(60, 120, 200, 140));
            } else if (sel_node == node and sel_start != sel_end) {
                self.text_engine.drawSelectionRects(txt, screen_x + pad_l, screen_y + pad_t, node.font_size, text_max_w, sel_start, sel_end, Color.rgba(60, 120, 200, 140));
            }

            if (node.code_language != .none) {
                // Syntax-highlighted rendering: tokenize each line, draw colored spans
                const lang: syntax.Language = switch (node.code_language) {
                    .zig => .zig,
                    .typescript => .typescript,
                    .json => .json,
                    .bash => .bash,
                    .markdown => .markdown,
                    .plain => .plain,
                    .none => unreachable,
                };
                const lm = self.text_engine.lineMetrics(node.font_size);
                const line_h: f32 = if (node.line_height > 0) node.line_height else lm.height;
                var line_y = screen_y + pad_t;
                var spans: [256]ColorSpan = undefined;
                var lines_iter = std.mem.splitScalar(u8, txt, '\n');
                while (lines_iter.next()) |line| {
                    const span_count = syntax.tokenizeLine(line, lang, &spans);
                    self.text_engine.drawColorSpans(spans[0..span_count], screen_x + pad_l, line_y, node.font_size);
                    line_y += line_h;
                }
            } else {
                // Normal single-color text rendering
                self.text_engine.drawTextWrappedFull(
                    txt,
                    screen_x + pad_l,
                    screen_y + pad_t,
                    node.font_size,
                    text_max_w,
                    color,
                    node.style.text_align,
                    node.letter_spacing,
                    node.line_height,
                    node.number_of_lines,
                );
            }
        }

        // ── Scissor clipping for scroll/hidden containers ────────
        var prev_clip: c.SDL_Rect = undefined;
        var had_prev_clip = false;
        const needs_clip = node.style.overflow != .visible;

        if (needs_clip) {
            c.SDL_RenderGetClipRect(self.renderer, &prev_clip);
            had_prev_clip = (prev_clip.w > 0 and prev_clip.h > 0);

            var clip = c.SDL_Rect{ .x = sx, .y = sy, .w = sw, .h = sh };

            if (had_prev_clip) {
                const ix1 = @max(clip.x, prev_clip.x);
                const iy1 = @max(clip.y, prev_clip.y);
                const ix2 = @min(clip.x + clip.w, prev_clip.x + prev_clip.w);
                const iy2 = @min(clip.y + clip.h, prev_clip.y + prev_clip.h);
                clip.x = ix1;
                clip.y = iy1;
                clip.w = @max(0, ix2 - ix1);
                clip.h = @max(0, iy2 - iy1);
            }

            _ = c.SDL_RenderSetClipRect(self.renderer, &clip);
        }

        // ── Paint children with scroll offset (z-index sorted) ────
        const child_scroll_x = scroll_offset_x + if (needs_clip) node.scroll_x else @as(f32, 0);
        const child_scroll_y = scroll_offset_y + if (needs_clip) node.scroll_y else @as(f32, 0);

        // Check if any child has non-zero z_index
        var needs_zsort = false;
        for (node.children) |*child| {
            if (child.style.z_index != 0) {
                needs_zsort = true;
                break;
            }
        }

        if (needs_zsort and node.children.len <= 512) {
            // Build sorted index array
            var indices: [512]u16 = undefined;
            for (0..node.children.len) |ci| {
                indices[ci] = @intCast(ci);
            }
            // Insertion sort by z_index (stable, small N)
            var si: usize = 1;
            while (si < node.children.len) : (si += 1) {
                const key_idx = indices[si];
                const key_z = node.children[key_idx].style.z_index;
                var sj: usize = si;
                while (sj > 0 and node.children[indices[sj - 1]].style.z_index > key_z) : (sj -= 1) {
                    indices[sj] = indices[sj - 1];
                }
                indices[sj] = key_idx;
            }
            for (0..node.children.len) |ci| {
                self.paintTreeWithOpacity(&node.children[indices[ci]], child_scroll_x, child_scroll_y, effective_opacity);
            }
        } else {
            for (node.children) |*child| {
                self.paintTreeWithOpacity(child, child_scroll_x, child_scroll_y, effective_opacity);
            }
        }

        // ── Restore previous clip rect ───────────────────────────
        if (needs_clip) {
            if (had_prev_clip) {
                _ = c.SDL_RenderSetClipRect(self.renderer, &prev_clip);
            } else {
                _ = c.SDL_RenderSetClipRect(self.renderer, null);
            }
        }
    }
};

// ── Main ────────────────────────────────────────────────────────────────────

pub fn main() !void {
    if (c.SDL_Init(c.SDL_INIT_VIDEO) != 0) {
        std.debug.print("SDL_Init failed: {s}\n", .{c.SDL_GetError()});
        return error.SDLInitFailed;
    }
    defer c.SDL_Quit();

    const init_w: c_int = 800;
    const init_h: c_int = 600;

    const window = c.SDL_CreateWindow(
        "ReactJIT Engine",
        c.SDL_WINDOWPOS_CENTERED,
        c.SDL_WINDOWPOS_CENTERED,
        init_w,
        init_h,
        c.SDL_WINDOW_SHOWN | c.SDL_WINDOW_RESIZABLE,
    ) orelse {
        std.debug.print("SDL_CreateWindow failed: {s}\n", .{c.SDL_GetError()});
        return error.WindowCreateFailed;
    };
    defer c.SDL_DestroyWindow(window);

    const renderer = c.SDL_CreateRenderer(
        window,
        -1,
        c.SDL_RENDERER_ACCELERATED | c.SDL_RENDERER_PRESENTVSYNC,
    ) orelse {
        std.debug.print("SDL_CreateRenderer failed: {s}\n", .{c.SDL_GetError()});
        return error.RendererFailed;
    };
    defer c.SDL_DestroyRenderer(renderer);

    _ = c.SDL_SetRenderDrawBlendMode(renderer, c.SDL_BLENDMODE_BLEND);

    // Init wgpu GPU backend
    gpu.init(window) catch |err| {
        std.debug.print("wgpu init failed: {}\n", .{err});
    };
    defer gpu.deinit();

    // Init text engine with bundled DejaVu Sans, system fallbacks per platform
    var text_engine = TextEngine.init(renderer, "fonts/base/DejaVuSans-Regular.ttf") catch
        TextEngine.init(renderer, "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf") catch
        TextEngine.init(renderer, "/System/Library/Fonts/Supplemental/Arial.ttf") catch
        TextEngine.init(renderer, "/System/Library/Fonts/SFNS.ttf") catch
        TextEngine.init(renderer, "C:/Windows/Fonts/segoeui.ttf") catch
        TextEngine.init(renderer, "C:/Windows/Fonts/arial.ttf") catch {
        std.debug.print("No font found!\n", .{});
        return error.FontNotFound;
    };
    defer text_engine.deinit();

    // Wire up text measurement for the layout engine
    g_text_engine = &text_engine;
    layout.setMeasureFn(measureCallback);

    // Init image cache and wire up measurement for layout engine
    var image_cache = ImageCache.init(renderer);
    defer image_cache.deinit();
    g_image_cache = &image_cache;
    layout.setMeasureImageFn(measureImageCallback);

    _ = Painter{ .renderer = renderer, .text_engine = &text_engine, .image_cache = &image_cache };

    // Wire up GPU text rendering with FreeType handles from text engine
    gpu.initText(text_engine.library, text_engine.face, text_engine.fallback_faces, text_engine.fallback_count);

    // Init rounded corner texture
    initCircleTexture(renderer);
    defer if (g_circle_tex) |t| c.SDL_DestroyTexture(t);

    // ── Colors ──────────────────────────────────────────────────────
    const bg = Color.rgb(24, 24, 32);
    const container_bg = Color.rgb(30, 30, 42);
    const red = Color.rgb(235, 87, 87);
    const blue = Color.rgb(86, 156, 214);
    const green = Color.rgb(78, 201, 176);
    const accent = Color.rgb(255, 121, 198);
    const yellow = Color.rgb(229, 192, 123);
    const muted = Color.rgb(120, 120, 140);

    std.debug.print(
        \\
        \\  ┌──────────────────────────────────────┐
        \\  │  ReactJIT Engine — Phase 2            │
        \\  │  Letters. Actual letters.             │
        \\  │                                       │
        \\  │  FreeType + SDL2 + Zig flex layout.   │
        \\  │  Text measured, positioned, rendered.  │
        \\  └──────────────────────────────────────┘
        \\
        \\
    , .{});

    // ── Build the UI tree ───────────────────────────────────────────
    // A card-like layout with text content — no coordinates, just declarations.

    // ── UI tree ───────────────────────────────────────────────────
    // All arrays must be `var` because layout mutates .computed
    // through pointers. Zig's comptime const arrays live in
    // read-only memory — layout would segfault trying to write.

    var stat1_children = [_]Node{
        .{ .text = "Binary Size", .font_size = 11, .text_color = muted, .style = .{ .padding_bottom = 4 } },
        .{ .text = "148 KB", .font_size = 22, .text_color = accent },
    };
    var stat2_children = [_]Node{
        .{ .text = "Layout Engine", .font_size = 11, .text_color = muted, .style = .{ .padding_bottom = 4 } },
        .{ .text = "Flexbox", .font_size = 22, .text_color = green },
    };
    var stat3_children = [_]Node{
        .{ .text = "Renderer", .font_size = 11, .text_color = muted, .style = .{ .padding_bottom = 4 } },
        .{ .text = "OpenGL", .font_size = 22, .text_color = blue },
    };

    var stats_children = [_]Node{
        .{ .style = .{ .flex_grow = 1, .background_color = Color.rgb(40, 40, 56), .padding = 12 }, .children = &stat1_children },
        .{ .style = .{ .flex_grow = 1, .background_color = Color.rgb(40, 40, 56), .padding = 12 }, .children = &stat2_children },
        .{ .style = .{ .flex_grow = 1, .background_color = Color.rgb(40, 40, 56), .padding = 12 }, .children = &stat3_children },
    };

    var bar_children = [_]Node{
        .{ .style = .{ .flex_grow = 1, .background_color = red, .padding = 8 }, .text = "Red", .font_size = 12, .text_color = Color.rgb(255, 255, 255) },
        .{ .style = .{ .flex_grow = 1, .background_color = blue, .padding = 8 }, .text = "Blue", .font_size = 12, .text_color = Color.rgb(255, 255, 255) },
        .{ .style = .{ .flex_grow = 1, .background_color = green, .padding = 8 }, .text = "Green", .font_size = 12, .text_color = Color.rgb(255, 255, 255) },
        .{ .style = .{ .flex_grow = 1, .background_color = yellow, .padding = 8 }, .text = "Yellow", .font_size = 12, .text_color = Color.rgb(30, 30, 42) },
    };

    var container_children = [_]Node{
        // Title
        .{ .text = "ReactJIT Engine", .font_size = 28, .text_color = Color.rgb(255, 255, 255), .style = .{ .padding_bottom = 4 } },
        // Subtitle
        .{ .text = "Zig + SDL2 + FreeType. No Love2D. No LuaJIT. No bridge.", .font_size = 14, .text_color = muted, .style = .{ .padding_bottom = 16 } },
        // Stats row
        .{ .style = .{ .flex_direction = .row, .gap = 10 }, .children = &stats_children },
        // Color bar
        .{ .style = .{ .flex_direction = .row, .gap = 4, .height = 40 }, .children = &bar_children },
        // Footer
        .{ .text = "One pixel. Then the world.", .font_size = 12, .text_color = Color.rgb(80, 80, 100), .style = .{ .padding_top = 8 } },
    };
    var container = Node{
        .style = .{
            .width = 540,
            .flex_direction = .column,
            .padding = 24,
            .gap = 12,
            .background_color = container_bg,
        },
        .children = &container_children,
    };

    // The pixel
    var pixel = Node{
        .style = .{ .width = 2, .height = 2, .background_color = accent },
    };

    // ── Main loop ───────────────────────────────────────────────────
    var running = true;
    var win_w: f32 = @floatFromInt(init_w);
    var win_h: f32 = @floatFromInt(init_h);

    while (running) {
        var event: c.SDL_Event = undefined;
        while (c.SDL_PollEvent(&event) != 0) {
            switch (event.type) {
                c.SDL_QUIT => running = false,
                c.SDL_WINDOWEVENT => {
                    if (event.window.event == c.SDL_WINDOWEVENT_SIZE_CHANGED) {
                        win_w = @floatFromInt(event.window.data1);
                        win_h = @floatFromInt(event.window.data2);
                        gpu.resize(@intCast(event.window.data1), @intCast(event.window.data2));
                    }
                },
                c.SDL_KEYDOWN => {
                    if (event.key.keysym.sym == c.SDLK_ESCAPE) {
                        running = false;
                    } else {
                        // Build modifier bitfield: bit0=ctrl, bit1=shift, bit2=alt, bit3=meta
                        const sdl_mod = event.key.keysym.mod;
                        const mods: u16 = (if (sdl_mod & c.KMOD_CTRL != 0) @as(u16, 1) else @as(u16, 0)) |
                            (if (sdl_mod & c.KMOD_SHIFT != 0) @as(u16, 2) else @as(u16, 0)) |
                            (if (sdl_mod & c.KMOD_ALT != 0) @as(u16, 4) else @as(u16, 0)) |
                            (if (sdl_mod & c.KMOD_GUI != 0) @as(u16, 8) else @as(u16, 0));
                        // Dispatch to hovered node's on_key handler (or could be focused node)
                        if (hovered_node) |node| {
                            if (node.handlers.on_key) |handler| {
                                handler(event.key.keysym.sym, mods);
                            }
                        }
                        // Also walk the tree for global key handlers on non-hovered nodes
                        dispatchGlobalKeyHandlers(&container, event.key.keysym.sym, mods, hovered_node);
                    }
                },
                c.SDL_MOUSEMOTION => {
                    const mx: f32 = @floatFromInt(event.motion.x);
                    const my: f32 = @floatFromInt(event.motion.y);
                    const prev_hovered = hovered_node;
                    hovered_node = events.hitTest(&container, mx, my);

                    // Fire hover enter/exit callbacks
                    if (prev_hovered != hovered_node) {
                        if (prev_hovered) |prev| {
                            if (prev.handlers.on_hover_exit) |handler| handler();
                        }
                        if (hovered_node) |node| {
                            if (node.handlers.on_hover_enter) |handler| handler();
                        }
                    }
                },
                c.SDL_MOUSEBUTTONDOWN => {
                    const mx: f32 = @floatFromInt(event.button.x);
                    const my: f32 = @floatFromInt(event.button.y);
                    if (events.hitTest(&container, mx, my)) |node| {
                        if (node.handlers.on_press) |handler| handler();
                    }
                },
                c.SDL_MOUSEWHEEL => {
                    // Get current mouse position for hit test
                    var mx_i: c_int = undefined;
                    var my_i: c_int = undefined;
                    _ = c.SDL_GetMouseState(&mx_i, &my_i);
                    const mx: f32 = @floatFromInt(mx_i);
                    const my: f32 = @floatFromInt(my_i);

                    // Find the scroll container under the mouse
                    if (events.findScrollContainer(&container, mx, my)) |scroll_node| {
                        const scroll_amount: f32 = @as(f32, @floatFromInt(event.wheel.y)) * 30.0;
                        scroll_node.scroll_y -= scroll_amount;
                        // Clamp to valid range [0, content_height - visible_height]
                        const max_scroll = @max(0.0, scroll_node.content_height - scroll_node.computed.h);
                        scroll_node.scroll_y = @max(0.0, @min(scroll_node.scroll_y, max_scroll));
                        if (scroll_node.handlers.on_scroll) |handler| handler();
                    }
                },
                else => {},
            }
        }

        // ── Layout pass ─────────────────────────────────────────────
        // Auto-height: let the container figure out how tall it needs to be
        layout.layout(&container, (win_w - 540) / 2.0, (win_h - 400) / 2.0, 540, 400);

        pixel.computed = .{
            .x = win_w / 2.0 - 1,
            .y = win_h / 2.0 - 1,
            .w = 2,
            .h = 2,
        };

        // ── Paint pass (wgpu) ────────────────────────────────────────
        // Queue rects for this frame
        // Container background (rounded)
        gpu.drawRect(
            (win_w - 540) / 2.0,
            (win_h - 400) / 2.0,
            540,
            400,
            30.0 / 255.0, 30.0 / 255.0, 42.0 / 255.0, 1.0, // color
            12.0, // border_radius
            0, // border_width
            0, 0, 0, 0, // border_color
        );

        // Stat cards
        const card_y = (win_h - 400) / 2.0 + 80;
        const card_w: f32 = 160;
        const card_h: f32 = 60;
        const card_gap: f32 = 10;
        const cards_start = (win_w - 540) / 2.0 + 24;

        // Card 1
        gpu.drawRect(cards_start, card_y, card_w, card_h, 40.0 / 255.0, 40.0 / 255.0, 56.0 / 255.0, 1.0, 6.0, 0, 0, 0, 0, 0);
        // Card 2
        gpu.drawRect(cards_start + card_w + card_gap, card_y, card_w, card_h, 40.0 / 255.0, 40.0 / 255.0, 56.0 / 255.0, 1.0, 6.0, 0, 0, 0, 0, 0);
        // Card 3
        gpu.drawRect(cards_start + (card_w + card_gap) * 2, card_y, card_w, card_h, 40.0 / 255.0, 40.0 / 255.0, 56.0 / 255.0, 1.0, 6.0, 0, 0, 0, 0, 0);

        // Color bar
        const bar_y = card_y + card_h + 12;
        const bar_w = (540 - 24 * 2 - 12) / 4;
        gpu.drawRect(cards_start, bar_y, bar_w, 40, 235.0 / 255.0, 87.0 / 255.0, 87.0 / 255.0, 1.0, 4.0, 0, 0, 0, 0, 0);
        gpu.drawRect(cards_start + bar_w + 4, bar_y, bar_w, 40, 86.0 / 255.0, 156.0 / 255.0, 214.0 / 255.0, 1.0, 4.0, 0, 0, 0, 0, 0);
        gpu.drawRect(cards_start + (bar_w + 4) * 2, bar_y, bar_w, 40, 78.0 / 255.0, 201.0 / 255.0, 176.0 / 255.0, 1.0, 4.0, 0, 0, 0, 0, 0);
        gpu.drawRect(cards_start + (bar_w + 4) * 3, bar_y, bar_w, 40, 229.0 / 255.0, 192.0 / 255.0, 123.0 / 255.0, 1.0, 4.0, 0, 0, 0, 0, 0);

        // Test: large border-radius rect (the crispy test)
        gpu.drawRect(
            (win_w - 540) / 2.0 + 24,
            bar_y + 60,
            200, 80,
            1.0, 121.0 / 255.0, 198.0 / 255.0, 1.0, // accent pink
            24.0, // large border-radius
            2.0, // border
            1.0, 1.0, 1.0, 0.5, // white semi-transparent border
        );

        // ── Text ────────────────────────────────────────────────────
        const text_x = (win_w - 540) / 2.0 + 24;
        const text_y = (win_h - 400) / 2.0 + 24;
        gpu.drawTextLine("ReactJIT Engine", text_x, text_y, 28, 1.0, 1.0, 1.0, 1.0);
        gpu.drawTextLine("wgpu + FreeType + Zig flex layout. Pixel-perfect.", text_x, text_y + 36, 14, 120.0 / 255.0, 120.0 / 255.0, 140.0 / 255.0, 1.0);

        // Stat labels
        gpu.drawTextLine("148 KB", cards_start + 12, card_y + 28, 22, 1.0, 121.0 / 255.0, 198.0 / 255.0, 1.0);
        gpu.drawTextLine("Flexbox", cards_start + card_w + card_gap + 12, card_y + 28, 22, 78.0 / 255.0, 201.0 / 255.0, 176.0 / 255.0, 1.0);
        gpu.drawTextLine("wgpu", cards_start + (card_w + card_gap) * 2 + 12, card_y + 28, 22, 86.0 / 255.0, 156.0 / 255.0, 214.0 / 255.0, 1.0);

        gpu.drawTextLine("One pixel. Then the world.", text_x, bar_y + 48, 12, 80.0 / 255.0, 80.0 / 255.0, 100.0 / 255.0, 1.0);

        // Render and present
        gpu.frame(
            @as(f64, @floatFromInt(bg.r)) / 255.0,
            @as(f64, @floatFromInt(bg.g)) / 255.0,
            @as(f64, @floatFromInt(bg.b)) / 255.0,
        );
    }

    std.debug.print("Engine shut down cleanly.\n", .{});
}
