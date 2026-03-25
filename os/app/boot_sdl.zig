//! CartridgeOS boot screen — SDL3 software renderer, no wgpu
//! Just draws pixels on KMS/DRM to prove the pipeline.

const c = @cImport({
    @cInclude("SDL3/SDL.h");
});

pub fn main() !void {
    if (!c.SDL_Init(c.SDL_INIT_VIDEO)) {
        const err = c.SDL_GetError();
        _ = c.SDL_Log("SDL_Init failed: %s", err);
        return error.SDLInitFailed;
    }
    defer c.SDL_Quit();

    const window = c.SDL_CreateWindow("CartridgeOS", 1280, 800, 0) orelse {
        _ = c.SDL_Log("CreateWindow failed: %s", c.SDL_GetError());
        return error.WindowFailed;
    };
    defer c.SDL_DestroyWindow(window);

    const renderer = c.SDL_CreateRenderer(window, null) orelse {
        _ = c.SDL_Log("CreateRenderer failed: %s", c.SDL_GetError());
        return error.RendererFailed;
    };
    defer c.SDL_DestroyRenderer(renderer);

    var running = true;
    var frame: u32 = 0;
    while (running) {
        var event: c.SDL_Event = undefined;
        while (c.SDL_PollEvent(&event)) {
            if (event.type == c.SDL_EVENT_QUIT) running = false;
            if (event.type == c.SDL_EVENT_KEY_DOWN) {
                if (event.key.scancode == c.SDL_SCANCODE_ESCAPE) running = false;
            }
        }

        // Background
        _ = c.SDL_SetRenderDrawColor(renderer, 10, 10, 26, 255);
        _ = c.SDL_RenderClear(renderer);

        // Purple accent bar
        const bar = c.SDL_FRect{ .x = 440, .y = 340, .w = 400, .h = 4 };
        _ = c.SDL_SetRenderDrawColor(renderer, 124, 92, 252, 255);
        _ = c.SDL_RenderFillRect(renderer, &bar);

        // Animated loading bar
        const progress: f32 = @as(f32, @floatFromInt(frame % 120)) / 120.0;
        const loading = c.SDL_FRect{ .x = 440, .y = 360, .w = 400 * progress, .h = 2 };
        _ = c.SDL_SetRenderDrawColor(renderer, 124, 92, 252, 180);
        _ = c.SDL_RenderFillRect(renderer, &loading);

        // Center box
        const box = c.SDL_FRect{ .x = 540, .y = 300, .w = 200, .h = 80 };
        _ = c.SDL_SetRenderDrawColor(renderer, 20, 20, 50, 255);
        _ = c.SDL_RenderFillRect(renderer, &box);

        _ = c.SDL_RenderPresent(renderer);
        c.SDL_Delay(16);
        frame += 1;
    }
}
