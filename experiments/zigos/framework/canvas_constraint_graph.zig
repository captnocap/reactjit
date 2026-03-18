//! Canvas: constraint-graph — Zoomable/pannable component tree visualization.
//!
//! Google Maps mental model: at zoom 1.0 the entire graph fits the viewport.
//! Scroll wheel zooms in/out centered on cursor. Drag to pan.
//! Deeper nodes reveal as you zoom in.

const std = @import("std");
const gpu = @import("gpu.zig");
const canvas = @import("canvas.zig");

// ── Graph node data ─────────────────────────────────────────────────────

const MAX_NODES = 1024;

const NodeType = enum {
    root,
    parent,
    child,
    fixed,
    fixed_sz,
    flex,
    dyn,
};

const MAX_CHILDREN = 16; // max children per node

const GraphNode = struct {
    name: []const u8,
    ntype: NodeType,
    parent_idx: ?u16,
    children: [MAX_CHILDREN]u16,  // actual child indices
    child_count: u16,
    depth: u8,
    descendant_count: u16,
    gx: f32,
    gy: f32,
    gw: f32,
    gh: f32,
};

// ── Camera state ────────────────────────────────────────────────────────

var cam_x: f32 = 0;        // center of viewport in graph space
var cam_y: f32 = 0;
var cam_zoom: f32 = 1.0;   // 1.0 = fit entire graph, >1 = zoomed in

// Graph bounds (computed from layout)
var graph_min_x: f32 = 0;
var graph_max_x: f32 = 1000;
var graph_min_y: f32 = 0;
var graph_max_y: f32 = 800;

// Viewport bounds (set each render call)
var vp_x: f32 = 0;
var vp_y: f32 = 0;
var vp_w: f32 = 1400;
var vp_h: f32 = 800;

// ── Node storage ────────────────────────────────────────────────────────

var nodes: [MAX_NODES]GraphNode = undefined;
var node_count: u16 = 0;
var graph_built: bool = false;

// ── Demo tree builder ───────────────────────────────────────────────────
// Builds a realistic app component tree for testing.
// In production, this would be populated from the actual component tree at runtime.

fn addNode(name: []const u8, ntype: NodeType, parent: ?u16, depth: u8) u16 {
    if (node_count >= MAX_NODES) return 0;
    const idx = node_count;
    nodes[idx] = .{
        .name = name,
        .ntype = ntype,
        .parent_idx = parent,
        .children = undefined,
        .child_count = 0,
        .depth = depth,
        .descendant_count = 0,
        .gx = 0, .gy = 0,
        .gw = @max(60, @as(f32, @floatFromInt(name.len)) * 8 + 24),
        .gh = 36,
    };
    if (parent) |p| {
        const cc = nodes[p].child_count;
        if (cc < MAX_CHILDREN) {
            nodes[p].children[cc] = idx;
            nodes[p].child_count = cc + 1;
        }
    }
    node_count += 1;
    return idx;
}

