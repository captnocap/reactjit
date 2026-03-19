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

// ── Telemetry host functions (build JS objects from unified snapshot) ──

const tel = @import("telemetry.zig");

fn setF(ctx: *qjs.JSContext, obj: qjs.JSValue, name: [*:0]const u8, val: f64) void {
    _ = qjs.JS_SetPropertyStr(ctx, obj, name, qjs.JS_NewFloat64(ctx, val));
}

fn setB(ctx: *qjs.JSContext, obj: qjs.JSValue, name: [*:0]const u8, val: bool) void {
    setF(ctx, obj, name, if (val) 1.0 else 0.0);
}

fn hostTelFrame(ctx: ?*qjs.JSContext, _: qjs.JSValue, _: c_int, _: [*c]qjs.JSValue) callconv(.c) qjs.JSValue {
    const c2 = ctx orelse return QJS_UNDEFINED;
    const s = tel.current;
    const obj = qjs.JS_NewObject(c2);
    setF(c2, obj, "fps", @floatFromInt(s.fps));
    setF(c2, obj, "tick_us", @floatFromInt(s.tick_us));
    setF(c2, obj, "layout_us", @floatFromInt(s.layout_us));
    setF(c2, obj, "paint_us", @floatFromInt(s.paint_us));
    setF(c2, obj, "frame_total_us", @floatFromInt(s.frame_total_us));
    setF(c2, obj, "frame_number", @floatFromInt(s.frame_number));
    setF(c2, obj, "bridge_calls_per_sec", @floatFromInt(s.bridge_calls_per_sec));
    return obj;
}

fn hostTelGpu(ctx: ?*qjs.JSContext, _: qjs.JSValue, _: c_int, _: [*c]qjs.JSValue) callconv(.c) qjs.JSValue {
    const c2 = ctx orelse return QJS_UNDEFINED;
    const s = tel.current;
    const obj = qjs.JS_NewObject(c2);
    setF(c2, obj, "rect_count", @floatFromInt(s.rect_count));
    setF(c2, obj, "glyph_count", @floatFromInt(s.glyph_count));
    setF(c2, obj, "rect_capacity", @floatFromInt(s.rect_capacity));
    setF(c2, obj, "glyph_capacity", @floatFromInt(s.glyph_capacity));
    setF(c2, obj, "atlas_glyph_count", @floatFromInt(s.atlas_glyph_count));
    setF(c2, obj, "atlas_capacity", @floatFromInt(s.atlas_capacity));
    setF(c2, obj, "atlas_row_x", @floatFromInt(s.atlas_row_x));
    setF(c2, obj, "atlas_row_y", @floatFromInt(s.atlas_row_y));
    setF(c2, obj, "scissor_depth", @floatFromInt(s.scissor_depth));
    setF(c2, obj, "scissor_segment_count", @floatFromInt(s.scissor_segment_count));
    setF(c2, obj, "gpu_surface_w", @floatFromInt(s.gpu_surface_w));
    setF(c2, obj, "gpu_surface_h", @floatFromInt(s.gpu_surface_h));
    setF(c2, obj, "frame_hash", @floatFromInt(s.frame_hash));
    setF(c2, obj, "frames_since_drain", @floatFromInt(s.frames_since_drain));
    return obj;
}

fn hostTelNodes(ctx: ?*qjs.JSContext, _: qjs.JSValue, _: c_int, _: [*c]qjs.JSValue) callconv(.c) qjs.JSValue {
    const c2 = ctx orelse return QJS_UNDEFINED;
    const s = tel.current;
    const obj = qjs.JS_NewObject(c2);
    setF(c2, obj, "total", @floatFromInt(s.total_nodes));
    setF(c2, obj, "visible", @floatFromInt(s.visible_nodes));
    setF(c2, obj, "hidden", @floatFromInt(s.hidden_nodes));
    setF(c2, obj, "zero_size", @floatFromInt(s.zero_size_nodes));
    setF(c2, obj, "max_depth", @floatFromInt(s.max_depth));
    setF(c2, obj, "scroll", @floatFromInt(s.scroll_nodes));
    setF(c2, obj, "text", @floatFromInt(s.text_nodes));
    setF(c2, obj, "image", @floatFromInt(s.image_nodes));
    setF(c2, obj, "pressable", @floatFromInt(s.pressable_nodes));
    setF(c2, obj, "canvas", @floatFromInt(s.canvas_nodes));
    return obj;
}

