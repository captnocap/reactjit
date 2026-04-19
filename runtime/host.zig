// Spawn hermes → read mutation-command stream → apply to a persistent node pool → paint with SDL3.
// Mini-layout for the spinner cart only. The real framework/layout.zig slots in later —
// the point of this binary is to prove the hermes→Zig seam end-to-end.

const std = @import("std");
const c = @cImport({ @cInclude("SDL3/SDL.h"); });

const WIN_W = 900;
const WIN_H = 400;
const FRAME_MS = 100;

// ── Node pool (persistent, mutated by commands) ─────────────────────

const Node = struct {
    id: u32,
    type: []const u8, // "View" | "Text" | ...
    // Style fields we care about for the spinner
    width_px: ?f32 = null,
    width_pct: ?f32 = null,
    height_px: ?f32 = null,
    height_pct: ?f32 = null,
    bg: ?u32 = null, // packed 0xRRGGBB
    padding: f32 = 0,
    gap: f32 = 0,
    flex_row: bool = false,
    justify_center: bool = false,
    align_center: bool = false,
    border_radius: f32 = 0,
    children: std.ArrayList(u32) = .{},
};

var nodes: std.AutoHashMap(u32, Node) = undefined;
var root_ids: std.ArrayList(u32) = .{};
var alloc: std.mem.Allocator = undefined;

fn namedColor(name: []const u8) u32 {
    const eq = std.mem.eql;
    if (eq(u8, name, "black"))   return 0x000000;
    if (eq(u8, name, "white"))   return 0xFFFFFF;
    if (eq(u8, name, "red"))     return 0xDC3232;
    if (eq(u8, name, "blue"))    return 0x4682E6;
    if (eq(u8, name, "green"))   return 0x3CBE64;
    if (eq(u8, name, "yellow"))  return 0xF0D23C;
    if (eq(u8, name, "cyan"))    return 0x46D2E6;
    if (eq(u8, name, "magenta")) return 0xDC50C8;
    return 0x505050;
}

fn applyStyle(node: *Node, style: std.json.Value) void {
    if (style != .object) return;
    var it = style.object.iterator();
    while (it.next()) |e| {
        const k = e.key_ptr.*;
        const v = e.value_ptr.*;
        if (std.mem.eql(u8, k, "width")) {
            switch (v) {
                .integer => |i| node.width_px = @floatFromInt(i),
                .float   => |f| node.width_px = @floatCast(f),
                .string  => |s| if (std.mem.endsWith(u8, s, "%")) {
                    node.width_pct = std.fmt.parseFloat(f32, s[0..s.len-1]) catch null;
                },
                else => {},
            }
        } else if (std.mem.eql(u8, k, "height")) {
            switch (v) {
                .integer => |i| node.height_px = @floatFromInt(i),
                .float   => |f| node.height_px = @floatCast(f),
                .string  => |s| if (std.mem.endsWith(u8, s, "%")) {
                    node.height_pct = std.fmt.parseFloat(f32, s[0..s.len-1]) catch null;
                },
                else => {},
            }
        } else if (std.mem.eql(u8, k, "backgroundColor")) {
            if (v == .string) node.bg = namedColor(v.string);
        } else if (std.mem.eql(u8, k, "padding")) {
            switch (v) {
                .integer => |i| node.padding = @floatFromInt(i),
                .float   => |f| node.padding = @floatCast(f),
                else => {},
            }
        } else if (std.mem.eql(u8, k, "gap")) {
            switch (v) {
                .integer => |i| node.gap = @floatFromInt(i),
                .float   => |f| node.gap = @floatCast(f),
                else => {},
            }
        } else if (std.mem.eql(u8, k, "flexDirection")) {
            if (v == .string) node.flex_row = std.mem.eql(u8, v.string, "row");
        } else if (std.mem.eql(u8, k, "justifyContent")) {
            if (v == .string) node.justify_center = std.mem.eql(u8, v.string, "center");
        } else if (std.mem.eql(u8, k, "alignItems")) {
            if (v == .string) node.align_center = std.mem.eql(u8, v.string, "center");
        } else if (std.mem.eql(u8, k, "borderRadius")) {
            switch (v) {
                .integer => |i| node.border_radius = @floatFromInt(i),
                .float   => |f| node.border_radius = @floatCast(f),
                else => {},
            }
        }
    }
}

// ── Command application ─────────────────────────────────────────────

