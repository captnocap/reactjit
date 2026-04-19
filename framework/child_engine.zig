//! Child Window Engine — renderer-only process for independent windows.
//!
//! Port of love2d/lua/child_window/main.lua. Runs as a separate OS process
//! spawned by the parent via process.zig. Connects to the parent over
//! TCP/NDJSON (ipc.zig), receives tree mutations, renders with its own
//! wgpu surface, and sends input events back.
//!
//! No QuickJS, no app logic — pure renderer.
//!
//! The dynamic node pool allows the parent to build and mutate a tree
//! remotely via CREATE/APPEND/REMOVE/UPDATE commands, matching the Lua
//! protocol from window_ipc.lua.
//!
//! Usage (this is called from child_main.zig):
//!   try child_engine.run();

const std = @import("std");
const c = @import("c.zig").imports;
const layout = @import("layout.zig");
const text_mod = @import("text.zig");
const gpu = @import("gpu/gpu.zig");
const ipc = @import("net/ipc.zig");
const log = @import("log.zig");

const Node = layout.Node;
const Color = layout.Color;
const TextEngine = text_mod.TextEngine;

// ════════════════════════════════════════════════════════════════════════
// Dynamic Node Pool
// ════════════════════════════════════════════════════════════════════════
//
// The parent sends CREATE/APPEND/REMOVE/UPDATE commands over IPC.
// We store node data in a flat pool indexed by ID. Before each frame,
// we rebuild the tree into an arena buffer so layout.Node.children
// slices point to contiguous memory.

const MAX_POOL_NODES = 2048;
const MAX_CHILDREN_PER_NODE = 64;

const PoolEntry = struct {
    active: bool = false,
    node: Node = .{},
    child_ids: [MAX_CHILDREN_PER_NODE]u16 = [_]u16{0} ** MAX_CHILDREN_PER_NODE,
    child_count: u16 = 0,
};

var pool: [MAX_POOL_NODES]PoolEntry = [_]PoolEntry{.{}} ** MAX_POOL_NODES;
var root_ids: [MAX_CHILDREN_PER_NODE]u16 = [_]u16{0} ** MAX_CHILDREN_PER_NODE;
var root_count: u16 = 0;

// Arena for the materialized tree (rebuilt each frame)
var tree_arena: [MAX_POOL_NODES]Node = undefined;
var arena_pos: usize = 0;

fn poolCreate(id: u16) void {
    if (id >= MAX_POOL_NODES) return;
    pool[id] = .{ .active = true };
}

fn poolAppend(parent_id: u16, child_id: u16) void {
    if (parent_id >= MAX_POOL_NODES or !pool[parent_id].active) return;
    const p = &pool[parent_id];
    if (p.child_count >= MAX_CHILDREN_PER_NODE) return;
    p.child_ids[p.child_count] = child_id;
    p.child_count += 1;
}

fn poolAppendToRoot(child_id: u16) void {
    if (root_count >= MAX_CHILDREN_PER_NODE) return;
    root_ids[root_count] = child_id;
    root_count += 1;
}

fn poolRemove(parent_id: u16, child_id: u16) void {
    if (parent_id >= MAX_POOL_NODES or !pool[parent_id].active) return;
    const p = &pool[parent_id];
    var write: u16 = 0;
    for (0..p.child_count) |i| {
        if (p.child_ids[i] != child_id) {
            p.child_ids[write] = p.child_ids[i];
            write += 1;
        }
    }
    p.child_count = write;
}

fn poolRemoveFromRoot(child_id: u16) void {
    var write: u16 = 0;
    for (0..root_count) |i| {
        if (root_ids[i] != child_id) {
            root_ids[write] = root_ids[i];
            write += 1;
        }
    }
    root_count = write;
}

/// Build the full tree from root IDs. Returns a pointer to a synthetic root node.
/// The root node's children are the root_ids entries.
var synthetic_root: Node = .{};

fn buildTree() ?*Node {
    arena_pos = 0;

    if (root_count == 0) return null;

    // Synthetic root fills the window
    synthetic_root = .{
        .style = .{
            .flex_direction = .column,
            .flex_grow = 1,
        },
    };

    // Simple approach: for each root child, recursively copy into arena
    const children_start = arena_pos;
    arena_pos += root_count;
    if (arena_pos > MAX_POOL_NODES) return null;

    for (0..root_count) |i| {
        const id = root_ids[i];
        if (id >= MAX_POOL_NODES or !pool[id].active) {
            tree_arena[children_start + i] = .{};
            continue;
        }
        tree_arena[children_start + i] = pool[id].node;
        tree_arena[children_start + i].children = buildChildSlice(id);
    }

    synthetic_root.children = tree_arena[children_start .. children_start + root_count];
    return &synthetic_root;
}

