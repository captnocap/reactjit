//! Paint functions — node rendering, canvas paths, inline glyphs, terminal cells.
//!
//! Extracted from engine.zig. Called by engine.run() each frame.

const std = @import("std");
const c = @import("c.zig").imports;
const layout = @import("layout.zig");
const gpu = @import("gpu/gpu.zig");
const geometry = @import("geometry.zig");
const selection = @import("selection.zig");
const svg_path = @import("svg_path.zig");
const input = @import("input.zig");
const classifier = @import("classifier.zig");
const semantic = @import("semantic.zig");
const text_mod = @import("text.zig");

const build_options = @import("build_options");
const HAS_CANVAS = if (@hasDecl(build_options, "has_canvas")) build_options.has_canvas else true;
const HAS_EFFECTS = if (@hasDecl(build_options, "has_effects")) build_options.has_effects else true;
const HAS_3D = if (@hasDecl(build_options, "has_3d")) build_options.has_3d else true;
const HAS_VIDEO = if (@hasDecl(build_options, "has_video")) build_options.has_video else true;
const HAS_RENDER_SURFACES = if (@hasDecl(build_options, "has_render_surfaces")) build_options.has_render_surfaces else true;
const HAS_BLEND2D = if (@hasDecl(build_options, "has_blend2d")) build_options.has_blend2d else false;
const HAS_TERMINAL = if (@hasDecl(build_options, "has_terminal")) build_options.has_terminal else true;

const vello_gfx = @import("vello.zig");
const blend2d_gfx = if (HAS_BLEND2D) @import("blend2d.zig") else struct {
    pub fn drawPath(_: anytype, _: anytype, _: anytype, _: anytype, _: anytype, _: anytype, _: anytype, _: anytype) void {}
};
const canvas = if (HAS_CANVAS) @import("canvas.zig") else struct {
    pub fn getSelectedNode() ?u32 { return null; }
    pub fn getHoveredNode() ?u32 { return null; }
    pub fn handleDrag(_: f32, _: f32) void {}
    pub fn getNodeDim(_: usize) f32 { return 1.0; }
    pub fn getFlowOverride(_: usize) bool { return true; }
};
const effects = if (HAS_EFFECTS) @import("effects.zig") else struct {
    pub fn paintEffect(_: anytype, _: f32, _: f32, _: f32, _: f32, _: f32) bool { return false; }
    pub fn paintCustomEffect(_: anytype, _: f32, _: f32, _: f32, _: f32, _: f32) bool { return false; }
};
const r3d = if (HAS_3D) @import("gpu/3d.zig") else struct {
    pub fn render(_: anytype, _: f32, _: f32, _: f32, _: f32, _: f32) bool { return false; }
};
const videos = if (HAS_VIDEO) @import("videos.zig") else struct {
    pub fn paintVideo(_: anytype, _: f32, _: f32, _: f32, _: f32, _: f32) bool { return false; }
};
const render_surfaces = if (HAS_RENDER_SURFACES) @import("render_surfaces.zig") else struct {
    pub fn paintSurface(_: anytype, _: f32, _: f32, _: f32, _: f32, _: f32) bool { return false; }
};
const vterm_mod = if (HAS_TERMINAL) @import("vterm.zig") else @import("vterm.zig");

const engine = @import("engine.zig");
const crashlog = @import("crashlog.zig");
const log = @import("log.zig");

const Node = layout.Node;
const Color = layout.Color;

const paisleyDebugEnabled = engine.paisleyDebugEnabled;
const positionCanvasNodes = engine.positionCanvasNodes;
const isPaisleyName = engine.isPaisleyName;
const brighten = engine.brighten;
const measureCallback = engine.measureCallback;
const termCellSelected = engine.termCellSelected;
// g_paisley_graph_logged_once: use engine.g_paisley_graph_logged_once directly
const offsetDescendants = engine.offsetDescendants;
const measureWidthOnly = engine.measureWidthOnly;

pub const PAINT_BUDGET: u32 = 50_000;
pub var g_paint_count: u32 = 0;
pub var g_hidden_count: u32 = 0;
pub var g_zero_count: u32 = 0;
pub var g_budget_exceeded: bool = false;
pub var g_dt_sec: f32 = 0;
pub var g_paint_opacity: f32 = 1.0; // global opacity multiplier for dim/highlight
var g_effect_bg_logged: bool = false;
var g_effect_child_seen: bool = false;
pub var g_flow_enabled: bool = true; // per-child flow override for hover mode
pub var g_hover_changed: bool = false; // debug flag
pub var g_semantic_overlay: bool = false; // Ctrl+Shift+D toggles semantic color overlay

// Canvas drag state — tracks which canvas is being dragged for pan
pub var canvas_drag_node: ?*Node = null;
pub var canvas_drag_last_x: f32 = 0;
pub var canvas_drag_last_y: f32 = 0;

// TextInput drag-select state
pub var input_drag_active: bool = false;
pub var input_drag_id: u8 = 0;
pub var input_drag_node_x: f32 = 0; // node rect x (for computing local_x)
pub var input_drag_node_pl: f32 = 0; // node padding-left
pub var input_drag_font_size: u16 = 0;

pub fn resetPaintCounters() void {
    g_paint_count = 0;
    g_budget_exceeded = false;
    g_hidden_count = 0;
}

