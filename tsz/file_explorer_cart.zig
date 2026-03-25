//! File Explorer — a pure Zig cartridge (no tsz compiler involved).
//!
//! Demonstrates that ANY Zig code can be a cartridge by exporting the
//! standard ABI: app_get_root, app_get_init, app_get_tick, app_get_title.
//!
//! Uses std.fs to read directories, builds a Node tree manually.

const std = @import("std");
const layout = @import("framework/layout.zig");
const Node = layout.Node;
const Style = layout.Style;
const Color = layout.Color;

// ── Colors ──

const BG = Color.rgb(15, 23, 42);
const HEADER_BG = Color.rgb(30, 41, 59);
const ENTRY_BG = Color.rgb(22, 33, 55);
const ENTRY_HOVER = Color.rgb(30, 58, 138);
const DIR_COLOR = Color.rgb(96, 165, 250);
const FILE_COLOR = Color.rgb(203, 213, 225);
const PATH_COLOR = Color.rgb(148, 163, 184);
const SIZE_COLOR = Color.rgb(100, 116, 139);

// ── State ──

var current_path_buf: [1024]u8 = undefined;
var current_path_len: usize = 0;
var dirty: bool = true;

// ── Node storage ──

const MAX_ENTRIES = 48;

// Each entry: [icon_text] [name_text] [size_text] in a row
var icon_nodes: [MAX_ENTRIES]Node = [_]Node{.{}} ** MAX_ENTRIES;
var name_nodes: [MAX_ENTRIES]Node = [_]Node{.{}} ** MAX_ENTRIES;
var size_nodes: [MAX_ENTRIES]Node = [_]Node{.{}} ** MAX_ENTRIES;
var row_children: [MAX_ENTRIES][3]Node = undefined;
var row_nodes: [MAX_ENTRIES]Node = [_]Node{.{}} ** MAX_ENTRIES;
var list_children_buf: [MAX_ENTRIES]Node = [_]Node{.{}} ** MAX_ENTRIES;
var entry_count: usize = 0;

// Name buffers (directory entry names)
var name_bufs: [MAX_ENTRIES][256]u8 = undefined;
var name_lens: [MAX_ENTRIES]usize = [_]usize{0} ** MAX_ENTRIES;

// Size buffers
var size_bufs: [MAX_ENTRIES][32]u8 = undefined;
var size_lens: [MAX_ENTRIES]usize = [_]usize{0} ** MAX_ENTRIES;

// Is-directory flags
var is_dir: [MAX_ENTRIES]bool = [_]bool{false} ** MAX_ENTRIES;

// Header
var path_text_node = Node{ .text = ".", .font_size = 14, .text_color = PATH_COLOR };
var title_node = Node{ .text = "File Explorer", .font_size = 18, .text_color = Color.rgb(226, 232, 240) };
var header_children = [2]Node{ .{}, .{} };
var header_node = Node{
    .style = .{ .padding = 12, .gap = 4, .background_color = HEADER_BG },
};

// Back button
var back_text = Node{ .text = ".. (up)", .font_size = 13, .text_color = DIR_COLOR };
var back_inner = [1]Node{.{}};
var back_node = Node{
    .style = .{ .padding_left = 12, .padding_right = 12, .padding_top = 6, .padding_bottom = 6, .background_color = ENTRY_BG, .border_radius = 4 },
    .handlers = .{ .on_press = &goUp },
};

// List container
var list_node = Node{
    .style = .{ .flex_grow = 1, .gap = 2, .padding = 8, .overflow = .scroll },
};

// Root
var root_children = [3]Node{ .{}, .{}, .{} };
var root = Node{
    .style = .{ .width = -1, .height = -1, .background_color = BG, .gap = 0 },
};

// ── Click handler dispatch ──

fn makeClickHandler(comptime i: usize) *const fn () void {
    return &struct {
        fn handler() void {
            if (i < entry_count and is_dir[i]) {
                // Navigate into this directory
                const name = name_bufs[i][0..name_lens[i]];
                var new_path_buf: [1024]u8 = undefined;
                const cur = current_path_buf[0..current_path_len];
                const new_len = std.fmt.bufPrint(&new_path_buf, "{s}/{s}", .{ cur, name }) catch return;
                @memcpy(current_path_buf[0..new_len.len], new_len);
                current_path_len = new_len.len;
                dirty = true;
            }
        }
    }.handler;
}

const click_handlers = blk: {
    var h: [MAX_ENTRIES]*const fn () void = undefined;
    for (0..MAX_ENTRIES) |i| h[i] = makeClickHandler(i);
    break :blk h;
};