/// Recursively build children slices for a pool node.
fn buildChildSlice(parent_id: u16) []Node {
    if (parent_id >= MAX_POOL_NODES or !pool[parent_id].active) return &.{};
    const cc = pool[parent_id].child_count;
    if (cc == 0) return &.{};
    if (arena_pos + cc > MAX_POOL_NODES) return &.{};

    const base = arena_pos;
    arena_pos += cc;

    for (0..cc) |i| {
        const child_id = pool[parent_id].child_ids[i];
        if (child_id >= MAX_POOL_NODES or !pool[child_id].active) {
            tree_arena[base + i] = .{};
            continue;
        }
        tree_arena[base + i] = pool[child_id].node;
        tree_arena[base + i].children = buildChildSlice(child_id);
    }

    return tree_arena[base .. base + cc];
}

// ════════════════════════════════════════════════════════════════════════
// Command parsing — minimal NDJSON command processor
// ════════════════════════════════════════════════════════════════════════
//
// Commands from parent (NDJSON lines):
//   {"type":"init","commands":[...]}
//   {"type":"mutations","commands":[...]}
//   {"type":"resize","width":N,"height":N}
//   {"type":"quit"}
//
// Individual tree commands within init/mutations:
//   {"op":"CREATE","id":N}
//   {"op":"CREATE","id":N,"bg":"#RRGGBB","text":"...","fontSize":N}
//   {"op":"APPEND","parentId":N,"childId":N}
//   {"op":"APPEND_TO_ROOT","childId":N}
//   {"op":"REMOVE","parentId":N,"childId":N}
//   {"op":"REMOVE_FROM_ROOT","childId":N}
//   {"op":"UPDATE","id":N,"text":"...","bg":"#RRGGBB"}
//
// We use simple substring scanning rather than a full JSON parser.

var tree_dirty: bool = true;
var shutting_down: bool = false;

fn handleMessage(data: []const u8, win_w: *f32, win_h: *f32) void {
    if (findString(data, "\"quit\"")) {
        shutting_down = true;
        return;
    }

    if (findString(data, "\"resize\"")) {
        if (findInt(data, "\"width\":")) |w| win_w.* = @floatFromInt(w);
        if (findInt(data, "\"height\":")) |h| win_h.* = @floatFromInt(h);
        tree_dirty = true;
        return;
    }

    // init and mutations both contain command arrays
    // For simplicity, scan for individual op patterns in the entire message
    if (findString(data, "\"init\"") or findString(data, "\"mutations\"")) {
        // Process embedded commands by scanning for op patterns
        var pos: usize = 0;
        while (pos < data.len) {
            if (findAt(data, pos, "\"op\":")) |op_start| {
                const cmd_start = backtrackToOpenBrace(data, op_start);
                const cmd_end = findMatchingBrace(data, cmd_start);
                if (cmd_end > cmd_start) {
                    processCommand(data[cmd_start..cmd_end]);
                    pos = cmd_end;
                } else {
                    pos = op_start + 5;
                }
            } else break;
        }
        tree_dirty = true;
        return;
    }
}