pub fn paintNode(node: *Node) void {
    if (node.style.display == .none) { g_hidden_count += 1; log.info(.render, "hidden {s}", .{node.debug_name orelse "?"}); return; }
    g_paint_count += 1;
    if (g_paint_count > PAINT_BUDGET) {
        if (!g_budget_exceeded) {
            g_budget_exceeded = true;
            std.debug.print("[BUDGET] Paint pass exceeded {d} nodes — bailing (likely infinite loop)\n", .{PAINT_BUDGET});
        }
        return;
    }

    // Canvas.Path: draw before size check
    if (node.canvas_path or node.canvas_path_d != null) { paintCanvasPath(node); return; }

    const r = node.computed;
    if (r.w <= 0 or r.h <= 0) { g_zero_count += 1; log.info(.render, "zero-size {s} w={d:.0} h={d:.0}", .{node.debug_name orelse "?", r.w, r.h}); return; }

    // Apply node opacity (cascades to children via g_paint_opacity)
    const saved_opacity = g_paint_opacity;
    if (node.style.opacity < 1.0) {
        g_paint_opacity *= node.style.opacity;
    }
    if (g_paint_opacity <= 0) { g_paint_opacity = saved_opacity; return; }

    // Paint this node's visuals (background, text, input, selection)
    paintNodeVisuals(node);

    // Background effects — children with effect_background paint behind siblings
    for (node.children) |*child| {
        if (child.effect_render != null and !g_effect_child_seen) {
            g_effect_child_seen = true;
            std.debug.print("[effect-child-seen] parent={x} child={x} bg={} parent_rect={d}x{d} child_rect={d}x{d}\n", .{ @intFromPtr(node), @intFromPtr(child), child.effect_background, r.w, r.h, child.computed.w, child.computed.h });
        }
        if (child.effect_background and child.effect_render != null) {
            if (!g_effect_bg_logged) {
                g_effect_bg_logged = true;
                std.debug.print("[effect-bg-paint] firing parent={x} child={x} rect={d}x{d}\n", .{ @intFromPtr(node), @intFromPtr(child), r.w, r.h });
            }
            _ = effects.paintCustomEffect(child, r.x, r.y, r.w, r.h, g_paint_opacity);
        }
    }

    // Canvas rendering — separate heavy path
    if (node.canvas_type != null) { paintCanvasContainer(node); return; }

    // Graph container — lightweight canvas with transform for SVG path children
    if (node.graph_container) {
        if (paisleyDebugEnabled() and !engine.g_paisley_graph_logged_once) {
            engine.g_paisley_graph_logged_once = true;
            std.debug.print("[paisley] graphContainer node={x} children={d}\n", .{ @intFromPtr(node), node.children.len });
            const sample_count = @min(node.children.len, 8);
            for (0..sample_count) |i| {
                const child = &node.children[i];
                std.debug.print(
                    "[paisley] graphChild[{d}] node={x} path={any} has_d={any} child_count={d} fillEffect={s}\n",
                    .{
                        i,
                        @intFromPtr(child),
                        child.canvas_path,
                        child.canvas_path_d != null,
                        child.children.len,
                        child.canvas_fill_effect orelse "",
                    },
                );
            }
        }
        gpu.pushScissor(r.x, r.y, r.w, r.h);
        // Set up transform: graph-space center (viewX,viewY) maps to element center
        const vx: f32 = node.canvas_view_x;
        const vy: f32 = node.canvas_view_y;
        const vz: f32 = if (node.canvas_view_zoom > 0) node.canvas_view_zoom else 1.0;
        const cx = r.x + r.w / 2;
        const cy = r.y + r.h / 2;
        const g_tx_raw = cx - vx * vz;
        const g_ty_raw = cy - vy * vz;
        const snap_graph_transform = @abs(vz - 1.0) < 0.001;
        const g_tx = if (snap_graph_transform) @floor(g_tx_raw) + 0.5 else g_tx_raw;
        const g_ty = if (snap_graph_transform) @floor(g_ty_raw) + 0.5 else g_ty_raw;
        gpu.setTransform(0, 0, g_tx, g_ty, vz);
        for (node.children) |*child| paintNode(child);
        gpu.resetTransform();
        gpu.popScissor();
        return;
    }

    // Overflow clipping + scroll offset + recurse children
    const ov = node.style.overflow;
    const is_scroll = (ov == .scroll or (ov == .auto and node.content_height > r.h));
    const is_clipped = is_scroll or ov == .hidden;

    if (is_clipped) gpu.pushScissor(r.x, r.y, r.w, r.h);

    if (is_scroll and (node.scroll_x != 0 or node.scroll_y != 0)) {
        const sx = node.scroll_x;
        const sy = node.scroll_y;
        offsetDescendants(node, -sx, -sy);
        for (node.children) |*child| if (!child.effect_background) paintNode(child);
        offsetDescendants(node, sx, sy);
    } else {
        for (node.children) |*child| if (!child.effect_background) paintNode(child);
    }

    if (is_clipped) gpu.popScissor();
    g_paint_opacity = saved_opacity;
}

