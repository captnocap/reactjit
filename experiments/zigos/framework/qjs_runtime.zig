//! QuickJS Runtime — the main loop for <script> mode apps.
//!
//! Provides: SDL2 windowing, QuickJS VM, state bridge, SDL2 painter, telemetry.
//! The generated_app.zig just needs to provide: root node, JS_LOGIC, state init.

const std = @import("std");
const c = @import("c.zig").imports;
const layout = @import("layout.zig");
const text_mod = @import("text.zig");
const state = @import("state.zig");

const Node = layout.Node;
const Color = layout.Color;
const TextEngine = text_mod.TextEngine;

// ── QuickJS C bindings ──────────────────────────────────────────
const qjs = @cImport({
    @cDefine("_GNU_SOURCE", "1");
    @cDefine("QUICKJS_NG_BUILD", "1");
    @cInclude("quickjs.h");
});
const QJS_UNDEFINED = qjs.JSValue{ .u = .{ .int32 = 0 }, .tag = 3 };

var g_qjs_rt: ?*qjs.JSRuntime = null;
var g_qjs_ctx: ?*qjs.JSContext = null;
var g_text_engine: ?*TextEngine = null;

// ── Telemetry (written by the main loop, read by JS host functions) ──
pub var telemetry_fps: u32 = 0;
pub var telemetry_layout_us: u64 = 0;
pub var telemetry_paint_us: u64 = 0;
pub var telemetry_tick_us: u64 = 0;
pub var telemetry_bridge_calls: u64 = 0;
pub var bridge_calls_this_second: u64 = 0;
var bridge_last_reset: i64 = 0;

// ── Host functions ──────────────────────────────────────────────

fn hostSetState(ctx: ?*qjs.JSContext, _: qjs.JSValue, argc: c_int, argv: [*c]qjs.JSValue) callconv(.c) qjs.JSValue {
    if (argc < 2) return QJS_UNDEFINED;
    var slot_id: i32 = 0;
    _ = qjs.JS_ToInt32(ctx, &slot_id, argv[0]);
    if (slot_id < 0 or slot_id >= state.MAX_SLOTS) return QJS_UNDEFINED;
    var f: f64 = 0;
    _ = qjs.JS_ToFloat64(ctx, &f, argv[1]);
    state.setSlot(@intCast(slot_id), @intFromFloat(f));
    bridge_calls_this_second += 1;
    return QJS_UNDEFINED;
}

fn hostSetStateString(ctx: ?*qjs.JSContext, _: qjs.JSValue, argc: c_int, argv: [*c]qjs.JSValue) callconv(.c) qjs.JSValue {
    if (argc < 2) return QJS_UNDEFINED;
    var slot_id: i32 = 0;
    _ = qjs.JS_ToInt32(ctx, &slot_id, argv[0]);
    if (slot_id < 0 or slot_id >= state.MAX_SLOTS) return QJS_UNDEFINED;
    const str = qjs.JS_ToCString(ctx, argv[1]);
    if (str == null) return QJS_UNDEFINED;
    defer qjs.JS_FreeCString(ctx, str);
    state.setSlotString(@intCast(slot_id), std.mem.span(str));
    return QJS_UNDEFINED;
}

fn hostLog(ctx: ?*qjs.JSContext, _: qjs.JSValue, argc: c_int, argv: [*c]qjs.JSValue) callconv(.c) qjs.JSValue {
    if (argc < 2) return QJS_UNDEFINED;
    const msg = qjs.JS_ToCString(ctx, argv[1]);
    if (msg == null) return QJS_UNDEFINED;
    defer qjs.JS_FreeCString(ctx, msg);
    std.log.info("[JS] {s}", .{std.mem.span(msg)});
    return QJS_UNDEFINED;
}

fn hostHeavyCompute(ctx: ?*qjs.JSContext, _: qjs.JSValue, argc: c_int, argv: [*c]qjs.JSValue) callconv(.c) qjs.JSValue {
    if (argc < 1) return qjs.JS_NewFloat64(null, 0);
    var n: i32 = 0;
    _ = qjs.JS_ToInt32(ctx, &n, argv[0]);
    const compute = @extern(*const fn (c_long) callconv(.c) c_long, .{ .name = "heavy_compute" });
    const result = compute(@intCast(n));
    return qjs.JS_NewFloat64(null, @floatFromInt(result));
}