fn processCommand(cmd: []const u8) void {
    if (findString(cmd, "\"CREATE\"")) {
        const id = findInt(cmd, "\"id\":") orelse return;
        if (id < 0 or id >= MAX_POOL_NODES) return;
        const uid: u16 = @intCast(id);
        poolCreate(uid);

        // Optional style properties
        if (findHexColor(cmd, "\"bg\":\"#")) |col| {
            pool[uid].node.style.background_color = col;
        }
        if (findQuotedString(cmd, "\"text\":\"")) |txt| {
            pool[uid].node.text = txt;
        }
        if (findInt(cmd, "\"fontSize\":")) |fs| {
            pool[uid].node.font_size = @intCast(@min(200, @max(1, fs)));
        }
        if (findHexColor(cmd, "\"color\":\"#")) |col| {
            pool[uid].node.text_color = col;
        }
        // Flex properties
        if (findInt(cmd, "\"flexGrow\":")) |fg| {
            pool[uid].node.style.flex_grow = @floatFromInt(fg);
        }
        if (findInt(cmd, "\"padding\":")) |p| {
            pool[uid].node.style.padding = @floatFromInt(p);
        }
        if (findInt(cmd, "\"gap\":")) |g| {
            pool[uid].node.style.gap = @floatFromInt(g);
        }
        if (findString(cmd, "\"row\"")) {
            pool[uid].node.style.flex_direction = .row;
        }
    } else if (findString(cmd, "\"APPEND_TO_ROOT\"")) {
        const child_id = findInt(cmd, "\"childId\":") orelse return;
        if (child_id < 0 or child_id >= MAX_POOL_NODES) return;
        poolAppendToRoot(@intCast(child_id));
    } else if (findString(cmd, "\"REMOVE_FROM_ROOT\"")) {
        const child_id = findInt(cmd, "\"childId\":") orelse return;
        if (child_id < 0 or child_id >= MAX_POOL_NODES) return;
        poolRemoveFromRoot(@intCast(child_id));
    } else if (findString(cmd, "\"APPEND\"")) {
        const parent_id = findInt(cmd, "\"parentId\":") orelse return;
        const child_id = findInt(cmd, "\"childId\":") orelse return;
        if (parent_id < 0 or child_id < 0) return;
        if (parent_id >= MAX_POOL_NODES or child_id >= MAX_POOL_NODES) return;
        poolAppend(@intCast(parent_id), @intCast(child_id));
    } else if (findString(cmd, "\"REMOVE\"")) {
        const parent_id = findInt(cmd, "\"parentId\":") orelse return;
        const child_id = findInt(cmd, "\"childId\":") orelse return;
        if (parent_id < 0 or child_id < 0) return;
        if (parent_id >= MAX_POOL_NODES or child_id >= MAX_POOL_NODES) return;
        poolRemove(@intCast(parent_id), @intCast(child_id));
    } else if (findString(cmd, "\"UPDATE\"")) {
        const id = findInt(cmd, "\"id\":") orelse return;
        if (id < 0 or id >= MAX_POOL_NODES) return;
        const uid: u16 = @intCast(id);
        if (!pool[uid].active) return;
        if (findHexColor(cmd, "\"bg\":\"#")) |col| {
            pool[uid].node.style.background_color = col;
        }
        if (findQuotedString(cmd, "\"text\":\"")) |txt| {
            pool[uid].node.text = txt;
        }
        if (findInt(cmd, "\"fontSize\":")) |fs| {
            pool[uid].node.font_size = @intCast(@min(200, @max(1, fs)));
        }
        if (findHexColor(cmd, "\"color\":\"#")) |col| {
            pool[uid].node.text_color = col;
        }
    } else if (findString(cmd, "\"CREATE_TEXT\"")) {
        const id = findInt(cmd, "\"id\":") orelse return;
        if (id < 0 or id >= MAX_POOL_NODES) return;
        const uid: u16 = @intCast(id);
        poolCreate(uid);
        if (findQuotedString(cmd, "\"text\":\"")) |txt| {
            pool[uid].node.text = txt;
        }
    }
}

// ── Minimal JSON scanning helpers ─────────────────────────────────────

fn findString(data: []const u8, needle: []const u8) bool {
    return std.mem.indexOf(u8, data, needle) != null;
}

fn findAt(data: []const u8, start: usize, needle: []const u8) ?usize {
    if (start >= data.len) return null;
    const idx = std.mem.indexOf(u8, data[start..], needle);
    if (idx) |i| return start + i;
    return null;
}

fn findInt(data: []const u8, prefix: []const u8) ?i32 {
    const idx = std.mem.indexOf(u8, data, prefix) orelse return null;
    const start = idx + prefix.len;
    // Skip whitespace
    var pos = start;
    while (pos < data.len and (data[pos] == ' ' or data[pos] == '\t')) pos += 1;
    if (pos >= data.len) return null;

    var negative = false;
    if (data[pos] == '-') {
        negative = true;
        pos += 1;
    }

    var val: i32 = 0;
    var found = false;
    while (pos < data.len and data[pos] >= '0' and data[pos] <= '9') {
        val = val * 10 + @as(i32, data[pos] - '0');
        found = true;
        pos += 1;
    }
    if (!found) return null;
    return if (negative) -val else val;
}