fn hostTelState(ctx: ?*qjs.JSContext, _: qjs.JSValue, _: c_int, _: [*c]qjs.JSValue) callconv(.c) qjs.JSValue {
    const c2 = ctx orelse return QJS_UNDEFINED;
    const s = tel.current;
    const obj = qjs.JS_NewObject(c2);
    setF(c2, obj, "slot_count", @floatFromInt(s.state_slot_count));
    setF(c2, obj, "slot_capacity", @floatFromInt(s.state_slot_capacity));
    setB(c2, obj, "dirty", s.state_dirty);
    setF(c2, obj, "array_slot_count", @floatFromInt(s.array_slot_count));
    setF(c2, obj, "array_slot_capacity", @floatFromInt(s.array_slot_capacity));
    return obj;
}

fn hostTelSystem(ctx: ?*qjs.JSContext, _: qjs.JSValue, _: c_int, _: [*c]qjs.JSValue) callconv(.c) qjs.JSValue {
    const c2 = ctx orelse return QJS_UNDEFINED;
    const s = tel.current;
    const obj = qjs.JS_NewObject(c2);
    setF(c2, obj, "window_x", @floatFromInt(s.window_x));
    setF(c2, obj, "window_y", @floatFromInt(s.window_y));
    setF(c2, obj, "window_w", @floatFromInt(s.window_w));
    setF(c2, obj, "window_h", @floatFromInt(s.window_h));
    setF(c2, obj, "display_count", @floatFromInt(s.display_count));
    setF(c2, obj, "current_display", @floatFromInt(s.current_display));
    setF(c2, obj, "display_w", @floatFromInt(s.display_w));
    setF(c2, obj, "display_h", @floatFromInt(s.display_h));
    setF(c2, obj, "breakpoint", @floatFromInt(s.breakpoint_tier));
    setF(c2, obj, "secondary_windows", @floatFromInt(s.secondary_window_count));
    return obj;
}

fn hostTelInput(ctx: ?*qjs.JSContext, _: qjs.JSValue, _: c_int, _: [*c]qjs.JSValue) callconv(.c) qjs.JSValue {
    const c2 = ctx orelse return QJS_UNDEFINED;
    const s = tel.current;
    const obj = qjs.JS_NewObject(c2);
    setF(c2, obj, "focused_id", @floatFromInt(s.focused_input_id));
    setF(c2, obj, "active_count", @floatFromInt(s.active_input_count));
    setB(c2, obj, "has_selection", s.has_selection);
    setB(c2, obj, "selection_dragging", s.selection_dragging);
    setB(c2, obj, "tooltip_visible", s.tooltip_visible);
    return obj;
}

fn hostTelCanvas(ctx: ?*qjs.JSContext, _: qjs.JSValue, _: c_int, _: [*c]qjs.JSValue) callconv(.c) qjs.JSValue {
    const c2 = ctx orelse return QJS_UNDEFINED;
    const s = tel.current;
    const obj = qjs.JS_NewObject(c2);
    setF(c2, obj, "cam_x", s.canvas_cam_x);
    setF(c2, obj, "cam_y", s.canvas_cam_y);
    setF(c2, obj, "cam_zoom", s.canvas_cam_zoom);
    setF(c2, obj, "type_count", @floatFromInt(s.canvas_type_count));
    return obj;
}

fn hostTelNet(ctx: ?*qjs.JSContext, _: qjs.JSValue, _: c_int, _: [*c]qjs.JSValue) callconv(.c) qjs.JSValue {
    const c2 = ctx orelse return QJS_UNDEFINED;
    const s = tel.current;
    const obj = qjs.JS_NewObject(c2);
    setF(c2, obj, "active_connections", @floatFromInt(s.net_active_connections));
    setF(c2, obj, "open_connections", @floatFromInt(s.net_open_connections));
    setF(c2, obj, "reconnecting", @floatFromInt(s.net_reconnecting));
    setF(c2, obj, "event_queue_depth", @floatFromInt(s.net_event_queue_depth));
    return obj;
}

