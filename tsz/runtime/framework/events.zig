//! ReactJIT Events — Phase 2
//!
//! Hit testing and event dispatch for the native engine.
//! Walk the node tree back-to-front (last child wins) to find
//! the deepest node containing a point that has event handlers.
//!
//! No allocations — handlers are compile-time function pointers.

const layout = @import("layout.zig");
const Node = layout.Node;

// ── Event Handler ────────────────────────────────────────────────────────

pub const EventHandler = struct {
    on_press: ?*const fn () void = null,
    on_hover_enter: ?*const fn () void = null,
    on_hover_exit: ?*const fn () void = null,
    on_key: ?*const fn (key: c_int, mods: u16) void = null,
    on_change_text: ?*const fn () void = null,
    on_scroll: ?*const fn () void = null,
    on_right_click: ?*const fn (x: f32, y: f32) void = null,
};

// ── Hit Testing ──────────────────────────────────────────────────────────

/// Walk the tree back-to-front (children rendered later are "on top").
/// Returns the deepest node containing (mx, my) that has at least one handler.
/// Skips display:none nodes entirely.
pub fn hitTest(node: *Node, mx: f32, my: f32) ?*Node {
    if (node.style.display == .none) return null;

    // Check children in reverse order (last child = front-most)
    var i = node.children.len;
    while (i > 0) {
        i -= 1;
        if (hitTest(&node.children[i], mx, my)) |hit| return hit;
    }

    // Check self — if this node has handlers, is a TextInput, or is a Canvas
    if (hasHandlers(&node.handlers) or node.input_id != null or node.canvas_type != null) {
        const r = node.computed;
        if (mx >= r.x and mx < r.x + r.w and my >= r.y and my < r.y + r.h) {
            return node;
        }
    }

    return null;
}

/// Returns true if the node has any event handler set.
fn hasHandlers(h: *const EventHandler) bool {
    return h.on_press != null or
        h.on_hover_enter != null or
        h.on_hover_exit != null or
        h.on_key != null or
        h.on_change_text != null or
        h.on_scroll != null or
        h.on_right_click != null;
}

// ── Text Hit Test (finds any text node, not just ones with handlers) ────

/// Find the deepest text node containing (mx, my).
/// Used for text selection — text nodes don't need event handlers.
pub fn hitTestText(node: *Node, mx: f32, my: f32) ?*Node {
    if (node.style.display == .none) return null;

    // Check children in reverse order (last child = front-most)
    var i = node.children.len;
    while (i > 0) {
        i -= 1;
        if (hitTestText(&node.children[i], mx, my)) |hit| return hit;
    }

    // Check self — must be a text node within bounds
    if (node.text != null) {
        const r = node.computed;
        if (mx >= r.x and mx < r.x + r.w and my >= r.y and my < r.y + r.h) {
            return node;
        }
    }

    return null;
}

// ── Scroll Container Hit Test ───────────────────────────────────────────

/// Find the deepest scroll container (overflow == .scroll) under (mx, my).
/// Used by mouse wheel dispatch to determine which ScrollView to scroll.
pub fn findScrollContainer(node: *Node, mx: f32, my: f32) ?*Node {
    if (node.style.display == .none) return null;

    const r = node.computed;
    // Quick AABB rejection
    if (mx < r.x or mx >= r.x + r.w or my < r.y or my >= r.y + r.h) return null;

    // Check children in reverse order (deepest/front-most first)
    var i = node.children.len;
    while (i > 0) {
        i -= 1;
        if (findScrollContainer(&node.children[i], mx, my)) |hit| return hit;
    }

    // Check self
    if (node.style.overflow == .scroll) {
        return node;
    }

    return null;
}
