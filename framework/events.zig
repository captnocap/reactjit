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
    js_on_hover_enter: ?[*:0]const u8 = null,
    lua_on_hover_enter: ?[*:0]const u8 = null,
    js_on_hover_exit: ?[*:0]const u8 = null,
    lua_on_hover_exit: ?[*:0]const u8 = null,
    on_key: ?*const fn (key: c_int, mods: u16) void = null,
    on_change_text: ?*const fn () void = null,
    on_submit: ?*const fn () void = null,
    on_scroll: ?*const fn () void = null,
    on_right_click: ?*const fn (x: f32, y: f32) void = null,
    /// JS expression to eval on press (used by .so cartridges that can't call QJS directly)
    js_on_press: ?[*:0]const u8 = null,
    /// Lua expression to eval on press (LuaJIT logic runtime)
    lua_on_press: ?[*:0]const u8 = null,
};

// ── Hit Testing ──────────────────────────────────────────────────────────

/// Walk the tree back-to-front (children rendered later are "on top").
/// Returns the deepest node containing (mx, my) that has at least one handler.
/// Skips display:none nodes entirely.
pub fn hitTest(node: *Node, mx: f32, my: f32) ?*Node {
    if (node.style.display == .none) return null;

    // Scroll container: clip hit test to visible bounds and adjust coordinates
    const r = node.computed;
    const ov = node.style.overflow;
    const is_scroll = (ov == .scroll or (ov == .auto and node.content_height > r.h));
    var child_mx = mx;
    var child_my = my;
    if (is_scroll) {
        if (mx < r.x or mx >= r.x + r.w or my < r.y or my >= r.y + r.h) return null;
        child_my = my + node.scroll_y;
        child_mx = mx + node.scroll_x;
    }

    // Check children in reverse order (last child = front-most)
    var i = node.children.len;
    while (i > 0) {
        i -= 1;
        if (hitTest(&node.children[i], child_mx, child_my)) |hit| return hit;
    }

    // Check self — if this node has handlers, href, TextInput, or Canvas
    if (hasHandlers(&node.handlers) or node.href != null or node.input_id != null or node.canvas_type != null) {
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
        h.js_on_hover_enter != null or
        h.lua_on_hover_enter != null or
        h.js_on_hover_exit != null or
        h.lua_on_hover_exit != null or
        h.on_key != null or
        h.on_change_text != null or
        h.on_submit != null or
        h.on_scroll != null or
        h.on_right_click != null or
        h.lua_on_press != null or
        h.js_on_press != null;
}

// ── Hover Hit Test (any node, not just ones with handlers) ──────────────

/// Walk the tree back-to-front.
/// Returns the deepest node containing (mx, my) that has handlers OR hoverable flag.
/// Used for hover effects — opt-in via handlers or hoverable = true.
pub fn hitTestHoverable(node: *Node, mx: f32, my: f32) ?*Node {
    if (node.style.display == .none) return null;

    const r = node.computed;
    const ov = node.style.overflow;
    const is_scroll = (ov == .scroll or (ov == .auto and node.content_height > r.h));
    var child_mx = mx;
    var child_my = my;
    if (is_scroll) {
        if (mx < r.x or mx >= r.x + r.w or my < r.y or my >= r.y + r.h) return null;
        child_my = my + node.scroll_y;
        child_mx = mx + node.scroll_x;
    }

    var i = node.children.len;
    while (i > 0) {
        i -= 1;
        if (hitTestHoverable(&node.children[i], child_mx, child_my)) |hit| return hit;
    }

    if (hasHandlers(&node.handlers) or node.hoverable or node.href != null or node.input_id != null or node.canvas_type != null) {
        if (r.w > 0 and r.h > 0 and mx >= r.x and mx < r.x + r.w and my >= r.y and my < r.y + r.h) {
            return node;
        }
    }

    return null;
}

// ── Text Hit Test (finds any text node, not just ones with handlers) ────

/// Find the deepest text node containing (mx, my).
/// Used for text selection — text nodes don't need event handlers.
pub fn hitTestText(node: *Node, mx: f32, my: f32) ?*Node {
    if (node.style.display == .none) return null;

    const r = node.computed;
    const ov = node.style.overflow;
    const is_scroll = (ov == .scroll or (ov == .auto and node.content_height > r.h));
    var child_mx = mx;
    var child_my = my;
    if (is_scroll) {
        if (mx < r.x or mx >= r.x + r.w or my < r.y or my >= r.y + r.h) return null;
        child_my = my + node.scroll_y;
        child_mx = mx + node.scroll_x;
    }

    // Check children in reverse order (last child = front-most)
    var i = node.children.len;
    while (i > 0) {
        i -= 1;
        if (hitTestText(&node.children[i], child_mx, child_my)) |hit| return hit;
    }

    // Check self — must be a text node within bounds
    if (node.text != null) {
        if (mx >= r.x and mx < r.x + r.w and my >= r.y and my < r.y + r.h) {
            return node;
        }
    }

    return null;
}

// ── Scroll Container Hit Test ───────────────────────────────────────────

/// Find the deepest scroll container under (mx, my).
/// Any node with overflow scroll or auto (when content overflows) is scrollable.
/// Find the deepest canvas node under the cursor.
pub fn findCanvasNode(node: *Node, mx: f32, my: f32) ?*Node {
    if (node.style.display == .none) return null;
    const r = node.computed;
    if (mx < r.x or mx >= r.x + r.w or my < r.y or my >= r.y + r.h) return null;
    // Canvas nodes don't have children in the paint tree, so check self first
    if (node.canvas_type != null) return node;
    const ov = node.style.overflow;
    const is_scroll = (ov == .scroll or (ov == .auto and node.content_height > r.h));
    var child_mx = mx;
    var child_my = my;
    if (is_scroll) {
        child_my = my + node.scroll_y;
        child_mx = mx + node.scroll_x;
    }
    var i = node.children.len;
    while (i > 0) {
        i -= 1;
        if (findCanvasNode(&node.children[i], child_mx, child_my)) |hit| return hit;
    }
    return null;
}

/// Walk the tree back-to-front to find the deepest node containing (mx, my)
/// that has a right-click handler or context_menu_items.
pub fn hitTestRightClick(node: *Node, mx: f32, my: f32) ?*Node {
    if (node.style.display == .none) return null;

    const r = node.computed;
    const ov = node.style.overflow;
    const is_scroll = (ov == .scroll or (ov == .auto and node.content_height > r.h));
    var child_mx = mx;
    var child_my = my;
    if (is_scroll) {
        if (mx < r.x or mx >= r.x + r.w or my < r.y or my >= r.y + r.h) return null;
        child_my = my + node.scroll_y;
        child_mx = mx + node.scroll_x;
    }

    var i = node.children.len;
    while (i > 0) {
        i -= 1;
        if (hitTestRightClick(&node.children[i], child_mx, child_my)) |hit| return hit;
    }

    if (node.handlers.on_right_click != null or node.context_menu_items != null) {
        if (mx >= r.x and mx < r.x + r.w and my >= r.y and my < r.y + r.h) {
            return node;
        }
    }

    return null;
}

pub fn findScrollContainer(node: *Node, mx: f32, my: f32) ?*Node {
    if (node.style.display == .none) return null;

    const r = node.computed;
    // Quick AABB rejection
    if (mx < r.x or mx >= r.x + r.w or my < r.y or my >= r.y + r.h) return null;

    // Scroll container: adjust coordinates for children in content space
    const ov = node.style.overflow;
    const is_scroll = (ov == .scroll or (ov == .auto and node.content_height > r.h));
    var child_mx = mx;
    var child_my = my;
    if (is_scroll) {
        child_my = my + node.scroll_y;
        child_mx = mx + node.scroll_x;
    }

    // Check children in reverse order (deepest/front-most first)
    var i = node.children.len;
    while (i > 0) {
        i -= 1;
        if (findScrollContainer(&node.children[i], child_mx, child_my)) |hit| return hit;
    }

    // Check self — scroll always scrollable, auto only when content overflows
    if (is_scroll) return node;

    return null;
}