fn applyCommand(cmd: std.json.Value) !void {
    if (cmd != .object) return;
    const op_v = cmd.object.get("op") orelse return;
    const op = op_v.string;
    if (std.mem.eql(u8, op, "CREATE")) {
        const id: u32 = @intCast(cmd.object.get("id").?.integer);
        const type_str = cmd.object.get("type").?.string;
        var node = Node{
            .id = id,
            .type = try alloc.dupe(u8, type_str),
            .children = .{},
        };
        const props = cmd.object.get("props") orelse std.json.Value{ .null = {} };
        if (props == .object) {
            if (props.object.get("style")) |style| applyStyle(&node, style);
        }
        try nodes.put(id, node);
    } else if (std.mem.eql(u8, op, "CREATE_TEXT")) {
        const id: u32 = @intCast(cmd.object.get("id").?.integer);
        try nodes.put(id, .{ .id = id, .type = "__Text__", .children = .{} });
    } else if (std.mem.eql(u8, op, "APPEND")) {
        const pid: u32 = @intCast(cmd.object.get("parentId").?.integer);
        const cid: u32 = @intCast(cmd.object.get("childId").?.integer);
        const p = nodes.getPtr(pid) orelse return;
        try p.children.append(alloc, cid);
    } else if (std.mem.eql(u8, op, "APPEND_TO_ROOT")) {
        const cid: u32 = @intCast(cmd.object.get("childId").?.integer);
        try root_ids.append(alloc, cid);
    } else if (std.mem.eql(u8, op, "REMOVE")) {
        const pid: u32 = @intCast(cmd.object.get("parentId").?.integer);
        const cid: u32 = @intCast(cmd.object.get("childId").?.integer);
        const p = nodes.getPtr(pid) orelse return;
        for (p.children.items, 0..) |x, i| if (x == cid) { _ = p.children.orderedRemove(i); break; };
    } else if (std.mem.eql(u8, op, "REMOVE_FROM_ROOT")) {
        const cid: u32 = @intCast(cmd.object.get("childId").?.integer);
        for (root_ids.items, 0..) |x, i| if (x == cid) { _ = root_ids.orderedRemove(i); break; };
    } else if (std.mem.eql(u8, op, "UPDATE")) {
        const id: u32 = @intCast(cmd.object.get("id").?.integer);
        const n = nodes.getPtr(id) orelse return;
        const props = cmd.object.get("props") orelse return;
        if (props == .object) {
            if (props.object.get("style")) |style| applyStyle(n, style);
        }
    }
    // INSERT_BEFORE, UPDATE_TEXT, etc. — spinner doesn't need them.
}

// ── Mini-flex layout + paint ────────────────────────────────────────

const Rect = struct { x: f32, y: f32, w: f32, h: f32 };

const Size = struct { w: f32, h: f32 };
fn computeChildSize(child: *const Node, parent_w: f32, parent_h: f32) Size {
    var w: f32 = parent_w;
    var h: f32 = parent_h;
    if (child.width_px) |v| w = v;
    if (child.width_pct) |v| w = parent_w * v / 100.0;
    if (child.height_px) |v| h = v;
    if (child.height_pct) |v| h = parent_h * v / 100.0;
    return .{ .w = w, .h = h };
}

fn paintNode(renderer: *c.SDL_Renderer, id: u32, rect: Rect) void {
    const n = nodes.getPtr(id) orelse return;

    if (n.bg) |bg| {
        const r: u8 = @intCast((bg >> 16) & 0xFF);
        const g: u8 = @intCast((bg >> 8) & 0xFF);
        const b: u8 = @intCast(bg & 0xFF);
        _ = c.SDL_SetRenderDrawColor(renderer, r, g, b, 255);
        const fr = c.SDL_FRect{ .x = rect.x, .y = rect.y, .w = rect.w, .h = rect.h };
        _ = c.SDL_RenderFillRect(renderer, &fr);
    }

    const inner = Rect{
        .x = rect.x + n.padding,
        .y = rect.y + n.padding,
        .w = rect.w - 2 * n.padding,
        .h = rect.h - 2 * n.padding,
    };

    if (n.children.items.len == 0) return;

    // Compute children sizes
    var total_main: f32 = 0;
    var sizes: [32]Size = undefined;
    for (n.children.items, 0..) |cid, i| {
        if (i >= 32) break;
        const child = nodes.getPtr(cid) orelse continue;
        sizes[i] = computeChildSize(child, inner.w, inner.h);
        total_main += if (n.flex_row) sizes[i].w else sizes[i].h;
    }
    if (n.children.items.len > 1) total_main += n.gap * @as(f32, @floatFromInt(n.children.items.len - 1));

    const main_size = if (n.flex_row) inner.w else inner.h;
    const cross_size = if (n.flex_row) inner.h else inner.w;

    var cursor: f32 = 0;
    if (n.justify_center) cursor = (main_size - total_main) / 2;

    for (n.children.items, 0..) |cid, i| {
        if (i >= 32) break;
        const s = sizes[i];
        const cm = if (n.flex_row) s.w else s.h;
        const cc = if (n.flex_row) s.h else s.w;
        var cross_off: f32 = 0;
        if (n.align_center) cross_off = (cross_size - cc) / 2;

        const cx = if (n.flex_row) inner.x + cursor else inner.x + cross_off;
        const cy = if (n.flex_row) inner.y + cross_off else inner.y + cursor;
        paintNode(renderer, cid, .{ .x = cx, .y = cy, .w = s.w, .h = s.h });
        cursor += cm + n.gap;
    }
}

