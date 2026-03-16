//! Contextual Overlays — menus, modals, tooltips, popovers
//!
//! Overlay registry with absolute positioning, click-outside dismiss,
//! and auto-positioning (viewport clamping, anchor flipping).
//!
//! Paint order: app tree → overlays → inspector.
//! Click order: overlays first → app tree (overlays consume clicks).

const std = @import("std");
const layout = @import("layout.zig");
const events = @import("events.zig");
const gpu = @import("gpu.zig");
const text_mod = @import("text.zig");
const Node = layout.Node;
const Color = layout.Color;

// ════════════════════════════════════════════════════════════════════════
// Types
// ════════════════════════════════════════════════════════════════════════

pub const MAX_OVERLAYS = 8;

pub const OverlayKind = enum {
    context_menu,
    popover,
    modal,
    tooltip,
};

pub const Position = enum {
    top,
    bottom,
    left,
    right,
};

pub const Overlay = struct {
    kind: OverlayKind = .context_menu,
    visible: bool = false,
    /// Absolute screen position
    x: f32 = 0,
    y: f32 = 0,
    /// Anchor element bounds (for popovers)
    anchor_x: f32 = 0,
    anchor_y: f32 = 0,
    anchor_w: f32 = 0,
    anchor_h: f32 = 0,
    /// Content subtree root
    root: ?*Node = null,
    /// Dismiss callback (compiled from onDismiss prop)
    on_dismiss: ?*const fn () void = null,
    /// Preferred position for popovers
    preferred_position: Position = .bottom,
};

// ════════════════════════════════════════════════════════════════════════
// State
// ════════════════════════════════════════════════════════════════════════

var overlays: [MAX_OVERLAYS]Overlay = [_]Overlay{.{}} ** MAX_OVERLAYS;
var overlay_count: usize = 0;
var viewport_w: f32 = 0;
var viewport_h: f32 = 0;

// ════════════════════════════════════════════════════════════════════════
// Public API
// ════════════════════════════════════════════════════════════════════════

/// Register an overlay slot. Returns the overlay ID (index).
pub fn register(kind: OverlayKind) usize {
    if (overlay_count >= MAX_OVERLAYS) return MAX_OVERLAYS - 1;
    const id = overlay_count;
    overlays[id] = .{ .kind = kind };
    overlay_count += 1;
    return id;
}

/// Show an overlay at absolute screen coordinates.
pub fn show(id: usize, x: f32, y: f32) void {
    if (id >= overlay_count) return;
    overlays[id].visible = true;
    overlays[id].x = x;
    overlays[id].y = y;
}

/// Show an overlay anchored to an element's bounds.
pub fn showAnchored(id: usize, anchor_x: f32, anchor_y: f32, anchor_w: f32, anchor_h: f32) void {
    if (id >= overlay_count) return;
    overlays[id].visible = true;
    overlays[id].anchor_x = anchor_x;
    overlays[id].anchor_y = anchor_y;
    overlays[id].anchor_w = anchor_w;
    overlays[id].anchor_h = anchor_h;
}

/// Hide a specific overlay.
pub fn hide(id: usize) void {
    if (id >= overlay_count) return;
    overlays[id].visible = false;
}

/// Hide all visible overlays.
pub fn hideAll() void {
    for (0..overlay_count) |i| {
        overlays[i].visible = false;
    }
}

/// Check if an overlay is visible.
pub fn isVisible(id: usize) bool {
    if (id >= overlay_count) return false;
    return overlays[id].visible;
}

/// Set the content root for an overlay.
pub fn setRoot(id: usize, root: *Node) void {
    if (id >= overlay_count) return;
    overlays[id].root = root;
}

/// Set the dismiss callback for an overlay.
pub fn setOnDismiss(id: usize, func: *const fn () void) void {
    if (id >= overlay_count) return;
    overlays[id].on_dismiss = func;
}

/// Set preferred position for popovers.
pub fn setPosition(id: usize, pos: Position) void {
    if (id >= overlay_count) return;
    overlays[id].preferred_position = pos;
}

/// Update viewport dimensions (call on resize).
pub fn setViewport(w: f32, h: f32) void {
    viewport_w = w;
    viewport_h = h;
}

/// Get a mutable pointer to an overlay's root node (for dynamic updates).
pub fn getRoot(id: usize) ?*Node {
    if (id >= overlay_count) return null;
    return overlays[id].root;
}

/// Get overlay by ID.
pub fn get(id: usize) ?*Overlay {
    if (id >= overlay_count) return null;
    return &overlays[id];
}

// ════════════════════════════════════════════════════════════════════════
// Click handling — runs BEFORE app hit testing
// ════════════════════════════════════════════════════════════════════════