fn goUp() void {
    const cur = current_path_buf[0..current_path_len];
    if (std.fs.path.dirname(cur)) |parent| {
        @memcpy(current_path_buf[0..parent.len], parent);
        current_path_len = parent.len;
        dirty = true;
    }
}

// ── Directory listing ──

fn listDirectory() void {
    const path = current_path_buf[0..current_path_len];
    path_text_node.text = path;

    var dir = std.fs.cwd().openDir(path, .{ .iterate = true }) catch {
        entry_count = 0;
        return;
    };
    defer dir.close();

    var it = dir.iterate();
    var count: usize = 0;
    while (count < MAX_ENTRIES) {
        const entry = it.next() catch break;
        if (entry == null) break;
        const e = entry.?;

        // Skip hidden files
        if (e.name.len > 0 and e.name[0] == '.') continue;

        // Store name
        const nl = @min(e.name.len, 255);
        @memcpy(name_bufs[count][0..nl], e.name[0..nl]);
        name_lens[count] = nl;
        is_dir[count] = (e.kind == .directory);

        // Format size
        if (e.kind == .directory) {
            const s = std.fmt.bufPrint(&size_bufs[count], "dir", .{}) catch "?";
            size_lens[count] = s.len;
        } else {
            // Try to stat for size
            const stat = dir.statFile(e.name) catch null;
            if (stat) |st| {
                const sz = st.size;
                if (sz > 1024 * 1024) {
                    const s = std.fmt.bufPrint(&size_bufs[count], "{d} MB", .{sz / (1024 * 1024)}) catch "?";
                    size_lens[count] = s.len;
                } else if (sz > 1024) {
                    const s = std.fmt.bufPrint(&size_bufs[count], "{d} KB", .{sz / 1024}) catch "?";
                    size_lens[count] = s.len;
                } else {
                    const s = std.fmt.bufPrint(&size_bufs[count], "{d} B", .{sz}) catch "?";
                    size_lens[count] = s.len;
                }
            } else {
                size_lens[count] = 0;
            }
        }

        count += 1;
    }
    entry_count = count;
}

fn rebuildTree() void {
    // Header
    header_children[0] = title_node;
    header_children[1] = path_text_node;
    header_node.children = &header_children;

    // Back button
    back_inner[0] = back_text;
    back_node.children = &back_inner;

    // Entry rows
    for (0..entry_count) |i| {
        icon_nodes[i] = .{
            .text = if (is_dir[i]) ">" else " ",
            .font_size = 13,
            .text_color = if (is_dir[i]) DIR_COLOR else SIZE_COLOR,
            .style = .{ .width = 16 },
        };
        name_nodes[i] = .{
            .text = name_bufs[i][0..name_lens[i]],
            .font_size = 13,
            .text_color = if (is_dir[i]) DIR_COLOR else FILE_COLOR,
            .style = .{ .flex_grow = 1, .flex_basis = 0 },
        };
        size_nodes[i] = .{
            .text = size_bufs[i][0..size_lens[i]],
            .font_size = 11,
            .text_color = SIZE_COLOR,
        };
        row_children[i] = .{ icon_nodes[i], name_nodes[i], size_nodes[i] };
        row_nodes[i] = .{
            .style = .{
                .flex_direction = .row,
                .gap = 8,
                .padding_left = 12,
                .padding_right = 12,
                .padding_top = 5,
                .padding_bottom = 5,
                .background_color = ENTRY_BG,
                .border_radius = 4,
            },
            .children = &row_children[i],
            .hoverable = true,
            .handlers = if (is_dir[i]) .{ .on_press = click_handlers[i] } else .{},
        };
        list_children_buf[i] = row_nodes[i];
    }

    // Assemble list (back button + entries)
    // We put the back button as the first entry in the list
    list_node.children = list_children_buf[0..entry_count];

    // Root
    root_children[0] = header_node;
    root_children[1] = back_node;
    root_children[2] = list_node;
    root.children = &root_children;
}

// ── Cartridge ABI exports ──

fn init() void {
    // Start at current working directory
    const cwd = std.fs.cwd().realpathAlloc(std.heap.page_allocator, ".") catch {
        @memcpy(current_path_buf[0..1], ".");
        current_path_len = 1;
        return;
    };
    @memcpy(current_path_buf[0..cwd.len], cwd);
    current_path_len = cwd.len;
    dirty = true;
}

fn tick(_: u32) void {
    if (dirty) {
        listDirectory();
        rebuildTree();
        dirty = false;
    }
}

export fn app_get_root() *Node {
    return &root;
}

export fn app_get_init() ?*const fn () void {
    return &init;
}

export fn app_get_tick() ?*const fn (u32) void {
    return &tick;
}

export fn app_get_title() [*:0]const u8 {
    return "File Explorer";
}

export fn app_state_count() usize {
    return 0;
}