fn buildDemoTree() void {
    if (graph_built) return;
    node_count = 0;

    const app = addNode("App", .root, null, 0);
    const router = addNode("Router", .parent, app, 1);

    // Shell subtree
    const shell = addNode("Shell", .flex, router, 2);
    const header = addNode("Header", .parent, shell, 3);
    _ = addNode("Logo", .fixed, header, 4);
    const search = addNode("SearchBar", .child, header, 4);
    _ = addNode("SearchIcon", .fixed, search, 5);
    _ = addNode("SearchInput", .flex, search, 5);
    _ = addNode("SearchClear", .fixed, search, 5);
    const tabs = addNode("NavTabs", .parent, header, 4);
    _ = addNode("Tab_Home", .fixed, tabs, 5);
    _ = addNode("Tab_Dash", .fixed, tabs, 5);
    _ = addNode("Tab_Projects", .fixed, tabs, 5);
    _ = addNode("Tab_Reports", .fixed, tabs, 5);
    _ = addNode("Tab_Settings", .fixed, tabs, 5);
    const umenu = addNode("UserMenu", .parent, header, 4);
    _ = addNode("Avatar", .fixed, umenu, 5);
    _ = addNode("UserName", .dyn, umenu, 5);
    _ = addNode("DropdownIcon", .fixed, umenu, 5);
    _ = addNode("NotifBell", .fixed_sz, header, 4);

    const sidebar = addNode("Sidebar", .dyn, shell, 3);
    const snav = addNode("SideNav", .parent, sidebar, 4);
    const nmain = addNode("NavSection_Main", .parent, snav, 5);
    _ = addNode("Nav_Home", .dyn, nmain, 6);
    _ = addNode("Nav_Dash", .dyn, nmain, 6);
    _ = addNode("Nav_Inbox", .dyn, nmain, 6);
    _ = addNode("Nav_Tasks", .dyn, nmain, 6);
    _ = addNode("Nav_Cal", .dyn, nmain, 6);
    const nproj = addNode("NavSection_Projects", .parent, snav, 5);
    _ = addNode("Proj_1", .dyn, nproj, 6);
    _ = addNode("Proj_2", .dyn, nproj, 6);
    _ = addNode("Proj_3", .dyn, nproj, 6);
    _ = addNode("Proj_4", .dyn, nproj, 6);
    _ = addNode("SideFooter", .fixed, sidebar, 4);

    const main_c = addNode("MainContent", .flex, shell, 3);
    const dash = addNode("DashboardPage", .child, main_c, 4);
    _ = addNode("PageHeader", .fixed_sz, dash, 5);
    const stats = addNode("StatsRow", .parent, dash, 5);
    _ = addNode("Stat_Revenue", .dyn, stats, 6);
    _ = addNode("Stat_Users", .dyn, stats, 6);
    _ = addNode("Stat_Orders", .dyn, stats, 6);
    _ = addNode("Stat_Conv", .dyn, stats, 6);
    const charts = addNode("ChartRow", .parent, dash, 5);
    _ = addNode("RevenueChart", .flex, charts, 6);
    _ = addNode("UsersChart", .flex, charts, 6);
    const feed = addNode("ActivityFeed", .child, dash, 5);
    var fi: u16 = 0;
    while (fi < 8) : (fi += 1) {
        _ = addNode("FeedItem", .dyn, feed, 6);
    }
    const table = addNode("DataTable", .child, dash, 5);
    _ = addNode("TableToolbar", .fixed_sz, table, 6);
    _ = addNode("TableHeader", .fixed_sz, table, 6);
    var ri: u16 = 0;
    while (ri < 10) : (ri += 1) {
        _ = addNode("TableRow", .dyn, table, 6);
    }

    const settings = addNode("SettingsPage", .parent, main_c, 4);
    _ = addNode("SettingsNav", .fixed, settings, 5);
    const spanel = addNode("SettingsPanel", .flex, settings, 5);
    _ = addNode("Section_Profile", .parent, spanel, 6);
    _ = addNode("Section_Security", .parent, spanel, 6);
    _ = addNode("Section_Notifs", .parent, spanel, 6);
    _ = addNode("Section_Billing", .parent, spanel, 6);

    const footer = addNode("Footer", .fixed_sz, shell, 3);
    _ = addNode("FooterLinks", .dyn, footer, 4);
    _ = addNode("FooterCopy", .fixed, footer, 4);

    // ModalStack
    const modal = addNode("ModalStack", .parent, router, 2);
    const dialog = addNode("ConfirmDialog", .parent, modal, 3);
    _ = addNode("DialogHeader", .fixed_sz, dialog, 4);
    _ = addNode("DialogBody", .flex, dialog, 4);
    _ = addNode("DialogFooter", .fixed_sz, dialog, 4);
    const preview = addNode("ImagePreview", .parent, modal, 3);
    _ = addNode("PreviewImage", .flex, preview, 4);
    _ = addNode("PreviewToolbar", .fixed_sz, preview, 4);

    // ToastStack
    const toast = addNode("ToastStack", .parent, router, 2);
    _ = addNode("Toast_1", .dyn, toast, 3);
    _ = addNode("Toast_2", .dyn, toast, 3);
    _ = addNode("Toast_3", .dyn, toast, 3);

    // Overlay
    const overlay = addNode("Overlay", .parent, router, 2);
    _ = addNode("Tooltip", .dyn, overlay, 3);
    const ctx = addNode("ContextMenu", .parent, overlay, 3);
    _ = addNode("MenuItem_Cut", .fixed, ctx, 4);
    _ = addNode("MenuItem_Copy", .fixed, ctx, 4);
    _ = addNode("MenuItem_Paste", .fixed, ctx, 4);
    _ = addNode("MenuItem_Delete", .fixed, ctx, 4);

    // Count descendants
    _ = countDescendants(0);

    // Layout
    layoutTree();

    graph_built = true;
}