/// Handle a click at (mx, my). Returns true if the click was consumed by an overlay.
///
/// Logic:
/// 1. Check if click is inside any visible overlay → route to overlay content
/// 2. Click outside all overlays → dismiss all, return false (pass to app)
pub fn handleClick(mx: f32, my: f32) bool {
    var any_visible = false;

    // Check if click is inside any visible overlay
    for (0..overlay_count) |i| {
        const ov = &overlays[i];
        if (!ov.visible) continue;
        any_visible = true;

        if (ov.root) |root| {
            // Hit test the overlay's content tree
            if (events.hitTest(root, mx, my)) |node| {
                // Click is inside this overlay — fire handler
                if (node.input_id != null) {
                    // TextInput inside overlay — let input system handle
                    return true;
                }
                if (node.handlers.on_press) |handler| {
                    handler();
                    return true;
                }
                return true; // consumed even without handler
            }

            // Check if click is within overlay bounds (even if no handler hit)
            const r = root.computed;
            if (mx >= r.x and mx < r.x + r.w and my >= r.y and my < r.y + r.h) {
                return true; // inside overlay area
            }
        }
    }

    // Click outside all overlays — dismiss them
    if (any_visible) {
        for (0..overlay_count) |i| {
            const ov = &overlays[i];
            if (ov.visible) {
                ov.visible = false;
                if (ov.on_dismiss) |dismiss| dismiss();
            }
        }
        return true; // consumed the click (dismiss action)
    }

    return false; // no overlays visible, pass to app
}

// ════════════════════════════════════════════════════════════════════════
// Hover handling — for overlay content
// ════════════════════════════════════════════════════════════════════════

/// Hit test overlay content for hover. Returns node if inside an overlay.
pub fn hitTestOverlays(mx: f32, my: f32) ?*Node {
    // Reverse order — last overlay is topmost
    var i = overlay_count;
    while (i > 0) {
        i -= 1;
        const ov = &overlays[i];
        if (!ov.visible) continue;
        if (ov.root) |root| {
            if (events.hitTest(root, mx, my)) |node| return node;
        }
    }
    return null;
}

// ════════════════════════════════════════════════════════════════════════
// Positioning
// ════════════════════════════════════════════════════════════════════════

/// Clamp an overlay position so it stays within the viewport.
pub fn clampToViewport(x: f32, y: f32, w: f32, h: f32) struct { x: f32, y: f32 } {
    const vw = viewport_w;
    const vh = viewport_h;
    return .{
        .x = @max(0, @min(x, vw - w)),
        .y = @max(0, @min(y, vh - h)),
    };
}

/// Position a popover relative to an anchor element with auto-flip.
pub fn positionPopover(
    anchor_x: f32,
    anchor_y: f32,
    anchor_w: f32,
    anchor_h: f32,
    popover_w: f32,
    popover_h: f32,
    preferred: Position,
) struct { x: f32, y: f32 } {
    const gap: f32 = 4; // spacing between anchor and popover
    const vw = viewport_w;
    const vh = viewport_h;

    var x: f32 = 0;
    var y: f32 = 0;

    switch (preferred) {
        .bottom => {
            x = anchor_x + (anchor_w - popover_w) / 2;
            y = anchor_y + anchor_h + gap;
            // Flip to top if overflows bottom
            if (y + popover_h > vh) {
                y = anchor_y - popover_h - gap;
            }
        },
        .top => {
            x = anchor_x + (anchor_w - popover_w) / 2;
            y = anchor_y - popover_h - gap;
            // Flip to bottom if overflows top
            if (y < 0) {
                y = anchor_y + anchor_h + gap;
            }
        },
        .right => {
            x = anchor_x + anchor_w + gap;
            y = anchor_y + (anchor_h - popover_h) / 2;
            // Flip to left if overflows right
            if (x + popover_w > vw) {
                x = anchor_x - popover_w - gap;
            }
        },
        .left => {
            x = anchor_x - popover_w - gap;
            y = anchor_y + (anchor_h - popover_h) / 2;
            // Flip to right if overflows left
            if (x < 0) {
                x = anchor_x + anchor_w + gap;
            }
        },
    }

    // Final clamp
    return .{
        .x = @max(0, @min(x, vw - popover_w)),
        .y = @max(0, @min(y, vh - popover_h)),
    };
}

// ════════════════════════════════════════════════════════════════════════
// Rendering — called by compositor after app tree paint
// ════════════════════════════════════════════════════════════════════════

