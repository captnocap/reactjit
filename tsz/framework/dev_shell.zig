//! CartridgeOS — multi-app host shell with hot-reload.
//!
//! Loads multiple .tsz app .so files as "cartridges" in a tabbed interface.
//! Each cartridge has its own state, event handlers, and lifecycle.
//! Cartridges can be hot-reloaded independently — state survives.
//!
//! Usage:
//!   tsz-dev app1.so app2.so app3.so    — load multiple apps in tabs
//!   tsz-dev app.so                     — single app (no tab bar)

const std = @import("std");
const layout = @import("layout.zig");
const engine = @import("engine.zig");
const cartridge = @import("cartridge.zig");
const Node = layout.Node;
const Color = layout.Color;

// ── Shell UI colors ──

const TAB_BG = Color.rgb(17, 24, 39);
const TAB_ACTIVE_BG = Color.rgb(30, 58, 138);
const TAB_TEXT = Color.rgb(148, 163, 184);
const TAB_ACTIVE_TEXT = Color.rgb(219, 234, 254);
const STATUS_BG = Color.rgb(17, 24, 39);
const STATUS_TEXT = Color.rgb(100, 116, 139);

// ── Shell UI node storage ──

const MAX_TABS = cartridge.MAX_CARTRIDGES;

var tab_text_nodes: [MAX_TABS]Node = [_]Node{.{}} ** MAX_TABS;
var tab_inner: [MAX_TABS][1]Node = undefined;
var tab_buttons: [MAX_TABS]Node = [_]Node{.{}} ** MAX_TABS;
var tab_bar_kids: [MAX_TABS]Node = [_]Node{.{}} ** MAX_TABS;

var content_child = [1]Node{.{}};
var content_area = Node{ .style = .{ .flex_grow = 1, .flex_basis = 0 } };
var status_text_node = Node{ .text = "CartridgeOS", .font_size = 11, .text_color = STATUS_TEXT };
var status_child = [1]Node{.{}};
var status_bar = Node{ .style = .{ .padding_left = 12, .padding_right = 12, .padding_top = 4, .padding_bottom = 4, .background_color = STATUS_BG } };
var tab_bar = Node{ .style = .{ .flex_direction = .row, .gap = 2, .padding_left = 8, .padding_right = 8, .padding_top = 6, .padding_bottom = 6, .background_color = TAB_BG } };

var shell_kids_multi = [3]Node{ .{}, .{}, .{} };
var shell_root_multi = Node{ .style = .{ .width = -1, .height = -1 } };

var loaded_count: usize = 0;

// ── Tab click handlers (comptime-generated dispatch table) ──

fn switchTo(idx: usize) void {
    cartridge.setActive(idx);
    refreshUI();
}

fn makeHandler(comptime i: usize) *const fn () void {
    return &struct { fn h() void { switchTo(i); } }.h;
}

const tab_handlers = blk: {
    var h: [MAX_TABS]*const fn () void = undefined;
    for (0..MAX_TABS) |i| h[i] = makeHandler(i);
    break :blk h;
};

// ── UI refresh ──

fn refreshUI() void {
    const n = loaded_count;
    const act = cartridge.activeIndex();

    // Update tab highlights
    for (0..n) |i| {
        tab_buttons[i].style.background_color = if (i == act) TAB_ACTIVE_BG else null;
        tab_text_nodes[i].text_color = if (i == act) TAB_ACTIVE_TEXT else TAB_TEXT;
        tab_inner[i][0] = tab_text_nodes[i];
        tab_buttons[i].children = &tab_inner[i];
        tab_bar_kids[i] = tab_buttons[i];
    }
    tab_bar.children = tab_bar_kids[0..n];

    // Swap content to active cartridge
    if (cartridge.getActiveRoot()) |root| {
        content_child[0] = root.*;
        content_area.children = &content_child;
    }

    // Status text
    var buf: [128]u8 = undefined;
    if (cartridge.get(act)) |cart| {
        const s = std.fmt.bufPrint(&buf, "{d} cartridge(s) | active: {s}", .{ n, cart.titleSlice() }) catch "CartridgeOS";
        // Copy to persistent buffer since buf is stack-local
        @memcpy(g_status_buf[0..s.len], s);
        g_status_len = s.len;
    }
    status_text_node.text = g_status_buf[0..g_status_len];
    status_child[0] = status_text_node;
    status_bar.children = &status_child;

    // Reassemble root
    shell_kids_multi[0] = tab_bar;
    shell_kids_multi[1] = content_area;
    shell_kids_multi[2] = status_bar;
    shell_root_multi.children = &shell_kids_multi;
}

