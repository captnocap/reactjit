//! ReactJIT Engine — Phase 0+1
//!
//! One pixel. Then a rectangle. Then a layout engine. Then the world.
//!
//! SDL2 window + accelerated renderer + flex layout engine.
//! The rectangles are no longer hardcoded — they're positioned by
//! the same flex algorithm that powers the Lua layout engine.

const std = @import("std");
const sdl = @cImport({
    @cInclude("SDL2/SDL.h");
});
const layout = @import("layout.zig");
const Node = layout.Node;
const Style = layout.Style;
const Color = layout.Color;
const LayoutRect = layout.LayoutRect;

// ── Painter (Phase 0 — SDL2 Renderer) ───────────────────────────────────────

const Painter = struct {
    renderer: *sdl.SDL_Renderer,

    pub fn clear(self: *Painter, color: Color) void {
        _ = sdl.SDL_SetRenderDrawColor(self.renderer, color.r, color.g, color.b, color.a);
        _ = sdl.SDL_RenderClear(self.renderer);
    }

    pub fn fillRect(self: *Painter, rect: LayoutRect, color: Color) void {
        _ = sdl.SDL_SetRenderDrawColor(self.renderer, color.r, color.g, color.b, color.a);
        var sdl_rect = sdl.SDL_Rect{
            .x = @intFromFloat(rect.x),
            .y = @intFromFloat(rect.y),
            .w = @intFromFloat(rect.w),
            .h = @intFromFloat(rect.h),
        };
        _ = sdl.SDL_RenderFillRect(self.renderer, &sdl_rect);
    }

    pub fn present(self: *Painter) void {
        sdl.SDL_RenderPresent(self.renderer);
    }

    /// Walk the node tree and paint every node that has a background color.
    pub fn paintTree(self: *Painter, node: *Node) void {
        if (node.style.display == .none) return;

        if (node.style.background_color) |color| {
            self.fillRect(node.computed, color);
        }

        for (node.children) |*child| {
            self.paintTree(child);
        }
    }
};

// ── Main ────────────────────────────────────────────────────────────────────

pub fn main() !void {
    // Init SDL2
    if (sdl.SDL_Init(sdl.SDL_INIT_VIDEO) != 0) {
        std.debug.print("SDL_Init failed: {s}\n", .{sdl.SDL_GetError()});
        return error.SDLInitFailed;
    }
    defer sdl.SDL_Quit();

    const init_w: c_int = 800;
    const init_h: c_int = 600;

    const window = sdl.SDL_CreateWindow(
        "ReactJIT Engine",
        sdl.SDL_WINDOWPOS_CENTERED,
        sdl.SDL_WINDOWPOS_CENTERED,
        init_w,
        init_h,
        sdl.SDL_WINDOW_SHOWN | sdl.SDL_WINDOW_RESIZABLE,
    ) orelse {
        std.debug.print("SDL_CreateWindow failed: {s}\n", .{sdl.SDL_GetError()});
        return error.WindowCreateFailed;
    };
    defer sdl.SDL_DestroyWindow(window);

    const renderer = sdl.SDL_CreateRenderer(
        window,
        -1,
        sdl.SDL_RENDERER_ACCELERATED | sdl.SDL_RENDERER_PRESENTVSYNC,
    ) orelse {
        std.debug.print("SDL_CreateRenderer failed: {s}\n", .{sdl.SDL_GetError()});
        return error.RendererFailed;
    };
    defer sdl.SDL_DestroyRenderer(renderer);

    _ = sdl.SDL_SetRenderDrawBlendMode(renderer, sdl.SDL_BLENDMODE_BLEND);

    var painter = Painter{ .renderer = renderer };

    // ── Colors ──────────────────────────────────────────────────────
    const bg = Color.rgb(24, 24, 32);
    const container_bg = Color.rgb(30, 30, 42);
    const red = Color.rgb(235, 87, 87);
    const blue = Color.rgb(86, 156, 214);
    const green = Color.rgb(78, 201, 176);
    const accent = Color.rgb(255, 121, 198);
    const yellow = Color.rgb(229, 192, 123);
    const purple = Color.rgb(198, 120, 221);

    std.debug.print(
        \\
        \\  ┌──────────────────────────────────────┐
        \\  │  ReactJIT Engine — Phase 1            │
        \\  │  Flex layout engine is LIVE.          │
        \\  │                                       │
        \\  │  Nodes are positioned by flexbox,     │
        \\  │  not hardcoded coordinates.            │
        \\  │                                       │
        \\  │  Zig, all the way down.               │
        \\  └──────────────────────────────────────┘
        \\
        \\
    , .{});

    // ── Build the UI tree ───────────────────────────────────────────
    // This is what the reconciler will produce. For now, hardcoded.
    // Notice: NO pixel coordinates anywhere. Just style declarations.

    // Bottom row: two small boxes
    var bottom_children = [_]Node{
        .{ .style = .{ .flex_grow = 1, .height = 40, .background_color = yellow } },
        .{ .style = .{ .flex_grow = 1, .height = 40, .background_color = purple } },
    };

    // Top row: three equal columns
    var top_children = [_]Node{
        .{ .style = .{ .flex_grow = 1, .background_color = red } },
        .{ .style = .{ .flex_grow = 1, .background_color = blue } },
        .{ .style = .{ .flex_grow = 1, .background_color = green } },
    };

    // Main container: column with a row of 3, then a row of 2
    const top_row = Node{
        .style = .{
            .flex_direction = .row,
            .flex_grow = 1,
            .gap = 10,
        },
        .children = &top_children,
    };
    const bottom_row = Node{
        .style = .{
            .flex_direction = .row,
            .gap = 10,
        },
        .children = &bottom_children,
    };

    var container_children = [_]Node{ top_row, bottom_row };
    var container = Node{
        .style = .{
            .width = 500,
            .height = 350,
            .flex_direction = .column,
            .padding = 15,
            .gap = 10,
            .background_color = container_bg,
        },
        .children = &container_children,
    };

    // The pixel — still here, dead center, 1x1
    var pixel = Node{
        .style = .{
            .width = 2,
            .height = 2,
            .background_color = accent,
        },
    };

    // ── Main loop ───────────────────────────────────────────────────
    var running = true;
    var win_w: f32 = @floatFromInt(init_w);
    var win_h: f32 = @floatFromInt(init_h);

    while (running) {
        var event: sdl.SDL_Event = undefined;
        while (sdl.SDL_PollEvent(&event) != 0) {
            switch (event.type) {
                sdl.SDL_QUIT => running = false,
                sdl.SDL_WINDOWEVENT => {
                    if (event.window.event == sdl.SDL_WINDOWEVENT_SIZE_CHANGED) {
                        win_w = @floatFromInt(event.window.data1);
                        win_h = @floatFromInt(event.window.data2);
                    }
                },
                sdl.SDL_KEYDOWN => {
                    if (event.key.keysym.sym == sdl.SDLK_ESCAPE) running = false;
                },
                else => {},
            }
        }

        // ── Layout pass ─────────────────────────────────────────────
        // Center the container in the window
        const cx = (win_w - 500) / 2.0;
        const cy = (win_h - 350) / 2.0;
        layout.layout(&container, cx, cy, 500, 350);

        // Position the pixel at dead center
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
