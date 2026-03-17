//! ZigOS — TSZ-compiled dashboard + QuickJS logic
//!
//! The UI comes from Dashboard.tsz (compiled to dashboard.gen.zig).
//! The logic comes from logic_tsz.js (runs in QuickJS).
//! QuickJS writes state.setSlot() → TSZ fragment reads state.getSlot().
//! Zero JSON. Zero tree rebuild. Static node arrays, dirty-checked text updates.

const std = @import("std");
const c = @import("framework/c.zig").imports;
const layout = @import("framework/layout.zig");
const text_mod = @import("framework/text.zig");
const state = @import("framework/state.zig");
const qjs_mod = @import("src/qjs.zig");
const dashboard = @import("dashboard.gen.zig");

const Node = layout.Node;
const Color = layout.Color;
const TextEngine = text_mod.TextEngine;

var g_text_engine: ?*TextEngine = null;

fn measureCb(t: []const u8, fs: u16, mw: f32, ls: f32, lh: f32, ml: u16, nw: bool) layout.TextMetrics {
    if (g_text_engine) |te| return te.measureTextWrappedEx(t, fs, mw, ls, lh, ml, nw);
    return .{};
}
fn measureImgCb(_: []const u8) layout.ImageDims { return .{}; }

// ── QuickJS host functions that write to state.zig slots ────────

const qjs = qjs_mod.c;
const JSValue = qjs_mod.JSValue;
const JS_UNDEFINED = qjs_mod.JS_UNDEFINED;

var g_slot_base: usize = 0;

fn hostSetState(ctx: ?*qjs_mod.JSContext, this: JSValue, argc: c_int, argv: [*c]JSValue) callconv(.c) JSValue {
    _ = this;
    if (argc < 2) return JS_UNDEFINED;
    var slot_id: i32 = 0;
    _ = qjs.JS_ToInt32(ctx, &slot_id, argv[0]);
    if (slot_id < 0 or slot_id >= @as(i32, @intCast(dashboard.SLOT_COUNT))) return JS_UNDEFINED;
    var f: f64 = 0;
    _ = qjs.JS_ToFloat64(ctx, &f, argv[1]);
    state.setSlot(g_slot_base + @as(usize, @intCast(slot_id)), @intFromFloat(f));
    return JS_UNDEFINED;
}

fn hostSetStateString(ctx: ?*qjs_mod.JSContext, this: JSValue, argc: c_int, argv: [*c]JSValue) callconv(.c) JSValue {
    _ = this;
    if (argc < 2) return JS_UNDEFINED;
    var slot_id: i32 = 0;
    _ = qjs.JS_ToInt32(ctx, &slot_id, argv[0]);
    if (slot_id < 0 or slot_id >= @as(i32, @intCast(dashboard.SLOT_COUNT))) return JS_UNDEFINED;
    const str = qjs.JS_ToCString(ctx, argv[1]);
    if (str == null) return JS_UNDEFINED;
    defer qjs.JS_FreeCString(ctx, str);
    state.setSlotString(g_slot_base + @as(usize, @intCast(slot_id)), std.mem.span(str));
    return JS_UNDEFINED;
}

fn hostLog(ctx: ?*qjs_mod.JSContext, this: JSValue, argc: c_int, argv: [*c]JSValue) callconv(.c) JSValue {
    _ = this;
    if (argc < 2) return JS_UNDEFINED;
    var level: i32 = 0;
    _ = qjs.JS_ToInt32(ctx, &level, argv[0]);
    const msg = qjs.JS_ToCString(ctx, argv[1]);
    if (msg == null) return JS_UNDEFINED;
    defer qjs.JS_FreeCString(ctx, msg);
    std.log.info("[JS] {s}", .{std.mem.span(msg)});
    return JS_UNDEFINED;
}

// ── Painter ──────────────────────────────────────────────────────