fn hostHeavyComputeTimed(ctx: ?*qjs.JSContext, _: qjs.JSValue, argc: c_int, argv: [*c]qjs.JSValue) callconv(.c) qjs.JSValue {
    if (argc < 1) return qjs.JS_NewFloat64(null, 0);
    var n: i32 = 0;
    _ = qjs.JS_ToInt32(ctx, &n, argv[0]);
    const compute = @extern(*const fn (c_long) callconv(.c) c_long, .{ .name = "heavy_compute_timed" });
    const result = compute(@intCast(n));
    return qjs.JS_NewFloat64(null, @floatFromInt(result));
}

fn hostSetComputeN(ctx: ?*qjs.JSContext, _: qjs.JSValue, argc: c_int, argv: [*c]qjs.JSValue) callconv(.c) qjs.JSValue {
    if (argc < 1) return QJS_UNDEFINED;
    var n: i32 = 0;
    _ = qjs.JS_ToInt32(ctx, &n, argv[0]);
    const setter = @extern(*const fn (c_long) callconv(.c) void, .{ .name = "set_compute_n" });
    setter(@intCast(n));
    return QJS_UNDEFINED;
}

fn hostGetFps(_: ?*qjs.JSContext, _: qjs.JSValue, _: c_int, _: [*c]qjs.JSValue) callconv(.c) qjs.JSValue {
    return qjs.JS_NewFloat64(null, @floatFromInt(telemetry_fps));
}
fn hostGetLayoutUs(_: ?*qjs.JSContext, _: qjs.JSValue, _: c_int, _: [*c]qjs.JSValue) callconv(.c) qjs.JSValue {
    return qjs.JS_NewFloat64(null, @floatFromInt(telemetry_layout_us));
}
fn hostGetPaintUs(_: ?*qjs.JSContext, _: qjs.JSValue, _: c_int, _: [*c]qjs.JSValue) callconv(.c) qjs.JSValue {
    return qjs.JS_NewFloat64(null, @floatFromInt(telemetry_paint_us));
}
fn hostGetTickUs(_: ?*qjs.JSContext, _: qjs.JSValue, _: c_int, _: [*c]qjs.JSValue) callconv(.c) qjs.JSValue {
    return qjs.JS_NewFloat64(null, @floatFromInt(telemetry_tick_us));
}

const polyfill =
    \\globalThis.console = {
    \\  log: function(...args) { __hostLog(0, args.map(String).join(' ')); },
    \\  warn: function(...args) { __hostLog(1, args.map(String).join(' ')); },
    \\  error: function(...args) { __hostLog(2, args.map(String).join(' ')); },
    \\};
    \\globalThis._timers = [];
    \\globalThis._timerIdNext = 1;
    \\globalThis.setTimeout = function(fn, ms) {
    \\  const id = globalThis._timerIdNext++;
    \\  globalThis._timers.push({ id, fn, ms: ms || 0, at: Date.now() + (ms || 0), interval: false });
    \\  return id;
    \\};
    \\globalThis.setInterval = function(fn, ms) {
    \\  const id = globalThis._timerIdNext++;
    \\  globalThis._timers.push({ id, fn, ms: ms || 16, at: Date.now() + (ms || 16), interval: true });
    \\  return id;
    \\};
    \\globalThis.clearTimeout = function(id) {
    \\  globalThis._timers = globalThis._timers.filter(t => t.id !== id);
    \\};
    \\globalThis.clearInterval = globalThis.clearTimeout;
    \\globalThis.__zigOS_tick = function() {
    \\  const now = Date.now();
    \\  const ready = globalThis._timers.filter(t => now >= t.at);
    \\  for (const t of ready) {
    \\    t.fn();
    \\    if (t.interval) { t.at = now + t.ms; }
    \\  }
    \\  globalThis._timers = globalThis._timers.filter(t => t.interval || now < t.at);
    \\};
;

// ── QuickJS lifecycle ───────────────────────────────────────────

