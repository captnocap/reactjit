//! ReactJIT Engine — Phase 0
//!
//! One pixel. Then a rectangle. Then the world.
//!
//! This is the native runtime that replaces Love2D + LuaJIT.
//! SDL2 window + SDL2 accelerated renderer for Phase 0.
//! Phase 1 replaces SDL_Renderer with raw OpenGL/Vulkan painter.
//! Everything that follows — layout, paint, reconciler — builds on this.

const std = @import("std");
const sdl = @cImport({
    @cInclude("SDL2/SDL.h");
});

// ── Color ───────────────────────────────────────────────────────────────────

const Color = struct {
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

// ── Rect ────────────────────────────────────────────────────────────────────

const Rect = struct {
    x: f32,
    y: f32,
    w: f32,
    h: f32,

    fn toSDL(self: Rect) sdl.SDL_Rect {
        return .{
            .x = @intFromFloat(self.x),
            .y = @intFromFloat(self.y),
            .w = @intFromFloat(self.w),
            .h = @intFromFloat(self.h),
        };
    }
};

// ── Painter (Phase 0 — SDL2 Renderer) ───────────────────────────────────────
// This gets replaced with a real OpenGL/Vulkan painter in Phase 1.
// The interface stays the same: clear, drawRect, present.

const Painter = struct {
    renderer: *sdl.SDL_Renderer,

    pub fn clear(self: *Painter, color: Color) void {
        _ = sdl.SDL_SetRenderDrawColor(self.renderer, color.r, color.g, color.b, color.a);
        _ = sdl.SDL_RenderClear(self.renderer);
    }

    pub fn drawRect(self: *Painter, rect: Rect, color: Color) void {
        _ = sdl.SDL_SetRenderDrawColor(self.renderer, color.r, color.g, color.b, color.a);
        var sdl_rect = rect.toSDL();
        _ = sdl.SDL_RenderFillRect(self.renderer, &sdl_rect);
    }

    pub fn present(self: *Painter) void {
        sdl.SDL_RenderPresent(self.renderer);
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

    // Create window
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

    // Create hardware-accelerated renderer
    const renderer = sdl.SDL_CreateRenderer(
        window,
        -1,
        sdl.SDL_RENDERER_ACCELERATED | sdl.SDL_RENDERER_PRESENTVSYNC,
    ) orelse {
        std.debug.print("SDL_CreateRenderer failed: {s}\n", .{sdl.SDL_GetError()});
        return error.RendererFailed;
    };
    defer sdl.SDL_DestroyRenderer(renderer);

    // Enable alpha blending
    _ = sdl.SDL_SetRenderDrawBlendMode(renderer, sdl.SDL_BLENDMODE_BLEND);

    var painter = Painter{ .renderer = renderer };

    // ── Colors ──────────────────────────────────────────────────────────
    const bg = Color.rgb(24, 24, 32);
    const container = Color.rgb(30, 30, 42);
    const red = Color.rgb(235, 87, 87);
    const blue = Color.rgb(86, 156, 214);
    const green = Color.rgb(78, 201, 176);
    const accent = Color.rgb(255, 121, 198); // the pixel that started it all

    std.debug.print(
        \\
        \\  ┌──────────────────────────────────────┐
        \\  │  ReactJIT Engine — Phase 0            │
        \\  │  One pixel. Then the world.           │
        \\  │                                       │
        \\  │  SDL2 — no Love2D — no LuaJIT         │
        \\  │  no QuickJS — no bridge               │
        \\  │                                       │
        \\  │  Just Zig, all the way down.          │
        \\  └──────────────────────────────────────┘
        \\
        \\
    , .{});

    // ── Main loop ───────────────────────────────────────────────────────
    var running = true;
    var win_w: f32 = @floatFromInt(init_w);
    var win_h: f32 = @floatFromInt(init_h);

    while (running) {
        // Poll events
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
                    if (event.key.keysym.sym == sdl.SDLK_ESCAPE) {
                        running = false;
                    }
                },
                else => {},
            }
        }

        // ── Paint ───────────────────────────────────────────────────────
        painter.clear(bg);

        // A centered container — this is what the layout engine will position
        const cx = win_w / 2.0 - 200.0;
        const cy = win_h / 2.0 - 150.0;
        painter.drawRect(.{ .x = cx, .y = cy, .w = 400, .h = 300 }, container);

        // Three child rects — what a flex row will look like
        const gap: f32 = 15;
        const child_w: f32 = (400.0 - gap * 4.0) / 3.0;
        const child_h: f32 = 300.0 - gap * 2.0;

        painter.drawRect(.{ .x = cx + gap, .y = cy + gap, .w = child_w, .h = child_h }, red);
        painter.drawRect(.{ .x = cx + gap * 2.0 + child_w, .y = cy + gap, .w = child_w, .h = child_h }, blue);
        painter.drawRect(.{ .x = cx + gap * 3.0 + child_w * 2.0, .y = cy + gap, .w = child_w, .h = child_h }, green);

        // The pixel that started it all — 1x1, dead center
        painter.drawRect(.{ .x = win_w / 2.0, .y = win_h / 2.0, .w = 1, .h = 1 }, accent);

        painter.present();
    }

    std.debug.print("Engine shut down cleanly.\n", .{});
}