// ── Hermes subprocess: batched frame parser ─────────────────────────
// Hermes prints `CMD <json-array>` lines and `MARK frame-N-done` separators.
// We collect frames as arrays of parsed commands and replay them against the pool.

const FrameBatch = std.ArrayList(u8); // raw JSON bytes for one flush

fn readFrames(alloc_: std.mem.Allocator, stdout: anytype) !std.ArrayList([]u8) {
    var frames: std.ArrayList([]u8) = .{};
    var reader_buf: [1 << 20]u8 = undefined;
    var line_buf: std.ArrayList(u8) = .{};
    defer line_buf.deinit(alloc_);

    while (true) {
        const n = try stdout.read(&reader_buf);
        if (n == 0) break;
        for (reader_buf[0..n]) |ch| {
            if (ch == '\n') {
                if (std.mem.startsWith(u8, line_buf.items, "CMD ")) {
                    const json_bytes = try alloc_.dupe(u8, line_buf.items[4..]);
                    try frames.append(alloc_, json_bytes);
                }
                line_buf.clearRetainingCapacity();
            } else {
                try line_buf.append(alloc_, ch);
            }
        }
    }
    return frames;
}

// ── Main ────────────────────────────────────────────────────────────

pub fn main() !void {
    var gpa = std.heap.GeneralPurposeAllocator(.{}){};
    alloc = gpa.allocator();
    nodes = std.AutoHashMap(u32, Node).init(alloc);

    // Spawn hermes
    var child = std.process.Child.init(&.{
        "/home/siah/testing/ts-parse/hermes-test/hermes",
        "/home/siah/creative/reactjit/experiments/hermes-stack/bundle.js",
    }, alloc);
    child.stdout_behavior = .Pipe;
    child.stderr_behavior = .Inherit;
    try child.spawn();
    const out = child.stdout.?;
    const frames = try readFrames(alloc, out);
    _ = try child.wait();
    std.debug.print("collected {d} frame batches\n", .{frames.items.len});

    // Parse each frame batch into a std.json.Value array and store as "scenes"
    // We can't replay destructive mutations, so we snapshot the pool after each apply.
    // Simpler approach: apply frame 0, snapshot rects by layout; apply each update frame; snapshot.
    // Even simpler: apply incrementally and, for each frame, render into SDL once the loop advances.

    var parsed_frames: std.ArrayList(std.json.Parsed(std.json.Value)) = .{};
    for (frames.items) |bytes| {
        const p = try std.json.parseFromSlice(std.json.Value, alloc, bytes, .{});
        try parsed_frames.append(alloc, p);
    }

    // Apply frame 0 (mount) immediately so the initial tree is live before the window shows.
    if (parsed_frames.items.len > 0) {
        for (parsed_frames.items[0].value.array.items) |cmd| try applyCommand(cmd);
    }

    // SDL3 window
    if (!c.SDL_Init(c.SDL_INIT_VIDEO)) return error.SdlInit;
    defer c.SDL_Quit();
    const win = c.SDL_CreateWindow("hermes-stack spinner", WIN_W, WIN_H, 0) orelse return error.SdlWin;
    defer c.SDL_DestroyWindow(win);
    const renderer = c.SDL_CreateRenderer(win, null) orelse return error.SdlRenderer;
    defer c.SDL_DestroyRenderer(renderer);

    var next_frame_idx: usize = 1; // frame 0 already applied
    var last_swap = c.SDL_GetTicks();
    var running = true;
    while (running) {
        var ev: c.SDL_Event = undefined;
        while (c.SDL_PollEvent(&ev)) {
            if (ev.type == c.SDL_EVENT_QUIT) running = false;
            if (ev.type == c.SDL_EVENT_KEY_DOWN and ev.key.key == c.SDLK_ESCAPE) running = false;
        }

        const now = c.SDL_GetTicks();
        if (now - last_swap >= FRAME_MS) {
            if (next_frame_idx < parsed_frames.items.len) {
                for (parsed_frames.items[next_frame_idx].value.array.items) |cmd| {
                    applyCommand(cmd) catch {};
                }
                next_frame_idx += 1;
            } else {
                // Loop: reset to frame 0 mount state? Simpler: cycle by reapplying in order from 0.
                // Since updates are cumulative, cycling doesn't restore earlier colors unless we have
                // the reverse. For visual proof of the stream, we just stop advancing and keep last frame.
                next_frame_idx = 1; // restart cycle with update stream; hermes UPDATE is idempotent on re-apply
                // Re-apply frame 0 to reset:
                for (parsed_frames.items[0].value.array.items) |cmd| { applyCommand(cmd) catch {}; }
            }
            last_swap = now;
        }

        _ = c.SDL_SetRenderDrawColor(renderer, 20, 20, 25, 255);
        _ = c.SDL_RenderClear(renderer);
        for (root_ids.items) |rid| {
            paintNode(renderer, rid, .{ .x = 0, .y = 0, .w = WIN_W, .h = WIN_H });
        }
        _ = c.SDL_RenderPresent(renderer);
        c.SDL_Delay(8);
    }
}
