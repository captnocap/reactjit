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
// TODO: inspector + devtools panel being rewritten in .tsz (see runtime/devtools/)
// const inspector = @import("inspector.zig");
// const devtools_panel = @import("devtools_panel.zig");
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

// Text selection state — set by generated_app.zig before frame()
var g_sel_node: ?*Node = null;
var g_sel_end_node: ?*Node = null;
var g_sel_start: usize = 0;
var g_sel_end: usize = 0;
var g_sel_all: bool = false;
// 0 = before selection, 1 = inside selection, 2 = past selection
var g_sel_walk_state: u8 = 0;

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

pub fn setSelection(sel_node: ?*Node, sel_end_node: ?*Node, sel_start: usize, sel_end: usize, sel_all: bool) void {
    g_sel_node = sel_node;
    g_sel_end_node = sel_end_node;
    g_sel_start = sel_start;
    g_sel_end = sel_end;
    g_sel_all = sel_all;
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
    g_sel_walk_state = 0; // Reset selection walk state each frame
    clip_depth = 0; // Reset clip stack each frame

    // Walk tree and emit draw commands
    paintNode(root, 0, 0, 1.0);

    // Overlay (terminal cell painting, etc.)
    if (g_overlay_fn) |func| {
        func(g_overlay_rect[0], g_overlay_rect[1], g_overlay_rect[2], g_overlay_rect[3]);
    }

    // Contextual overlays (menus, modals, tooltips, popovers)
    overlay_mod.setViewport(win_w, win_h);
    overlay_mod.render();

    // TODO: Inspector + devtools panel — being rewritten in .tsz

    // Present via wgpu
    gpu.frame(
        @as(f64, @floatFromInt(bg_color.r)) / 255.0,
        @as(f64, @floatFromInt(bg_color.g)) / 255.0,
        @as(f64, @floatFromInt(bg_color.b)) / 255.0,
    );
}

// ════════════════════════════════════════════════════════════════════════
// Clip rect stack — for overflow: scroll/hidden
// ════════════════════════════════════════════════════════════════════════

const ClipRect = struct { x: f32, y: f32, w: f32, h: f32 };
const MAX_CLIP_STACK = 16;
var clip_stack: [MAX_CLIP_STACK]ClipRect = undefined;
var clip_depth: usize = 0;

fn pushClip(x: f32, y: f32, w: f32, h: f32) void {
    if (clip_depth < MAX_CLIP_STACK) {
        if (clip_depth > 0) {
            const parent = clip_stack[clip_depth - 1];
            const nx = @max(x, parent.x);
            const ny = @max(y, parent.y);
            const nx2 = @min(x + w, parent.x + parent.w);
            const ny2 = @min(y + h, parent.y + parent.h);
            clip_stack[clip_depth] = .{ .x = nx, .y = ny, .w = @max(0, nx2 - nx), .h = @max(0, ny2 - ny) };
        } else {
            clip_stack[clip_depth] = .{ .x = x, .y = y, .w = w, .h = h };
        }
        clip_depth += 1;
    }
}

fn popClip() void {
    if (clip_depth > 0) clip_depth -= 1;
}

fn isClipped(sx: f32, sy: f32, sw: f32, sh: f32) bool {
    if (clip_depth == 0) return false;
    const cr = clip_stack[clip_depth - 1];
    return (sx + sw <= cr.x or sx >= cr.x + cr.w or sy + sh <= cr.y or sy >= cr.y + cr.h);
}