/// Paint a Canvas.Path node (SVG stroke curves + optional blend2d fill).
/// Standalone path nodes (canvas_path_d set, canvas_path false) auto-scale
/// their 24×24 viewbox paths to fit the node's computed rect — used for icons.
pub fn paintCanvasPath(node: *Node) callconv(.auto) void {
    @setRuntimeSafety(false);
    if (node.canvas_path_d) |d| {
        const tc = node.text_color orelse Color.rgb(255, 255, 255);

        // Standalone path (icon mode): scale path to fit node bounds
        const r = node.computed;
        const is_icon = !node.canvas_path and r.w > 0 and r.h > 0;
        if (is_icon) {
            // Lucide icons use a 24×24 viewbox
            const vb: f32 = 24.0;
            const scale = @min(r.w / vb, r.h / vb);
            const ox = r.x + (r.w - vb * scale) / 2;
            const oy = r.y + (r.h - vb * scale) / 2;
            gpu.setTransform(0, 0, ox, oy, scale);
        }

        // Fill pass — either from named effect texture or flat color
        if (node.canvas_fill_effect) |ename| {
            // Look up the named effect's pixel buffer and fill triangles with sampled colors
            if (effects.getEffectFill(ename)) |info| {
                const fill_path = svg_path.parsePath(d);
                // Compute path bounding box for UV mapping
                var min_x: f32 = 1e9;
                var min_y: f32 = 1e9;
                var max_x: f32 = -1e9;
                var max_y: f32 = -1e9;
                for (0..fill_path.subpath_count) |si2| {
                    const sp2 = &fill_path.subpaths[si2];
                    var pi2: u32 = 0;
                    while (pi2 + 1 < sp2.count) : (pi2 += 2) {
                        if (sp2.points[pi2] < min_x) min_x = sp2.points[pi2];
                        if (sp2.points[pi2 + 1] < min_y) min_y = sp2.points[pi2 + 1];
                        if (sp2.points[pi2] > max_x) max_x = sp2.points[pi2];
                        if (sp2.points[pi2 + 1] > max_y) max_y = sp2.points[pi2 + 1];
                    }
                }
                if (paisleyDebugEnabled() and isPaisleyName(ename)) {
                    std.debug.print(
                        "[paisley] paintCanvasPath name={s} d_len={d} bbox=({d:.1},{d:.1},{d:.1},{d:.1}) stroke_w={d:.2} curve_count={d} subpaths={d}\n",
                        .{
                            ename,
                            d.len,
                            min_x,
                            min_y,
                            max_x - min_x,
                            max_y - min_y,
                            node.canvas_stroke_width,
                            fill_path.curve_count,
                            fill_path.subpath_count,
                        },
                    );
                }
                if (HAS_BLEND2D) {
                    blend2d_gfx.fillSVGPathFromEffect(
                        d,
                        info.pixel_buf,
                        info.width,
                        info.height,
                        min_x,
                        min_y,
                        max_x - min_x,
                        max_y - min_y,
                        g_paint_opacity,
                        @as(f32, @floatFromInt(tc.r)) / 255.0,
                        @as(f32, @floatFromInt(tc.g)) / 255.0,
                        @as(f32, @floatFromInt(tc.b)) / 255.0,
                        @as(f32, @floatFromInt(tc.a)) / 255.0,
                        node.canvas_stroke_width,
                    );
                } else {
                    svg_path.drawFillFromEffect(
                        &fill_path,
                        info.pixel_buf,
                        info.width,
                        info.height,
                        min_x, min_y, max_x - min_x, max_y - min_y,
                    );
                }
            } else if (paisleyDebugEnabled() and isPaisleyName(ename)) {
                std.debug.print("[paisley] paintCanvasPath name={s} missing fill source\n", .{ename});
            }
        } else if (node.canvas_fill_color) |fc| {
            const fill_path = svg_path.parsePath(d);
            svg_path.drawFill(&fill_path,
                @as(f32, @floatFromInt(fc.r)) / 255.0, @as(f32, @floatFromInt(fc.g)) / 255.0,
                @as(f32, @floatFromInt(fc.b)) / 255.0, @as(f32, @floatFromInt(fc.a)) / 255.0 * g_paint_opacity);
        }
        // Stroke pass — auto-AA fill-color stroke (2px) + user-specified stroke
        const path = svg_path.parsePath(d);
        const flow = if (g_flow_enabled) node.canvas_flow_speed else @as(f32, 0);
        const ticks = @as(u32, @truncate(c.SDL_GetTicks()));
        // Auto-AA: fill-color stroke covers jagged triangle-fan fill edges
        if (node.canvas_fill_color) |fc| {
            svg_path.drawStrokeCurves(&path,
                @as(f32, @floatFromInt(fc.r)) / 255.0, @as(f32, @floatFromInt(fc.g)) / 255.0,
                @as(f32, @floatFromInt(fc.b)) / 255.0, @as(f32, @floatFromInt(fc.a)) / 255.0 * g_paint_opacity,
                10.0, flow, ticks);
        }
        // User-specified stroke
        svg_path.drawStrokeCurves(
            &path,
            @as(f32, @floatFromInt(tc.r)) / 255.0,
            @as(f32, @floatFromInt(tc.g)) / 255.0,
            @as(f32, @floatFromInt(tc.b)) / 255.0,
            @as(f32, @floatFromInt(tc.a)) / 255.0 * g_paint_opacity,
            node.canvas_stroke_width, flow, ticks,
        );

        if (is_icon) gpu.resetTransform();
    }
}