/// Render all visible overlays. Called by compositor.frame() after app tree.
pub fn render() void {
    for (0..overlay_count) |i| {
        const ov = &overlays[i];
        if (!ov.visible) continue;

        // Modal backdrop
        if (ov.kind == .modal) {
            gpu.drawRect(
                0, 0, viewport_w, viewport_h,
                0, 0, 0, 0.5, // semi-transparent black
                0, 0, 0, 0, 0, 0, // no border
            );
        }

        if (ov.root) |root| {
            // Position the overlay content
            var pos_x = ov.x;
            var pos_y = ov.y;

            switch (ov.kind) {
                .context_menu => {
                    // Already at cursor position, just clamp
                    const clamped = clampToViewport(pos_x, pos_y, root.computed.w, root.computed.h);
                    pos_x = clamped.x;
                    pos_y = clamped.y;
                },
                .modal => {
                    // Center in viewport
                    pos_x = (viewport_w - root.computed.w) / 2;
                    pos_y = (viewport_h - root.computed.h) / 2;
                },
                .tooltip => {
                    // Offset from cursor by (8, 8)
                    pos_x = ov.x + 8;
                    pos_y = ov.y + 8;
                    const clamped = clampToViewport(pos_x, pos_y, root.computed.w, root.computed.h);
                    pos_x = clamped.x;
                    pos_y = clamped.y;
                },
                .popover => {
                    // Anchor-relative with auto-flip
                    const positioned = positionPopover(
                        ov.anchor_x, ov.anchor_y,
                        ov.anchor_w, ov.anchor_h,
                        root.computed.w, root.computed.h,
                        ov.preferred_position,
                    );
                    pos_x = positioned.x;
                    pos_y = positioned.y;
                },
            }

            // Update computed position for hit testing
            root.computed.x = pos_x;
            root.computed.y = pos_y;

            // Layout the overlay content at the computed position
            layout.layout(root, pos_x, pos_y, root.computed.w, root.computed.h);

            // Paint the overlay content tree
            paintOverlayNode(root, 1.0);
        }
    }
}

/// Paint an overlay node and its children (same as compositor.paintNode but without scroll).
fn paintOverlayNode(node: *Node, parent_opacity: f32) void {
    if (node.style.display == .none) return;

    const effective_opacity = parent_opacity * node.style.opacity;
    if (effective_opacity <= 0) return;

    const sx = node.computed.x;
    const sy = node.computed.y;
    const w = node.computed.w;
    const h = node.computed.h;

    // Background
    if (node.style.background_color) |color| {
        const cr = @as(f32, @floatFromInt(color.r)) / 255.0;
        const cg = @as(f32, @floatFromInt(color.g)) / 255.0;
        const cb = @as(f32, @floatFromInt(color.b)) / 255.0;
        const ca = @as(f32, @floatFromInt(color.a)) / 255.0 * effective_opacity;

        const br = node.style.border_radius;
        const bw_val = node.style.border_width;
        const bc = node.style.border_color orelse Color.rgb(255, 255, 255);
        const bcr = @as(f32, @floatFromInt(bc.r)) / 255.0;
        const bcg = @as(f32, @floatFromInt(bc.g)) / 255.0;
        const bcb = @as(f32, @floatFromInt(bc.b)) / 255.0;
        const bca = @as(f32, @floatFromInt(bc.a)) / 255.0 * effective_opacity;

        gpu.drawRect(sx, sy, w, h, cr, cg, cb, ca, br, if (bw_val > 0) bw_val else 0, bcr, bcg, bcb, bca);
    } else if (node.style.border_width > 0) {
        const bc = node.style.border_color orelse Color.rgb(255, 255, 255);
        const bcr = @as(f32, @floatFromInt(bc.r)) / 255.0;
        const bcg = @as(f32, @floatFromInt(bc.g)) / 255.0;
        const bcb = @as(f32, @floatFromInt(bc.b)) / 255.0;
        const bca = @as(f32, @floatFromInt(bc.a)) / 255.0 * effective_opacity;
        gpu.drawRect(sx, sy, w, h, 0, 0, 0, 0, node.style.border_radius, node.style.border_width, bcr, bcg, bcb, bca);
    }

    // Text
    if (node.text) |txt| {
        const pad_l = node.style.padLeft();
        const pad_t = node.style.padTop();
        const color = node.text_color orelse Color.rgb(255, 255, 255);
        const cr = @as(f32, @floatFromInt(color.r)) / 255.0;
        const cg = @as(f32, @floatFromInt(color.g)) / 255.0;
        const cb = @as(f32, @floatFromInt(color.b)) / 255.0;
        const ca = @as(f32, @floatFromInt(color.a)) / 255.0 * effective_opacity;
        gpu.drawTextLine(txt, sx + pad_l, sy + pad_t, node.font_size, cr, cg, cb, ca);
    }

    // Children
    for (node.children) |*child| {
        paintOverlayNode(child, effective_opacity);
    }
}

// ════════════════════════════════════════════════════════════════════════
// Reset (for hot-reload / testing)
// ════════════════════════════════════════════════════════════════════════

pub fn reset() void {
    overlay_count = 0;
    overlays = [_]Overlay{.{}} ** MAX_OVERLAYS;
}
