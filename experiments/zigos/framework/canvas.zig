//! Unified Canvas System — Built-in zoom/pan camera + optional custom renderers.
//!
//! Every <Canvas> gets zoom (scroll wheel) and pan (drag) for free.
//! Content is composed with <Canvas.Node gx={} gy={} gw={} gh={}> children
//! which are real framework nodes (Box, Text, etc.) positioned in graph space.
//!
//! Optional: register a custom render_fn for a canvas type to draw procedural
//! content (connector lines, grids, particles) alongside the framework nodes.

const std = @import("std");
const gpu = @import("gpu/gpu.zig");

// ── Camera Transform ────────────────────────────────────────────────────

pub const CameraTransform = struct {
    cx: f32,      // camera center X in graph space
    cy: f32,      // camera center Y in graph space
    scale: f32,   // zoom scale factor (1.0 = 1:1)
};

// ── Built-in camera state (shared by all canvas instances for now) ──────

var cam_x: f32 = 0;
var cam_y: f32 = 0;
var cam_zoom: f32 = 1.0;

// ── Canvas Renderer Interface (optional, for custom drawing) ────────────

pub const CanvasRenderer = struct {
    /// Custom render pass — draws before Canvas.Node children.
    /// Use for connector lines, grids, overlays, etc.
    render_fn: *const fn (x: f32, y: f32, w: f32, h: f32, cam: CameraTransform) void,
};

// ── Registry (for custom renderers) ─────────────────────────────────────

const MAX_CANVAS_TYPES = 32;

var type_names: [MAX_CANVAS_TYPES][]const u8 = undefined;
var type_renderers: [MAX_CANVAS_TYPES]CanvasRenderer = undefined;
var type_count: usize = 0;
var initialized: bool = false;

pub fn register(name: []const u8, renderer: CanvasRenderer) void {
    if (type_count >= MAX_CANVAS_TYPES) return;
    for (0..type_count) |i| {
        if (std.mem.eql(u8, type_names[i], name)) {
            type_renderers[i] = renderer;
            return;
        }
    }
    type_names[type_count] = name;
    type_renderers[type_count] = renderer;
    type_count += 1;
}

pub fn get(name: []const u8) ?*const CanvasRenderer {
    for (0..type_count) |i| {
        if (std.mem.eql(u8, type_names[i], name)) return &type_renderers[i];
    }
    return null;
}

// ── Lifecycle ───────────────────────────────────────────────────────────

pub fn init() void {
    if (initialized) return;
    initialized = true;
    cam_x = 0;
    cam_y = 0;
    cam_zoom = 1.0;
}

/// Set camera position and zoom (called from initial viewport props).
pub fn setCamera(cx: f32, cy: f32, zoom: f32) void {
    cam_x = cx;
    cam_y = cy;
    cam_zoom = zoom;
}

// ── Rendering ───────────────────────────────────────────────────────────

/// Render the canvas background + optional custom render pass.
/// Called by engine before painting Canvas.Node children.
pub fn renderCanvas(canvas_type: []const u8, x: f32, y: f32, w: f32, h: f32) void {
    // Background
    gpu.drawRect(x, y, w, h, 0.03, 0.05, 0.08, 1.0, 0, 0, 0, 0, 0, 0);

    // Custom render pass (connector lines, etc.)
    if (get(canvas_type)) |renderer| {
        renderer.render_fn(x, y, w, h, getCameraTransform(x, y, w, h));
    }
}

/// Get current camera transform for positioning Canvas.Node children.
pub fn getCameraTransform(_: f32, _: f32, _: f32, _: f32) CameraTransform {
    return .{ .cx = cam_x, .cy = cam_y, .scale = cam_zoom };
}

/// Convert screen coordinates to graph space (inverse of GPU transform).
/// screen = pos * scale + (vp_center - cam * scale)
/// → pos = (screen - vp_center + cam * scale) / scale
pub fn screenToGraph(screen_x: f32, screen_y: f32, vp_cx: f32, vp_cy: f32) [2]f32 {
    if (cam_zoom == 0) return .{ 0, 0 };
    return .{
        (screen_x - vp_cx + cam_x * cam_zoom) / cam_zoom,
        (screen_y - vp_cy + cam_y * cam_zoom) / cam_zoom,
    };
}

/// Hovered node index (set by engine mouse handler)
var hovered_node_idx: ?u16 = null;
/// Selected (pinned) node index (set by click)
var selected_node_idx: ?u16 = null;

pub fn setHoveredNode(idx: ?u16) void {
    hovered_node_idx = idx;
}

pub fn getHoveredNode() ?u16 {
    return hovered_node_idx;
}

/// Click: toggle selection. Same node = deselect. Different node = select. Empty = deselect.
pub fn clickNode() void {
    if (hovered_node_idx) |hi| {
        selected_node_idx = if (selected_node_idx != null and selected_node_idx.? == hi) null else hi;
    } else {
        selected_node_idx = null;
    }
}

pub fn getSelectedNode() ?u16 {
    return selected_node_idx;
}

/// Active node for detail panel: selected > hovered
pub fn getActiveNode() ?u16 {
    return selected_node_idx orelse hovered_node_idx;
}

// ── Input handlers (built-in zoom/pan for every canvas) ─────────────────

pub fn handleScroll(mx: f32, my: f32, delta: f32, vp_w: f32, vp_h: f32) void {
    // Zoom toward cursor — keep the point under cursor fixed
    const old_gx = cam_x + (mx - vp_w / 2) / cam_zoom;
    const old_gy = cam_y + (my - vp_h / 2) / cam_zoom;

    const factor: f32 = if (delta > 0) 1.15 else 1.0 / 1.15;
    cam_zoom = @max(0.05, @min(cam_zoom * factor, 100.0));

    const new_gx = cam_x + (mx - vp_w / 2) / cam_zoom;
    const new_gy = cam_y + (my - vp_h / 2) / cam_zoom;
    cam_x += old_gx - new_gx;
    cam_y += old_gy - new_gy;
}

pub fn handleDrag(dx: f32, dy: f32) void {
    if (cam_zoom > 0) {
        cam_x -= dx / cam_zoom;
        cam_y -= dy / cam_zoom;
    }
}

// ── Telemetry ────────────────────────────────────────────────────────────

pub const TelemetryCameraState = struct {
    x: f32,
    y: f32,
    zoom: f32,
    type_count: u32,
};

pub fn telemetryCameraState() TelemetryCameraState {
    return .{
        .x = cam_x,
        .y = cam_y,
        .zoom = cam_zoom,
        .type_count = @intCast(type_count),
    };
}

var node_dim_idx: ?u16 = null;
var node_dim_opacity: f32 = 1.0;
var flow_override_idx: ?u16 = null;
var flow_override_enabled: bool = false;

pub fn setNodeDim(idx: u16, opacity: f32) void {
    node_dim_idx = idx;
    node_dim_opacity = opacity;
}

pub fn resetNodeDim() void {
    node_dim_idx = null;
    node_dim_opacity = 1.0;
}

pub fn setFlowOverride(idx: u16, enabled: bool) void {
    flow_override_idx = idx;
    flow_override_enabled = enabled;
}

pub fn resetFlowOverride() void {
    flow_override_idx = null;
    flow_override_enabled = false;
}

pub fn getNodeDim(idx: u16) f32 {
    if (node_dim_idx) |di| {
        if (di == idx) return node_dim_opacity;
    }
    return 1.0;
}

pub fn getFlowOverride(idx: u16) bool {
    if (flow_override_idx) |fi| {
        if (fi == idx) return flow_override_enabled;
    }
    return true;
}