fn countDescendants(idx: u16) u16 {
    var total: u16 = 0;
    const n = &nodes[idx];
    var ci: u16 = 0;
    while (ci < n.child_count) : (ci += 1) {
        const child_idx = n.children[ci];
        total += 1 + countDescendants(child_idx);
    }
    n.descendant_count = total;
    return total;
}

// ── Tree layout (post-order, leaf cursor) ───────────────────────────────

var layout_cursor: f32 = 0;
const H_GAP: f32 = 16;
const V_SPACING: f32 = 100; // vertical distance between levels

fn leafCount(idx: u16) f32 {
    const n = &nodes[idx];
    if (n.child_count == 0) return 1;
    var total: f32 = 0;
    var ci: u16 = 0;
    while (ci < n.child_count) : (ci += 1) {
        total += leafCount(n.children[ci]);
    }
    return total;
}

fn layoutNode(idx: u16) void {
    const n = &nodes[idx];
    n.gy = @as(f32, @floatFromInt(n.depth)) * V_SPACING;

    if (n.child_count == 0) {
        // Leaf: place at cursor
        n.gx = layout_cursor + n.gw / 2;
        layout_cursor += n.gw + H_GAP;
        return;
    }

    // Layout children first
    var ci: u16 = 0;
    while (ci < n.child_count) : (ci += 1) {
        layoutNode(n.children[ci]);
    }

    // Center over children
    const first = &nodes[n.children[0]];
    const last = &nodes[n.children[n.child_count - 1]];
    n.gx = (first.gx + last.gx) / 2;
}

fn layoutTree() void {
    layout_cursor = 0;
    layoutNode(0);

    // Compute graph bounds
    graph_min_x = 1e9;
    graph_max_x = -1e9;
    graph_min_y = 0;
    graph_max_y = 0;
    var i: u16 = 0;
    while (i < node_count) : (i += 1) {
        const n = &nodes[i];
        const left = n.gx - n.gw / 2;
        const right = n.gx + n.gw / 2;
        const bottom = n.gy + n.gh;
        if (left < graph_min_x) graph_min_x = left;
        if (right > graph_max_x) graph_max_x = right;
        if (bottom > graph_max_y) graph_max_y = bottom;
    }

    // Center camera on graph
    cam_x = (graph_min_x + graph_max_x) / 2;
    cam_y = (graph_min_y + graph_max_y) / 2;
    cam_zoom = 1.0;
}

// ── Coordinate transforms ───────────────────────────────────────────────

fn graphToScreenX(gx: f32) f32 {
    // At zoom 1.0: entire graph fits viewport width
    const graph_w = graph_max_x - graph_min_x + 80;  // padding
    const graph_h = graph_max_y - graph_min_y + 80;
    const base_scale = @min(vp_w / graph_w, vp_h / graph_h);
    const scale = base_scale * cam_zoom;
    return vp_x + vp_w / 2 + (gx - cam_x) * scale;
}

fn graphToScreenY(gy: f32) f32 {
    const graph_w = graph_max_x - graph_min_x + 80;
    const graph_h = graph_max_y - graph_min_y + 80;
    const base_scale = @min(vp_w / graph_w, vp_h / graph_h);
    const scale = base_scale * cam_zoom;
    return vp_y + vp_h / 2 + (gy - cam_y) * scale;
}