fn hostTelLayout(ctx: ?*qjs.JSContext, _: qjs.JSValue, _: c_int, _: [*c]qjs.JSValue) callconv(.c) qjs.JSValue {
    const c2 = ctx orelse return QJS_UNDEFINED;
    const s = tel.current;
    const obj = qjs.JS_NewObject(c2);
    setF(c2, obj, "budget", @floatFromInt(s.layout_budget));
    setF(c2, obj, "budget_used", @floatFromInt(s.layout_budget_used));
    setF(c2, obj, "route_history_depth", @floatFromInt(s.route_history_depth));
    setF(c2, obj, "route_current_index", @floatFromInt(s.route_current_index));
    setF(c2, obj, "log_channels_enabled", @floatFromInt(s.log_channels_enabled));
    return obj;
}

fn hostTelHistory(ctx: ?*qjs.JSContext, _: qjs.JSValue, argc: c_int, argv: [*c]qjs.JSValue) callconv(.c) qjs.JSValue {
    const c2 = ctx orelse return QJS_UNDEFINED;
    var count: i32 = 40;
    if (argc >= 1) _ = qjs.JS_ToInt32(c2, &count, argv[0]);
    const n: usize = @intCast(@max(1, @min(count, 120)));
    const avail = tel.historyCount();
    const actual = @min(n, avail);

    const arr = qjs.JS_NewArray(c2);
    for (0..actual) |i| {
        if (tel.getHistory(i)) |snap| {
            _ = qjs.JS_SetPropertyUint32(c2, arr, @intCast(i), qjs.JS_NewFloat64(c2, @floatFromInt(snap.frame_total_us)));
        }
    }
    return arr;
}

fn hostTelNodeCount(_: ?*qjs.JSContext, _: qjs.JSValue, _: c_int, _: [*c]qjs.JSValue) callconv(.c) qjs.JSValue {
    return qjs.JS_NewFloat64(null, @floatFromInt(tel.nodeCount()));
}

fn hostTelNode(ctx: ?*qjs.JSContext, _: qjs.JSValue, argc: c_int, argv: [*c]qjs.JSValue) callconv(.c) qjs.JSValue {
    const c2 = ctx orelse return QJS_UNDEFINED;
    if (argc < 1) return QJS_UNDEFINED;
    var idx: i32 = 0;
    _ = qjs.JS_ToInt32(c2, &idx, argv[0]);
    if (idx < 0) return QJS_UNDEFINED;

    const node = tel.getNode(@intCast(idx)) orelse return QJS_UNDEFINED;
    const depth = tel.getNodeDepth(@intCast(idx));
    const r = node.computed;

    const obj = qjs.JS_NewObject(c2);
    setF(c2, obj, "depth", @floatFromInt(depth));
    setF(c2, obj, "child_count", @floatFromInt(node.children.len));
    setF(c2, obj, "x", r.x);
    setF(c2, obj, "y", r.y);
    setF(c2, obj, "w", r.w);
    setF(c2, obj, "h", r.h);
    setB(c2, obj, "has_text", node.text != null);
    setB(c2, obj, "has_image", node.image_src != null);
    setB(c2, obj, "has_handler", node.handlers.on_press != null);
    setB(c2, obj, "has_tooltip", node.tooltip != null);
    setF(c2, obj, "font_size", @floatFromInt(node.font_size));
    setF(c2, obj, "opacity", node.style.opacity);
    setF(c2, obj, "scroll_y", node.scroll_y);
    setF(c2, obj, "content_height", node.content_height);

    // Tag name — debug_name or inferred type
    const tag = node.debug_name orelse tel.nodeTypeName(node);
    _ = qjs.JS_SetPropertyStr(c2, obj, "tag", qjs.JS_NewStringLen(c2, tag.ptr, @intCast(tag.len)));

    // Display and flex direction as numbers
    setF(c2, obj, "display", @floatFromInt(@intFromEnum(node.style.display)));
    setF(c2, obj, "flex_direction", @floatFromInt(@intFromEnum(node.style.flex_direction)));

    return obj;
}

