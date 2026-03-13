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
const Node = layout.Node;
const Style = layout.Style;
const Color = layout.Color;
const LayoutRect = layout.LayoutRect;
const TextEngine = text_mod.TextEngine;

// ── Global text engine (set during init, used by layout measure callback) ───
var g_text_engine: ?*TextEngine = null;

fn measureCallback(t: []const u8, font_size: u16) layout.TextMetrics {
    if (g_text_engine) |te| {
        return te.measureText(t, font_size);
    }
    return .{};
}

// ── Painter ─────────────────────────────────────────────────────────────────

const Painter = struct {
    renderer: *c.SDL_Renderer,
    text_engine: *TextEngine,

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

    /// Walk the node tree and paint backgrounds + text.
    pub fn paintTree(self: *Painter, node: *Node) void {
        if (node.style.display == .none) return;

        // Paint background
        if (node.style.background_color) |color| {
            self.fillRect(node.computed, color);
        }

        // Paint text
        if (node.text) |txt| {
            const pad_l = node.style.padLeft();
            const pad_t = node.style.padTop();
            const color = node.text_color orelse Color.rgb(255, 255, 255);
            self.text_engine.drawText(
                txt,
                node.computed.x + pad_l,
                node.computed.y + pad_t,
                node.font_size,
                color,
            );
        }

        // Paint children
        for (node.children) |*child| {
            self.paintTree(child);
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

    var painter = Painter{ .renderer = renderer, .text_engine = &text_engine };

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

    // Title text
    const title = Node{
        .style = .{ .padding_bottom = 4 },
        .text = "ReactJIT Engine",
        .font_size = 28,
        .text_color = Color.rgb(255, 255, 255),
    };

    // Subtitle
    const subtitle = Node{
        .style = .{ .padding_bottom = 16 },
        .text = "Zig + SDL2 + FreeType. No Love2D. No LuaJIT. No bridge.",
        .font_size = 14,
        .text_color = muted,
    };

    // Stat cards
    const stat1 = Node{
        .style = .{ .flex_grow = 1, .background_color = Color.rgb(40, 40, 56), .padding = 12 },
        .children = @constCast(&[_]Node{
            .{ .text = "Binary Size", .font_size = 11, .text_color = muted, .style = .{ .padding_bottom = 4 } },
            .{ .text = "148 KB", .font_size = 22, .text_color = accent },
        }),
    };

    const stat2 = Node{
        .style = .{ .flex_grow = 1, .background_color = Color.rgb(40, 40, 56), .padding = 12 },
        .children = @constCast(&[_]Node{
            .{ .text = "Layout Engine", .font_size = 11, .text_color = muted, .style = .{ .padding_bottom = 4 } },
            .{ .text = "Flexbox", .font_size = 22, .text_color = green },
        }),
    };

    const stat3 = Node{
        .style = .{ .flex_grow = 1, .background_color = Color.rgb(40, 40, 56), .padding = 12 },
        .children = @constCast(&[_]Node{
            .{ .text = "Renderer", .font_size = 11, .text_color = muted, .style = .{ .padding_bottom = 4 } },
            .{ .text = "OpenGL", .font_size = 22, .text_color = blue },
        }),
    };

    // Stats row
    const stats_row = Node{
        .style = .{ .flex_direction = .row, .gap = 10 },
        .children = @constCast(&[_]Node{ stat1, stat2, stat3 }),
    };

    // Color bar (the original 3 rects — now with labels)
    const color_bar = Node{
        .style = .{ .flex_direction = .row, .gap = 4, .height = 40 },
        .children = @constCast(&[_]Node{
            .{ .style = .{ .flex_grow = 1, .background_color = red, .padding = 8, .align_items = .center, .justify_content = .center }, .text = "Red", .font_size = 12, .text_color = Color.rgb(255, 255, 255) },
            .{ .style = .{ .flex_grow = 1, .background_color = blue, .padding = 8, .align_items = .center, .justify_content = .center }, .text = "Blue", .font_size = 12, .text_color = Color.rgb(255, 255, 255) },
            .{ .style = .{ .flex_grow = 1, .background_color = green, .padding = 8, .align_items = .center, .justify_content = .center }, .text = "Green", .font_size = 12, .text_color = Color.rgb(255, 255, 255) },
            .{ .style = .{ .flex_grow = 1, .background_color = yellow, .padding = 8, .align_items = .center, .justify_content = .center }, .text = "Yellow", .font_size = 12, .text_color = Color.rgb(30, 30, 42) },
        }),
    };

    // Footer
    const footer = Node{
        .style = .{ .padding_top = 8 },
        .text = "One pixel. Then the world.",
        .font_size = 12,
        .text_color = Color.rgb(80, 80, 100),
    };

    // Main container
    var container_children = [_]Node{ title, subtitle, stats_row, color_bar, footer };
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
                    if (event.key.keysym.sym == c.SDLK_ESCAPE) running = false;
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
        painter.paintTree(&container);
        painter.fillRect(pixel.computed, accent);
        painter.present();
    }

    std.debug.print("Engine shut down cleanly.\n", .{});
}