pub fn initVM() void {
    const rt = qjs.JS_NewRuntime() orelse return;
    qjs.JS_SetMemoryLimit(rt, 64 * 1024 * 1024);
    qjs.JS_SetMaxStackSize(rt, 1024 * 1024);
    const ctx = qjs.JS_NewContext(rt) orelse {
        qjs.JS_FreeRuntime(rt);
        return;
    };
    g_qjs_rt = rt;
    g_qjs_ctx = ctx;

    const global = qjs.JS_GetGlobalObject(ctx);
    defer qjs.JS_FreeValue(ctx, global);
    _ = qjs.JS_SetPropertyStr(ctx, global, "__setState", qjs.JS_NewCFunction(ctx, hostSetState, "__setState", 2));
    _ = qjs.JS_SetPropertyStr(ctx, global, "__setStateString", qjs.JS_NewCFunction(ctx, hostSetStateString, "__setStateString", 2));
    _ = qjs.JS_SetPropertyStr(ctx, global, "__hostLog", qjs.JS_NewCFunction(ctx, hostLog, "__hostLog", 2));
    _ = qjs.JS_SetPropertyStr(ctx, global, "getFps", qjs.JS_NewCFunction(ctx, hostGetFps, "getFps", 0));
    _ = qjs.JS_SetPropertyStr(ctx, global, "getLayoutUs", qjs.JS_NewCFunction(ctx, hostGetLayoutUs, "getLayoutUs", 0));
    _ = qjs.JS_SetPropertyStr(ctx, global, "getPaintUs", qjs.JS_NewCFunction(ctx, hostGetPaintUs, "getPaintUs", 0));
    _ = qjs.JS_SetPropertyStr(ctx, global, "getTickUs", qjs.JS_NewCFunction(ctx, hostGetTickUs, "getTickUs", 0));
    _ = qjs.JS_SetPropertyStr(ctx, global, "heavy_compute", qjs.JS_NewCFunction(ctx, hostHeavyCompute, "heavy_compute", 1));
    _ = qjs.JS_SetPropertyStr(ctx, global, "heavy_compute_timed", qjs.JS_NewCFunction(ctx, hostHeavyComputeTimed, "heavy_compute_timed", 1));
    _ = qjs.JS_SetPropertyStr(ctx, global, "set_compute_n", qjs.JS_NewCFunction(ctx, hostSetComputeN, "set_compute_n", 1));

    const val = qjs.JS_Eval(ctx, polyfill.ptr, polyfill.len, "<polyfill>", qjs.JS_EVAL_TYPE_GLOBAL);
    qjs.JS_FreeValue(ctx, val);
}

/// Register a native function on the JS global object. Call after initVM, before evalScript.
/// Accepts a raw function pointer to avoid @cImport type conflicts between compilation units.
pub fn registerHostFn(name: [*:0]const u8, func: *const anyopaque, argc: c_int) void {
    if (g_qjs_ctx) |ctx| {
        const global = qjs.JS_GetGlobalObject(ctx);
        defer qjs.JS_FreeValue(ctx, global);
        // JSCFunction is ?*const fn(...) — cast raw pointer through the inner type
        const FnType = @typeInfo(@TypeOf(qjs.JS_NewCFunction)).@"fn".params[1].type.?;
        const qjs_fn: FnType = @ptrCast(func);
        _ = qjs.JS_SetPropertyStr(ctx, global, name, qjs.JS_NewCFunction(ctx, qjs_fn, name, argc));
    }
}

/// Eval the app's JS logic. Call after initVM and any registerHostFn calls.
pub fn evalScript(js_logic: []const u8) void {
    if (g_qjs_ctx) |ctx| {
        const val = qjs.JS_Eval(ctx, js_logic.ptr, js_logic.len, "<app>", qjs.JS_EVAL_TYPE_GLOBAL);
        if (qjs.JS_IsException(val)) {
            const exc = qjs.JS_GetException(ctx);
            const s = qjs.JS_ToCString(ctx, exc);
            if (s != null) {
                std.log.err("[JS] {s}", .{std.mem.span(s)});
                qjs.JS_FreeCString(ctx, s);
            }
            qjs.JS_FreeValue(ctx, exc);
        }
        qjs.JS_FreeValue(ctx, val);
    }
}

pub fn tick() void {
    if (g_qjs_ctx) |ctx| {
        const global = qjs.JS_GetGlobalObject(ctx);
        defer qjs.JS_FreeValue(ctx, global);
        const tick_fn = qjs.JS_GetPropertyStr(ctx, global, "__zigOS_tick");
        defer qjs.JS_FreeValue(ctx, tick_fn);
        if (!qjs.JS_IsUndefined(tick_fn)) {
            const r = qjs.JS_Call(ctx, tick_fn, global, 0, null);
            qjs.JS_FreeValue(ctx, r);
        }
        if (g_qjs_rt) |rt| {
            var ctx2: ?*qjs.JSContext = null;
            while (qjs.JS_ExecutePendingJob(rt, &ctx2) > 0) {}
        }
    }
}

pub fn deinit() void {
    if (g_qjs_ctx) |ctx| qjs.JS_FreeContext(ctx);
    if (g_qjs_rt) |rt| qjs.JS_FreeRuntime(rt);
}

// ── SDL2 painter ────────────────────────────────────────────────

