//! BSOD binary entry point — reads crash data from /tmp, renders the crash screen.
//!
//! This is the main() for tsz-bsod. It:
//! 1. Reads /tmp/reactjit-crash-* files written by watchdog
//! 2. Inits SDL2 + wgpu + text engine (fresh process, no shared state)
//! 3. Populates bsod.gen.zig state slots with the crash data
//! 4. Runs the layout + compositor render loop

const std = @import("std");
const c = @import("c.zig").imports;
const layout = @import("layout.zig");
const text_mod = @import("text.zig");
const gpu = @import("gpu.zig");
const compositor = @import("compositor.zig");
const state = @import("state.zig");
const bsod_ui = @import("bsod.gen.zig");
const events = @import("events.zig");
const Color = layout.Color;
const Node = layout.Node;
const TextEngine = text_mod.TextEngine;

var g_text_engine: ?*TextEngine = null;

fn measureCallback(t: []const u8, font_size: u16, max_width: f32, letter_spacing: f32, line_height: f32, max_lines: u16, no_wrap: bool) layout.TextMetrics {
    if (g_text_engine) |te| {
        return te.measureTextWrappedEx(t, font_size, max_width, letter_spacing, line_height, max_lines, no_wrap);
    }
    return .{};
}

fn readCrashFile(path: []const u8, buf: []u8) []const u8 {
    const file = std.fs.openFileAbsolute(path, .{}) catch return "";
    defer file.close();
    const n = file.readAll(buf) catch return "";
    return buf[0..n];
}

