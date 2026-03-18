//! ZigOS Engine — owns the window lifecycle, GPU, text, layout, paint, and event loop.
//!
//! The generated app provides a node tree + callbacks. The engine handles everything else.
//! Adding new framework modules (geometry, watchdog, etc.) happens here — no codegen changes needed.

const std = @import("std");
const c = @import("c.zig").imports;
const layout = @import("layout.zig");
const text_mod = @import("text.zig");
const gpu = @import("gpu.zig");
const qjs_runtime = @import("qjs_runtime.zig");
const geometry = @import("geometry.zig");
const selection = @import("selection.zig");
const breakpoint = @import("breakpoint.zig");
const windows = @import("windows.zig");
const canvas = @import("canvas.zig");
const log = @import("log.zig");
const tooltip = @import("tooltip.zig");

const input = @import("input.zig");
const Node = layout.Node;
const Color = layout.Color;
const TextEngine = text_mod.TextEngine;

// ── Cursor blink state ───────────────────────────────────────────────────
var g_cursor_visible: bool = true;
var g_prev_tick: u32 = 0;

// ── Hover state ─────────────────────────────────────────────────────────

var hovered_node: ?*Node = null;

fn updateHover(root: *Node, mx: f32, my: f32) void {
    const events = @import("events.zig");
    const hit = events.hitTestHoverable(root, mx, my);
    if (hit == hovered_node) return;

    // Exit previous
    if (hovered_node) |prev| {
        if (prev.handlers.on_hover_exit) |handler| handler();
    }
    hovered_node = hit;
    // Enter new
    if (hit) |node| {
        if (node.handlers.on_hover_enter) |handler| handler();
        // Tooltip: show if node carries tooltip text
        if (node.tooltip) |tt| {
            const r = node.computed;
            tooltip.show(tt, r.x, r.y, r.w, r.h);
        } else {
            tooltip.hide();
        }
    } else {
        tooltip.hide();
    }
}

fn brighten(color: Color, amount: u8) Color {
    return .{
        .r = @min(255, @as(u16, color.r) + amount),
        .g = @min(255, @as(u16, color.g) + amount),
        .b = @min(255, @as(u16, color.b) + amount),
        .a = color.a,
    };
}

// ── App interface ────────────────────────────────────────────────────────

pub const AppConfig = struct {
    title: [*:0]const u8 = "zigos app",
    width: u32 = 1280,
    height: u32 = 800,
    root: *Node,
    js_logic: []const u8 = "",
    /// Called once after QuickJS VM is ready. Register FFI host functions, set initial state.
    init: ?*const fn () void = null,
    /// Called every frame before layout. Do FFI polling, state dirty checks, dynamic text updates.
    tick: ?*const fn (now_ms: u32) void = null,
};

// ── Text measurement (framework-owned) ──────────────────────────────────

var g_text_engine: ?*TextEngine = null;

fn measureCallback(t: []const u8, font_size: u16, max_width: f32, letter_spacing: f32, line_height: f32, max_lines: u16, no_wrap: bool) layout.TextMetrics {
    if (g_text_engine) |te| {
        return te.measureTextWrappedEx(t, font_size, max_width, letter_spacing, line_height, max_lines, no_wrap);
    }
    return .{};
}

fn measureImageCallback(_: []const u8) layout.ImageDims {
    return .{};
}

// ── Node painting (framework-owned) ─────────────────────────────────────

fn offsetDescendants(node: *Node, dy: f32) void {
    for (node.children) |*child| {
        child.computed.y += dy;
        offsetDescendants(child, dy);
    }
}

var g_paint_count: u32 = 0;
var g_hidden_count: u32 = 0;
var g_zero_count: u32 = 0;

// Canvas drag state — tracks which canvas is being dragged for pan
var canvas_drag_node: ?*Node = null;
var canvas_drag_last_x: f32 = 0;
var canvas_drag_last_y: f32 = 0;

