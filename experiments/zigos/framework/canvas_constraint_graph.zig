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

/// Style snapshot — what matters for layout debugging
const NodeStyle = struct {
    width: ?f32 = null,         // explicit width or null (auto)
    height: ?f32 = null,
    flex_grow: f32 = 0,
    flex_basis: ?f32 = null,
    padding: f32 = 0,
    gap: f32 = 0,
    flex_dir: enum { row, column } = .column,
    align_items: enum { start, center, end, stretch } = .stretch,
    justify: enum { start, center, end, space_between } = .start,
    // Computed by layout
    computed_x: f32 = 0,
    computed_y: f32 = 0,
    computed_w: f32 = 0,
    computed_h: f32 = 0,
};

const GraphNode = struct {
    name: []const u8,
    ntype: NodeType,
    parent_idx: ?u16,
    children: [MAX_CHILDREN]u16,
    child_count: u16,
    depth: u8,
    descendant_count: u16,
    style: NodeStyle,
    // Graph layout positions
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

// ── Hover + selection + filter state ─────────────────────────────────────

var hovered_idx: ?u16 = null;   // node under cursor
var selected_idx: ?u16 = null;  // pinned node (click to select)
var mouse_gx: f32 = 0;
var mouse_gy: f32 = 0;

// DFS walk order — for prev/next navigation
var dfs_order: [MAX_NODES]u16 = undefined;
var dfs_count: u16 = 0;
var filter_buf: [64]u8 = [_]u8{0} ** 64;
var filter_len: u8 = 0;

// ── Demo tree builder ───────────────────────────────────────────────────
// Builds a realistic app component tree for testing.
// In production, this would be populated from the actual component tree at runtime.

fn addNode(name: []const u8, ntype: NodeType, parent: ?u16, depth: u8, sty: NodeStyle) u16 {
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
        .style = sty,
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

// Shorthand style constructors
const S = NodeStyle;
fn sRow(g: f32, gap: f32) S { return .{ .flex_dir = .row, .flex_grow = g, .gap = gap }; }
fn sCol(g: f32, gap: f32) S { return .{ .flex_dir = .column, .flex_grow = g, .gap = gap }; }
fn sFixed(w: f32, h: f32) S { return .{ .width = w, .height = h }; }
fn sGrow(g: f32) S { return .{ .flex_grow = g }; }

fn buildDemoTree() void {
    if (graph_built) return;
    node_count = 0;

    const n = addNode;
    const app = n("App", .root, null, 0, sCol(1, 0));
    const router = n("Router", .parent, app, 1, sCol(1, 0));

    const shell = n("Shell", .flex, router, 2, sRow(1, 0));
    const header = n("Header", .parent, shell, 3, .{ .flex_dir = .row, .height = 56, .padding = 8, .gap = 12, .align_items = .center });
    _ = n("Logo", .fixed, header, 4, sFixed(40, 40));
    const search = n("SearchBar", .child, header, 4, .{ .flex_dir = .row, .flex_grow = 1, .gap = 4 });
    _ = n("SearchIcon", .fixed, search, 5, sFixed(20, 20));
    _ = n("SearchInput", .flex, search, 5, sGrow(1));
    _ = n("SearchClear", .fixed, search, 5, sFixed(20, 20));
    const tabs = n("NavTabs", .parent, header, 4, .{ .flex_dir = .row, .gap = 4 });
    _ = n("Tab_Home", .fixed, tabs, 5, sFixed(60, 32));
    _ = n("Tab_Dash", .fixed, tabs, 5, sFixed(60, 32));
    _ = n("Tab_Projects", .fixed, tabs, 5, sFixed(72, 32));
    _ = n("Tab_Reports", .fixed, tabs, 5, sFixed(64, 32));
    _ = n("Tab_Settings", .fixed, tabs, 5, sFixed(68, 32));
    const umenu = n("UserMenu", .parent, header, 4, .{ .flex_dir = .row, .gap = 8, .align_items = .center });
    _ = n("Avatar", .fixed, umenu, 5, sFixed(32, 32));
    _ = n("UserName", .dyn, umenu, 5, .{ .width = 80 });
    _ = n("DropdownIcon", .fixed, umenu, 5, sFixed(16, 16));
    _ = n("NotifBell", .fixed_sz, header, 4, sFixed(32, 32));

    const sidebar = n("Sidebar", .dyn, shell, 3, .{ .width = 240, .padding = 8, .gap = 4 });
    const snav = n("SideNav", .parent, sidebar, 4, .{ .flex_grow = 1, .gap = 2 });
    const nmain = n("NavSection_Main", .parent, snav, 5, .{ .gap = 2 });
    _ = n("Nav_Home", .dyn, nmain, 6, .{ .height = 32 });
    _ = n("Nav_Dash", .dyn, nmain, 6, .{ .height = 32 });
    _ = n("Nav_Inbox", .dyn, nmain, 6, .{ .height = 32 });
    _ = n("Nav_Tasks", .dyn, nmain, 6, .{ .height = 32 });
    _ = n("Nav_Cal", .dyn, nmain, 6, .{ .height = 32 });
    const nproj = n("NavSection_Projects", .parent, snav, 5, .{ .gap = 2 });
    _ = n("Proj_1", .dyn, nproj, 6, .{ .height = 32 });
    _ = n("Proj_2", .dyn, nproj, 6, .{ .height = 32 });
    _ = n("Proj_3", .dyn, nproj, 6, .{ .height = 32 });
    _ = n("Proj_4", .dyn, nproj, 6, .{ .height = 32 });
    _ = n("SideFooter", .fixed, sidebar, 4, .{ .height = 48 });

    const main_c = n("MainContent", .flex, shell, 3, .{ .flex_grow = 1, .padding = 16, .gap = 16 });
    const dash = n("DashboardPage", .child, main_c, 4, .{ .flex_grow = 1, .gap = 16 });
    _ = n("PageHeader", .fixed_sz, dash, 5, .{ .height = 48, .flex_dir = .row, .justify = .space_between });
    const stats = n("StatsRow", .parent, dash, 5, .{ .flex_dir = .row, .gap = 12 });
    _ = n("Stat_Revenue", .dyn, stats, 6, sGrow(1));
    _ = n("Stat_Users", .dyn, stats, 6, sGrow(1));
    _ = n("Stat_Orders", .dyn, stats, 6, sGrow(1));
    _ = n("Stat_Conv", .dyn, stats, 6, sGrow(1));
    const charts = n("ChartRow", .parent, dash, 5, .{ .flex_dir = .row, .gap = 16 });
    _ = n("RevenueChart", .flex, charts, 6, sGrow(1));
    _ = n("UsersChart", .flex, charts, 6, sGrow(1));
    const feed = n("ActivityFeed", .child, dash, 5, .{ .gap = 4 });
    var fi: u16 = 0;
    while (fi < 8) : (fi += 1) {
        _ = n("FeedItem", .dyn, feed, 6, .{ .height = 64, .flex_dir = .row, .gap = 8 });
    }
    const table = n("DataTable", .child, dash, 5, .{ .gap = 0 });
    _ = n("TableToolbar", .fixed_sz, table, 6, .{ .height = 40, .flex_dir = .row, .gap = 8 });
    _ = n("TableHeader", .fixed_sz, table, 6, .{ .height = 36, .flex_dir = .row });
    var ri: u16 = 0;
    while (ri < 10) : (ri += 1) {
        _ = n("TableRow", .dyn, table, 6, .{ .height = 40, .flex_dir = .row });
    }

    const settings = n("SettingsPage", .parent, main_c, 4, .{ .flex_dir = .row, .gap = 16 });
    _ = n("SettingsNav", .fixed, settings, 5, .{ .width = 200, .gap = 4 });
    const spanel = n("SettingsPanel", .flex, settings, 5, .{ .flex_grow = 1, .gap = 24 });
    _ = n("Section_Profile", .parent, spanel, 6, .{ .gap = 12 });
    _ = n("Section_Security", .parent, spanel, 6, .{ .gap = 12 });
    _ = n("Section_Notifs", .parent, spanel, 6, .{ .gap = 8 });
    _ = n("Section_Billing", .parent, spanel, 6, .{ .gap = 12 });

    const footer = n("Footer", .fixed_sz, shell, 3, .{ .height = 48, .flex_dir = .row, .padding = 16 });
    _ = n("FooterLinks", .dyn, footer, 4, .{ .flex_dir = .row, .gap = 16 });
    _ = n("FooterCopy", .fixed, footer, 4, .{});

    const modal = n("ModalStack", .parent, router, 2, .{});
    const dialog = n("ConfirmDialog", .parent, modal, 3, .{ .width = 400, .height = 250, .gap = 0 });
    _ = n("DialogHeader", .fixed_sz, dialog, 4, .{ .height = 48 });
    _ = n("DialogBody", .flex, dialog, 4, sGrow(1));
    _ = n("DialogFooter", .fixed_sz, dialog, 4, .{ .height = 52, .flex_dir = .row, .gap = 8, .justify = .end });
    const preview = n("ImagePreview", .parent, modal, 3, .{ .flex_grow = 1 });
    _ = n("PreviewImage", .flex, preview, 4, sGrow(1));
    _ = n("PreviewToolbar", .fixed_sz, preview, 4, .{ .height = 44, .flex_dir = .row, .gap = 8 });

    const toast = n("ToastStack", .parent, router, 2, .{ .gap = 8 });
    _ = n("Toast_1", .dyn, toast, 3, .{ .height = 48 });
    _ = n("Toast_2", .dyn, toast, 3, .{ .height = 48 });
    _ = n("Toast_3", .dyn, toast, 3, .{ .height = 48 });

    const overlay = n("Overlay", .parent, router, 2, .{});
    _ = n("Tooltip", .dyn, overlay, 3, .{ .width = 120, .height = 32 });
    const ctx = n("ContextMenu", .parent, overlay, 3, .{ .width = 180, .gap = 2 });
    _ = n("MenuItem_Cut", .fixed, ctx, 4, .{ .height = 32 });
    _ = n("MenuItem_Copy", .fixed, ctx, 4, .{ .height = 32 });
    _ = n("MenuItem_Paste", .fixed, ctx, 4, .{ .height = 32 });
    _ = n("MenuItem_Delete", .fixed, ctx, 4, .{ .height = 32 });

    _ = countDescendants(0);
    buildDfsOrder(0);
    layoutTree();
    graph_built = true;
}

/// Build DFS traversal order
fn buildDfsOrder(idx: u16) void {
    if (dfs_count >= MAX_NODES) return;
    dfs_order[dfs_count] = idx;
    dfs_count += 1;
    const nd = &nodes[idx];
    var ci: u16 = 0;
    while (ci < nd.child_count) : (ci += 1) {
        buildDfsOrder(nd.children[ci]);
    }
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

/// Format a u16 into a sentinel-terminated string for drawTextLine
var fmt_buf: [8:0]u8 = .{0} ** 8;
fn fmtNum(val: u16) [:0]const u8 {
    const slice = std.fmt.bufPrint(&fmt_buf, "{d}", .{val}) catch "?";
    fmt_buf[slice.len] = 0;
    return fmt_buf[0..slice.len :0];
}

/// Format a float with 1 decimal place + "x" suffix (for zoom)
var fmt_float_buf: [16:0]u8 = .{0} ** 16;
fn fmtZoom(val: f32) [:0]const u8 {
    const slice = std.fmt.bufPrint(&fmt_float_buf, "{d:.1}x", .{val}) catch "?";
    fmt_float_buf[slice.len] = 0;
    return fmt_float_buf[0..slice.len :0];
}

/// Format a float as a value (no suffix)
var fmt_val_buf: [16:0]u8 = .{0} ** 16;
fn fmtFloat(val: f32) [:0]const u8 {
    // Show as integer if it's whole, otherwise 1 decimal
    const rounded = @round(val);
    if (@abs(val - rounded) < 0.01) {
        const slice = std.fmt.bufPrint(&fmt_val_buf, "{d}", .{@as(i32, @intFromFloat(rounded))}) catch "?";
        fmt_val_buf[slice.len] = 0;
        return fmt_val_buf[0..slice.len :0];
    }
    const slice = std.fmt.bufPrint(&fmt_val_buf, "{d:.1}", .{val}) catch "?";
    fmt_val_buf[slice.len] = 0;
    return fmt_val_buf[0..slice.len :0];
}

// ── Hit testing ─────────────────────────────────────────────────────────

fn hitTestGraph(gx: f32, gy: f32) ?u16 {
    // Check nodes in reverse order (later = deeper = on top)
    var i: u16 = node_count;
    while (i > 0) {
        i -= 1;
        const n = &nodes[i];
        const hw = n.gw / 2;
        const hh = n.gh / 2;
        if (gx >= n.gx - hw and gx <= n.gx + hw and gy >= n.gy - hh and gy <= n.gy + hh) {
            return i;
        }
    }
    return null;
}

/// Case-insensitive substring match
fn matchesFilter(name: []const u8) bool {
    if (filter_len == 0) return true;
    const filt = filter_buf[0..filter_len];
    if (filt.len > name.len) return false;
    var ni: usize = 0;
    while (ni + filt.len <= name.len) : (ni += 1) {
        var ok = true;
        for (0..filt.len) |fi| {
            const a = if (name[ni + fi] >= 'A' and name[ni + fi] <= 'Z') name[ni + fi] + 32 else name[ni + fi];
            const b = if (filt[fi] >= 'A' and filt[fi] <= 'Z') filt[fi] + 32 else filt[fi];
            if (a != b) { ok = false; break; }
        }
        if (ok) return true;
    }
    return false;
}

// ── Render ──────────────────────────────────────────────────────────────

fn render(x: f32, y: f32, w: f32, h: f32) void {
    buildDemoTree();

    vp_x = x;
    vp_y = y;
    vp_w = w;
    vp_h = h;

    const scale = graphScale();
    const min_visible_size: f32 = 4;
    const has_filter = filter_len > 0;

    // Background
    gpu.drawRect(x, y, w, h, 0.03, 0.05, 0.08, 1.0, 0, 0, 0, 0, 0, 0);

    // Draw connectors
    var i: u16 = 0;
    while (i < node_count) : (i += 1) {
        const n = &nodes[i];
        if (n.child_count == 0) continue;

        const tc = typeColor(n.ntype);
        const dimmed = has_filter and !matchesFilter(n.name);
        const alpha: f32 = if (dimmed) 0.15 else 0.6;
        const px = graphToScreenX(n.gx);
        const py = graphToScreenY(n.gy + n.gh / 2);
        const first_child = &nodes[n.children[0]];
        const cy_top = graphToScreenY(first_child.gy - first_child.gh / 2);
        const mid_y = py + (cy_top - py) / 2;
        const line_w: f32 = @max(1, 2 * scale);

        if (cy_top - py > 1) {
            gpu.drawRect(px - line_w / 2, py, line_w, mid_y - py, tc.r, tc.g, tc.b, alpha, 0, 0, 0, 0, 0, 0);
        }

        if (n.child_count > 1) {
            const last_child = &nodes[n.children[n.child_count - 1]];
            const fcx = graphToScreenX(first_child.gx);
            const lcx = graphToScreenX(last_child.gx);
            const bar_l = @min(fcx, lcx);
            const bar_r = @max(fcx, lcx);
            gpu.drawRect(bar_l, mid_y - line_w / 2, bar_r - bar_l + line_w, line_w, tc.r, tc.g, tc.b, alpha, 0, 0, 0, 0, 0, 0);
        }

        var ci: u16 = 0;
        while (ci < n.child_count) : (ci += 1) {
            const child = &nodes[n.children[ci]];
            const ccx = graphToScreenX(child.gx);
            const ccy = graphToScreenY(child.gy - child.gh / 2);
            if (ccy - mid_y > 1) {
                gpu.drawRect(ccx - line_w / 2, mid_y, line_w, ccy - mid_y, tc.r, tc.g, tc.b, alpha, 0, 0, 0, 0, 0, 0);
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

        if (sx + nw < x or sx > x + w or sy + nh < y or sy > y + h) continue;

        const tc = typeColor(n.ntype);
        const is_hovered = hovered_idx != null and hovered_idx.? == i;
        const is_selected = selected_idx != null and selected_idx.? == i;
        const dimmed = has_filter and !matchesFilter(n.name);
        const node_alpha: f32 = if (dimmed) 0.2 else 1.0;
        const br: f32 = @min(4 * scale, 6);
        const bw_val: f32 = if (is_selected) @max(2, 3 * scale) else if (is_hovered) @max(2, 2.5 * scale) else @max(1, 1.5 * scale);

        // Selection ring
        if (is_selected) {
            gpu.drawRect(sx - 4, sy - 4, nw + 8, nh + 8, tc.r, tc.g, tc.b, 0.4, br + 3, 2, 1.0, 1.0, 1.0, 0.7);
        } else if (is_hovered) {
            gpu.drawRect(sx - 3, sy - 3, nw + 6, nh + 6, tc.r, tc.g, tc.b, 0.25, br + 2, 0, 0, 0, 0, 0);
        }

        // Background
        gpu.drawRect(sx, sy, nw, nh, tc.bg_r, tc.bg_g, tc.bg_b, node_alpha, br, bw_val, tc.r, tc.g, tc.b, node_alpha);

        // Text
        if (nw > 40 and nh > 16) {
            const font_size: u16 = @intFromFloat(@max(8, @min(13 * scale, 16)));
            const sub_size: u16 = @intFromFloat(@max(6, @min(9 * scale, 12)));
            const text_alpha: f32 = if (dimmed) 0.3 else 1.0;

            gpu.drawTextLine(n.name, sx + 4 * scale, sy + 3 * scale, font_size, 0.88, 0.90, 0.94, text_alpha);

            if (nh > 28) {
                gpu.drawTextLine(typeName(n.ntype), sx + 4 * scale, sy + nh - @as(f32, @floatFromInt(sub_size)) - 3 * scale, sub_size, tc.r, tc.g, tc.b, text_alpha * 0.8);
            }
        }
    }

    // ── Detail popover (selected > hovered) ────────────────────────────
    // Two-pass: measure height first, then draw with exact bounds.
    const popover_idx = selected_idx orelse hovered_idx;
    if (popover_idx) |hi| {
        const hn = &nodes[hi];
        const tc = typeColor(hn.ntype);
        const s = hn.style;

        // ── Pass 1: measure exact content height ──
        var mh: f32 = 8; // top padding
        mh += 20; // name (14px + 6 gap)
        mh += 16; // type (11px + 5 gap)
        mh += 14 * 3; // depth + children + descendants
        if (hn.parent_idx != null) mh += 14; // parent name
        mh += 8; // separator
        mh += 14; // "own style" header
        mh += 14 * 2; // flexDirection + alignItems (always shown)
        if (s.width != null) mh += 14;
        if (s.height != null) mh += 14;
        if (s.flex_grow > 0) mh += 14;
        if (s.padding > 0) mh += 14;
        if (s.gap > 0) mh += 14;
        if (hn.parent_idx != null) {
            mh += 8; // separator
            mh += 14; // "parent constraints" header
            mh += 14; // parent flexDirection
            const ps = nodes[hn.parent_idx.?].style;
            if (ps.gap > 0) mh += 14;
            mh += 14; // parent alignItems
        }
        if (selected_idx != null) mh += 18; // nav hint
        mh += 8; // bottom padding

        // Width: label col (100) + value col (longest value ~80) + padding
        const pop_w: f32 = 200;
        const pop_h: f32 = mh;

        const nw_s = hn.gw * scale;
        const screen_x = graphToScreenX(hn.gx) + nw_s / 2 + 8;
        const screen_y = graphToScreenY(hn.gy) - hn.gh * scale / 2;
        const px_c = @max(x + 4, @min(screen_x, x + w - pop_w - 8));
        const py_c = @max(y + 4, @min(screen_y, y + h - pop_h - 8));

        // ── Pass 2: draw ──
        // Scissor creates a segment boundary — flushes prior glyphs so popover draws on top
        gpu.pushScissor(px_c, py_c, pop_w, pop_h);
        gpu.drawRect(px_c, py_c, pop_w, pop_h, 0.06, 0.08, 0.14, 0.95, 6, 1.5, tc.r * 0.5, tc.g * 0.5, tc.b * 0.5, 0.9);

        var ry = py_c + 8;
        const lx = px_c + 10;
        const vx = px_c + 100;
        const L = struct { const r: f32 = 0.45; const g: f32 = 0.45; const b: f32 = 0.55; }; // label color
        const V = struct { const r: f32 = 0.85; const g: f32 = 0.85; const b: f32 = 0.92; }; // value color

        gpu.drawTextLine(hn.name, lx, ry, 14, 0.95, 0.95, 0.98, 1.0);
        ry += 20;
        gpu.drawTextLine(typeName(hn.ntype), lx, ry, 11, tc.r, tc.g, tc.b, 1.0);
        ry += 16;

        gpu.drawTextLine("depth", lx, ry, 10, L.r, L.g, L.b, 0.8);
        gpu.drawTextLine(fmtNum(hn.depth), vx, ry, 10, V.r, V.g, V.b, 1.0);
        ry += 14;
        gpu.drawTextLine("children", lx, ry, 10, L.r, L.g, L.b, 0.8);
        gpu.drawTextLine(fmtNum(hn.child_count), vx, ry, 10, V.r, V.g, V.b, 1.0);
        ry += 14;
        gpu.drawTextLine("descendants", lx, ry, 10, L.r, L.g, L.b, 0.8);
        gpu.drawTextLine(fmtNum(hn.descendant_count), vx, ry, 10, V.r, V.g, V.b, 1.0);
        ry += 14;
        if (hn.parent_idx) |pi| {
            gpu.drawTextLine("parent", lx, ry, 10, L.r, L.g, L.b, 0.8);
            gpu.drawTextLine(nodes[pi].name, vx, ry, 10, V.r, V.g, V.b, 1.0);
            ry += 14;
        }

        gpu.drawRect(lx, ry + 2, pop_w - 20, 1, 0.25, 0.25, 0.35, 0.5, 0, 0, 0, 0, 0, 0);
        ry += 8;
        gpu.drawTextLine("own style", lx, ry, 10, tc.r * 0.8, tc.g * 0.8, tc.b * 0.8, 0.9);
        ry += 14;
        gpu.drawTextLine("flexDirection", lx, ry, 10, L.r, L.g, L.b, 0.8);
        gpu.drawTextLine(if (s.flex_dir == .row) "row" else "column", vx, ry, 10, V.r, V.g, V.b, 1.0);
        ry += 14;
        gpu.drawTextLine("alignItems", lx, ry, 10, L.r, L.g, L.b, 0.8);
        gpu.drawTextLine(switch (s.align_items) { .start => "start", .center => "center", .end => "end", .stretch => "stretch" }, vx, ry, 10, V.r, V.g, V.b, 1.0);
        ry += 14;
        if (s.width) |wv| { gpu.drawTextLine("width", lx, ry, 10, L.r, L.g, L.b, 0.8); gpu.drawTextLine(fmtFloat(wv), vx, ry, 10, V.r, V.g, V.b, 1.0); ry += 14; }
        if (s.height) |hv| { gpu.drawTextLine("height", lx, ry, 10, L.r, L.g, L.b, 0.8); gpu.drawTextLine(fmtFloat(hv), vx, ry, 10, V.r, V.g, V.b, 1.0); ry += 14; }
        if (s.flex_grow > 0) { gpu.drawTextLine("flexGrow", lx, ry, 10, L.r, L.g, L.b, 0.8); gpu.drawTextLine(fmtFloat(s.flex_grow), vx, ry, 10, V.r, V.g, V.b, 1.0); ry += 14; }
        if (s.padding > 0) { gpu.drawTextLine("padding", lx, ry, 10, L.r, L.g, L.b, 0.8); gpu.drawTextLine(fmtFloat(s.padding), vx, ry, 10, V.r, V.g, V.b, 1.0); ry += 14; }
        if (s.gap > 0) { gpu.drawTextLine("gap", lx, ry, 10, L.r, L.g, L.b, 0.8); gpu.drawTextLine(fmtFloat(s.gap), vx, ry, 10, V.r, V.g, V.b, 1.0); ry += 14; }

        if (hn.parent_idx) |pi| {
            const ps = nodes[pi].style;
            const ptc = typeColor(nodes[pi].ntype);
            gpu.drawRect(lx, ry + 2, pop_w - 20, 1, 0.25, 0.25, 0.35, 0.5, 0, 0, 0, 0, 0, 0);
            ry += 8;
            gpu.drawTextLine("parent constraints", lx, ry, 10, ptc.r * 0.8, ptc.g * 0.8, ptc.b * 0.8, 0.9);
            ry += 14;
            gpu.drawTextLine("flexDirection", lx, ry, 10, L.r, L.g, L.b, 0.8);
            gpu.drawTextLine(if (ps.flex_dir == .row) "row" else "column", vx, ry, 10, V.r, V.g, V.b, 1.0);
            ry += 14;
            if (ps.gap > 0) { gpu.drawTextLine("gap", lx, ry, 10, L.r, L.g, L.b, 0.8); gpu.drawTextLine(fmtFloat(ps.gap), vx, ry, 10, V.r, V.g, V.b, 1.0); ry += 14; }
            gpu.drawTextLine("alignItems", lx, ry, 10, L.r, L.g, L.b, 0.8);
            gpu.drawTextLine(switch (ps.align_items) { .start => "start", .center => "center", .end => "end", .stretch => "stretch" }, vx, ry, 10, V.r, V.g, V.b, 1.0);
            ry += 14;
        }

        if (selected_idx != null) {
            gpu.drawTextLine("[arrows] navigate", px_c + 10, py_c + pop_h - 18, 9, 0.35, 0.35, 0.45, 0.6);
        }
        gpu.popScissor();
    }

    // ── Filter bar (bottom-left) ────────────────────────────────────────
    {
        const bar_w: f32 = 200;
        const bar_h: f32 = 28;
        const bar_x = x + 10;
        const bar_y = y + h - bar_h - 10;
        const active = filter_len > 0;
        const bar_bg: f32 = if (active) 0.12 else 0.06;
        gpu.drawRect(bar_x, bar_y, bar_w, bar_h, bar_bg, bar_bg + 0.02, bar_bg + 0.06, 0.9, 4, 1, 0.25, 0.25, 0.35, 0.6);

        if (filter_len > 0) {
            gpu.drawTextLine(filter_buf[0..filter_len], bar_x + 8, bar_y + 6, 12, 0.9, 0.9, 0.95, 1.0);
        } else {
            gpu.drawTextLine("type to filter...", bar_x + 8, bar_y + 7, 11, 0.35, 0.35, 0.45, 0.7);
        }
    }

    // HUD: zoom level
    gpu.drawTextLine("zoom:", x + w - 110, y + h - 24, 12, 0.5, 0.5, 0.6, 0.8);
    gpu.drawTextLine(fmtZoom(cam_zoom), x + w - 70, y + h - 24, 12, 0.8, 0.8, 0.9, 0.9);
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
    const gx = screenToGraphX(mx);
    const gy = screenToGraphY(my);
    const hit = hitTestGraph(gx, gy);
    if (hit) |idx| {
        // Toggle selection: click same node deselects
        selected_idx = if (selected_idx != null and selected_idx.? == idx) null else idx;
    } else {
        selected_idx = null;
    }
    return true;
}

fn handleMouse(mx: f32, my: f32) void {
    mouse_gx = screenToGraphX(mx);
    mouse_gy = screenToGraphY(my);
    hovered_idx = hitTestGraph(mouse_gx, mouse_gy);
}

/// Find DFS index of a node
fn dfsIndexOf(idx: u16) ?u16 {
    var i: u16 = 0;
    while (i < dfs_count) : (i += 1) {
        if (dfs_order[i] == idx) return i;
    }
    return null;
}

/// Navigate to a node: select it and pan camera to center on it
fn navigateTo(idx: u16) void {
    selected_idx = idx;
    cam_x = nodes[idx].gx;
    cam_y = nodes[idx].gy;
}

fn handleKey(sym: c_int, mods: u16) void {
    _ = mods;

    // Arrow left/right: prev/next in DFS order
    if (sym == 1073741903 or sym == 1073741904) { // SDLK_RIGHT / SDLK_LEFT
        const active = selected_idx orelse hovered_idx orelse 0;
        if (dfsIndexOf(active)) |di| {
            if (sym == 1073741903) { // right = next
                if (di + 1 < dfs_count) navigateTo(dfs_order[di + 1]);
            } else { // left = prev
                if (di > 0) navigateTo(dfs_order[di - 1]);
            }
        }
        return;
    }
    // Arrow up: go to parent
    if (sym == 1073741906) { // SDLK_UP
        const active = selected_idx orelse hovered_idx;
        if (active) |idx| {
            if (nodes[idx].parent_idx) |pi| navigateTo(pi);
        }
        return;
    }
    // Arrow down: go to first child
    if (sym == 1073741905) { // SDLK_DOWN
        const active = selected_idx orelse hovered_idx;
        if (active) |idx| {
            if (nodes[idx].child_count > 0) navigateTo(nodes[idx].children[0]);
        }
        return;
    }

    // Backspace: delete last filter char
    if (sym == 8) {
        if (filter_len > 0) filter_len -= 1;
        return;
    }
    // Escape: clear selection then filter
    if (sym == 27) {
        if (selected_idx != null) { selected_idx = null; return; }
        if (filter_len > 0) { filter_len = 0; return; }
        return;
    }
    // Printable ASCII: append to filter
    if (sym >= 32 and sym < 127 and filter_len < filter_buf.len - 1) {
        filter_buf[filter_len] = @intCast(@as(u32, @bitCast(sym)));
        filter_len += 1;
    }
}

// ── Registration ────────────────────────────────────────────────────────

pub fn register() void {
    canvas.register("constraint-graph", .{
        .render_fn = render,
        .handle_scroll_fn = handleScroll,
        .handle_drag_fn = handleDrag,
        .handle_click_fn = handleClick,
        .handle_mouse_fn = handleMouse,
        .handle_key_fn = handleKey,
    });
}