pub fn main() !void {
    if (c.SDL_Init(c.SDL_INIT_VIDEO) != 0) return error.SDLInitFailed;
    defer c.SDL_Quit();

    const window = c.SDL_CreateWindow(
        "ReactJIT Crashed",
        c.SDL_WINDOWPOS_CENTERED,
        c.SDL_WINDOWPOS_CENTERED,
        620,
        560,
        c.SDL_WINDOW_SHOWN | c.SDL_WINDOW_RESIZABLE,
    ) orelse return error.WindowCreateFailed;
    defer c.SDL_DestroyWindow(window);
    c.SDL_SetWindowMinimumSize(window, 400, 300);

    const renderer = c.SDL_CreateRenderer(
        window,
        -1,
        c.SDL_RENDERER_ACCELERATED | c.SDL_RENDERER_PRESENTVSYNC,
    ) orelse return error.RendererFailed;
    defer c.SDL_DestroyRenderer(renderer);
    _ = c.SDL_SetRenderDrawBlendMode(renderer, c.SDL_BLENDMODE_BLEND);

    var te = TextEngine.init(renderer, "fonts/base/DejaVuSans-Regular.ttf") catch
        TextEngine.init(renderer, "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf") catch
        TextEngine.init(renderer, "C:/Windows/Fonts/segoeui.ttf") catch
        TextEngine.init(renderer, "C:/Windows/Fonts/arial.ttf") catch
        return error.FontNotFound;
    defer te.deinit();

    g_text_engine = &te;
    layout.setMeasureFn(measureCallback);

    // Init GPU
    gpu.init(window) catch return error.GpuInitFailed;
    gpu.initText(te.library, te.face, te.fallback_faces, te.fallback_count);

    // Init compositor
    compositor.init(renderer, &te, undefined);

    // Create state slots: 1 int (copied) + 11 strings
    _ = state.createSlot(0); // slot 0: copied
    _ = state.createSlotString(""); // slot 1: reason
    _ = state.createSlotString(""); // slot 2: detail
    _ = state.createSlotString(""); // slot 3: rss
    _ = state.createSlotString(""); // slot 4: pid
    _ = state.createSlotString(""); // slot 5: uptime
    _ = state.createSlotString(""); // slot 6: appName
    _ = state.createSlotString(""); // slot 7: timestamp
    _ = state.createSlotString(""); // slot 8: stackTrace
    _ = state.createSlotString(""); // slot 9: peakRss
    _ = state.createSlotString(""); // slot 10: leakRate
    _ = state.createSlotString(""); // slot 11: frames

    // Init BSOD UI module (sets default values into slots)
    bsod_ui.init(0);

    // Read crash data from /tmp
    var reason_buf: [256]u8 = undefined;
    var detail_buf: [512]u8 = undefined;
    var rss_buf: [32]u8 = undefined;
    var pid_buf: [16]u8 = undefined;
    var uptime_buf: [32]u8 = undefined;
    var frames_buf: [16]u8 = undefined;
    var peak_rss_buf: [32]u8 = undefined;
    var rate_buf: [32]u8 = undefined;

    const crash_reason = readCrashFile("/tmp/reactjit-crash-reason", &reason_buf);
    const crash_detail = readCrashFile("/tmp/reactjit-crash-detail", &detail_buf);
    const crash_rss = readCrashFile("/tmp/reactjit-crash-rss", &rss_buf);
    const crash_pid = readCrashFile("/tmp/reactjit-crash-pid", &pid_buf);
    const crash_uptime = readCrashFile("/tmp/reactjit-crash-uptime", &uptime_buf);
    const crash_frames = readCrashFile("/tmp/reactjit-crash-frames", &frames_buf);
    const crash_peak = readCrashFile("/tmp/reactjit-crash-peak-rss", &peak_rss_buf);
    const crash_rate = readCrashFile("/tmp/reactjit-crash-leak-rate", &rate_buf);

    // Populate state slots
    if (crash_reason.len > 0) bsod_ui.setReason(crash_reason);
    if (crash_detail.len > 0) bsod_ui.setDetail(crash_detail);
    if (crash_rss.len > 0) bsod_ui.setRss(crash_rss);
    if (crash_pid.len > 0) bsod_ui.setPid(crash_pid);
    if (crash_uptime.len > 0) bsod_ui.setUptime(crash_uptime);
    if (crash_frames.len > 0) bsod_ui.setFrames(crash_frames);
    if (crash_peak.len > 0) bsod_ui.setPeakRss(crash_peak);
    if (crash_rate.len > 0) bsod_ui.setLeakRate(crash_rate);

    // Timestamp — use current time
    var ts_buf: [32]u8 = undefined;
    const epoch = std.time.timestamp();
    const ts_str = std.fmt.bufPrint(&ts_buf, "epoch:{d}", .{epoch}) catch "";
    if (ts_str.len > 0) bsod_ui.setTimestamp(ts_str);

    // Force immediate update of dynamic texts
    bsod_ui.tick();
    std.debug.print("[bsod] Loaded crash data: reason={s} rss={s} pid={s}\n", .{ crash_reason, crash_rss, crash_pid });

    var win_w: f32 = 620;
    var win_h: f32 = 560;

    // Render loop
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
                c.SDL_WINDOWEVENT => {
                    if (event.window.event == c.SDL_WINDOWEVENT_SIZE_CHANGED) {
                        win_w = @floatFromInt(event.window.data1);
                        win_h = @floatFromInt(event.window.data2);
                        gpu.resize(@intCast(event.window.data1), @intCast(event.window.data2));
                    }
                },
                c.SDL_MOUSEBUTTONDOWN => {
                    const mx: f32 = @floatFromInt(event.button.x);
                    const my: f32 = @floatFromInt(event.button.y);
                    const root = bsod_ui.getRoot();
                    if (events.hitTest(root, mx, my)) |node| {
                        if (node.handlers.on_press) |handler| handler();
                    }
                },
                c.SDL_MOUSEWHEEL => {
                    var mx_i: c_int = undefined;
                    var my_i: c_int = undefined;
                    _ = c.SDL_GetMouseState(&mx_i, &my_i);
                    const mx: f32 = @floatFromInt(mx_i);
                    const my: f32 = @floatFromInt(my_i);
                    const root = bsod_ui.getRoot();
                    if (events.findScrollContainer(root, mx, my)) |scroll_node| {
                        scroll_node.scroll_y -= @as(f32, @floatFromInt(event.wheel.y)) * 30.0;
                        const max_scroll = @max(0.0, scroll_node.content_height - scroll_node.computed.h);
                        scroll_node.scroll_y = @max(0.0, @min(scroll_node.scroll_y, max_scroll));
                    }
                },
                else => {},
            }
        }

        bsod_ui.tick();
        const root = bsod_ui.getRoot();
        layout.layout(root, 0, 0, win_w, win_h);
        compositor.frame(root, win_w, win_h, Color.rgb(15, 10, 20));
    }
}
