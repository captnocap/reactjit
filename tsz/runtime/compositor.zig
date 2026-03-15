//! Retained-mode compositor for tsz — wgpu backend
//!
//! Walks the node tree, emits draw commands to gpu.zig.
//! No per-node textures — everything is batched and drawn in order.
//!
//! Replaces the SDL_Renderer-based compositor with wgpu draw calls.

const std = @import("std");
const c = @import("c.zig").imports;
const layout = @import("layout.zig");
const text_mod = @import("text.zig");
const image_mod = @import("image.zig");
const gpu = @import("gpu.zig");
const canvas = @import("canvas.zig");
const overlay_mod = @import("overlay.zig");
const inspector = @import("framework/inspector/panel.zig");
const devtools_panel = @import("compiled/framework/devtoolspanel.gen.zig");
const Node = layout.Node;
const Style = layout.Style;
const Color = layout.Color;
const TextEngine = text_mod.TextEngine;
const ImageCache = image_mod.ImageCache;

// ════════════════════════════════════════════════════════════════════════
// State
// ════════════════════════════════════════════════════════════════════════

var g_text_engine: ?*TextEngine = null;
var g_image_cache: ?*ImageCache = null;
var g_hovered_node: ?*Node = null;
var g_app_root: ?*Node = null;
var g_app_w: f32 = 0;
var g_app_h: f32 = 0;
var g_gpu_initialized: bool = false;

// ════════════════════════════════════════════════════════════════════════
// Public API
// ════════════════════════════════════════════════════════════════════════

/// Init compositor. Accepts SDL_Renderer for backward compatibility with
/// generated_app.zig, but rendering is done via wgpu internally.
pub fn init(renderer: *c.SDL_Renderer, text_engine: *TextEngine, image_cache: *ImageCache) void {
    g_text_engine = text_engine;
    g_image_cache = image_cache;

    // Get the SDL window from the renderer to init wgpu
    const window = c.SDL_RenderGetWindow(renderer);
    if (window) |win| {
        gpu.init(win) catch |err| {
            std.debug.print("wgpu init failed in compositor: {}\n", .{err});
            return;
        };
        gpu.initText(text_engine.library, text_engine.face, text_engine.fallback_faces, text_engine.fallback_count);
        g_gpu_initialized = true;
    }
}

pub fn deinit() void {
    if (g_gpu_initialized) {
        gpu.deinit();
        g_gpu_initialized = false;
    }
    g_text_engine = null;
    g_image_cache = null;
}

pub fn handleResize(width: u32, height: u32) void {
    if (g_gpu_initialized) {
        gpu.resize(width, height);
    }
}

pub fn setHoveredNode(node: ?*Node) void {
    g_hovered_node = node;
}

/// Composite the entire tree and present to screen via wgpu.
// Optional overlay callback — called after node tree paint, before GPU present.
// Used by terminal to paint colored cells directly.
var g_overlay_fn: ?*const fn (f32, f32, f32, f32) void = null;
var g_overlay_node_id: ?[]const u8 = null;
var g_overlay_rect: [4]f32 = .{ 0, 0, 0, 0 };

/// Register an overlay painter that fires on the node with the given test_id.
pub fn setOverlay(test_id: []const u8, func: *const fn (f32, f32, f32, f32) void) void {
    g_overlay_node_id = test_id;
    g_overlay_fn = func;
}

pub fn frame(root: *Node, win_w: f32, win_h: f32, bg_color: Color) void {
    g_app_root = root;
    g_app_w = win_w;
    g_app_h = win_h;

    // Walk tree and emit draw commands
    paintNode(root, 0, 0, 1.0);

    // Overlay (terminal cell painting, etc.)
    if (g_overlay_fn) |func| {
        func(g_overlay_rect[0], g_overlay_rect[1], g_overlay_rect[2], g_overlay_rect[3]);
    }

    // Contextual overlays (menus, modals, tooltips, popovers)
    overlay_mod.setViewport(win_w, win_h);
    overlay_mod.render();

    // Inspector overlay highlights
    inspector.render();

    // Devtools panel (pre-compiled from DevtoolsPanel.tsz)
    if (inspector.isEnabled()) {
        const panel_root = devtools_panel.getRoot();
        panel_root.style.height = inspector.getPanelHeight();
        layout.layout(panel_root, 0, inspector.getAppHeight(win_h), win_w, inspector.getPanelHeight());
        paintNode(panel_root, 0, 0, 1.0);
    }

    // Present via wgpu
    gpu.frame(
        @as(f64, @floatFromInt(bg_color.r)) / 255.0,
        @as(f64, @floatFromInt(bg_color.g)) / 255.0,
        @as(f64, @floatFromInt(bg_color.b)) / 255.0,
    );
}

// ════════════════════════════════════════════════════════════════════════
// Tree painting — walks nodes and emits gpu draw commands
// ════════════════════════════════════════════════════════════════════════