/// Paint a box shadow using the multi-rect approach (Love2D method).
/// Draws N expanded rectangles from outermost to innermost with fading alpha.
fn paintShadowMultiRect(r: layout.LayoutRect, style: layout.Style, sc: Color) void {
    @setRuntimeSafety(false);
    const blur = style.shadow_blur;
    if (blur <= 0) return;

    var steps: u32 = @intFromFloat(@ceil(blur));
    if (steps > 10) steps = 10;
    if (steps < 1) steps = 1;

    const base_alpha = @as(f32, @floatFromInt(sc.a)) / 255.0 * g_paint_opacity;
    const sr = @as(f32, @floatFromInt(sc.r)) / 255.0;
    const sg = @as(f32, @floatFromInt(sc.g)) / 255.0;
    const sb = @as(f32, @floatFromInt(sc.b)) / 255.0;
    const ox = style.shadow_offset_x;
    const oy = style.shadow_offset_y;
    const fsteps = @as(f32, @floatFromInt(steps));

    var i: u32 = steps;
    while (i >= 1) : (i -= 1) {
        const expand = @as(f32, @floatFromInt(i));
        const alpha = (base_alpha / fsteps) * (fsteps - expand + 1);
        const rad = style.radiusTL() + expand;
        gpu.drawRectCorners(
            r.x + ox - expand, r.y + oy - expand,
            r.w + expand * 2, r.h + expand * 2,
            sr, sg, sb, alpha,
            rad, rad, rad, rad,
            0, 0, 0, 0, 0,
        );
    }
}

/// Paint a box shadow using SDF blur (shader method).
/// Emits a single expanded rect; the fragment shader widens the SDF falloff.
fn paintShadowSDF(r: layout.LayoutRect, style: layout.Style, sc: Color) void {
    @setRuntimeSafety(false);
    const blur = style.shadow_blur;
    if (blur <= 0) return;

    const sa = @as(f32, @floatFromInt(sc.a)) / 255.0 * g_paint_opacity;
    const sr = @as(f32, @floatFromInt(sc.r)) / 255.0;
    const sg = @as(f32, @floatFromInt(sc.g)) / 255.0;
    const sb = @as(f32, @floatFromInt(sc.b)) / 255.0;
    const ox = style.shadow_offset_x;
    const oy = style.shadow_offset_y;

    gpu.drawRectShadow(
        r.x + ox, r.y + oy, r.w, r.h,
        sr, sg, sb, sa,
        style.radiusTL(), style.radiusTR(), style.radiusBR(), style.radiusBL(),
        blur,
    );
}

