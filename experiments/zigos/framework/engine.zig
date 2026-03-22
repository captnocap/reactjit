//! ZigOS Engine — owns the window lifecycle, GPU, text, layout, paint, and event loop.
//!
//! The generated app provides a node tree + callbacks. The engine handles everything else.
//! Adding new framework modules (geometry, watchdog, etc.) happens here — no codegen changes needed.

const std = @import("std");
const c = @import("c.zig").imports;
const layout = @import("layout.zig");
const text_mod = @import("text.zig");
const gpu = @import("gpu/gpu.zig");
const qjs_runtime = @import("qjs_runtime.zig");
const geometry = @import("geometry.zig");
const selection = @import("selection.zig");
const breakpoint = @import("breakpoint.zig");
const windows = @import("windows.zig");
const canvas = @import("canvas.zig");
const svg_path = @import("svg_path.zig");
const log = @import("log.zig");
const tooltip = @import("tooltip.zig");
const telemetry = @import("telemetry.zig");
const devtools = @import("devtools.zig");
const testharness = @import("testharness.zig");
const videos = @import("videos.zig");
const render_surfaces = @import("render_surfaces.zig");
const filedrop = @import("filedrop.zig");
const capture = @import("capture.zig");
const effects = @import("effects.zig");
const transition = @import("transition.zig");

const input = @import("input.zig");
const Node = layout.Node;
const Color = layout.Color;
const TextEngine = text_mod.TextEngine;

// ── Devtools state ──────────────────────────────────────────────────────
var devtools_visible: bool = false;
var devtools_initialized: bool = false;
const DEVTOOLS_HEIGHT: f32 = 360;

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
    min_width: u32 = 320,
    min_height: u32 = 240,
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

