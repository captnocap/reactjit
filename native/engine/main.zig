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

// ── Global text engine (set during init, used by layout measure callback) ───
var g_text_engine: ?*TextEngine = null;

// ── Global image cache (set during init, used by layout measure callback) ───
var g_image_cache: ?*ImageCache = null;

fn measureCallback(t: []const u8, font_size: u16, max_width: f32) layout.TextMetrics {
    if (g_text_engine) |te| {
        return te.measureTextWrapped(t, font_size, max_width);
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
    /// Nodes that are hovered get a brightened background.
    /// Scroll/hidden overflow nodes use SDL clip rect for scissor clipping,
    /// and offset their children by scroll_x/scroll_y.
    pub fn paintTree(self: *Painter, node: *Node, scroll_offset_x: f32, scroll_offset_y: f32) void {
        if (node.style.display == .none) return;

        // Apply accumulated scroll offset to get screen position
        const screen_x = node.computed.x - scroll_offset_x;
        const screen_y = node.computed.y - scroll_offset_y;

        // Paint background (brighten if hovered)
        if (node.style.background_color) |color| {
            const is_hovered = (hovered_node != null and hovered_node.? == node);
            const paint_color = if (is_hovered) brighten(color) else color;
            _ = c.SDL_SetRenderDrawColor(self.renderer, paint_color.r, paint_color.g, paint_color.b, paint_color.a);
            var bg_rect = c.SDL_Rect{
                .x = @intFromFloat(screen_x),
                .y = @intFromFloat(screen_y),
                .w = @intFromFloat(node.computed.w),
                .h = @intFromFloat(node.computed.h),
            };
            _ = c.SDL_RenderFillRect(self.renderer, &bg_rect);
        }

        // Paint image
        if (node.image_src) |src| {
            if (self.image_cache.load(src)) |img| {
                var dst = c.SDL_Rect{
                    .x = @intFromFloat(screen_x),
                    .y = @intFromFloat(screen_y),
                    .w = @intFromFloat(node.computed.w),
                    .h = @intFromFloat(node.computed.h),
                };
                _ = c.SDL_RenderCopy(self.renderer, img.texture, null, &dst);
            }
        }

        // Paint text (with word wrapping to node width)
        if (node.text) |txt| {
            const pad_l = node.style.padLeft();
            const pad_r = node.style.padRight();
            const pad_t = node.style.padTop();
            const color = node.text_color orelse Color.rgb(255, 255, 255);
            const text_max_w = node.computed.w - pad_l - pad_r;
            // Draw selection highlight behind text
            if (sel_all) {
                self.text_engine.drawSelectionRects(txt, screen_x + pad_l, screen_y + pad_t, node.font_size, text_max_w, 0, txt.len, Color.rgba(60, 120, 200, 140));
            } else if (sel_node == node and sel_start != sel_end) {
                self.text_engine.drawSelectionRects(txt, screen_x + pad_l, screen_y + pad_t, node.font_size, text_max_w, sel_start, sel_end, Color.rgba(60, 120, 200, 140));
            }
            self.text_engine.drawTextWrapped(
                txt,
                screen_x + pad_l,
                screen_y + pad_t,
                node.font_size,
                text_max_w,
                color,
            );
        }

        // ── Scissor clipping for scroll/hidden containers ────────
        var prev_clip: c.SDL_Rect = undefined;
        var had_prev_clip = false;
        const needs_clip = node.style.overflow != .visible;

        if (needs_clip) {
            // Save previous clip rect (for nested scroll containers)
            c.SDL_RenderGetClipRect(self.renderer, &prev_clip);
            had_prev_clip = (prev_clip.w > 0 and prev_clip.h > 0);

            // Set clip to this node's screen bounds
            var clip = c.SDL_Rect{
                .x = @intFromFloat(screen_x),
                .y = @intFromFloat(screen_y),
                .w = @intFromFloat(node.computed.w),
                .h = @intFromFloat(node.computed.h),
            };

            // Intersect with existing clip if present (nested clips)
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

        // ── Paint children with scroll offset ────────────────────
        const child_scroll_x = scroll_offset_x + if (needs_clip) node.scroll_x else @as(f32, 0);
        const child_scroll_y = scroll_offset_y + if (needs_clip) node.scroll_y else @as(f32, 0);

        for (node.children) |*child| {
            self.paintTree(child, child_scroll_x, child_scroll_y);
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

    // Init text engine with bundled DejaVu Sans
    var text_engine = TextEngine.init(renderer, "fonts/base/DejaVuSans-Regular.ttf") catch
        TextEngine.init(renderer, "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf") catch {
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

    var painter = Painter{ .renderer = renderer, .text_engine = &text_engine, .image_cache = &image_cache };

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
                    }
                },
                c.SDL_KEYDOWN => {
                    if (event.key.keysym.sym == c.SDLK_ESCAPE) {
                        running = false;
                    } else {
                        // Dispatch to hovered node's on_key handler (or could be focused node)
                        if (hovered_node) |node| {
                            if (node.handlers.on_key) |handler| {
                                handler(event.key.keysym.sym);
                            }
                        }
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

        // ── Paint pass ──────────────────────────────────────────────
        painter.clear(bg);
        painter.paintTree(&container, 0, 0);
        painter.fillRect(pixel.computed, accent);
        painter.present();
    }

    std.debug.print("Engine shut down cleanly.\n", .{});
}
