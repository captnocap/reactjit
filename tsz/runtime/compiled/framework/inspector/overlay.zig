//! Inspector overlay — pre-compiled from InspectorOverlay.tsz
//!
//! Hover/select highlight rendering + deep hit testing.
//! Imported by panel.zig — not used directly by compositor.

const layout = @import("../../layout.zig");
const gpu = @import("../../gpu.zig");
const Node = layout.Node;

// ── Hit result storage ───────────────────────────────────────────────────

var hover_x: f32 = 0;
var hover_y: f32 = 0;
var hover_w: f32 = 0;
var hover_h: f32 = 0;
pub var hover_valid: bool = false;

var select_x: f32 = 0;
var select_y: f32 = 0;
var select_w: f32 = 0;
var select_h: f32 = 0;
pub var select_valid: bool = false;

pub var selected_node: ?*Node = null;

// ── Hit testing ──────────────────────────────────────────────────────────

/// Find the node under the cursor. Updates hover rect.
/// Returns true if a node was found.
pub fn updateHover(root: *Node, mx: f32, my: f32) bool {
    var sx: f32 = 0;
    var sy: f32 = 0;
    if (deepHitTest(root, mx, my, 0, 0, &sx, &sy)) |node| {
        if (selected_node == node) {
            hover_valid = false;
            return false;
        }
        const r = node.computed;
        hover_x = r.x - sx;
        hover_y = r.y - sy;
        hover_w = r.w;
        hover_h = r.h;
        hover_valid = true;
        return true;
    }
    hover_valid = false;
    return false;
}

/// Try to select the node at (mx, my). Returns true if consumed.
pub fn selectAt(root: *Node, mx: f32, my: f32) bool {
    var sx: f32 = 0;
    var sy: f32 = 0;
    if (deepHitTest(root, mx, my, 0, 0, &sx, &sy)) |node| {
        const r = node.computed;
        select_x = r.x - sx;
        select_y = r.y - sy;
        select_w = r.w;
        select_h = r.h;
        select_valid = true;
        selected_node = node;
        hover_valid = false;
        return true;
    }
    return false;
}

pub fn clearSelection() void {
    select_valid = false;
    selected_node = null;
}

pub fn clearHover() void {
    hover_valid = false;
}

// ── Rendering (pre-compiled from InspectorOverlay.tsz) ───────────────────
//
// Source .tsz:
//   {hasHover() && <Box style={{ position:'absolute', backgroundColor:'#3b82f620',
//     borderWidth:1, borderColor:'#3b82f6a0' }} />}
//   {hasSelect() && <Box style={{ position:'absolute', backgroundColor:'#3b82f610',
//     borderWidth:2, borderColor:'#3b82f6e0' }} />}

pub fn render() void {
    if (hover_valid) {
        gpu.drawRect(
            hover_x, hover_y, hover_w, hover_h,
            0.231, 0.510, 0.965, 0.125,
            0, 1,
            0.231, 0.510, 0.965, 0.627,
        );
    }
    if (select_valid) {
        gpu.drawRect(
            select_x, select_y, select_w, select_h,
            0.231, 0.510, 0.965, 0.063,
            0, 2,
            0.231, 0.510, 0.965, 0.878,
        );
    }
}

// ── Getters (for future .tsz panel components) ───────────────────────────

pub fn getHoverX() f32 { return hover_x; }
pub fn getHoverY() f32 { return hover_y; }
pub fn getHoverW() f32 { return hover_w; }
pub fn getHoverH() f32 { return hover_h; }
pub fn hasHover() bool { return hover_valid; }
pub fn getSelectX() f32 { return select_x; }
pub fn getSelectY() f32 { return select_y; }
pub fn getSelectW() f32 { return select_w; }
pub fn getSelectH() f32 { return select_h; }
pub fn hasSelect() bool { return select_valid; }

// ── Deep hit test ────────────────────────────────────────────────────────

fn deepHitTest(node: *Node, mx: f32, my: f32, acc_sx: f32, acc_sy: f32, out_sx: *f32, out_sy: *f32) ?*Node {
    if (node.style.display == .none) return null;
    if (node.devtools_viz == .inspector_overlay) return null;

    const r = node.computed;
    const vis_x = r.x - acc_sx;
    const vis_y = r.y - acc_sy;

    if (mx < vis_x or mx >= vis_x + r.w or my < vis_y or my >= vis_y + r.h) return null;

    var child_sx = acc_sx;
    var child_sy = acc_sy;
    if (node.style.overflow != .visible) {
        child_sx += node.scroll_x;
        child_sy += node.scroll_y;
    }

    var i = node.children.len;
    while (i > 0) {
        i -= 1;
        if (deepHitTest(&node.children[i], mx, my, child_sx, child_sy, out_sx, out_sy)) |hit| return hit;
    }

    out_sx.* = acc_sx;
    out_sy.* = acc_sy;
    return node;
}