fn measureWidthOnly(t: []const u8, font_size: u16) f32 {
    if (g_text_engine) |te| {
        return te.measureTextWrappedEx(t, font_size, 0, 0, 0, 1, true).width;
    }
    return 0;
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

/// Recursively offset a node and all descendants by dx/dy.
fn offsetNodeXY(node: *Node, dx: f32, dy: f32) void {
    node.computed.x += dx;
    node.computed.y += dy;
    for (node.children) |*child| offsetNodeXY(child, dx, dy);
}

/// Translate Canvas.Node children from flex positions to raw graph-space.
/// gx/gy is the center of the node in graph space.
/// GPU transform maps graph space → screen space.
fn positionCanvasNodes(parent: *Node) void {
    for (parent.children) |*child| {
        if (!child.canvas_node) continue;
        // Place at raw graph coordinates (gx/gy = center)
        const target_x = child.canvas_gx - child.computed.w / 2;
        const target_y = child.canvas_gy - child.computed.h / 2;
        const dx = target_x - child.computed.x;
        const dy = target_y - child.computed.y;
        child.computed.x = target_x;
        child.computed.y = target_y;
        for (child.children) |*gc| offsetNodeXY(gc, dx, dy);
    }
}

var g_paint_count: u32 = 0;
var g_hidden_count: u32 = 0;
var g_zero_count: u32 = 0;
var g_paint_opacity: f32 = 1.0; // global opacity multiplier for dim/highlight
var g_flow_enabled: bool = true; // per-child flow override for hover mode
var g_hover_changed: bool = false; // debug flag

// Canvas drag state — tracks which canvas is being dragged for pan
var canvas_drag_node: ?*Node = null;
var canvas_drag_last_x: f32 = 0;
var canvas_drag_last_y: f32 = 0;

// TextInput drag-select state
var input_drag_active: bool = false;
var input_drag_id: u8 = 0;
var input_drag_node_x: f32 = 0; // node rect x (for computing local_x)
var input_drag_node_pl: f32 = 0; // node padding-left
var input_drag_font_size: u16 = 0;

fn paintNode(node: *Node) void {
    if (node.style.display == .none) { g_hidden_count += 1; return; }
    g_paint_count += 1;

    // Canvas.Path: draw before size check
    if (node.canvas_path) { paintCanvasPath(node); return; }

    const r = node.computed;
    if (r.w <= 0 or r.h <= 0) { g_zero_count += 1; return; }

    // Paint this node's visuals (background, text, input, selection)
    paintNodeVisuals(node);

    // Canvas rendering — separate heavy path
    if (node.canvas_type != null) { paintCanvasContainer(node); return; }

    // Overflow clipping + scroll offset + recurse children
    const ov = node.style.overflow;
    const is_scroll = (ov == .scroll or (ov == .auto and node.content_height > r.h));
    const is_clipped = is_scroll or ov == .hidden;

    if (is_clipped) gpu.pushScissor(r.x, r.y, r.w, r.h);

    if (is_scroll and node.scroll_y != 0) {
        const sy = node.scroll_y;
        offsetDescendants(node, -sy);
        for (node.children) |*child| paintNode(child);
        offsetDescendants(node, sy);
    } else {
        for (node.children) |*child| paintNode(child);
    }

    if (is_clipped) gpu.popScissor();
}

/// Paint a Canvas.Path node (SVG stroke curves). Separated to keep paintNode frame small.
fn paintCanvasPath(node: *Node) callconv(.auto) void {
    @setRuntimeSafety(false);
    if (node.canvas_path_d) |d| {
        const tc = node.text_color orelse Color.rgb(255, 255, 255);
        const path = svg_path.parsePath(d);
        svg_path.drawStrokeCurves(
            &path,
            @as(f32, @floatFromInt(tc.r)) / 255.0,
            @as(f32, @floatFromInt(tc.g)) / 255.0,
            @as(f32, @floatFromInt(tc.b)) / 255.0,
            @as(f32, @floatFromInt(tc.a)) / 255.0 * g_paint_opacity,
            node.canvas_stroke_width,
            if (g_flow_enabled) node.canvas_flow_speed else 0,
            c.SDL_GetTicks(),
        );
    }
}

/// Paint node visuals: background, hover, text, selection, text input.
/// Separated from paintNode to reduce the recursive frame size.
noinline fn paintNodeVisuals(node: *Node) void {
    const r = node.computed;
    const is_hovered = (hovered_node == node) and (node.handlers.on_hover_enter != null or node.handlers.on_hover_exit != null or node.hoverable);

    if (is_hovered and node.style.background_color == null) {
        gpu.drawRect(r.x, r.y, r.w, r.h, 0.15, 0.15, 0.22, 0.6, node.style.border_radius, 0, 0, 0, 0, 0);
    }

    if (node.style.background_color) |bg_raw| {
        if (bg_raw.a > 0) {
            const bg = if (is_hovered) brighten(bg_raw, 20) else bg_raw;
            const bc = node.style.border_color orelse Color.rgb(0, 0, 0);
            const has_transform = node.style.rotation != 0 or node.style.scale_x != 1.0 or node.style.scale_y != 1.0;
            if (has_transform) {
                gpu.drawRectTransformed(
                    r.x, r.y, r.w, r.h,
                    @as(f32, @floatFromInt(bg.r)) / 255.0, @as(f32, @floatFromInt(bg.g)) / 255.0,
                    @as(f32, @floatFromInt(bg.b)) / 255.0, @as(f32, @floatFromInt(bg.a)) / 255.0 * g_paint_opacity,
                    node.style.border_radius, node.style.border_width,
                    @as(f32, @floatFromInt(bc.r)) / 255.0, @as(f32, @floatFromInt(bc.g)) / 255.0,
                    @as(f32, @floatFromInt(bc.b)) / 255.0, @as(f32, @floatFromInt(bc.a)) / 255.0 * g_paint_opacity,
                    node.style.rotation, node.style.scale_x, node.style.scale_y,
                );
            } else {
                gpu.drawRect(
                    r.x, r.y, r.w, r.h,
                    @as(f32, @floatFromInt(bg.r)) / 255.0, @as(f32, @floatFromInt(bg.g)) / 255.0,
                    @as(f32, @floatFromInt(bg.b)) / 255.0, @as(f32, @floatFromInt(bg.a)) / 255.0 * g_paint_opacity,
                    node.style.border_radius, node.style.border_width,
                    @as(f32, @floatFromInt(bc.r)) / 255.0, @as(f32, @floatFromInt(bc.g)) / 255.0,
                    @as(f32, @floatFromInt(bc.b)) / 255.0, @as(f32, @floatFromInt(bc.a)) / 255.0 * g_paint_opacity,
                );
            }
        }
    }

    // Video frame — draw after background, before text
    if (node.video_src) |src| {
        _ = videos.paintVideo(src, r.x, r.y, r.w, r.h, g_paint_opacity);
    }

    // Render surface — screen capture, webcam, VM, etc.
    if (node.render_src) |src| {
        _ = render_surfaces.paintSurface(src, r.x, r.y, r.w, r.h, g_paint_opacity);
    }

    // Effect — generative visual
    if (node.effect_type) |etype| {
        _ = effects.paintEffect(etype, r.x, r.y, r.w, r.h, g_paint_opacity);
    }
    // Custom effect — user-compiled onRender callback
    if (node.effect_render) |render_fn| {
        _ = effects.paintCustomEffect(render_fn, r.x, r.y, r.w, r.h, g_paint_opacity);
    }

    selection.paintHighlight(node, r.x, r.y);

    if (node.text) |t| {
        if (t.len > 0) {
            const tc = node.text_color orelse Color.rgb(255, 255, 255);
            const pl = node.style.padLeft();
            const pt = node.style.padTop();
            const pr = node.style.padRight();
            const final_a = @as(f32, @floatFromInt(tc.a)) / 255.0 * g_paint_opacity;
            _ = gpu.drawTextWrapped(
                t, r.x + pl, r.y + pt, node.font_size, @max(1.0, r.w - pl - pr),
                @as(f32, @floatFromInt(tc.r)) / 255.0, @as(f32, @floatFromInt(tc.g)) / 255.0,
                @as(f32, @floatFromInt(tc.b)) / 255.0, final_a, node.number_of_lines,
            );
        }
    }

    if (node.input_id) |id| paintTextInput(node, id);
}

/// Paint TextInput: typed text, placeholder, selection highlight, blinking cursor.
noinline fn paintTextInput(node: *Node, id: u8) void {
    const r = node.computed;
    if (input.isFocused(id)) {
        const pad: f32 = 4;
        gpu.drawRect(r.x - pad, r.y - pad, r.w + pad * 2, r.h + pad * 2, 0, 0, 0, 0, 5, 1.5, 0.30, 0.56, 0.92, 0.7);
    }
    const typed = input.getText(id);
    const is_placeholder = typed.len == 0;
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
                @as(f32, @floatFromInt(tc.r)) / 255.0, @as(f32, @floatFromInt(tc.g)) / 255.0,
                @as(f32, @floatFromInt(tc.b)) / 255.0, @as(f32, @floatFromInt(tc.a)) / 255.0, 0,
            );
        }
    }
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