fn paintNode(node: *Node, scroll_x: f32, scroll_y: f32, parent_opacity: f32) void {
    if (node.style.display == .none) return;

    const effective_opacity = parent_opacity * node.style.opacity;
    if (effective_opacity <= 0) return;

    const screen_x = node.computed.x - scroll_x;
    const screen_y = node.computed.y - scroll_y;
    const w = node.computed.w;

    // Capture overlay rect if this node matches the overlay test_id
    if (g_overlay_node_id) |overlay_id| {
        if (node.test_id) |tid| {
            if (std.mem.eql(u8, tid, overlay_id)) {
                g_overlay_rect = .{ screen_x, screen_y, w, node.computed.h };
            }
        }
    }
    const h = node.computed.h;

    // ── Canvas ─────────────────────────────────────────────────
    // Canvas nodes delegate rendering to the canvas system entirely.
    // They still participate in flex layout — the computed bounds are
    // passed through to the canvas renderer.
    if (node.canvas_type) |ct| {
        canvas.renderCanvas(ct, screen_x, screen_y, w, h);
        return; // Canvas handles its own children/content
    }

    // ── Background ──────────────────────────────────────────────
    if (node.style.background_color) |color| {
        const is_hovered = (g_hovered_node != null and g_hovered_node.? == node);
        const paint_color = if (is_hovered) brighten(color) else color;

        const cr = @as(f32, @floatFromInt(paint_color.r)) / 255.0;
        const cg = @as(f32, @floatFromInt(paint_color.g)) / 255.0;
        const cb = @as(f32, @floatFromInt(paint_color.b)) / 255.0;
        const ca = @as(f32, @floatFromInt(paint_color.a)) / 255.0 * effective_opacity;

        const br = node.style.border_radius;
        const bw_val = node.style.border_width;
        const bc = node.style.border_color orelse Color.rgb(255, 255, 255);
        const bcr = @as(f32, @floatFromInt(bc.r)) / 255.0;
        const bcg = @as(f32, @floatFromInt(bc.g)) / 255.0;
        const bcb = @as(f32, @floatFromInt(bc.b)) / 255.0;
        const bca = @as(f32, @floatFromInt(bc.a)) / 255.0 * effective_opacity;

        gpu.drawRect(
            screen_x, screen_y, w, h,
            cr, cg, cb, ca,
            br,
            if (bw_val > 0) bw_val else 0,
            bcr, bcg, bcb, bca,
        );
    } else if (node.style.border_width > 0) {
        // Border only, no background
        const bc = node.style.border_color orelse Color.rgb(255, 255, 255);
        const bcr = @as(f32, @floatFromInt(bc.r)) / 255.0;
        const bcg = @as(f32, @floatFromInt(bc.g)) / 255.0;
        const bcb = @as(f32, @floatFromInt(bc.b)) / 255.0;
        const bca = @as(f32, @floatFromInt(bc.a)) / 255.0 * effective_opacity;

        gpu.drawRect(
            screen_x, screen_y, w, h,
            0, 0, 0, 0,
            node.style.border_radius,
            node.style.border_width,
            bcr, bcg, bcb, bca,
        );
    }

    // ── Text ────────────────────────────────────────────────────
    if (node.text) |txt| {
        const pad_l = node.style.padLeft();
        const pad_r = node.style.padRight();
        const pad_t = node.style.padTop();
        const color = node.text_color orelse Color.rgb(255, 255, 255);
        const text_max_w = node.computed.w - pad_l - pad_r;
        _ = text_max_w;

        const cr = @as(f32, @floatFromInt(color.r)) / 255.0;
        const cg = @as(f32, @floatFromInt(color.g)) / 255.0;
        const cb = @as(f32, @floatFromInt(color.b)) / 255.0;
        const ca = @as(f32, @floatFromInt(color.a)) / 255.0 * effective_opacity;

        gpu.drawTextLine(
            txt,
            screen_x + pad_l,
            screen_y + pad_t,
            node.font_size,
            cr, cg, cb, ca,
        );
    }

    // ── Children ────────────────────────────────────────────────
    const needs_clip = node.style.overflow != .visible;
    const child_scroll_x = scroll_x + if (needs_clip) node.scroll_x else @as(f32, 0);
    const child_scroll_y = scroll_y + if (needs_clip) node.scroll_y else @as(f32, 0);

    // Z-index sorting
    var needs_zsort = false;
    for (node.children) |*child| {
        if (child.style.z_index != 0) {
            needs_zsort = true;
            break;
        }
    }

    if (needs_zsort and node.children.len <= 512) {
        var indices: [512]u16 = undefined;
        for (0..node.children.len) |ci| indices[ci] = @intCast(ci);
        var si: usize = 1;
        while (si < node.children.len) : (si += 1) {
            const key_idx = indices[si];
            const key_z = node.children[key_idx].style.z_index;
            var sj: usize = si;
            while (sj > 0 and node.children[indices[sj - 1]].style.z_index > key_z) : (sj -= 1) {
                indices[sj] = indices[sj - 1];
            }
            indices[sj] = key_idx;
        }
        for (0..node.children.len) |ci| {
            paintNode(&node.children[indices[ci]], child_scroll_x, child_scroll_y, effective_opacity);
        }
    } else {
        for (node.children) |*child| {
            paintNode(child, child_scroll_x, child_scroll_y, effective_opacity);
        }
    }
}

// ════════════════════════════════════════════════════════════════════════
// Helpers
// ════════════════════════════════════════════════════════════════════════

fn brighten(color: Color) Color {
    return .{
        .r = @min(255, @as(u16, color.r) + 30),
        .g = @min(255, @as(u16, color.g) + 30),
        .b = @min(255, @as(u16, color.b) + 30),
        .a = color.a,
    };
}