fn paintNode(node: *Node) void {
    if (node.style.display == .none) { g_hidden_count += 1; return; }
    g_paint_count += 1;
    const r = node.computed;
    if (r.w <= 0 or r.h <= 0) { g_zero_count += 1; }
    if (r.w <= 0 or r.h <= 0) return;
    // Hover highlight — brighten background when this node is hovered
    const is_hovered = (hovered_node == node);
    if (is_hovered and node.style.background_color == null) {
        // Node has no background but is hovered — draw a subtle highlight
        gpu.drawRect(
            r.x, r.y, r.w, r.h,
            0.15, 0.15, 0.22, 0.6,
            node.style.border_radius,
            0, 0, 0, 0, 0,
        );
    }

    if (node.style.background_color) |bg_raw| {
        if (bg_raw.a > 0) {
            const bg = if (is_hovered) brighten(bg_raw, 20) else bg_raw;
            const bc = node.style.border_color orelse Color.rgb(0, 0, 0);
            gpu.drawRect(
                r.x, r.y, r.w, r.h,
                @as(f32, @floatFromInt(bg.r)) / 255.0,
                @as(f32, @floatFromInt(bg.g)) / 255.0,
                @as(f32, @floatFromInt(bg.b)) / 255.0,
                @as(f32, @floatFromInt(bg.a)) / 255.0,
                node.style.border_radius,
                0,
                @as(f32, @floatFromInt(bc.r)) / 255.0,
                @as(f32, @floatFromInt(bc.g)) / 255.0,
                @as(f32, @floatFromInt(bc.b)) / 255.0,
                @as(f32, @floatFromInt(bc.a)) / 255.0,
            );
        }
    }
    // Selection highlights (drawn behind text)
    selection.paintHighlight(node, r.x, r.y);

    if (node.text) |t| {
        if (t.len > 0) {
            const tc = node.text_color orelse Color.rgb(255, 255, 255);
            const pl = node.style.padLeft();
            const pt = node.style.padTop();
            const pr = node.style.padRight();
            _ = gpu.drawTextWrapped(
                t, r.x + pl, r.y + pt, node.font_size, @max(1.0, r.w - pl - pr),
                @as(f32, @floatFromInt(tc.r)) / 255.0,
                @as(f32, @floatFromInt(tc.g)) / 255.0,
                @as(f32, @floatFromInt(tc.b)) / 255.0,
                @as(f32, @floatFromInt(tc.a)) / 255.0,
            );
        }
    }

    // TextInput: render typed text (or placeholder) and blinking cursor
    if (node.input_id) |id| {
        const typed = input.getText(id);
        const is_placeholder = typed.len == 0;
        // Selection highlight (drawn behind text, same as normal text nodes)
        if (!is_placeholder) {
            const sel = input.getSelection(id);
            if (sel.hi > sel.lo) {
                const pl = node.style.padLeft();
                const pt = node.style.padTop();
                const pr = node.style.padRight();
                gpu.drawSelectionRects(typed, r.x + pl, r.y + pt, node.font_size, @max(1.0, r.w - pl - pr), sel.lo, sel.hi);
            }
        }
        const display_text: ?[]const u8 = if (!is_placeholder) typed else node.placeholder;
        if (display_text) |t| {
            if (t.len > 0) {
                const tc = if (is_placeholder)
                    Color.rgb(100, 100, 110)
                else
                    (node.text_color orelse Color.rgb(220, 220, 220));
                const pl = node.style.padLeft();
                const pt = node.style.padTop();
                const pr = node.style.padRight();
                _ = gpu.drawTextWrapped(
                    t, r.x + pl, r.y + pt, node.font_size, @max(1.0, r.w - pl - pr),
                    @as(f32, @floatFromInt(tc.r)) / 255.0,
                    @as(f32, @floatFromInt(tc.g)) / 255.0,
                    @as(f32, @floatFromInt(tc.b)) / 255.0,
                    @as(f32, @floatFromInt(tc.a)) / 255.0,
                );
            }
        }
        // Blinking cursor when focused
        if (input.isFocused(id) and g_cursor_visible) {
            const cursor_pos = input.getCursorPos(id);
            const pl = node.style.padLeft();
            const pt = node.style.padTop();
            const pb = node.style.padBottom();
            const metrics = measureCallback(typed[0..cursor_pos], node.font_size, r.w - pl - node.style.padRight(), 0, 0, 1, true);
            const cx = r.x + pl + metrics.width;
            const ch = r.h - pt - pb;
            gpu.drawRect(cx, r.y + pt, 2, @max(ch, 4), 1, 1, 1, 0.8, 0, 0, 0, 0, 0, 0);
        }
    }

    // Canvas rendering — delegate to canvas system if this node has a canvas_type
    if (node.canvas_type) |ct| {
        canvas.renderCanvas(ct, r.x, r.y, r.w, r.h);
        return; // Canvas handles its own content — no children
    }

    // Overflow clipping + scroll offset for scroll/auto/hidden containers
    const ov = node.style.overflow;
    const is_scroll = (ov == .scroll or (ov == .auto and node.content_height > r.h));
    const is_clipped = is_scroll or ov == .hidden;

    if (is_clipped) gpu.pushScissor(r.x, r.y, r.w, r.h);

    if (is_scroll and node.scroll_y != 0) {
        // Offset all descendants by scroll amount (layout positions are absolute)
        const sy = node.scroll_y;
        offsetDescendants(node, -sy);
        for (node.children) |*child| paintNode(child);
        offsetDescendants(node, sy);
    } else {
        for (node.children) |*child| paintNode(child);
    }

    if (is_clipped) gpu.popScissor();
}

