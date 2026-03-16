//! Inspector panel controller — enable/disable + input dispatch.
//! Wraps overlay.zig for hit testing and rendering.

const layout = @import("../../layout.zig");
const overlay = @import("overlay.zig");
const Node = layout.Node;

var enabled: bool = false;
var dragging: bool = false;
var last_mx: f32 = 0;
var last_my: f32 = 0;

pub fn toggle() void {
    enabled = !enabled;
    if (!enabled) {
        overlay.clearSelection();
        overlay.clearHover();
    }
}

pub fn isEnabled() bool {
    return enabled;
}

pub fn getSelectedNode() ?*Node {
    return overlay.selected_node;
}

pub fn clearSelection() void {
    overlay.clearSelection();
}

pub fn mouseMoved(mx: f32, my: f32) void {
    last_mx = mx;
    last_my = my;
}

pub fn handleClick(root: *Node, mx: f32, my: f32) bool {
    if (!enabled) return false;
    return overlay.selectAt(root, mx, my);
}

pub fn mouseReleased() void {
    dragging = false;
}

pub fn getAppHeight(win_h: f32) f32 {
    if (!enabled) return win_h;
    return win_h - getPanelHeight();
}

pub fn getPanelHeight() f32 {
    if (!enabled) return 0;
    return 250;
}

pub fn render() void {
    overlay.render();
}

pub fn updateHover(root: *Node, _: f32, _: f32) void {
    if (!enabled) return;
    _ = overlay.updateHover(root, last_mx, last_my);
}