fn graphScale() f32 {
    const graph_w = graph_max_x - graph_min_x + 80;
    const graph_h = graph_max_y - graph_min_y + 80;
    return @min(vp_w / graph_w, vp_h / graph_h) * cam_zoom;
}

fn screenToGraphX(sx: f32) f32 {
    const scale = graphScale();
    return cam_x + (sx - vp_w / 2) / scale;
}

fn screenToGraphY(sy: f32) f32 {
    const scale = graphScale();
    return cam_y + (sy - vp_h / 2) / scale;
}

// ── Node type colors ────────────────────────────────────────────────────

const TypeColor = struct { r: f32, g: f32, b: f32, bg_r: f32, bg_g: f32, bg_b: f32 };

fn typeColor(t: NodeType) TypeColor {
    return switch (t) {
        .root =>     .{ .r = 0.66, .g = 0.33, .b = 0.97, .bg_r = 0.10, .bg_g = 0.06, .bg_b = 0.19 },
        .parent =>   .{ .r = 0.66, .g = 0.33, .b = 0.97, .bg_r = 0.10, .bg_g = 0.06, .bg_b = 0.19 },
        .child =>    .{ .r = 0.98, .g = 0.45, .b = 0.09, .bg_r = 0.10, .bg_g = 0.08, .bg_b = 0.03 },
        .fixed =>    .{ .r = 0.29, .g = 0.87, .b = 0.50, .bg_r = 0.05, .bg_g = 0.10, .bg_b = 0.06 },
        .fixed_sz => .{ .r = 0.97, .g = 0.44, .b = 0.44, .bg_r = 0.10, .bg_g = 0.05, .bg_b = 0.05 },
        .flex =>     .{ .r = 0.23, .g = 0.51, .b = 0.96, .bg_r = 0.05, .bg_g = 0.07, .bg_b = 0.13 },
        .dyn =>      .{ .r = 0.98, .g = 0.75, .b = 0.14, .bg_r = 0.10, .bg_g = 0.09, .bg_b = 0.03 },
    };
}

fn typeName(t: NodeType) []const u8 {
    return switch (t) {
        .root => "Root",
        .parent => "Parent",
        .child => "Child",
        .fixed => "Fixed",
        .fixed_sz => "Fixed sz",
        .flex => "Flex",
        .dyn => "Dynamic",
    };
}

// ── Render ──────────────────────────────────────────────────────────────