// ── Engine entry point ──────────────────────────────────────────────────

pub fn run(config: AppConfig) !void {
    if (c.SDL_Init(c.SDL_INIT_VIDEO) != 0) return error.SDLInitFailed;
    defer c.SDL_Quit();
    log.info(.engine, "SDL initialized", .{});

    // Canvas system init
    canvas.init();

    // Geometry: restore saved window position/size
    geometry.init(std.mem.span(config.title));
    var init_x: c_int = c.SDL_WINDOWPOS_CENTERED;
    var init_y: c_int = c.SDL_WINDOWPOS_CENTERED;
    var init_w: c_int = @intCast(config.width);
    var init_h: c_int = @intCast(config.height);
    if (geometry.load()) |g| {
        init_x = g.x;
        init_y = g.y;
        init_w = g.width;
        init_h = g.height;
        log.info(.geometry, "restored {d}x{d} at ({d},{d})", .{ g.width, g.height, g.x, g.y });
    }

    const window = c.SDL_CreateWindow(
        config.title,
        init_x, init_y,
        init_w, init_h,
        c.SDL_WINDOW_SHOWN | c.SDL_WINDOW_RESIZABLE,
    ) orelse return error.WindowCreateFailed;
    defer c.SDL_DestroyWindow(window);
    defer windows.deinitAll(); // close all secondary windows before SDL_Quit
    c.SDL_SetWindowMinimumSize(window, 320, 240);

    if (geometry.load() != null) geometry.blockSaves();

    // GPU init
    gpu.init(window) catch |err| {
        std.debug.print("wgpu init failed: {}\n", .{err});
        return error.GPUInitFailed;
    };
    defer gpu.deinit();

    // Text engine (FreeType)
    var te = TextEngine.initHeadless("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf") catch
        TextEngine.initHeadless("/System/Library/Fonts/Supplemental/Arial.ttf") catch
        TextEngine.initHeadless("C:/Windows/Fonts/segoeui.ttf") catch
        return error.FontNotFound;
    defer te.deinit();

    gpu.initText(te.library, te.face, te.fallback_faces, te.fallback_count);
    g_text_engine = &te;
    layout.setMeasureFn(measureCallback);
    layout.setMeasureImageFn(measureImageCallback);

    var win_w: f32 = @floatFromInt(init_w);
    var win_h: f32 = @floatFromInt(init_h);
    breakpoint.update(win_w);

    // QuickJS VM
    qjs_runtime.initVM();
    defer qjs_runtime.deinit();

    // App init (FFI registration, initial state)
    if (config.init) |initFn| initFn();

    // Run embedded JS
    if (config.js_logic.len > 0) qjs_runtime.evalScript(config.js_logic);

    // Initial tick — set up dynamic texts after JS is evaluated
    if (config.tick) |tickFn| tickFn(c.SDL_GetTicks());

    // Main loop
    var running = true;
    var fps_frames: u32 = 0;
    var fps_last: u32 = c.SDL_GetTicks();

    while (running) {
        var event: c.SDL_Event = undefined;
        while (c.SDL_PollEvent(&event) != 0) {
            // Route to secondary windows first — if consumed, skip main window handling
            if (windows.routeEvent(&event)) continue;

            switch (event.type) {
                c.SDL_QUIT => running = false,
                c.SDL_WINDOWEVENT => {
                    switch (event.window.event) {
                        c.SDL_WINDOWEVENT_SIZE_CHANGED => {
                            win_w = @floatFromInt(event.window.data1);
                            win_h = @floatFromInt(event.window.data2);
                            gpu.resize(@intCast(event.window.data1), @intCast(event.window.data2));
                            breakpoint.update(win_w);
                            geometry.save(window);
                        },
                        c.SDL_WINDOWEVENT_MOVED => {
                            geometry.save(window);
                        },
                        else => {},
                    }
                },
                c.SDL_MOUSEBUTTONDOWN => {
                    if (event.button.button == c.SDL_BUTTON_LEFT) {
                        const mx: f32 = @floatFromInt(event.button.x);
                        const my: f32 = @floatFromInt(event.button.y);
                        const events = @import("events.zig");
                        // Canvas click — route to canvas first
                        if (events.findCanvasNode(config.root, mx, my)) |cn| {
                            if (cn.canvas_type) |ct| {
                                _ = canvas.dispatchClick(ct, mx - cn.computed.x, my - cn.computed.y);
                                canvas_drag_node = cn;
                                canvas_drag_last_x = mx;
                                canvas_drag_last_y = my;
                            }
                        } else if (layout.hitTest(config.root, mx, my)) |hit| {
                            if (hit.input_id) |id| {
                                input.focus(id);
                            } else if (hit.handlers.on_press) |handler| {
                                input.unfocus();
                                handler();
                            } else {
                                input.unfocus();
                                selection.onMouseDown(config.root, mx, my, c.SDL_GetTicks());
                            }
                        } else {
                            input.unfocus();
                            selection.onMouseDown(config.root, mx, my, c.SDL_GetTicks());
                        }
                    }
                },
                c.SDL_MOUSEMOTION => {
                    const mx: f32 = @floatFromInt(event.motion.x);
                    const my: f32 = @floatFromInt(event.motion.y);
                    updateHover(config.root, mx, my);
                    // Canvas mouse move — for hover detection
                    {
                        const events = @import("events.zig");
                        if (events.findCanvasNode(config.root, mx, my)) |cn| {
                            if (cn.canvas_type) |ct| {
                                canvas.dispatchMouse(ct, mx - cn.computed.x, my - cn.computed.y);
                            }
                        }
                    }
                    const dragging_left = (event.motion.state & c.SDL_BUTTON_LMASK) != 0;
                    if (dragging_left and canvas_drag_node != null) {
                        // Canvas drag — send dx/dy for panning
                        const cn = canvas_drag_node.?;
                        if (cn.canvas_type) |ct| {
                            const dx = mx - canvas_drag_last_x;
                            const dy = my - canvas_drag_last_y;
                            canvas.dispatchDrag(ct, mx - cn.computed.x, my - cn.computed.y, dx, dy);
                            canvas_drag_last_x = mx;
                            canvas_drag_last_y = my;
                        }
                    } else if (dragging_left) {
                        selection.onMouseDrag(config.root, mx, my);
                    }
                },
                c.SDL_MOUSEBUTTONUP => {
                    if (event.button.button == c.SDL_BUTTON_LEFT) {
                        canvas_drag_node = null;
                        selection.onMouseUp();
                    }
                },
                c.SDL_TEXTINPUT => {
                    // Route text input to canvas if one is hovered
                    var canvas_consumed = false;
                    {
                        var tmx_i: c_int = undefined;
                        var tmy_i: c_int = undefined;
                        _ = c.SDL_GetMouseState(&tmx_i, &tmy_i);
                        const tmx: f32 = @floatFromInt(tmx_i);
                        const tmy: f32 = @floatFromInt(tmy_i);
                        const tevents = @import("events.zig");
                        if (tevents.findCanvasNode(config.root, tmx, tmy)) |cn| {
                            if (cn.canvas_type) |ct| {
                                // Send each char as a key event (printable ASCII)
                                const ch = event.text.text[0];
                                if (ch >= 32 and ch < 127) {
                                    canvas.dispatchKey(ct, @intCast(ch), 0);
                                    canvas_consumed = true;
                                }
                            }
                        }
                    }
                    if (!canvas_consumed) input.handleTextInput(@ptrCast(&event.text.text));
                },
                c.SDL_KEYDOWN => {
                    const sym = event.key.keysym.sym;
                    const mod = event.key.keysym.mod;
                    const ctrl = (mod & c.KMOD_CTRL) != 0;
                    // Route backspace/escape to canvas if hovered
                    var canvas_key_consumed = false;
                    if (sym == c.SDLK_BACKSPACE or sym == c.SDLK_ESCAPE) {
                        var kmx_i: c_int = undefined;
                        var kmy_i: c_int = undefined;
                        _ = c.SDL_GetMouseState(&kmx_i, &kmy_i);
                        const kmx: f32 = @floatFromInt(kmx_i);
                        const kmy: f32 = @floatFromInt(kmy_i);
                        const kevents = @import("events.zig");
                        if (kevents.findCanvasNode(config.root, kmx, kmy)) |cn| {
                            if (cn.canvas_type) |ct| {
                                canvas.dispatchKey(ct, sym, @intCast(mod));
                                canvas_key_consumed = true;
                            }
                        }
                    }
                    if (!canvas_key_consumed) {
                        const input_consumed = if (input.getFocusedId() != null)
                            (if (ctrl) input.handleCtrlKey(sym) else input.handleKey(sym))
                        else
                            false;
                        if (!input_consumed) {
                            selection.onKeyDown(config.root, sym, mod);
                            if (sym == c.SDLK_ESCAPE) running = false;
                        }
                    }
                },
                c.SDL_MOUSEWHEEL => {
                    var mx_i: c_int = undefined;
                    var my_i: c_int = undefined;
                    _ = c.SDL_GetMouseState(&mx_i, &my_i);
                    const mx: f32 = @floatFromInt(mx_i);
                    const my: f32 = @floatFromInt(my_i);
                    const events = @import("events.zig");
                    // Canvas scroll — route to canvas for zoom
                    if (events.findCanvasNode(config.root, mx, my)) |cn| {
                        if (cn.canvas_type) |ct| {
                            const delta: f32 = @floatFromInt(event.wheel.y);
                            canvas.dispatchScroll(ct, mx - cn.computed.x, my - cn.computed.y, delta);
                        }
                    } else if (events.findScrollContainer(config.root, mx, my)) |scroll_node| {
                        if (event.wheel.y != 0) {
                            scroll_node.scroll_y -= @as(f32, @floatFromInt(event.wheel.y)) * 30.0;
                        }
                        if (event.wheel.x != 0) {
                            const page = @max(scroll_node.computed.h * 0.8, 60.0);
                            scroll_node.scroll_y -= @as(f32, @floatFromInt(event.wheel.x)) * page;
                        }
                        const max_scroll = @max(0.0, scroll_node.content_height - scroll_node.computed.h);
                        scroll_node.scroll_y = @max(0.0, @min(scroll_node.scroll_y, max_scroll));
                    }
                },
                else => {},
            }
        }

        // QuickJS tick
        const t0 = std.time.microTimestamp();
        qjs_runtime.tick();
        const t1 = std.time.microTimestamp();
        qjs_runtime.telemetry_tick_us = @intCast(@max(0, t1 - t0));

        // App tick (FFI polling, state updates, dynamic texts)
        if (config.tick) |tickFn| tickFn(c.SDL_GetTicks());

        // Layout (main window)
        const t2 = std.time.microTimestamp();
        layout.layout(config.root, 0, 0, win_w, win_h);
        const t3 = std.time.microTimestamp();
        qjs_runtime.telemetry_layout_us = @intCast(@max(0, t3 - t2));

        // Layout + paint secondary windows (in-process, notifications)
        windows.layoutAll();
        windows.paintAndPresent();

        // Resolve deferred selection (safe — layout is done, FT mutations won't corrupt measurements)
        selection.resolvePending();

        // Cursor blink — update before paint so cursor state is fresh
        const now_tick = c.SDL_GetTicks();
        const dt_ms = now_tick -% g_prev_tick;
        g_prev_tick = now_tick;
        g_cursor_visible = input.tickBlink(@as(f32, @floatFromInt(dt_ms)) / 1000.0);

        // Paint (main window — wgpu)
        selection.resetWalkState();
        const t4 = std.time.microTimestamp();
        paintNode(config.root);

        // Tooltip overlay (always on top of main tree)
        tooltip.paintOverlay(measureCallback, win_w, win_h);

        const t5 = std.time.microTimestamp();
        qjs_runtime.telemetry_paint_us = @intCast(@max(0, t5 - t4));

        gpu.frame(0.051, 0.067, 0.090);

        // Telemetry
        fps_frames += 1;
        const now = c.SDL_GetTicks();
        if (now - fps_last >= 1000) {
            qjs_runtime.telemetry_fps = fps_frames;
            const ppf = g_paint_count / @max(fps_frames, 1);
            const hpf = g_hidden_count / @max(fps_frames, 1);
            const zpf = g_zero_count / @max(fps_frames, 1);
            std.debug.print("[telemetry] FPS: {d} | layout: {d}us | paint: {d}us | visible: {d} | hidden: {d} | zero: {d} | bridge: {d}/s\n", .{
                fps_frames, qjs_runtime.telemetry_layout_us, qjs_runtime.telemetry_paint_us, ppf, hpf, zpf, qjs_runtime.bridge_calls_this_second,
            });
            qjs_runtime.telemetry_bridge_calls = qjs_runtime.bridge_calls_this_second;
            qjs_runtime.bridge_calls_this_second = 0;
            g_paint_count = 0;
            g_hidden_count = 0;
            g_zero_count = 0;
            fps_frames = 0;
            fps_last = now;
        }
    }
}