/// Clamp a rect to the current clip bounds. Returns null if fully clipped.
fn clipRect(sx: f32, sy: f32, sw: f32, sh: f32) ?ClipRect {
    if (clip_depth == 0) return .{ .x = sx, .y = sy, .w = sw, .h = sh };
    const cr = clip_stack[clip_depth - 1];
    const cx = @max(sx, cr.x);
    const cy = @max(sy, cr.y);
    const cx2 = @min(sx + sw, cr.x + cr.w);
    const cy2 = @min(sy + sh, cr.y + cr.h);
    if (cx2 <= cx or cy2 <= cy) return null;
    return .{ .x = cx, .y = cy, .w = cx2 - cx, .h = cy2 - cy };
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

    // Skip nodes fully outside the current clip rect
    if (node.style.position != .absolute and isClipped(screen_x, screen_y, w, node.computed.h)) return;

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

        if (clipRect(screen_x, screen_y, w, h)) |clipped| {
            gpu.drawRect(
                clipped.x, clipped.y, clipped.w, clipped.h,
                cr, cg, cb, ca,
                br,
                if (bw_val > 0) bw_val else 0,
                bcr, bcg, bcb, bca,
            );
        }
    } else if (node.style.border_width > 0) {
        // Border only, no background
        const bc = node.style.border_color orelse Color.rgb(255, 255, 255);
        const bcr = @as(f32, @floatFromInt(bc.r)) / 255.0;
        const bcg = @as(f32, @floatFromInt(bc.g)) / 255.0;
        const bcb = @as(f32, @floatFromInt(bc.b)) / 255.0;
        const bca = @as(f32, @floatFromInt(bc.a)) / 255.0 * effective_opacity;

        if (clipRect(screen_x, screen_y, w, h)) |clipped| {
            gpu.drawRect(
                clipped.x, clipped.y, clipped.w, clipped.h,
                0, 0, 0, 0,
                node.style.border_radius,
                node.style.border_width,
                bcr, bcg, bcb, bca,
            );
        }
    }

    // ── Text ────────────────────────────────────────────────────
    if (node.text) |txt| {
        // Skip text entirely if the text area is clipped
        const pad_l = node.style.padLeft();
        const pad_r = node.style.padRight();
        const pad_t = node.style.padTop();
        const text_max_w = node.computed.w - pad_l - pad_r;
        const text_x = screen_x + pad_l;
        const text_y = screen_y + pad_t;
        const text_h = h - pad_t - node.style.padBottom();
        if (clipRect(text_x, text_y, text_max_w, text_h) == null) return;
        const color = node.text_color orelse Color.rgb(255, 255, 255);

        const cr = @as(f32, @floatFromInt(color.r)) / 255.0;
        const cg = @as(f32, @floatFromInt(color.g)) / 255.0;
        const cb = @as(f32, @floatFromInt(color.b)) / 255.0;
        const ca = @as(f32, @floatFromInt(color.a)) / 255.0 * effective_opacity;

        // Selection highlight — draw before text so highlight is behind
        if (g_sel_node != null and g_sel_end_node != null and (g_sel_start != g_sel_end or g_sel_all)) {
            const is_start_node = (g_sel_node == node);
            const is_end_node = (g_sel_end_node == node);
            const is_same_node = (g_sel_node == g_sel_end_node);

            var s0: usize = 0;
            var s1: usize = txt.len;
            var should_highlight = false;

            if (g_sel_all) {
                should_highlight = true;
            } else if (is_same_node and is_start_node) {
                // Single-node selection
                s0 = @min(g_sel_start, g_sel_end);
                s1 = @max(g_sel_start, g_sel_end);
                should_highlight = (s1 > s0);
            } else if (is_start_node or is_end_node) {
                // First or last boundary node in cross-node selection
                if (g_sel_walk_state == 0) {
                    // This is the first boundary we encounter in tree order
                    if (is_start_node) {
                        s0 = g_sel_start;
                        s1 = txt.len;
                    } else {
                        s0 = g_sel_end;
                        s1 = txt.len;
                    }
                    g_sel_walk_state = 1;
                } else if (g_sel_walk_state == 1) {
                    // This is the second boundary — end of cross-node selection
                    if (is_end_node) {
                        s0 = 0;
                        s1 = g_sel_end;
                    } else {
                        s0 = 0;
                        s1 = g_sel_start;
                    }
                    g_sel_walk_state = 2;
                }
                should_highlight = (s1 > s0);
            } else if (g_sel_walk_state == 1) {
                // Middle node — fully selected
                should_highlight = true;
            }

            if (should_highlight and s1 > s0) {
                const tx = screen_x + pad_l;
                const ty = screen_y + pad_t;
                gpu.drawSelectionRects(txt, tx, ty, node.font_size, text_max_w, s0, s1);
            }
        }

        _ = gpu.drawTextWrapped(
            txt,
            screen_x + pad_l,
            screen_y + pad_t,
            node.font_size,
            text_max_w,
            cr, cg, cb, ca,
        );
    }

    // ── Children ────────────────────────────────────────────────
    const needs_clip = node.style.overflow != .visible;
    const child_scroll_x = scroll_x + if (needs_clip) node.scroll_x else @as(f32, 0);
    const child_scroll_y = scroll_y + if (needs_clip) node.scroll_y else @as(f32, 0);

    // Push clip rect for overflow: scroll/hidden containers
    if (needs_clip) {
        pushClip(screen_x, screen_y, w, h);
        gpu.pushScissor(screen_x, screen_y, w, h);
    }

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

    if (needs_clip) {
        popClip();
        gpu.popScissor();
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