fn findHexColor(data: []const u8, prefix: []const u8) ?Color {
    const idx = std.mem.indexOf(u8, data, prefix) orelse return null;
    const start = idx + prefix.len;
    if (start + 6 > data.len) return null;
    const hex = data[start .. start + 6];
    const r = hexByte(hex[0], hex[1]) orelse return null;
    const g = hexByte(hex[2], hex[3]) orelse return null;
    const b = hexByte(hex[4], hex[5]) orelse return null;
    return Color.rgb(r, g, b);
}

fn hexByte(hi: u8, lo: u8) ?u8 {
    const h = hexDigit(hi) orelse return null;
    const l = hexDigit(lo) orelse return null;
    return h * 16 + l;
}

fn hexDigit(ch: u8) ?u8 {
    if (ch >= '0' and ch <= '9') return ch - '0';
    if (ch >= 'a' and ch <= 'f') return ch - 'a' + 10;
    if (ch >= 'A' and ch <= 'F') return ch - 'A' + 10;
    return null;
}

fn findQuotedString(data: []const u8, prefix: []const u8) ?[]const u8 {
    const idx = std.mem.indexOf(u8, data, prefix) orelse return null;
    const start = idx + prefix.len;
    // Find closing quote (no escape handling for now)
    var end = start;
    while (end < data.len and data[end] != '"') end += 1;
    if (end >= data.len) return null;
    return data[start..end];
}

fn backtrackToOpenBrace(data: []const u8, pos: usize) usize {
    var p = pos;
    while (p > 0) {
        p -= 1;
        if (data[p] == '{') return p;
    }
    return 0;
}

fn findMatchingBrace(data: []const u8, start: usize) usize {
    if (start >= data.len or data[start] != '{') return start;
    var depth: u32 = 0;
    var in_string = false;
    for (start..data.len) |i| {
        if (data[i] == '"' and (i == 0 or data[i - 1] != '\\')) in_string = !in_string;
        if (in_string) continue;
        if (data[i] == '{') depth += 1;
        if (data[i] == '}') {
            depth -= 1;
            if (depth == 0) return i + 1;
        }
    }
    return data.len;
}

// ════════════════════════════════════════════════════════════════════════
// Input event serialization — send SDL events back to parent as NDJSON
// ════════════════════════════════════════════════════════════════════════

var event_buf: [1024]u8 = undefined;

fn sendClickEvent(client: *ipc.Client, mx: f32, my: f32, button: u8) void {
    const msg = std.fmt.bufPrint(&event_buf,
        "{{\"type\":\"event\",\"payload\":{{\"type\":\"click\",\"x\":{d},\"y\":{d},\"button\":{d}}}}}",
        .{ @as(i32, @intFromFloat(mx)), @as(i32, @intFromFloat(my)), button },
    ) catch return;
    _ = client.sendLine(msg);
}

fn sendKeyEvent(client: *ipc.Client, key: c_int, event_type: []const u8) void {
    const msg = std.fmt.bufPrint(&event_buf,
        "{{\"type\":\"event\",\"payload\":{{\"type\":\"{s}\",\"key\":{d}}}}}",
        .{ event_type, key },
    ) catch return;
    _ = client.sendLine(msg);
}

fn sendWindowEvent(client: *ipc.Client, handler: []const u8) void {
    const msg = std.fmt.bufPrint(&event_buf,
        "{{\"type\":\"windowEvent\",\"handler\":\"{s}\"}}",
        .{handler},
    ) catch return;
    _ = client.sendLine(msg);
}

fn sendWheelEvent(client: *ipc.Client, mx: f32, my: f32, dy: f32) void {
    const msg = std.fmt.bufPrint(&event_buf,
        "{{\"type\":\"event\",\"payload\":{{\"type\":\"wheel\",\"x\":{d},\"y\":{d},\"dy\":{d}}}}}",
        .{ @as(i32, @intFromFloat(mx)), @as(i32, @intFromFloat(my)), @as(i32, @intFromFloat(dy)) },
    ) catch return;
    _ = client.sendLine(msg);
}

// ════════════════════════════════════════════════════════════════════════
// Paint — simplified GPU paint (no canvas/devtools/selection)
// ════════════════════════════════════════════════════════════════════════

