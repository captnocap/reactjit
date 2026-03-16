//! Inspector stub — no-op until rewritten in .tsz (see runtime/devtools/)
//!
//! Every function the codegen main loop references is stubbed here.
//! Replace with real implementation once devtools are compiled from .tsz.

const layout = @import("layout.zig");
const Node = layout.Node;

var enabled: bool = false;

pub fn toggle() void {
    enabled = !enabled;
}

pub fn isEnabled() bool {
    return enabled;
}

pub fn getSelectedNode() ?*Node {
    return null;
}

pub fn clearSelection() void {}

pub fn mouseMoved(_: f32, _: f32) void {}

pub fn handleClick(_: *Node, _: f32, _: f32) bool {
    return false;
}

pub fn mouseReleased() void {}

pub fn getAppHeight(win_h: f32) f32 {
    return win_h;
}

pub fn updateHover(_: *Node, _: f32, _: f32) void {}

pub fn hasHover() bool {
    return false;
}

pub fn hasSelect() bool {
    return false;
}

pub fn getHoverX() f32 { return 0; }
pub fn getHoverY() f32 { return 0; }
pub fn getHoverW() f32 { return 0; }
pub fn getHoverH() f32 { return 0; }

pub fn getSelectX() f32 { return 0; }
pub fn getSelectY() f32 { return 0; }
pub fn getSelectW() f32 { return 0; }
pub fn getSelectH() f32 { return 0; }

pub fn getPanelHeight() f32 { return 0; }

pub fn render() void {}