fn render(x: f32, y: f32, w: f32, h: f32) void {
    buildDemoTree();

    vp_x = x;
    vp_y = y;
    vp_w = w;
    vp_h = h;

    const scale = graphScale();
    const min_visible_size: f32 = 4; // don't draw nodes smaller than 4px

    // Background
    gpu.drawRect(x, y, w, h, 0.03, 0.05, 0.08, 1.0, 0, 0, 0, 0, 0, 0);

    // Draw connectors first
    var i: u16 = 0;
    while (i < node_count) : (i += 1) {
        const n = &nodes[i];
        if (n.child_count == 0) continue;

        const tc = typeColor(n.ntype);
        const px = graphToScreenX(n.gx);
        const py = graphToScreenY(n.gy + n.gh / 2);
        const first_child = &nodes[n.children[0]];
        const cy_top = graphToScreenY(first_child.gy - first_child.gh / 2);
        const mid_y = py + (cy_top - py) / 2;
        const line_w: f32 = @max(1, 2 * scale);

        // Stem down from parent
        if (cy_top - py > 1) {
            gpu.drawRect(px - line_w / 2, py, line_w, mid_y - py, tc.r, tc.g, tc.b, 0.6, 0, 0, 0, 0, 0, 0);
        }

        // Horizontal bar
        if (n.child_count > 1) {
            const last_child = &nodes[n.children[n.child_count - 1]];
            const fcx = graphToScreenX(first_child.gx);
            const lcx = graphToScreenX(last_child.gx);
            const bar_l = @min(fcx, lcx);
            const bar_r = @max(fcx, lcx);
            gpu.drawRect(bar_l, mid_y - line_w / 2, bar_r - bar_l + line_w, line_w, tc.r, tc.g, tc.b, 0.6, 0, 0, 0, 0, 0, 0);
        }

        // Stems down to children
        var ci: u16 = 0;
        while (ci < n.child_count) : (ci += 1) {
            const child = &nodes[n.children[ci]];
            const ccx = graphToScreenX(child.gx);
            const ccy = graphToScreenY(child.gy - child.gh / 2);
            if (ccy - mid_y > 1) {
                gpu.drawRect(ccx - line_w / 2, mid_y, line_w, ccy - mid_y, tc.r, tc.g, tc.b, 0.6, 0, 0, 0, 0, 0, 0);
            }
        }
    }

    // Draw nodes
    i = 0;
    while (i < node_count) : (i += 1) {
        const n = &nodes[i];
        const nw = n.gw * scale;
        const nh = n.gh * scale;
        if (nw < min_visible_size or nh < min_visible_size) continue;

        const sx = graphToScreenX(n.gx) - nw / 2;
        const sy = graphToScreenY(n.gy) - nh / 2;

        // Skip if off-screen
        if (sx + nw < x or sx > x + w or sy + nh < y or sy > y + h) continue;

        const tc = typeColor(n.ntype);
        const br: f32 = @min(4 * scale, 6);
        const bw: f32 = @max(1, 1.5 * scale);

        // Background
        gpu.drawRect(sx, sy, nw, nh, tc.bg_r, tc.bg_g, tc.bg_b, 1.0, br, bw, tc.r, tc.g, tc.b, 1.0);

        // Text — only draw if node is big enough to read
        if (nw > 40 and nh > 16) {
            const font_size: u16 = @intFromFloat(@max(8, @min(13 * scale, 16)));
            const sub_size: u16 = @intFromFloat(@max(6, @min(9 * scale, 12)));

            gpu.drawTextLine(n.name, sx + 4 * scale, sy + 3 * scale, font_size, 0.88, 0.90, 0.94, 1.0);

            if (nh > 28) {
                gpu.drawTextLine(typeName(n.ntype), sx + 4 * scale, sy + nh - @as(f32, @floatFromInt(sub_size)) - 3 * scale, sub_size, tc.r, tc.g, tc.b, 0.8);
            }
        }
    }

    // HUD: zoom level
    gpu.drawTextLine("zoom:", x + w - 100, y + h - 24, 12, 0.5, 0.5, 0.6, 0.8);
}

// ── Input handlers ──────────────────────────────────────────────────────

fn handleScroll(mx: f32, my: f32, delta: f32) void {
    // Zoom toward cursor position
    const old_gx = screenToGraphX(mx);
    const old_gy = screenToGraphY(my);

    // Zoom factor: each scroll tick = 15%
    const factor: f32 = if (delta > 0) 1.15 else 1.0 / 1.15;
    cam_zoom = @max(0.1, @min(cam_zoom * factor, 50.0));

    // Adjust camera so the point under cursor stays fixed
    const new_gx = screenToGraphX(mx);
    const new_gy = screenToGraphY(my);
    cam_x += old_gx - new_gx;
    cam_y += old_gy - new_gy;
}

fn handleDrag(_: f32, _: f32, dx: f32, dy: f32) void {
    // Pan: move camera opposite to drag direction
    const scale = graphScale();
    if (scale > 0) {
        cam_x -= dx / scale;
        cam_y -= dy / scale;
    }
}

fn handleClick(mx: f32, my: f32) bool {
    // Future: node selection, expand/collapse
    _ = mx;
    _ = my;
    return true;
}

// ── Registration ────────────────────────────────────────────────────────

pub fn register() void {
    canvas.register("constraint-graph", .{
        .render_fn = render,
        .handle_scroll_fn = handleScroll,
        .handle_drag_fn = handleDrag,
        .handle_click_fn = handleClick,
    });
}
