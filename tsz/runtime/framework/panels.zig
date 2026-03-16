//! Panel Registry — fragments identify themselves by string, callable by name
//!
//! Each .gen.zig fragment declares a PANEL_ID. The runtime registers them at
//! startup. Any .tsz handler can toggle a panel by calling its name as a function:
//!
//!   onPress={() => buildmonitor()}   →   panels.toggle("buildmonitor")
//!
//! The name IS the function. No registry API to learn. No indirection.

const std = @import("std");
const layout = @import("layout.zig");
const Node = layout.Node;

pub const MAX_PANELS = 32;

pub const PanelEntry = struct {
    id: []const u8,
    init_fn: *const fn (usize) void,
    tick_fn: *const fn () void,
    get_root_fn: *const fn () *Node,
    visible: bool,
    initialized: bool,
    slot_base: usize,
};

var panels: [MAX_PANELS]PanelEntry = undefined;
var panel_count: usize = 0;

/// Register a compiled fragment as a toggleable panel.
pub fn register(
    id: []const u8,
    init_fn: *const fn (usize) void,
    tick_fn: *const fn () void,
    get_root_fn: *const fn () *Node,
) void {
    if (panel_count >= MAX_PANELS) return;
    panels[panel_count] = .{
        .id = id,
        .init_fn = init_fn,
        .tick_fn = tick_fn,
        .get_root_fn = get_root_fn,
        .visible = false,
        .initialized = false,
        .slot_base = 0,
    };
    panel_count += 1;
}

/// Toggle a panel by its string ID.
pub fn toggle(id: []const u8) void {
    for (panels[0..panel_count]) |*p| {
        if (std.mem.eql(u8, p.id, id)) {
            if (!p.initialized) {
                // Lazy init: allocate state slots after everything else
                const state = @import("state.zig");
                p.slot_base = state.slotCount();
                p.init_fn(p.slot_base);
                p.initialized = true;
            }
            p.visible = !p.visible;
            return;
        }
    }
    std.debug.print("[panels] Unknown panel: {s}\n", .{id});
}

/// Show a panel (no-op if already visible).
pub fn show(id: []const u8) void {
    for (panels[0..panel_count]) |*p| {
        if (std.mem.eql(u8, p.id, id)) {
            if (!p.initialized) {
                const state = @import("state.zig");
                p.slot_base = state.slotCount();
                p.init_fn(p.slot_base);
                p.initialized = true;
            }
            p.visible = true;
            return;
        }
    }
}

/// Hide a panel (no-op if already hidden).
pub fn hide(id: []const u8) void {
    for (panels[0..panel_count]) |*p| {
        if (std.mem.eql(u8, p.id, id)) {
            p.visible = false;
            return;
        }
    }
}

/// Check if a panel is visible.
pub fn isVisible(id: []const u8) bool {
    for (panels[0..panel_count]) |p| {
        if (std.mem.eql(u8, p.id, id)) return p.visible;
    }
    return false;
}

/// Tick all visible panels.
pub fn tickAll() void {
    for (panels[0..panel_count]) |p| {
        if (p.visible and p.initialized) {
            p.tick_fn();
        }
    }
}

/// Get roots of all visible panels (for compositor layering).
pub fn getVisibleRoots(roots_out: *[MAX_PANELS]*Node) usize {
    var n: usize = 0;
    for (panels[0..panel_count]) |p| {
        if (p.visible and p.initialized) {
            roots_out[n] = p.get_root_fn();
            n += 1;
        }
    }
    return n;
}

/// Get count of registered panels.
pub fn count() usize {
    return panel_count;
}

/// Get count of visible panels.
pub fn visibleCount() usize {
    var n: usize = 0;
    for (panels[0..panel_count]) |p| {
        if (p.visible) n += 1;
    }
    return n;
}