fn paintNode(renderer: *c.SDL_Renderer, te: *TextEngine, node: *Node) void {
    if (node.style.display == .none) return;
    const r = node.computed;
    if (r.w <= 0 or r.h <= 0) return;
    if (node.style.background_color) |bg| {
        if (bg.a > 0) {
            _ = c.SDL_SetRenderDrawColor(renderer, bg.r, bg.g, bg.b, bg.a);
            var rect = c.SDL_Rect{ .x = @intFromFloat(r.x), .y = @intFromFloat(r.y), .w = @intFromFloat(r.w), .h = @intFromFloat(r.h) };
            _ = c.SDL_RenderFillRect(renderer, &rect);
        }
    }
    if (node.text) |t| {
        if (t.len > 0) {
            const tc = node.text_color orelse Color.rgb(255, 255, 255);
            const pl = node.style.padLeft();
            const pt = node.style.padTop();
            const pr = node.style.padRight();
            te.drawTextWrapped(t, r.x + pl, r.y + pt, node.font_size, @max(1.0, r.w - pl - pr), tc);
        }
    }
    for (node.children) |*child| paintNode(renderer, te, child);
}

// ── Main ─────────────────────────────────────────────────────────

pub fn main() !void {
    var gpa = std.heap.GeneralPurposeAllocator(.{}){};
    defer _ = gpa.deinit();
    const alloc = gpa.allocator();

    const args = try std.process.argsAlloc(alloc);
    defer std.process.argsFree(alloc, args);
    const cart_path = if (args.len > 1) args[1] else "carts/dashboard/logic_tsz.js";

    const js_source = std.fs.cwd().readFileAlloc(alloc, cart_path, 1024 * 1024) catch |err| {
        std.log.err("Failed to read: {s} ({any})", .{ cart_path, err });
        return err;
    };
    defer alloc.free(js_source);

    if (c.SDL_Init(c.SDL_INIT_VIDEO) != 0) return error.SDLInitFailed;
    defer c.SDL_Quit();

    const window = c.SDL_CreateWindow("ZigOS TSZ Dashboard", c.SDL_WINDOWPOS_CENTERED, c.SDL_WINDOWPOS_CENTERED, 1100, 800, c.SDL_WINDOW_SHOWN | c.SDL_WINDOW_RESIZABLE) orelse return error.WindowCreateFailed;
    defer c.SDL_DestroyWindow(window);

    const renderer = c.SDL_CreateRenderer(window, -1, c.SDL_RENDERER_ACCELERATED | c.SDL_RENDERER_PRESENTVSYNC) orelse return error.RendererFailed;
    defer c.SDL_DestroyRenderer(renderer);
    _ = c.SDL_SetRenderDrawBlendMode(renderer, c.SDL_BLENDMODE_BLEND);

    var text_engine = TextEngine.init(renderer, "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf") catch
        TextEngine.init(renderer, "/System/Library/Fonts/Supplemental/Arial.ttf") catch
        return error.FontNotFound;
    defer text_engine.deinit();

    g_text_engine = &text_engine;
    layout.setMeasureFn(measureCb);
    layout.setMeasureImageFn(measureImgCb);

    // Init TSZ state + dashboard fragment
    g_slot_base = state.reserveSlots(dashboard.SLOT_COUNT);
    dashboard.init(g_slot_base);

    // Init QuickJS
    var vm = try qjs_mod.VM.init(alloc);
    defer vm.deinit();
    vm.bind();

    // Register host functions that write directly to state.zig
    {
        const global = qjs.JS_GetGlobalObject(vm.ctx);
        defer qjs.JS_FreeValue(vm.ctx, global);
        _ = qjs.JS_SetPropertyStr(vm.ctx, global, "__setState", qjs.JS_NewCFunction(vm.ctx, hostSetState, "__setState", 2));
        _ = qjs.JS_SetPropertyStr(vm.ctx, global, "__setStateString", qjs.JS_NewCFunction(vm.ctx, hostSetStateString, "__setStateString", 2));
        _ = qjs.JS_SetPropertyStr(vm.ctx, global, "__hostLog", qjs.JS_NewCFunction(vm.ctx, hostLog, "__hostLog", 2));
    }

    std.log.info("Loading: {s}", .{cart_path});
    vm.eval(js_source, cart_path) catch {
        std.log.err("Cartridge failed to load", .{});
        return error.CartridgeLoadFailed;
    };

    var win_w: f32 = 1100;
    var win_h: f32 = 800;
    var running = true;
    var fps_frames: u32 = 0;
    var fps_last_tick: u32 = c.SDL_GetTicks();
    var fps_display: u32 = 0;
    var tick_us: u64 = 0;
    var layout_us: u64 = 0;
    var paint_us: u64 = 0;
    var title_buf: [256]u8 = undefined;

    const log_file = std.fs.cwd().createFile("telemetry.csv", .{}) catch null;
    defer if (log_file) |f| f.close();
    if (log_file) |f| f.writeAll("time_s,fps,tick_us,layout_us,paint_us,rss_kb\n") catch {};
    var log_time: u32 = 0;

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

        const t0 = std.time.microTimestamp();
        vm.tick();
        const t1 = std.time.microTimestamp();
        tick_us = @intCast(@max(0, t1 - t0));

        // TSZ fragment: check dirty slots, update only changed text
        dashboard.tick();
        state.clearDirty();

        _ = c.SDL_SetRenderDrawColor(renderer, 13, 17, 23, 255);
        _ = c.SDL_RenderClear(renderer);

        const t2 = std.time.microTimestamp();
        layout.layout(&dashboard.root, 0, 0, win_w, win_h);
        const t3 = std.time.microTimestamp();
        layout_us = @intCast(@max(0, t3 - t2));

        const t4 = std.time.microTimestamp();
        paintNode(renderer, &text_engine, &dashboard.root);
        const t5 = std.time.microTimestamp();
        paint_us = @intCast(@max(0, t5 - t4));

        // Telemetry bar
        {
            const bar_y = win_h - 24;
            _ = c.SDL_SetRenderDrawColor(renderer, 0, 0, 0, 200);
            var bar_rect = c.SDL_Rect{ .x = 0, .y = @intFromFloat(bar_y), .w = @intFromFloat(win_w), .h = 24 };
            _ = c.SDL_RenderFillRect(renderer, &bar_rect);
            const rss = readRssKb();
            var buf: [512]u8 = undefined;
            const str = std.fmt.bufPrint(&buf, "FPS: {d}  |  tick: {d}us  layout: {d}us  paint: {d}us  |  RSS: {d}KB  (TSZ compiled)", .{
                fps_display, tick_us, layout_us, paint_us, rss,
            }) catch "???";
            text_engine.drawText(str, 8, bar_y + 4, 13, Color.rgb(180, 220, 180));
        }

        c.SDL_RenderPresent(renderer);

        fps_frames += 1;
        const now = c.SDL_GetTicks();
        if (now - fps_last_tick >= 1000) {
            fps_display = fps_frames;
            fps_frames = 0;
            fps_last_tick = now;
            const rss = readRssKb();
            const t = std.fmt.bufPrint(&title_buf, "ZigOS TSZ Dashboard - {d} FPS  {d}KB\x00", .{ fps_display, rss }) catch "ZigOS\x00";
            c.SDL_SetWindowTitle(window, t.ptr);
            if (log_file) |f| {
                var csv_buf: [128]u8 = undefined;
                const csv = std.fmt.bufPrint(&csv_buf, "{d},{d},{d},{d},{d},{d}\n", .{ log_time, fps_display, tick_us, layout_us, paint_us, rss }) catch "";
                f.writeAll(csv) catch {};
                log_time += 1;
            }
        }
    }
}

fn readRssKb() u64 {
    var buf: [128]u8 = undefined;
    const f = std.fs.openFileAbsolute("/proc/self/statm", .{}) catch return 0;
    defer f.close();
    const n = f.readAll(&buf) catch return 0;
    var iter = std.mem.splitScalar(u8, buf[0..n], ' ');
    _ = iter.next();
    const r = iter.next() orelse return 0;
    return (std.fmt.parseInt(u64, r, 10) catch 0) * 4;
}