fn hostTelNodeStyle(ctx: ?*qjs.JSContext, _: qjs.JSValue, argc: c_int, argv: [*c]qjs.JSValue) callconv(.c) qjs.JSValue {
    const c2 = ctx orelse return QJS_UNDEFINED;
    if (argc < 1) return QJS_UNDEFINED;
    var idx: i32 = 0;
    _ = qjs.JS_ToInt32(c2, &idx, argv[0]);
    if (idx < 0) return QJS_UNDEFINED;

    const node = tel.getNode(@intCast(idx)) orelse return QJS_UNDEFINED;
    const sty = node.style;
    const obj = qjs.JS_NewObject(c2);

    // Dimensions
    if (sty.width) |v| setF(c2, obj, "width", v) else setF(c2, obj, "width", -1);
    if (sty.height) |v| setF(c2, obj, "height", v) else setF(c2, obj, "height", -1);
    if (sty.min_width) |v| setF(c2, obj, "min_width", v);
    if (sty.max_width) |v| setF(c2, obj, "max_width", v);
    if (sty.min_height) |v| setF(c2, obj, "min_height", v);
    if (sty.max_height) |v| setF(c2, obj, "max_height", v);

    // Flex
    setF(c2, obj, "flex_grow", sty.flex_grow);
    if (sty.flex_shrink) |v| setF(c2, obj, "flex_shrink", v);
    if (sty.flex_basis) |v| setF(c2, obj, "flex_basis", v);
    setF(c2, obj, "flex_direction", @floatFromInt(@intFromEnum(sty.flex_direction)));
    setF(c2, obj, "justify_content", @floatFromInt(@intFromEnum(sty.justify_content)));
    setF(c2, obj, "align_items", @floatFromInt(@intFromEnum(sty.align_items)));
    setF(c2, obj, "align_self", @floatFromInt(@intFromEnum(sty.align_self)));
    setF(c2, obj, "gap", sty.gap);

    // Padding
    setF(c2, obj, "padding", sty.padding);
    if (sty.padding_left) |v| setF(c2, obj, "padding_left", v);
    if (sty.padding_right) |v| setF(c2, obj, "padding_right", v);
    if (sty.padding_top) |v| setF(c2, obj, "padding_top", v);
    if (sty.padding_bottom) |v| setF(c2, obj, "padding_bottom", v);

    // Margin
    setF(c2, obj, "margin", sty.margin);
    if (sty.margin_left) |v| setF(c2, obj, "margin_left", v);
    if (sty.margin_right) |v| setF(c2, obj, "margin_right", v);
    if (sty.margin_top) |v| setF(c2, obj, "margin_top", v);
    if (sty.margin_bottom) |v| setF(c2, obj, "margin_bottom", v);

    // Visual
    setF(c2, obj, "border_radius", sty.border_radius);
    setF(c2, obj, "border_width", sty.border_width);
    setF(c2, obj, "opacity", sty.opacity);
    setF(c2, obj, "z_index", @floatFromInt(sty.z_index));
    setF(c2, obj, "rotation", sty.rotation);
    setF(c2, obj, "scale_x", sty.scale_x);
    setF(c2, obj, "scale_y", sty.scale_y);

    // Background color
    if (sty.background_color) |bg| {
        setF(c2, obj, "bg_r", @floatFromInt(bg.r));
        setF(c2, obj, "bg_g", @floatFromInt(bg.g));
        setF(c2, obj, "bg_b", @floatFromInt(bg.b));
        setF(c2, obj, "bg_a", @floatFromInt(bg.a));
    }

    // Border color
    if (sty.border_color) |bc| {
        setF(c2, obj, "border_r", @floatFromInt(bc.r));
        setF(c2, obj, "border_g", @floatFromInt(bc.g));
        setF(c2, obj, "border_b", @floatFromInt(bc.b));
        setF(c2, obj, "border_a", @floatFromInt(bc.a));
    }

    // Position
    setF(c2, obj, "position", @floatFromInt(@intFromEnum(sty.position)));
    if (sty.top) |v| setF(c2, obj, "top", v);
    if (sty.left) |v| setF(c2, obj, "left", v);
    if (sty.right) |v| setF(c2, obj, "right", v);
    if (sty.bottom) |v| setF(c2, obj, "bottom", v);

    // Overflow, display, text align
    setF(c2, obj, "overflow", @floatFromInt(@intFromEnum(sty.overflow)));
    setF(c2, obj, "display", @floatFromInt(@intFromEnum(sty.display)));
    setF(c2, obj, "text_align", @floatFromInt(@intFromEnum(sty.text_align)));

    return obj;
}