/// Paint a Canvas container: transform setup, graph children, HUD layer.
noinline fn paintCanvasContainer(node: *Node) void {
    const r = node.computed;
    const ct = node.canvas_type.?;
    if (node.canvas_view_set) {
        canvas.setCamera(node.canvas_view_x, node.canvas_view_y, node.canvas_view_zoom);
        node.canvas_view_set = false;
    }
    gpu.pushScissor(r.x, r.y, r.w, r.h);
    canvas.renderCanvas(ct, r.x, r.y, r.w, r.h);
    positionCanvasNodes(node);
    const cam = canvas.getCameraTransform(r.x, r.y, r.w, r.h);
    const vp_cx = r.x + r.w / 2;
    const vp_cy = r.y + r.h / 2;
    gpu.setTransform(0, 0, vp_cx - cam.cx * cam.scale, vp_cy - cam.cy * cam.scale, cam.scale);
    {
        const hovered = canvas.getHoveredNode();
        const selected = canvas.getSelectedNode();
        var child_idx: u16 = 0;
        for (node.children) |*child| {
            if (!child.canvas_clamp) {
                if (child.canvas_node) {
                    const node_selected = selected != null and selected.? == child_idx;
                    const node_hovered = hovered != null and hovered.? == child_idx;
                    if (node_selected) {
                        const hw = child.canvas_gw / 2 + 5;
                        const hh = child.canvas_gh / 2 + 5;
                        gpu.drawRect(child.canvas_gx - hw, child.canvas_gy - hh, hw * 2, hh * 2, 0.5, 0.4, 1.0, 0.4, 8, 2, 1.0, 1.0, 1.0, 0.5);
                    } else if (node_hovered) {
                        const hw = child.canvas_gw / 2 + 4;
                        const hh = child.canvas_gh / 2 + 4;
                        gpu.drawRect(child.canvas_gx - hw, child.canvas_gy - hh, hw * 2, hh * 2, 0.4, 0.3, 0.9, 0.25, 8, 0, 0, 0, 0, 0);
                    }
                }
                g_paint_opacity = canvas.getNodeDim(child_idx);
                g_flow_enabled = canvas.getFlowOverride(child_idx);
                paintNode(child);
                g_paint_opacity = 1.0;
                g_flow_enabled = true;
            }
            child_idx += 1;
        }
    }
    gpu.resetTransform();
    for (node.children) |*child| {
        if (child.canvas_clamp) {
            layout.layoutNode(child, r.x, r.y, r.w, r.h);
            paintNode(child);
        }
    }
    gpu.popScissor();
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
    c.SDL_SetWindowMinimumSize(window, @intCast(config.min_width), @intCast(config.min_height));

    if (geometry.load() != null) geometry.blockSaves();

    videos.init();
    defer videos.deinit();

    render_surfaces.init();
    defer render_surfaces.deinit();

    capture.init();
    defer capture.deinit();

    effects.init();
    defer effects.deinit();

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
    input.setMeasureWidthFn(measureWidthOnly);

    var win_w: f32 = @floatFromInt(init_w);
    var win_h: f32 = @floatFromInt(init_h);
    breakpoint.update(win_w);

    // QuickJS VM
    qjs_runtime.initVM();
    defer qjs_runtime.deinit();

    // App init (FFI registration, initial state)
    if (config.init) |initFn| initFn();

    // Test harness — enable if ZIGOS_TEST=1
    if (testharness.envEnabled()) testharness.enable();

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
                c.SDL_QUIT => {
                    std.debug.print("[engine] SDL_QUIT received\n", .{});
                    running = false;
                },
                c.SDL_WINDOWEVENT => {
                    switch (event.window.event) {
                        c.SDL_WINDOWEVENT_CLOSE => {
                            std.debug.print("[engine] SDL_WINDOWEVENT_CLOSE for window {d}\n", .{event.window.windowID});
                            running = false;
                        },
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
                    // Render surface input forwarding (VNC mouse) — check first
                    {
                        const rmx: f32 = @floatFromInt(event.button.x);
                        const rmy: f32 = @floatFromInt(event.button.y);
                        if (render_surfaces.handleMouseDown(rmx, rmy, event.button.button)) continue;
                    }
                    if (event.button.button == c.SDL_BUTTON_LEFT) {
                        const mx: f32 = @floatFromInt(event.button.x);
                        const my: f32 = @floatFromInt(event.button.y);
                        const events = @import("events.zig");
                        // Hit test devtools first (if visible), then app tree
                        const devtools_hit = if (devtools_visible) layout.hitTest(&devtools.root, mx, my) else null;
                        const hit = devtools_hit orelse layout.hitTest(config.root, mx, my);
                        const hit_is_interactive = if (hit) |h| (h.input_id != null or h.handlers.on_press != null) else false;
                        if (hit_is_interactive) {
                            const h = hit.?;
                            if (h.input_id) |id| {
                                const now_ms = c.SDL_GetTicks();
                                const clicks = input.trackClick(now_ms);
                                input.focus(id);
                                const pl = h.style.padLeft();
                                const local_x = mx - h.computed.x - pl;
                                if (clicks == 3) {
                                    input.selectAll(id);
                                } else if (clicks == 2) {
                                    input.setCursorFromX(id, local_x, h.font_size);
                                    input.selectWord(id);
                                } else {
                                    input.setCursorFromX(id, local_x, h.font_size);
                                    input.startDrag(id);
                                    input_drag_active = true;
                                    input_drag_id = id;
                                    input_drag_node_x = h.computed.x;
                                    input_drag_node_pl = pl;
                                    input_drag_font_size = h.font_size;
                                }
                            } else if (h.handlers.on_press) |handler| {
                                input.unfocus();
                                handler();
                            }
                        } else if ((if (devtools_visible) events.findCanvasNode(&devtools.root, mx, my) else null) orelse events.findCanvasNode(config.root, mx, my)) |cn| {
                            // Canvas click + drag start (only if no HUD element was clicked)
                            input.unfocus();
                            if (canvas.getHoveredNode() != null) canvas.clickNode();
                            canvas_drag_node = cn;
                            canvas_drag_last_x = mx;
                            canvas_drag_last_y = my;
                        } else {
                            input.unfocus();
                            selection.onMouseDown(config.root, mx, my, c.SDL_GetTicks());
                        }
                    }
                },
                c.SDL_MOUSEMOTION => {
                    const mx: f32 = @floatFromInt(event.motion.x);
                    const my: f32 = @floatFromInt(event.motion.y);
                    // Render surface mouse motion forwarding
                    if (render_surfaces.handleMouseMotion(mx, my)) continue;
                    // TextInput drag selection
                    if (input_drag_active) {
                        const local_x = mx - input_drag_node_x - input_drag_node_pl;
                        input.updateDrag(input_drag_id, local_x, input_drag_font_size);
                    }
                    if (devtools_visible) updateHover(&devtools.root, mx, my);
                    updateHover(config.root, mx, my);
                    // Canvas hit testing — find which Canvas.Node the mouse is over
                    {
                        const mevents = @import("events.zig");
                        if (mevents.findCanvasNode(config.root, mx, my)) |cn| {
                            const vp_cx = cn.computed.x + cn.computed.w / 2;
                            const vp_cy = cn.computed.y + cn.computed.h / 2;
                            const gpos = canvas.screenToGraph(mx, my, vp_cx, vp_cy);
                            // Check Canvas.Node children
                            var found_idx: ?u16 = null;
                            var ci: u16 = 0;
                            for (cn.children) |*child| {
                                if (child.canvas_node) {
                                    const hw = child.canvas_gw / 2;
                                    const hh = child.canvas_gh / 2;
                                    if (gpos[0] >= child.canvas_gx - hw and gpos[0] <= child.canvas_gx + hw and
                                        gpos[1] >= child.canvas_gy - hh and gpos[1] <= child.canvas_gy + hh)
                                    {
                                        found_idx = ci;
                                    }
                                }
                                ci += 1;
                            }
                            canvas.setHoveredNode(found_idx);
                            g_hover_changed = true;
                        } else {
                            if (canvas.getHoveredNode() != null) g_hover_changed = true;
                            canvas.setHoveredNode(null);
                        }
                    }
                    const dragging_left = (event.motion.state & c.SDL_BUTTON_LMASK) != 0;
                    if (dragging_left and canvas_drag_node != null) {
                        // Canvas pan — built-in
                        const dx = mx - canvas_drag_last_x;
                        const dy = my - canvas_drag_last_y;
                        canvas.handleDrag(dx, dy);
                        canvas_drag_last_x = mx;
                        canvas_drag_last_y = my;
                    } else if (dragging_left) {
                        selection.onMouseDrag(config.root, mx, my);
                    }
                },
                c.SDL_MOUSEBUTTONUP => {
                    // Render surface mouse up forwarding
                    {
                        const rmx: f32 = @floatFromInt(event.button.x);
                        const rmy: f32 = @floatFromInt(event.button.y);
                        if (render_surfaces.handleMouseUp(rmx, rmy, event.button.button)) continue;
                    }
                    if (event.button.button == c.SDL_BUTTON_LEFT) {
                        canvas_drag_node = null;
                        input_drag_active = false;
                        selection.onMouseUp();
                    }
                },
                c.SDL_TEXTINPUT => {
                    // PTY gets text first when active
                    if (qjs_runtime.ptyActive()) {
                        qjs_runtime.ptyHandleTextInput(@ptrCast(&event.text.text));
                        continue;
                    }
                    // Render surface text input forwarding
                    if (render_surfaces.handleTextInput(@ptrCast(&event.text.text))) continue;
                    input.handleTextInput(@ptrCast(&event.text.text));
                },
                c.SDL_KEYDOWN => {
                    const sym = event.key.keysym.sym;
                    const mod = event.key.keysym.mod;
                    // Capture key (F9 recording toggle)
                    if (capture.handleKey(sym)) continue;
                    // PTY special key routing (arrows, enter, backspace, ctrl combos)
                    if (qjs_runtime.ptyActive() and sym != c.SDLK_F12) {
                        qjs_runtime.ptyHandleKeyDown(sym, mod);
                        continue;
                    }
                    // Render surface key forwarding (before F12 check so F12 still works)
                    if (sym != c.SDLK_F12 and render_surfaces.handleKeyDown(sym)) continue;
                    // F12: toggle devtools
                    if (sym == c.SDLK_F12) {
                        devtools_visible = !devtools_visible;
                        std.debug.print("[devtools] F12 pressed — visible={}\n", .{devtools_visible});
                        if (devtools_visible and !devtools_initialized) {
                            std.debug.print("[devtools] calling _appInit...\n", .{});
                            devtools._appInit();
                            std.debug.print("[devtools] _appInit done, evaluating JS ({d} bytes)...\n", .{devtools.JS_LOGIC.len});
                            if (devtools.JS_LOGIC.len > 0) qjs_runtime.evalScript(devtools.JS_LOGIC);
                            std.debug.print("[devtools] JS done, initialized\n", .{});
                            devtools_initialized = true;
                        }
                    } else {
                        const ctrl = (mod & c.KMOD_CTRL) != 0;
                        const input_consumed = if (input.getFocusedId() != null)
                            (if (ctrl) input.handleCtrlKey(sym) else input.handleKey(sym))
                        else
                            false;
                        if (!input_consumed and !videos.handleKey(sym)) {
                            selection.onKeyDown(config.root, sym, mod);
                        }
                    }
                },
                c.SDL_KEYUP => {
                    _ = render_surfaces.handleKeyUp(event.key.keysym.sym);
                },
                c.SDL_MOUSEWHEEL => {
                    var mx_i: c_int = undefined;
                    var my_i: c_int = undefined;
                    _ = c.SDL_GetMouseState(&mx_i, &my_i);
                    const mx: f32 = @floatFromInt(mx_i);
                    const my: f32 = @floatFromInt(my_i);
                    const events = @import("events.zig");
                    // Canvas zoom — built-in (check devtools first, then app)
                    if ((if (devtools_visible) events.findCanvasNode(&devtools.root, mx, my) else null) orelse events.findCanvasNode(config.root, mx, my)) |cn| {
                        const delta: f32 = @floatFromInt(event.wheel.y);
                        canvas.handleScroll(mx - cn.computed.x, my - cn.computed.y, delta, cn.computed.w, cn.computed.h);
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
                c.SDL_DROPFILE => {
                    if (event.drop.file) |file_ptr| {
                        filedrop.dispatch(std.mem.span(file_ptr), config.root);
                        c.SDL_free(file_ptr);
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

        // Devtools tick
        if (devtools_visible and devtools_initialized) {
            devtools._appTick(c.SDL_GetTicks());
        }

        // Transition tick — interpolate active transitions AFTER style updates, BEFORE layout
        {
            const now_t = c.SDL_GetTicks();
            const dt_t = now_t -% g_prev_tick;
            const dt_t_sec = @as(f32, @floatFromInt(dt_t)) / 1000.0;
            _ = transition.tick(dt_t_sec);
        }

        // Layout (main window)
        const t2 = std.time.microTimestamp();
        const app_h = if (devtools_visible) @max(100, win_h - DEVTOOLS_HEIGHT) else win_h;
        layout.layout(config.root, 0, 0, win_w, app_h);
        if (devtools_visible) {
            layout.layout(&devtools.root, 0, app_h, win_w, DEVTOOLS_HEIGHT);
        }
        const t3 = std.time.microTimestamp();
        qjs_runtime.telemetry_layout_us = @intCast(@max(0, t3 - t2));

        // Layout + paint secondary windows (in-process, notifications)
        windows.layoutAll();
        windows.paintAndPresent();

        // Resolve deferred selection (safe — layout is done, FT mutations won't corrupt measurements)
        selection.resolvePending();

        // Video update — poll mpv for new frames before paint
        videos.update();

        // Render surfaces update — poll XShm/FFmpeg/VNC for new frames
        render_surfaces.update();

        // Cursor blink — update before paint so cursor state is fresh
        const now_tick = c.SDL_GetTicks();
        const dt_ms = now_tick -% g_prev_tick;
        g_prev_tick = now_tick;
        const dt_sec = @as(f32, @floatFromInt(dt_ms)) / 1000.0;
        g_cursor_visible = input.tickBlink(dt_sec);

        // Effects update — animate and render all effect instances
        effects.update(dt_sec);

        // Paint (main window — wgpu)
        selection.resetWalkState();
        const t4 = std.time.microTimestamp();
        paintNode(config.root);

        // Paint devtools panel (below app)
        if (devtools_visible) {
            gpu.drawRect(0, app_h, win_w, 2, 0.4, 0.2, 0.9, 1.0, 0, 0, 0, 0, 0, 0);
            paintNode(&devtools.root);
        }

        // Tooltip overlay (always on top of main tree)
        tooltip.paintOverlay(measureCallback, win_w, win_h);

        const t5 = std.time.microTimestamp();
        qjs_runtime.telemetry_paint_us = @intCast(@max(0, t5 - t4));

        gpu.frame(0.051, 0.067, 0.090);

        // Capture — screenshot/recording (fires inside gpu.frame via callback)
        if (capture.tick(config.root)) {
            std.process.exit(0); // screenshot captured — clean exit
        }

        // Test harness — run tests after layout+paint, then exit
        if (testharness.tick()) {
            const exit_code = testharness.runAll(config.root);
            std.process.exit(exit_code);
        }

        // Unified telemetry snapshot
        const t6 = std.time.microTimestamp();
        telemetry.collect(.{
            .tick_us = @intCast(@max(0, t1 - t0)),
            .layout_us = @intCast(@max(0, t3 - t2)),
            .paint_us = @intCast(@max(0, t5 - t4)),
            .frame_total_us = @intCast(@max(0, t6 - t0)),
            .fps = qjs_runtime.telemetry_fps,
            .bridge_calls_per_sec = qjs_runtime.telemetry_bridge_calls,
            .root = config.root,
            .visible_nodes = g_paint_count,
            .hidden_nodes = g_hidden_count,
            .zero_size_nodes = g_zero_count,
            .window = window,
            .hovered_node = hovered_node,
        });

        // Telemetry (legacy stderr + qjs_runtime vars)
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
            g_hover_changed = false;
            g_hidden_count = 0;
            g_zero_count = 0;
            fps_frames = 0;
            fps_last = now;
        }
    }
}