pub fn paintNode(renderer: *c.SDL_Renderer, te: *TextEngine, node: *Node) void {
    if (node.style.display == .none) return;
    const r = node.computed;
    if (r.w <= 0 or r.h <= 0) return;
    if (node.style.background_color) |bg| {
        if (bg.a > 0) {
            _ = c.SDL_SetRenderDrawColor(renderer, bg.r, bg.g, bg.b, bg.a);
            var rect = c.SDL_Rect{
                .x = @intFromFloat(r.x),
                .y = @intFromFloat(r.y),
                .w = @intFromFloat(r.w),
                .h = @intFromFloat(r.h),
            };
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

// ── Main loop ───────────────────────────────────────────────────

fn measureCallback(t: []const u8, fs: u16, mw: f32, ls: f32, lh: f32, ml: u16, nw: bool) layout.TextMetrics {
    if (g_text_engine) |te| return te.measureTextWrappedEx(t, fs, mw, ls, lh, ml, nw);
    return .{};
}
fn measureImageCallback(_: []const u8) layout.ImageDims {
    return .{};
}

pub fn run(root: *Node, js_logic: []const u8, initState: *const fn () void, updateTexts: *const fn () void) !void {
    if (c.SDL_Init(c.SDL_INIT_VIDEO) != 0) return error.SDLInitFailed;
    defer c.SDL_Quit();

    const window = c.SDL_CreateWindow("tsz app", c.SDL_WINDOWPOS_CENTERED, c.SDL_WINDOWPOS_CENTERED, 1280, 800, c.SDL_WINDOW_SHOWN | c.SDL_WINDOW_RESIZABLE) orelse return error.WindowCreateFailed;
    defer c.SDL_DestroyWindow(window);

    const renderer = c.SDL_CreateRenderer(window, -1, c.SDL_RENDERER_ACCELERATED | c.SDL_RENDERER_PRESENTVSYNC) orelse return error.RendererFailed;
    defer c.SDL_DestroyRenderer(renderer);
    _ = c.SDL_SetRenderDrawBlendMode(renderer, c.SDL_BLENDMODE_BLEND);

    var text_engine = TextEngine.init(renderer, "fonts/base/DejaVuSans-Regular.ttf") catch
        TextEngine.init(renderer, "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf") catch
        TextEngine.init(renderer, "/System/Library/Fonts/Supplemental/Arial.ttf") catch
        TextEngine.init(renderer, "C:/Windows/Fonts/segoeui.ttf") catch
        return error.FontNotFound;
    defer text_engine.deinit();

    g_text_engine = &text_engine;
    layout.setMeasureFn(measureCallback);
    layout.setMeasureImageFn(measureImageCallback);
    var win_w: f32 = 1280;
    var win_h: f32 = 800;

    initState();
    initVM(js_logic);
    defer deinit();
    updateTexts();

    var running = true;
    var fps_frames: u32 = 0;
    var fps_last: u32 = c.SDL_GetTicks();
    var fps_display: u32 = 0;
    var tick_us: u64 = 0;
    var layout_us: u64 = 0;
    var paint_us: u64 = 0;

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
        tick();
        const t1 = std.time.microTimestamp();
        tick_us = @intCast(@max(0, t1 - t0));

        if (state.isDirty()) {
            updateTexts();
            state.clearDirty();
        }

        _ = c.SDL_SetRenderDrawColor(renderer, 13, 17, 23, 255);
        _ = c.SDL_RenderClear(renderer);

        const t2 = std.time.microTimestamp();
        layout.layout(root, 0, 0, win_w, win_h);
        const t3 = std.time.microTimestamp();
        layout_us = @intCast(@max(0, t3 - t2));

        const t4 = std.time.microTimestamp();
        paintNode(renderer, &text_engine, root);
        const t5 = std.time.microTimestamp();
        paint_us = @intCast(@max(0, t5 - t4));

        // Telemetry bar
        {
            const bar_y = win_h - 24;
            _ = c.SDL_SetRenderDrawColor(renderer, 0, 0, 0, 200);
            var bar_rect = c.SDL_Rect{ .x = 0, .y = @intFromFloat(bar_y), .w = @intFromFloat(win_w), .h = 24 };
            _ = c.SDL_RenderFillRect(renderer, &bar_rect);
            var tbuf: [256]u8 = undefined;
            const tstr = std.fmt.bufPrint(&tbuf, "FPS: {d}  |  tick: {d}us  layout: {d}us  paint: {d}us", .{
                fps_display, tick_us, layout_us, paint_us,
            }) catch "???";
            text_engine.drawText(tstr, 8, bar_y + 4, 13, Color.rgb(180, 220, 180));
        }

        c.SDL_RenderPresent(renderer);

        fps_frames += 1;
        const now = c.SDL_GetTicks();
        if (now - fps_last >= 1000) {
            fps_display = fps_frames;
            fps_frames = 0;
            fps_last = now;
        }
    }
}