fn paintNode(node: *Node) void {
    if (node.style.display == .none) return;

    const r = node.computed;
    if (r.w <= 0 or r.h <= 0) return;

    // Background
    if (node.style.background_color) |col| {
        const cr: f32 = @as(f32, @floatFromInt(col.r)) / 255.0;
        const cg: f32 = @as(f32, @floatFromInt(col.g)) / 255.0;
        const cb: f32 = @as(f32, @floatFromInt(col.b)) / 255.0;
        const ca: f32 = @as(f32, @floatFromInt(col.a)) / 255.0;
        const rad: f32 = node.style.border_radius;
        var br: f32 = 0;
        var bg: f32 = 0;
        var bb: f32 = 0;
        var ba: f32 = 0;
        if (node.style.border_color) |bc| {
            br = @as(f32, @floatFromInt(bc.r)) / 255.0;
            bg = @as(f32, @floatFromInt(bc.g)) / 255.0;
            bb = @as(f32, @floatFromInt(bc.b)) / 255.0;
            ba = @as(f32, @floatFromInt(bc.a)) / 255.0;
        }
        gpu.drawRect(r.x, r.y, r.w, r.h, cr, cg, cb, ca, rad, node.style.brdTop(), node.style.brdRight(), node.style.brdBottom(), node.style.brdLeft(), br, bg, bb, ba);
    } else if (node.style.brdTop() > 0 or node.style.brdRight() > 0 or node.style.brdBottom() > 0 or node.style.brdLeft() > 0) {
        if (node.style.border_color) |bc| {
            const br: f32 = @as(f32, @floatFromInt(bc.r)) / 255.0;
            const bg: f32 = @as(f32, @floatFromInt(bc.g)) / 255.0;
            const bb: f32 = @as(f32, @floatFromInt(bc.b)) / 255.0;
            const ba: f32 = @as(f32, @floatFromInt(bc.a)) / 255.0;
            gpu.drawRect(r.x, r.y, r.w, r.h, 0, 0, 0, 0, node.style.border_radius, node.style.brdTop(), node.style.brdRight(), node.style.brdBottom(), node.style.brdLeft(), br, bg, bb, ba);
        }
    }

    // Text
    if (node.text) |txt| {
        if (txt.len > 0) {
            const tc = node.text_color orelse Color.rgb(255, 255, 255);
            const pl = node.style.padLeft();
            const pt = node.style.padTop();
            const max_w = r.w - pl - node.style.padRight();
            _ = gpu.drawTextWrapped(
                txt,
                r.x + pl,
                r.y + pt,
                node.font_size,
                max_w,
                @as(f32, @floatFromInt(tc.r)) / 255.0,
                @as(f32, @floatFromInt(tc.g)) / 255.0,
                @as(f32, @floatFromInt(tc.b)) / 255.0,
                1.0, 0,
            );
        }
    }

    // Scroll container clipping
    const ov = node.style.overflow;
    const is_scroll = (ov == .scroll or (ov == .auto and node.content_height > r.h));
    if (is_scroll) {
        gpu.pushScissor(r.x, r.y, r.w, r.h);
    }

    // Children
    for (node.children) |*child| {
        paintNode(child);
    }

    if (is_scroll) {
        gpu.popScissor();
    }
}

// ════════════════════════════════════════════════════════════════════════
// Main loop
// ════════════════════════════════════════════════════════════════════════