var g_status_buf: [128]u8 = undefined;
var g_status_len: usize = 0;

// ── Engine callbacks ──

fn shellTick(now: u32) void {
    cartridge.tickAll(now);

    // Cross-cartridge sync: counter's count (cart 0 slot 0) → colors' size (cart 1 slot 1)
    if (loaded_count > 1) {
        const count = cartridge.getStateInt(0, 0);
        const new_size = 100 + count * 20; // each click grows the box by 20px
        cartridge.setStateInt(1, 1, new_size);
    }

    // Refresh content (tick may have changed the tree)
    if (cartridge.getActiveRoot()) |root| {
        content_child[0] = root.*;
        content_area.children = &content_child;
        shell_kids_multi[1] = content_area;
    }
}

fn shellCheckReload(config: *engine.AppConfig) bool {
    if (cartridge.checkReloads()) |idx| {
        if (idx == cartridge.activeIndex()) {
            refreshUI();
            if (loaded_count > 1) {
                config.root = &shell_root_multi;
            } else if (cartridge.getActiveRoot()) |root| {
                config.root = root;
            }
        }
        return true;
    }
    return false;
}

fn shellPostReload() void {
    // State already restored by cartridge manager
}

// ── Entry point ──

pub fn main() !void {
    var arena = std.heap.ArenaAllocator.init(std.heap.page_allocator);
    defer arena.deinit();
    const alloc = arena.allocator();

    const args = try std.process.argsAlloc(alloc);
    if (args.len < 2) {
        std.debug.print("Usage: tsz-dev <app1.so> [app2.so] ...\n", .{});
        std.debug.print("\nCartridgeOS — multi-app host with hot-reload.\n", .{});
        return;
    }

    for (args[1..]) |so_path| {
        _ = cartridge.load(so_path) catch |err| {
            std.debug.print("[cartridge] Failed to load {s}: {}\n", .{ so_path, err });
        };
    }

    loaded_count = cartridge.count();
    if (loaded_count == 0) {
        std.debug.print("[cartridge] No cartridges loaded\n", .{});
        return;
    }

    std.debug.print("[cartridge] Loaded {d} cartridge(s)\n", .{loaded_count});
    for (0..loaded_count) |i| {
        if (cartridge.get(i)) |c| {
            std.debug.print("[cartridge]   [{d}] {s}\n", .{ i + 1, c.titleSlice() });
        }
    }

    // Build tab buttons
    for (0..loaded_count) |i| {
        if (cartridge.get(i)) |c| {
            tab_text_nodes[i] = .{ .text = c.titleSlice(), .font_size = 12, .text_color = TAB_TEXT };
            tab_buttons[i] = .{
                .style = .{ .padding_left = 12, .padding_right = 12, .padding_top = 6, .padding_bottom = 6, .border_radius = 4 },
                .handlers = .{ .on_press = tab_handlers[i] },
            };
        }
    }

    refreshUI();

    // Single app: use cartridge root directly. Multi: use shell root with tabs.
    const config_root: *Node = if (loaded_count > 1)
        &shell_root_multi
    else
        cartridge.getActiveRoot() orelse return;

    const title: [*:0]const u8 = if (loaded_count > 1) "CartridgeOS" else blk: {
        if (cartridge.get(0)) |c| {
            c.title[c.title_len] = 0;
            break :blk @ptrCast(&c.title);
        }
        break :blk "tsz-dev";
    };

    try engine.run(.{
        .title = title,
        .root = config_root,
        .tick = shellTick,
        .check_reload = shellCheckReload,
        .post_reload = shellPostReload,
    });
}