/// Paint node visuals: background, hover, text, selection, text input.
/// Separated from paintNode to reduce the recursive frame size.
noinline fn paintNodeVisuals(node: *Node) void {
    const r = node.computed;
    const is_hovered = (engine.hovered_node == node) and (node.handlers.on_hover_enter != null or node.handlers.on_hover_exit != null or node.handlers.js_on_hover_enter != null or node.handlers.lua_on_hover_enter != null or node.handlers.js_on_hover_exit != null or node.handlers.lua_on_hover_exit != null or node.hoverable);

    // Box shadow — draw BEFORE background so it appears behind
    if (node.style.shadow_color) |sc| {
        if (node.style.shadow_blur > 0) {
            paintShadowSDF(r, node.style, sc);
        }
    }

    if (is_hovered and node.style.background_color == null) {
        gpu.drawRectCorners(r.x, r.y, r.w, r.h, 0.15, 0.15, 0.22, 0.6,
            node.style.radiusTL(), node.style.radiusTR(), node.style.radiusBR(), node.style.radiusBL(),
            0, 0, 0, 0, 0);
    }

    if (node.style.background_color) |bg_raw| {
        if (bg_raw.a > 0) {
            const bg = if (is_hovered) brighten(bg_raw, 20) else bg_raw;
            const bc = node.style.border_color orelse Color.rgb(0, 0, 0);
            const has_transform = node.style.rotation != 0 or node.style.scale_x != 1.0 or node.style.scale_y != 1.0;
            if (has_transform) {
                gpu.drawRectCornersTransformed(
                    r.x, r.y, r.w, r.h,
                    @as(f32, @floatFromInt(bg.r)) / 255.0, @as(f32, @floatFromInt(bg.g)) / 255.0,
                    @as(f32, @floatFromInt(bg.b)) / 255.0, @as(f32, @floatFromInt(bg.a)) / 255.0 * g_paint_opacity,
                    node.style.radiusTL(), node.style.radiusTR(), node.style.radiusBR(), node.style.radiusBL(),
                    node.style.brdTop(),
                    @as(f32, @floatFromInt(bc.r)) / 255.0, @as(f32, @floatFromInt(bc.g)) / 255.0,
                    @as(f32, @floatFromInt(bc.b)) / 255.0, @as(f32, @floatFromInt(bc.a)) / 255.0 * g_paint_opacity,
                    node.style.rotation, node.style.scale_x, node.style.scale_y,
                );
            } else if (node.style.gradient_color_end) |ge| {
                if (node.style.gradient_direction != .none) {
                    const dir: f32 = switch (node.style.gradient_direction) {
                        .vertical => 1.0,
                        .horizontal => 2.0,
                        else => 0.0,
                    };
                    gpu.drawRectGradient(
                        r.x, r.y, r.w, r.h,
                        @as(f32, @floatFromInt(bg.r)) / 255.0, @as(f32, @floatFromInt(bg.g)) / 255.0,
                        @as(f32, @floatFromInt(bg.b)) / 255.0, @as(f32, @floatFromInt(bg.a)) / 255.0 * g_paint_opacity,
                        node.style.radiusTL(), node.style.radiusTR(), node.style.radiusBR(), node.style.radiusBL(),
                        node.style.brdTop(),
                        @as(f32, @floatFromInt(bc.r)) / 255.0, @as(f32, @floatFromInt(bc.g)) / 255.0,
                        @as(f32, @floatFromInt(bc.b)) / 255.0, @as(f32, @floatFromInt(bc.a)) / 255.0 * g_paint_opacity,
                        @as(f32, @floatFromInt(ge.r)) / 255.0, @as(f32, @floatFromInt(ge.g)) / 255.0,
                        @as(f32, @floatFromInt(ge.b)) / 255.0, @as(f32, @floatFromInt(ge.a)) / 255.0 * g_paint_opacity,
                        dir,
                    );
                } else {
                    gpu.drawRectCorners(
                        r.x, r.y, r.w, r.h,
                        @as(f32, @floatFromInt(bg.r)) / 255.0, @as(f32, @floatFromInt(bg.g)) / 255.0,
                        @as(f32, @floatFromInt(bg.b)) / 255.0, @as(f32, @floatFromInt(bg.a)) / 255.0 * g_paint_opacity,
                        node.style.radiusTL(), node.style.radiusTR(), node.style.radiusBR(), node.style.radiusBL(),
                        node.style.brdTop(),
                        @as(f32, @floatFromInt(bc.r)) / 255.0, @as(f32, @floatFromInt(bc.g)) / 255.0,
                        @as(f32, @floatFromInt(bc.b)) / 255.0, @as(f32, @floatFromInt(bc.a)) / 255.0 * g_paint_opacity,
                    );
                }
            } else {
                gpu.drawRectCorners(
                    r.x, r.y, r.w, r.h,
                    @as(f32, @floatFromInt(bg.r)) / 255.0, @as(f32, @floatFromInt(bg.g)) / 255.0,
                    @as(f32, @floatFromInt(bg.b)) / 255.0, @as(f32, @floatFromInt(bg.a)) / 255.0 * g_paint_opacity,
                    node.style.radiusTL(), node.style.radiusTR(), node.style.radiusBR(), node.style.radiusBL(),
                    node.style.brdTop(),
                    @as(f32, @floatFromInt(bc.r)) / 255.0, @as(f32, @floatFromInt(bc.g)) / 255.0,
                    @as(f32, @floatFromInt(bc.b)) / 255.0, @as(f32, @floatFromInt(bc.a)) / 255.0 * g_paint_opacity,
                );
            }
        }
    }

    // Border without background — draw border-only rect with transparent fill
    if (node.style.background_color == null and (node.style.brdTop() > 0 or node.style.border_width > 0)) {
        if (node.style.border_color) |bc| {
            gpu.drawRectCorners(
                r.x, r.y, r.w, r.h,
                0, 0, 0, 0,
                node.style.radiusTL(), node.style.radiusTR(), node.style.radiusBR(), node.style.radiusBL(),
                node.style.brdTop(),
                @as(f32, @floatFromInt(bc.r)) / 255.0, @as(f32, @floatFromInt(bc.g)) / 255.0,
                @as(f32, @floatFromInt(bc.b)) / 255.0, @as(f32, @floatFromInt(bc.a)) / 255.0 * g_paint_opacity,
            );
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
        _ = render_fn;
        if (node.effect_name) |ename| {
            _ = effects.paintNamedEffect(node, ename, r.x, r.y, r.w, r.h);
        } else {
            _ = effects.paintCustomEffect(node, r.x, r.y, r.w, r.h, g_paint_opacity);
        }
    }
    // 3D.View — 3D viewport rendered offscreen, composited here
    if (node.scene3d) {
        _ = r3d.render(node, r.x, r.y, r.w, r.h, g_paint_opacity);
    }

    selection.paintHighlight(node, r.x, r.y);

    // Terminal — cell-grid rendering via vterm
    if (node.terminal) {
        crashlog.logFmt("paint:term id={d}", .{node.terminal_id});
        paintTerminal(node);
        crashlog.log("paint:term-done");
    }

    if (node.text) |t| {
        // Skip text rendering for TextInput nodes — the input buffer paints instead
        if (t.len > 0 and node.input_id == null) {
            const tc = node.text_color orelse Color.rgb(255, 255, 255);
            const pl = node.style.padLeft();
            const pt = node.style.padTop();
            const pr = node.style.padRight();
            const final_a = @as(f32, @floatFromInt(tc.a)) / 255.0 * g_paint_opacity;
            gpu.resetInlineSlots();
            // Set up text effect if present
            if (node.text_effect) |ename| {
                if (effects.getEffectFill(ename)) |info| {
                    gpu.setTextEffect(info.pixel_buf, info.width, info.height, info.screen_x, info.screen_y);
                }
            }
            const text_h = gpu.drawTextWrapped(
                t, r.x + pl, r.y + pt, node.font_size, @max(1.0, r.w - pl - pr),
                @as(f32, @floatFromInt(tc.r)) / 255.0, @as(f32, @floatFromInt(tc.g)) / 255.0,
                @as(f32, @floatFromInt(tc.b)) / 255.0, final_a, node.number_of_lines,
            );
            // Render inline glyphs into recorded slot positions
            if (node.inline_glyphs) |glyphs| {
                paintInlineGlyphs(glyphs, node.font_size);
            }
            if (node.text_effect != null) gpu.clearTextEffect();
            // Underline for href links — span text content width, not node width
            if (node.href != null) {
                const text_w = measureWidthOnly(t, node.font_size);
                const underline_y = r.y + pt + text_h - 2;
                gpu.drawRect(r.x + pl, underline_y, text_w, 1,
                    @as(f32, @floatFromInt(tc.r)) / 255.0, @as(f32, @floatFromInt(tc.g)) / 255.0,
                    @as(f32, @floatFromInt(tc.b)) / 255.0, final_a * 0.6,
                    0, 0, 0, 0, 0, 0);
            }
        }
    }

    if (node.input_id) |id| {
        // Seed input buffer from value binding (node.text) when unfocused and buffer is empty/stale
        if (node.text) |t| {
            if (t.len > 0 and !input.isFocused(id)) {
                const current = input.getText(id);
                if (!std.mem.eql(u8, current, t)) {
                    input.setText(id, t);
                }
            }
        }
        paintTextInput(node, id);
    }
}

/// Render inline glyphs (polygons embedded in text) at their recorded slot positions.
pub fn paintInlineGlyphs(glyphs: []const layout.InlineGlyph, font_size: u16) void {
    const slot_count = gpu.getInlineSlotCount();
    const slots = gpu.getInlineSlots();
    var gi: usize = 0;
    while (gi < slot_count and gi < glyphs.len) : (gi += 1) {
        const slot = slots[gi];
        const glyph = glyphs[gi];
        const slot_size = slot.size * glyph.scale;
        if (slot_size <= 0) continue;
        const path = svg_path.parsePath(glyph.d);
        if (path.subpath_count == 0) continue;
        // Compute path bounding box
        var min_x: f32 = 1e9;
        var min_y: f32 = 1e9;
        var max_x: f32 = -1e9;
        var max_y: f32 = -1e9;
        for (0..path.subpath_count) |si| {
            const sp = &path.subpaths[si];
            var pi: u32 = 0;
            while (pi + 1 < sp.count) : (pi += 2) {
                if (sp.points[pi] < min_x) min_x = sp.points[pi];
                if (sp.points[pi + 1] < min_y) min_y = sp.points[pi + 1];
                if (sp.points[pi] > max_x) max_x = sp.points[pi];
                if (sp.points[pi + 1] > max_y) max_y = sp.points[pi + 1];
            }
        }
        const pw = max_x - min_x;
        const ph = max_y - min_y;
        if (pw <= 0 or ph <= 0) continue;
        // Scale to fit slot, centered
        const scale = @min(slot_size / pw, slot_size / ph);
        const cx_path = (min_x + max_x) / 2;
        const cy_path = (min_y + max_y) / 2;
        const cx_slot = slot.x + slot_size / 2;
        const cy_slot = slot.y + @as(f32, @floatFromInt(font_size)) / 2;
        // Transform: translate path center to slot center, scale around slot center
        gpu.setTransform(cx_path, cy_path, cx_slot - cx_path * scale, cy_slot - cy_path * scale, scale);
        // Fill: effect texture or flat color
        var used_effect = false;
        if (glyph.fill_effect) |ename| {
            if (effects.getEffectFill(ename)) |info| {
                // Always use direct triangle fill for inline glyphs (no blend2d —
                // blend2d uses a shared surface that gets overwritten between glyphs)
                svg_path.drawFillFromEffect(&path, info.pixel_buf, info.width, info.height, min_x, min_y, pw, ph);
                used_effect = true;
            }
        }
        if (!used_effect) {
            const fc = glyph.fill;
            svg_path.drawFill(&path,
                @as(f32, @floatFromInt(fc.r)) / 255.0, @as(f32, @floatFromInt(fc.g)) / 255.0,
                @as(f32, @floatFromInt(fc.b)) / 255.0, @as(f32, @floatFromInt(fc.a)) / 255.0 * g_paint_opacity);
        }
        // Stroke
        if (glyph.stroke_width > 0 and glyph.stroke.a > 0) {
            const sc = glyph.stroke;
            svg_path.drawStrokeCurves(&path,
                @as(f32, @floatFromInt(sc.r)) / 255.0, @as(f32, @floatFromInt(sc.g)) / 255.0,
                @as(f32, @floatFromInt(sc.b)) / 255.0, @as(f32, @floatFromInt(sc.a)) / 255.0 * g_paint_opacity,
                glyph.stroke_width, 0, 0);
        }
        gpu.resetTransform();
    }
}

/// Paint TextInput: typed text, placeholder, selection highlight, blinking cursor.
noinline fn paintTextInput(node: *Node, id: u8) void {
    const r = node.computed;
    if (input.isFocused(id)) {
        const pad: f32 = 4;
        gpu.drawRect(r.x - pad, r.y - pad, r.w + pad * 2, r.h + pad * 2, 0, 0, 0, 0, 5, 1.5, 1.5, 1.5, 1.5, 0.30);
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
    if (input.isFocused(id) and engine.g_cursor_visible) {
        const cursor_pos = input.getCursorPos(id);
        const pl = node.style.padLeft();
        const pt = node.style.padTop();
        const pb = node.style.padBottom();
        const is_multiline = input.isMultiline(id);
        const metrics = measureCallback(
            typed[0..cursor_pos],
            node.font_size,
            r.w - pl - node.style.padRight(),
            0,
            0,
            if (is_multiline) 0 else 1,
            !is_multiline,
        );
        const cx = r.x + pl + metrics.width;
        const ch = r.h - pt - pb;
        gpu.drawRect(cx, r.y + pt, 2, @max(ch, 4), 1, 1, 1, 0.8, 0, 0, 0, 0, 0, 0);
    }
}

/// Paint a Terminal node: cell-grid rendering via vterm.
/// Each cell gets its own fg color; non-default backgrounds get a bg rect.
/// Uses span-based batching: consecutive cells with the same fg are drawn as one string.
noinline fn paintTerminal(node: *Node) void {
    const ti = node.terminal_id;
    const r = node.computed;
    const font_size = node.terminal_font_size;
    const padding: f32 = 4;

    // Sanity check: don't paint if vterm not initialized
    if (vterm_mod.getRowsIdx(ti) == 0) {
        crashlog.logFmt("paint:skip id={d} rows=0", .{ti});
        return;
    }

    const cell_w = gpu.getCharWidth(font_size);
    const cell_h = gpu.getLineHeight(font_size);
    if (cell_w <= 0 or cell_h <= 0) return;

    const avail_w = r.w - padding * 2;
    const avail_h = r.h - padding * 2;
    const cols: u16 = @intFromFloat(@max(1, @floor(avail_w / cell_w)));
    const rows: u16 = @intFromFloat(@max(1, @floor(avail_h / cell_h)));

    // Auto-resize vterm to match layout (only if changed)
    const vt_rows = vterm_mod.getRowsIdx(ti);
    const vt_cols = vterm_mod.getColsIdx(ti);
    if (vt_rows != rows or vt_cols != cols) {
        vterm_mod.resizeVtermIdx(ti, rows, cols);
    }

    const base_x = r.x + padding;
    const base_y = r.y + padding;

    // Scrollback: when scrolled up, top rows come from scrollback, rest from live screen
    const scroll_off = vterm_mod.scrollOffsetIdx(ti);
    const sb_visible: u16 = @min(scroll_off, rows);

    // Draw cells row by row
    var row: u16 = 0;
    while (row < rows) : (row += 1) {
        const cy = base_y + @as(f32, @floatFromInt(row)) * cell_h;

        // Alternating row background for visual tracking
        if (row % 2 == 1) {
            gpu.drawRect(base_x, cy, avail_w, cell_h, 1.0, 1.0, 1.0, 0.02 * g_paint_opacity, 0, 0, 0, 0, 0, 0);
        }

        // Left accent bar: bright for classified tokens, dim for output
        if (row >= sb_visible) {
            const live_r = row - sb_visible;
            const tok = classifier.getRowTokenIdx(ti, live_r);
            if (tok != .output and tok != .text) {
                const ac = classifier.tokenColor(tok);
                gpu.drawRect(r.x, cy, 2, cell_h,
                    @as(f32, @floatFromInt(ac.r)) / 255.0,
                    @as(f32, @floatFromInt(ac.g)) / 255.0,
                    @as(f32, @floatFromInt(ac.b)) / 255.0,
                    0.9 * g_paint_opacity, 0, 0, 0, 0, 0, 0);
            } else {
                gpu.drawRect(r.x, cy + cell_h * 0.35, 2, cell_h * 0.3, 0.3, 0.33, 0.4, 0.25 * g_paint_opacity, 0, 0, 0, 0, 0, 0);
            }
        }

        var col: u16 = 0;
        while (col < cols) : (col += 1) {
            const cell = if (row < sb_visible)
                vterm_mod.getScrollbackCellIdx(ti, row, col)
            else
                vterm_mod.getCellIdx(ti, row - sb_visible, col);
            const cx = base_x + @as(f32, @floatFromInt(col)) * cell_w;

            // Selection highlight
            if (termCellSelected(row, col)) {
                gpu.drawRect(cx, cy, cell_w, cell_h, 0.3, 0.45, 0.8, 0.45 * g_paint_opacity, 0, 0, 0, 0, 0, 0);
            }

            // Background rect (non-default bg only)
            if (cell.bg) |bg| {
                const actual_bg = if (cell.reverse) (cell.fg orelse @TypeOf(cell.fg.?){ .r = 204, .g = 204, .b = 204 }) else bg;
                gpu.drawRect(cx, cy, cell_w * @as(f32, @floatFromInt(cell.width)), cell_h,
                    @as(f32, @floatFromInt(actual_bg.r)) / 255.0,
                    @as(f32, @floatFromInt(actual_bg.g)) / 255.0,
                    @as(f32, @floatFromInt(actual_bg.b)) / 255.0,
                    g_paint_opacity, 0, 0, 0, 0, 0, 0);
            }

            // Foreground glyph — semantic color for live rows, cell color for scrollback
            if (cell.char_len > 0 and cell.char_buf[0] != ' ') {
                const default_fg = @TypeOf(cell.fg.?){ .r = 204, .g = 204, .b = 204 };
                const raw_fg = if (cell.reverse) (cell.bg orelse @TypeOf(cell.bg.?){ .r = 0, .g = 0, .b = 0 }) else (cell.fg orelse default_fg);
                // Use semantic classifier color for live screen rows (only when overlay active)
                const fg = if (g_semantic_overlay and row >= sb_visible) blk: {
                    const live_row = row - sb_visible;
                    const token = classifier.getRowTokenIdx(ti, live_row);
                    if (token != .output and token != .text) {
                        const tc = classifier.tokenColor(token);
                        break :blk @TypeOf(raw_fg){ .r = tc.r, .g = tc.g, .b = tc.b };
                    }
                    break :blk raw_fg;
                } else raw_fg;
                gpu.drawGlyphAt(
                    cell.char_buf[0..cell.char_len],
                    cx, cy, font_size,
                    @as(f32, @floatFromInt(fg.r)) / 255.0,
                    @as(f32, @floatFromInt(fg.g)) / 255.0,
                    @as(f32, @floatFromInt(fg.b)) / 255.0,
                    g_paint_opacity,
                );
            }

            // Skip wide characters (CJK occupies 2 cells)
            if (cell.width > 1) col += cell.width - 1;
        }
    }

    // Scrollback indicator — dim bar at top when scrolled up
    if (scroll_off > 0) {
        gpu.drawRect(base_x, r.y, avail_w, 2, 0.5, 0.5, 0.8, 0.6 * g_paint_opacity, 0, 0, 0, 0, 0, 0);
    }

    // Cursor — only show when at live view (not scrolled up)
    if (scroll_off == 0 and vterm_mod.getCursorVisibleIdx(ti) and engine.g_cursor_visible) {
        const crow = vterm_mod.getCursorRowIdx(ti);
        const ccol = vterm_mod.getCursorColIdx(ti);
        if (crow < rows and ccol < cols) {
            const cx = base_x + @as(f32, @floatFromInt(ccol)) * cell_w;
            const cy_cur = base_y + @as(f32, @floatFromInt(crow)) * cell_h;
            gpu.drawRect(cx, cy_cur, cell_w, cell_h, 0.8, 0.8, 0.8, 0.7 * g_paint_opacity, 0, 0, 0, 0, 0, 0);
        }
    }
}

/// Paint a single canvas child (Canvas.Path or Canvas.Node) with highlight + dim/flow.
fn paintCanvasChild(child: *Node, child_idx: u16, hovered: ?u16, selected: ?u16) void {
    if (child.canvas_node) {
        const node_selected = selected != null and selected.? == child_idx;
        const node_hovered = hovered != null and hovered.? == child_idx;
        if (node_selected) {
            const hw = child.canvas_gw / 2 + 5;
            const hh = child.canvas_gh / 2 + 5;
            gpu.drawRect(child.canvas_gx - hw, child.canvas_gy - hh, hw * 2, hh * 2, 0.5, 0.4, 1.0, 0.4, 8, 2, 2, 2, 2, 1.0);
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

/// Paint a Canvas container: transform setup, graph children, HUD layer.
noinline fn paintCanvasContainer(node: *Node) void {
    const r = node.computed;
    const ct = node.canvas_type.?;
    if (node.canvas_view_set) {
        canvas.setCamera(node.canvas_view_x, node.canvas_view_y, node.canvas_view_zoom);
        node.canvas_view_set = false;
    }
    // Apply drift — continuous camera animation (pauses during drag or node selection)
    if (node.canvas_drift_active and canvas_drag_node == null and canvas.getSelectedNode() == null and g_dt_sec > 0) {
        canvas.handleDrag(-node.canvas_drift_x * g_dt_sec, -node.canvas_drift_y * g_dt_sec);
    }
    gpu.pushScissor(r.x, r.y, r.w, r.h);
    canvas.renderCanvas(ct, r.x, r.y, r.w, r.h);
    positionCanvasNodes(node);
    const cam = canvas.getCameraTransform(r.x, r.y, r.w, r.h);
    const vp_cx = r.x + r.w / 2;
    const vp_cy = r.y + r.h / 2;
    const tx = vp_cx - cam.cx * cam.scale;
    const ty = vp_cy - cam.cy * cam.scale;
    // DEBUG: prove subpixel offset theory — remove after diagnosis
    {
        const S = struct { var logged: bool = false; };
        if (!S.logged) {
            S.logged = true;
            std.debug.print("[canvas-debug] w={d:.1} h={d:.1} vp_cx={d:.2} vp_cy={d:.2} tx={d:.2} ty={d:.2} scale={d:.3}\n", .{ r.w, r.h, vp_cx, vp_cy, tx, ty, cam.scale });
        }
    }
    gpu.setTransform(0, 0, tx, ty, cam.scale);
    {
        const hovered = canvas.getHoveredNode();
        const selected = canvas.getSelectedNode();
        var child_idx: u16 = 0;
        for (node.children) |*child| {
            if (child.canvas_clamp) continue;
            if (child.canvas_node or child.canvas_path) {
                paintCanvasChild(child, child_idx, hovered, selected);
                child_idx += 1;
            } else {
                // Flatten through non-canvas container (map pool wrapper)
                for (child.children) |*gc| {
                    if (gc.canvas_clamp) continue;
                    paintCanvasChild(gc, child_idx, hovered, selected);
                    child_idx += 1;
                }
            }
        }
    }
    gpu.resetTransform();
    // Force a scissor segment boundary so tile text (batched) renders
    // BEFORE the clamp's background rect. Without this, all rects draw
    // first then all text — tile text bleeds over the clamp background.
    gpu.popScissor();
    gpu.pushScissor(r.x, r.y, r.w, r.h);
    for (node.children) |*child| {
        if (child.canvas_clamp) {
            layout.layoutNode(child, r.x, r.y, r.w, r.h);
            paintNode(child);
        } else if (!child.canvas_node and !child.canvas_path) {
            for (child.children) |*gc| {
                if (gc.canvas_clamp) {
                    layout.layoutNode(gc, r.x, r.y, r.w, r.h);
                    paintNode(gc);
                }
            }
        }
    }
    gpu.popScissor();
}