pub fn run() !void {
    // Read config from environment (set by parent in windows.zig openIndependent)
    const port_str = std.posix.getenv("ZIGOS_IPC_PORT") orelse {
        std.debug.print("[child_engine] ERROR: ZIGOS_IPC_PORT not set\n", .{});
        return error.NoIPCPort;
    };
    const port = std.fmt.parseInt(u16, port_str, 10) catch {
        std.debug.print("[child_engine] ERROR: invalid ZIGOS_IPC_PORT\n", .{});
        return error.InvalidPort;
    };

    var win_w: f32 = 640;
    var win_h: f32 = 480;
    if (std.posix.getenv("ZIGOS_WINDOW_W")) |ws| {
        if (std.fmt.parseInt(c_int, ws, 10) catch null) |w| win_w = @floatFromInt(w);
    }
    if (std.posix.getenv("ZIGOS_WINDOW_H")) |hs| {
        if (std.fmt.parseInt(c_int, hs, 10) catch null) |h| win_h = @floatFromInt(h);
    }

    // SDL init
    if (!c.SDL_Init(c.SDL_INIT_VIDEO)) return error.SDLInitFailed;
    defer c.SDL_Quit();

    const iw: c_int = @intFromFloat(win_w);
    const ih: c_int = @intFromFloat(win_h);

    const window = c.SDL_CreateWindow(
        "tsz child",
        iw,
        ih,
        c.SDL_WINDOW_RESIZABLE,
    ) orelse return error.WindowCreateFailed;
    defer c.SDL_DestroyWindow(window);

    // GPU init (own wgpu surface)
    gpu.init(window) catch return error.GPUInitFailed;
    defer gpu.deinit();

    // Text engine
    var te = TextEngine.initHeadless("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf") catch
        TextEngine.initHeadless("/System/Library/Fonts/Supplemental/Arial.ttf") catch
        return error.FontNotFound;
    defer te.deinit();

    gpu.initText(te.library, te.face, te.fallback_faces, te.fallback_count);
    layout.setMeasureFn(measureCallback);

    // Connect to parent
    var client = ipc.Client.connect(port) catch {
        std.debug.print("[child_engine] ERROR: failed to connect to parent\n", .{});
        return error.ConnectFailed;
    };
    defer client.close();

    // Send ready
    _ = client.sendLine("{\"type\":\"ready\"}");
    std.debug.print("[child_engine] connected to parent on port {d}\n", .{port});

    // Main loop
    var running = true;
    while (running) {
        // Poll SDL events
        var event: c.SDL_Event = undefined;
        while (c.SDL_PollEvent(&event)) {
            switch (event.type) {
                c.SDL_EVENT_QUIT => {
                    running = false;
                },
                c.SDL_EVENT_WINDOW_CLOSE_REQUESTED => {
                    if (shutting_down) {
                        running = false;
                    } else {
                        sendWindowEvent(&client, "onClose");
                    }
                },
                c.SDL_EVENT_WINDOW_PIXEL_SIZE_CHANGED => {
                    var ww: c_int = 0;
                    var wh: c_int = 0;
                    _ = c.SDL_GetWindowSize(window, &ww, &wh);
                    win_w = @floatFromInt(ww);
                    win_h = @floatFromInt(wh);
                    gpu.resize(@intCast(ww), @intCast(wh));
                    tree_dirty = true;
                },
                c.SDL_EVENT_MOUSE_BUTTON_DOWN => {
                    if (event.button.button == c.SDL_BUTTON_LEFT) {
                        sendClickEvent(&client, event.button.x, event.button.y, 1);
                    }
                },
                c.SDL_EVENT_KEY_DOWN => {
                    sendKeyEvent(&client, @intCast(event.key.key), "keydown");
                },
                c.SDL_EVENT_KEY_UP => {
                    sendKeyEvent(&client, @intCast(event.key.key), "keyup");
                },
                c.SDL_EVENT_MOUSE_WHEEL => {
                    sendWheelEvent(&client, event.wheel.mouse_x, event.wheel.mouse_y, event.wheel.y);
                },
                else => {},
            }
        }

        // Poll IPC messages from parent
        const msgs = client.poll();
        for (msgs) |msg| {
            handleMessage(msg.data, &win_w, &win_h);
        }
        if (client.dead) {
            std.debug.print("[child_engine] parent connection lost\n", .{});
            running = false;
        }
        if (shutting_down) running = false;

        // Build tree + layout
        if (tree_dirty) {
            // No-op if no tree yet
        }

        if (buildTree()) |root| {
            layout.layout(root, 0, 0, win_w, win_h);
            paintNode(root);
        }

        // Present
        gpu.frame(0.051, 0.067, 0.090);

        tree_dirty = false;
    }

    // Clean exit
    sendWindowEvent(&client, "onClose");
}

// ── Text measurement callback ─────────────────────────────────────────

fn measureCallback(t: []const u8, font_size: u16, max_width: f32, letter_spacing: f32, line_height: f32, max_lines: u16, no_wrap: bool) layout.TextMetrics {
    _ = t;
    _ = font_size;
    _ = max_width;
    _ = letter_spacing;
    _ = line_height;
    _ = max_lines;
    _ = no_wrap;
    // The child engine doesn't have direct access to the text engine from this callback.
    // For now, return empty metrics — text will still render via GPU, just without
    // accurate layout measurement. This is a known limitation until we wire the
    // text engine through properly.
    return .{};
}