fn hostTelNodeBoxModel(ctx: ?*qjs.JSContext, _: qjs.JSValue, argc: c_int, argv: [*c]qjs.JSValue) callconv(.c) qjs.JSValue {
    const c2 = ctx orelse return QJS_UNDEFINED;
    if (argc < 1) return QJS_UNDEFINED;
    var idx: i32 = 0;
    _ = qjs.JS_ToInt32(c2, &idx, argv[0]);
    if (idx < 0) return QJS_UNDEFINED;

    const node = tel.getNode(@intCast(idx)) orelse return QJS_UNDEFINED;
    const sty = node.style;
    const r = node.computed;

    const obj = qjs.JS_NewObject(c2);
    // Computed rect
    setF(c2, obj, "x", r.x);
    setF(c2, obj, "y", r.y);
    setF(c2, obj, "w", r.w);
    setF(c2, obj, "h", r.h);

    // Resolved padding
    setF(c2, obj, "pad_top", sty.padTop());
    setF(c2, obj, "pad_right", sty.padRight());
    setF(c2, obj, "pad_bottom", sty.padBottom());
    setF(c2, obj, "pad_left", sty.padLeft());

    // Resolved margin (no helper methods — resolve optional fields manually)
    setF(c2, obj, "margin_top", sty.margin_top orelse sty.margin);
    setF(c2, obj, "margin_right", sty.margin_right orelse sty.margin);
    setF(c2, obj, "margin_bottom", sty.margin_bottom orelse sty.margin);
    setF(c2, obj, "margin_left", sty.margin_left orelse sty.margin);

    setF(c2, obj, "border_width", sty.border_width);

    // Content dimensions
    const pl = sty.padLeft();
    const pr = sty.padRight();
    const pt = sty.padTop();
    const pb = sty.padBottom();
    setF(c2, obj, "content_w", @max(0, r.w - pl - pr));
    setF(c2, obj, "content_h", @max(0, r.h - pt - pb));

    return obj;
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

    // Telemetry host functions — unified snapshot access
    _ = qjs.JS_SetPropertyStr(ctx, global, "__tel_frame", qjs.JS_NewCFunction(ctx, hostTelFrame, "__tel_frame", 0));
    _ = qjs.JS_SetPropertyStr(ctx, global, "__tel_gpu", qjs.JS_NewCFunction(ctx, hostTelGpu, "__tel_gpu", 0));
    _ = qjs.JS_SetPropertyStr(ctx, global, "__tel_nodes", qjs.JS_NewCFunction(ctx, hostTelNodes, "__tel_nodes", 0));
    _ = qjs.JS_SetPropertyStr(ctx, global, "__tel_state", qjs.JS_NewCFunction(ctx, hostTelState, "__tel_state", 0));
    _ = qjs.JS_SetPropertyStr(ctx, global, "__tel_system", qjs.JS_NewCFunction(ctx, hostTelSystem, "__tel_system", 0));
    _ = qjs.JS_SetPropertyStr(ctx, global, "__tel_input", qjs.JS_NewCFunction(ctx, hostTelInput, "__tel_input", 0));
    _ = qjs.JS_SetPropertyStr(ctx, global, "__tel_canvas", qjs.JS_NewCFunction(ctx, hostTelCanvas, "__tel_canvas", 0));
    _ = qjs.JS_SetPropertyStr(ctx, global, "__tel_net", qjs.JS_NewCFunction(ctx, hostTelNet, "__tel_net", 0));
    _ = qjs.JS_SetPropertyStr(ctx, global, "__tel_layout", qjs.JS_NewCFunction(ctx, hostTelLayout, "__tel_layout", 0));
    _ = qjs.JS_SetPropertyStr(ctx, global, "__tel_history", qjs.JS_NewCFunction(ctx, hostTelHistory, "__tel_history", 1));
    _ = qjs.JS_SetPropertyStr(ctx, global, "__tel_node_count", qjs.JS_NewCFunction(ctx, hostTelNodeCount, "__tel_node_count", 0));
    _ = qjs.JS_SetPropertyStr(ctx, global, "__tel_node", qjs.JS_NewCFunction(ctx, hostTelNode, "__tel_node", 1));
    _ = qjs.JS_SetPropertyStr(ctx, global, "__tel_node_style", qjs.JS_NewCFunction(ctx, hostTelNodeStyle, "__tel_node_style", 1));
    _ = qjs.JS_SetPropertyStr(ctx, global, "__tel_node_box_model", qjs.JS_NewCFunction(ctx, hostTelNodeBoxModel, "__tel_node_box_model", 1));

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
