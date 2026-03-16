//! ReactJIT BSOD — Crash screen for the native engine
//!
//! When the watchdog or a panic fires, this opens a new SDL window
//! with the error details rendered as a styled crash report.
//! Stays open until the user presses Escape or clicks Quit.
//!
//! Zig equivalent of lua/bsod.lua — same spirit, zero Love2D.

const std = @import("std");
const c = @import("c.zig").imports;
const layout = @import("layout.zig");
const text_mod = @import("text.zig");
const watchdog = @import("watchdog.zig");
const Node = layout.Node;
const Color = layout.Color;
const TextEngine = text_mod.TextEngine;

/// Show the crash screen. Blocks until the user dismisses it.
/// Call this instead of just exiting — gives the user info about what happened.
pub fn show(reason: []const u8, detail: []const u8) void {
    // Try to create a crash window — if SDL is already dead, just print and bail
    const window = c.SDL_CreateWindow(
        "ReactJIT Crashed",
        c.SDL_WINDOWPOS_CENTERED,
        c.SDL_WINDOWPOS_CENTERED,
        600,
        420,
        c.SDL_WINDOW_SHOWN,
    ) orelse {
        std.debug.print("\n=== CRASH (no window) ===\n{s}\n{s}\n", .{ reason, detail });
        return;
    };
    defer c.SDL_DestroyWindow(window);

    const renderer = c.SDL_CreateRenderer(
        window,
        -1,
        c.SDL_RENDERER_ACCELERATED | c.SDL_RENDERER_PRESENTVSYNC,
    ) orelse {
        std.debug.print("\n=== CRASH (no renderer) ===\n{s}\n{s}\n", .{ reason, detail });
        return;
    };
    defer c.SDL_DestroyRenderer(renderer);
    _ = c.SDL_SetRenderDrawBlendMode(renderer, c.SDL_BLENDMODE_BLEND);

    var te = TextEngine.init(renderer, "fonts/base/DejaVuSans-Regular.ttf") catch
        TextEngine.init(renderer, "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf") catch
        TextEngine.init(renderer, "C:/Windows/Fonts/segoeui.ttf") catch
        TextEngine.init(renderer, "C:/Windows/Fonts/arial.ttf") catch {
        std.debug.print("\n=== CRASH (no font) ===\n{s}\n{s}\n", .{ reason, detail });
        return;
    };
    defer te.deinit();

    // Also print to terminal
    std.debug.print(
        \\
        \\  ╔══════════════════════════════════════════════════╗
        \\  ║  ReactJIT Crashed                                ║
        \\  ╚══════════════════════════════════════════════════╝
        \\
        \\  {s}
        \\  {s}
        \\
        \\  RSS at crash: {d}MB
        \\
    , .{ reason, detail, watchdog.getRssMb() });

    // Colors
    const bg = Color.rgb(15, 10, 20);
    const accent = Color.rgb(217, 51, 64);
    const text_color = Color.rgb(235, 230, 224);
    const dim = Color.rgb(140, 133, 128);
    const bar_bg = Color.rgb(20, 15, 26);
    const green = Color.rgb(76, 204, 102);

    // Build RSS string
    var rss_buf: [64]u8 = undefined;
    const rss_str = std.fmt.bufPrint(&rss_buf, "RSS at crash: {d}MB", .{watchdog.getRssMb()}) catch "RSS: ?";

    // Build timestamp
    // Use a simple frame counter since we don't have libc time formatting
    var time_buf: [32]u8 = undefined;
    const time_str = std.fmt.bufPrint(&time_buf, "Frame {d}", .{watchdog.getRssMb()}) catch "";

    // Crash screen loop
    var running = true;
    while (running) {
        var event: c.SDL_Event = undefined;
        while (c.SDL_PollEvent(&event) != 0) {
            switch (event.type) {
                c.SDL_QUIT => running = false,
                c.SDL_KEYDOWN => {
                    if (event.key.keysym.sym == c.SDLK_ESCAPE or
                        event.key.keysym.sym == c.SDLK_q or
                        event.key.keysym.sym == c.SDLK_RETURN)
                    {
                        running = false;
                    }
                },
                c.SDL_MOUSEBUTTONDOWN => {
                    // Check if click is on the "Quit" button area (bottom-right)
                    const mx = event.button.x;
                    const my = event.button.y;
                    if (my >= 370 and mx >= 500) running = false;
                },
                else => {},
            }
        }

        // ── Draw ────────────────────────────────────────────────
        _ = c.SDL_SetRenderDrawColor(renderer, bg.r, bg.g, bg.b, 255);
        _ = c.SDL_RenderClear(renderer);

        // Accent bar at top
        _ = c.SDL_SetRenderDrawColor(renderer, accent.r, accent.g, accent.b, 255);
        var top_bar = c.SDL_Rect{ .x = 0, .y = 0, .w = 600, .h = 4 };
        _ = c.SDL_RenderFillRect(renderer, &top_bar);

        var y: f32 = 24;

        // Title
        te.drawText("ReactJIT Crashed", 24, y, 22, accent);
        y += 34;

        // RSS
        te.drawText(rss_str, 24, y, 12, dim);
        y += 20;

        // Separator
        _ = c.SDL_SetRenderDrawColor(renderer, accent.r, accent.g, accent.b, 76);
        var sep = c.SDL_Rect{ .x = 24, .y = @intFromFloat(y), .w = 552, .h = 1 };
        _ = c.SDL_RenderFillRect(renderer, &sep);
        y += 12;

        // Reason
        te.drawText("REASON", 24, y, 11, dim);
        y += 18;

        // Reason box
        _ = c.SDL_SetRenderDrawColor(renderer, 25, 20, 32, 255);
        var reason_box = c.SDL_Rect{ .x = 24, .y = @intFromFloat(y), .w = 552, .h = 60 };
        _ = c.SDL_RenderFillRect(renderer, &reason_box);
        te.drawText(reason, 36, y + 12, 16, text_color);
        y += 72;

        // Detail
        te.drawText("DETAIL", 24, y, 11, dim);
        y += 18;

        _ = c.SDL_SetRenderDrawColor(renderer, 25, 20, 32, 255);
        var detail_box = c.SDL_Rect{ .x = 24, .y = @intFromFloat(y), .w = 552, .h = 80 };
        _ = c.SDL_RenderFillRect(renderer, &detail_box);
        te.drawText(detail, 36, y + 12, 13, Color.rgb(192, 140, 128));
        y += 92;

        // Status line
        _ = c.SDL_SetRenderDrawColor(renderer, 25, 20, 32, 255);
        var status_box = c.SDL_Rect{ .x = 24, .y = @intFromFloat(y), .w = 552, .h = 36 };
        _ = c.SDL_RenderFillRect(renderer, &status_box);
        te.drawText("The watchdog caught this before it could damage your system.", 36, y + 10, 12, green);
        y += 48;

        // Bottom bar
        _ = c.SDL_SetRenderDrawColor(renderer, bar_bg.r, bar_bg.g, bar_bg.b, 255);
        var bar = c.SDL_Rect{ .x = 0, .y = 376, .w = 600, .h = 44 };
        _ = c.SDL_RenderFillRect(renderer, &bar);

        // Separator above bar
        _ = c.SDL_SetRenderDrawColor(renderer, accent.r, accent.g, accent.b, 76);
        var bar_sep = c.SDL_Rect{ .x = 0, .y = 376, .w = 600, .h = 1 };
        _ = c.SDL_RenderFillRect(renderer, &bar_sep);

        // Quit button
        _ = c.SDL_SetRenderDrawColor(renderer, 77, 71, 89, 153);
        var quit_btn = c.SDL_Rect{ .x = 510, .y = 384, .w = 66, .h = 28 };
        _ = c.SDL_RenderFillRect(renderer, &quit_btn);
        te.drawText("Quit", 528, 389, 13, dim);

        // Hint
        te.drawText("Press Escape, Q, or Enter to dismiss", 24, 390, 11, dim);

        _ = time_str; // suppress unused
        c.SDL_RenderPresent(renderer);
    }
}
