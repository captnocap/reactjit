//! ZigOS Shell — Phase 1 (Desktop Proof of Concept)
//!
//! Embeds QuickJS in the TSZ runtime. Loads a JS cartridge,
//! renders its UI through the TSZ layout engine + SDL2 software renderer.
//!
//! Build:  cd experiments/zigos && zig build
//! Run:    ./zig-out/bin/zigos-shell [path/to/app.js]

const std = @import("std");
const c = @import("framework/c.zig").imports;
const layout = @import("framework/layout.zig");
const text_mod = @import("framework/text.zig");
const qjs = @import("src/qjs.zig");

const Node = layout.Node;
const Style = layout.Style;
const Color = layout.Color;
const TextEngine = text_mod.TextEngine;
const GuestNode = qjs.GuestNode;

// ── Globals ──────────────────────────────────────────────────────────

var g_text_engine: ?*TextEngine = null;

fn measureCallback(t: []const u8, font_size: u16, max_width: f32, letter_spacing: f32, line_height: f32, max_lines: u16, no_wrap: bool) layout.TextMetrics {
    if (g_text_engine) |te| return te.measureTextWrappedEx(t, font_size, max_width, letter_spacing, line_height, max_lines, no_wrap);
    return .{};
}

fn measureImageCallback(_: []const u8) layout.ImageDims {
    return .{};
}

// ── Guest tree conversion ────────────────────────────────────────────

const MAX_NODES = 16384;
const INVALID_POOL: usize = std.math.maxInt(usize);
var node_pool: [MAX_NODES]Node = [_]Node{.{}} ** MAX_NODES;
var node_count: usize = 0;

// BFS queue for tree conversion
var bfs_queue: [MAX_NODES]u32 = undefined;

fn buildGuestTree(vm: *qjs.VM) ?*Node {
    if (vm.guest_nodes.items.len == 0) return null;
    node_count = 0;

    // Init guest_to_pool mapping to invalid
    const guest_count = vm.guest_nodes.items.len;
    for (0..@min(guest_count, MAX_NODES)) |i| {
        guest_to_pool[i] = INVALID_POOL;
    }

    // BFS traversal ensures all direct children of a node are
    // contiguous in node_pool.
    var queue_head: usize = 0;
    var queue_tail: usize = 0;

    bfs_queue[queue_tail] = 0;
    queue_tail += 1;

    while (queue_head < queue_tail) {
        const guest_idx = bfs_queue[queue_head];
        queue_head += 1;

        if (guest_idx >= guest_count) continue;
        if (node_count >= MAX_NODES - 1) break;

        const guest = &vm.guest_nodes.items[guest_idx];
        const pool_idx = node_count;
        node_count += 1;
        guest_to_pool[guest_idx] = pool_idx;

        node_pool[pool_idx] = Node{
            .style = Style{
                .width = guest.width,
                .height = guest.height,
                .padding = guest.padding,
                .gap = guest.gap,
                .flex_grow = guest.flex_grow,
                .border_radius = guest.border_radius,
                .flex_direction = switch (guest.flex_direction) {
                    .row => .row,
                    .column => .column,
                },
                .background_color = if (guest.background_color) |bg| Color.rgba(bg[0], bg[1], bg[2], bg[3]) else null,
            },
            .text = guest.text,
            .font_size = guest.font_size,
            .text_color = if (guest.text) |_| blk: {
                break :blk if (guest.text_color) |tc| Color.rgba(tc[0], tc[1], tc[2], tc[3]) else Color.rgb(255, 255, 255);
            } else null,
        };

        for (guest.child_indices) |child_guest_idx| {
            if (queue_tail < MAX_NODES) {
                bfs_queue[queue_tail] = child_guest_idx;
                queue_tail += 1;
            }
        }
    }

    // Pass 2: wire up children slices (bounds-checked).
    for (vm.guest_nodes.items, 0..) |*guest, gi| {
        if (guest.child_indices.len > 0 and gi < MAX_NODES) {
            const parent_pool = guest_to_pool[gi];
            if (parent_pool == INVALID_POOL) continue;

            const first_child_pool = guest_to_pool[guest.child_indices[0]];
            if (first_child_pool == INVALID_POOL) continue;

            // Verify all children were allocated (contiguous in BFS)
            const end = first_child_pool + guest.child_indices.len;
            if (end > node_count) continue;

            node_pool[parent_pool].children = node_pool[first_child_pool..end];
        }
    }

    if (node_count == 0) return null;
    return &node_pool[0];
}

// ── Simple SDL2 painter ──────────────────────────────────────────────

fn paintNode(renderer: *c.SDL_Renderer, te: *TextEngine, node: *Node) void {
    if (node.style.display == .none) return;
    const r = node.computed;
    if (r.w <= 0 or r.h <= 0) return;

    // Background
    if (node.style.background_color) |bg| {
        if (bg.a > 0) {
            _ = c.SDL_SetRenderDrawColor(renderer, bg.r, bg.g, bg.b, bg.a);
            var rect = c.SDL_Rect{
                .x = @intFromFloat(r.x),
                .y = @intFromFloat(r.y),
                .w = @intFromFloat(r.w),
                .h = @intFromFloat(r.h),
            };
            _ = c.SDL_RenderFillRect(renderer, &rect);
        }
    }

    // Text
    if (node.text) |txt| {
        if (txt.len > 0) {
            const tc = node.text_color orelse Color.rgb(255, 255, 255);
            const pad_l = node.style.padLeft();
            const pad_t = node.style.padTop();
            const pad_r = node.style.padRight();
            const max_w = @max(1.0, r.w - pad_l - pad_r);
            te.drawTextWrapped(txt, r.x + pad_l, r.y + pad_t, node.font_size, max_w, tc);
        }
    }

    // Children
    for (node.children) |*child| {
        paintNode(renderer, te, child);
    }
}

// ── Hit testing ──────────────────────────────────────────────────────
// Walk the guest tree (which has correct parent-child relationships)
// and use the layout node pool for computed bounds.

// Mapping: guest_idx → pool_idx (built during convertNode)
var guest_to_pool: [MAX_NODES]usize = undefined;

fn hitTestPress(vm: *qjs.VM, mx: f32, my: f32) ?u32 {
    if (vm.guest_nodes.items.len == 0 or node_count == 0) return null;
    return hitTestGuest(vm, 0, mx, my);
}

fn hitTestGuest(vm: *qjs.VM, guest_idx: u32, mx: f32, my: f32) ?u32 {
    if (guest_idx >= vm.guest_nodes.items.len) return null;
    const guest = &vm.guest_nodes.items[guest_idx];
    const pool_idx = guest_to_pool[guest_idx];
    if (pool_idx >= node_count) return null;

    // Walk children back-to-front
    if (guest.child_indices.len > 0) {
        var i = guest.child_indices.len;
        while (i > 0) {
            i -= 1;
            if (hitTestGuest(vm, guest.child_indices[i], mx, my)) |id| return id;
        }
    }

    // Check bounds
    const r = node_pool[pool_idx].computed;
    if (r.w > 0 and r.h > 0 and mx >= r.x and mx < r.x + r.w and my >= r.y and my < r.y + r.h) {
        if (guest.on_press_id) |id| return id;
    }
    return null;
}

// ── Main ─────────────────────────────────────────────────────────────

pub fn main() !void {
    var gpa = std.heap.GeneralPurposeAllocator(.{}){};
    defer _ = gpa.deinit();
    const alloc = gpa.allocator();

    const args = try std.process.argsAlloc(alloc);
    defer std.process.argsFree(alloc, args);
    const cart_path = if (args.len > 1) args[1] else "carts/hello/app.js";

    const js_source = std.fs.cwd().readFileAlloc(alloc, cart_path, 1024 * 1024) catch |err| {
        std.log.err("Failed to read: {s} ({any})", .{ cart_path, err });
        return err;
    };
    defer alloc.free(js_source);

    if (c.SDL_Init(c.SDL_INIT_VIDEO) != 0) return error.SDLInitFailed;
    defer c.SDL_Quit();

    const window = c.SDL_CreateWindow(
        "ZigOS Shell",
        c.SDL_WINDOWPOS_CENTERED, c.SDL_WINDOWPOS_CENTERED,
        1024, 768,
        c.SDL_WINDOW_SHOWN | c.SDL_WINDOW_RESIZABLE,
    ) orelse return error.WindowCreateFailed;
    defer c.SDL_DestroyWindow(window);

    const renderer = c.SDL_CreateRenderer(window, -1, c.SDL_RENDERER_ACCELERATED | c.SDL_RENDERER_PRESENTVSYNC) orelse return error.RendererFailed;
    defer c.SDL_DestroyRenderer(renderer);
    _ = c.SDL_SetRenderDrawBlendMode(renderer, c.SDL_BLENDMODE_BLEND);

    var text_engine = TextEngine.init(renderer, "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf") catch
        TextEngine.init(renderer, "/System/Library/Fonts/Supplemental/Arial.ttf") catch
        return error.FontNotFound;
    defer text_engine.deinit();

    g_text_engine = &text_engine;
    layout.setMeasureFn(measureCallback);
    layout.setMeasureImageFn(measureImageCallback);

    // Init QuickJS
    var vm = try qjs.VM.init(alloc);
    defer vm.deinit();
    // bind() sets the opaque pointer AFTER vm is at its final stack address
    vm.bind();

    std.log.info("Loading: {s}", .{cart_path});
    vm.eval(js_source, cart_path) catch {
        std.log.err("Cartridge failed to load", .{});
        return error.CartridgeLoadFailed;
    };
    std.log.info("After eval: {d} guest nodes", .{vm.guest_nodes.items.len});

    var win_w: f32 = 1024;
    var win_h: f32 = 768;
    var running = true;
    var frame: u32 = 0;

    // Telemetry
    var fps_frames: u32 = 0;
    var fps_last_tick: u32 = c.SDL_GetTicks();
    var fps_display: u32 = 0;
    var tick_us: u64 = 0;
    var layout_us: u64 = 0;
    var tree_us: u64 = 0;
    var paint_us: u64 = 0;
    var guest_node_count: usize = 0;
    var layout_node_count: usize = 0;
    var title_buf: [256]u8 = undefined;

    while (running) {
        const frame_start = std.time.microTimestamp();
        _ = frame_start;

        var event: c.SDL_Event = undefined;
        while (c.SDL_PollEvent(&event) != 0) {
            switch (event.type) {
                c.SDL_QUIT => running = false,
                c.SDL_WINDOWEVENT => {
                    if (event.window.event == c.SDL_WINDOWEVENT_SIZE_CHANGED) {
                        win_w = @floatFromInt(event.window.data1);
                        win_h = @floatFromInt(event.window.data2);
                    }
                },
                c.SDL_KEYDOWN => {
                    if (event.key.keysym.sym == c.SDLK_ESCAPE) running = false;
                },
                c.SDL_MOUSEBUTTONDOWN => {
                    if (event.button.button == c.SDL_BUTTON_LEFT) {
                        const mx: f32 = @floatFromInt(event.button.x);
                        const my: f32 = @floatFromInt(event.button.y);
                        if (hitTestPress(&vm, mx, my)) |press_id| {
                            vm.dispatchPress(press_id);
                        }
                    }
                },
                else => {},
            }
        }

        // Tick QuickJS
        const t0 = std.time.microTimestamp();
        vm.tick();
        const t1 = std.time.microTimestamp();
        tick_us = @intCast(@max(0, t1 - t0));

        _ = c.SDL_SetRenderDrawColor(renderer, 18, 18, 28, 255);
        _ = c.SDL_RenderClear(renderer);

        // Build guest tree
        const t2 = std.time.microTimestamp();
        const maybe_root = buildGuestTree(&vm);
        const t3 = std.time.microTimestamp();
        tree_us = @intCast(@max(0, t3 - t2));

        if (maybe_root) |guest_root| {
            guest_node_count = vm.guest_nodes.items.len;
            layout_node_count = node_count;

            // Layout
            const t4 = std.time.microTimestamp();
            layout.layout(guest_root, 0, 0, win_w, win_h);
            const t5 = std.time.microTimestamp();
            layout_us = @intCast(@max(0, t5 - t4));

            // Paint
            const t6 = std.time.microTimestamp();
            paintNode(renderer, &text_engine, guest_root);
            const t7 = std.time.microTimestamp();
            paint_us = @intCast(@max(0, t7 - t6));
        }

        // Telemetry overlay (bottom bar)
        {
            const bar_h: f32 = 24;
            const bar_y = win_h - bar_h;
            _ = c.SDL_SetRenderDrawColor(renderer, 0, 0, 0, 200);
            var bar_rect = c.SDL_Rect{ .x = 0, .y = @intFromFloat(bar_y), .w = @intFromFloat(win_w), .h = @intFromFloat(bar_h) };
            _ = c.SDL_RenderFillRect(renderer, &bar_rect);

            // Read RSS from /proc/self/statm
            const rss_kb = readRssKb();

            var telem_buf: [512]u8 = undefined;
            const telem_str = std.fmt.bufPrint(&telem_buf, "FPS: {d}  |  tick: {d}us  tree: {d}us  layout: {d}us  paint: {d}us  |  nodes: {d}/{d}  |  RSS: {d}KB", .{
                fps_display, tick_us, tree_us, layout_us, paint_us,
                guest_node_count, layout_node_count, rss_kb,
            }) catch "???";
            text_engine.drawText(telem_str, 8, bar_y + 4, 13, Color.rgb(180, 220, 180));
        }

        c.SDL_RenderPresent(renderer);

        // FPS counter
        fps_frames += 1;
        const now_tick = c.SDL_GetTicks();
        if (now_tick - fps_last_tick >= 1000) {
            fps_display = fps_frames;
            fps_frames = 0;
            fps_last_tick = now_tick;

            // Update window title
            const title = std.fmt.bufPrint(&title_buf, "ZigOS Shell — {d} FPS  {d} nodes  {d}KB RSS\x00", .{
                fps_display, layout_node_count, readRssKb(),
            }) catch "ZigOS Shell\x00";
            c.SDL_SetWindowTitle(window, title.ptr);
        }

        frame +%= 1;
    }
}

fn readRssKb() u64 {
    var buf: [128]u8 = undefined;
    const f = std.fs.openFileAbsolute("/proc/self/statm", .{}) catch return 0;
    defer f.close();
    const n = f.readAll(&buf) catch return 0;
    var iter = std.mem.splitScalar(u8, buf[0..n], ' ');
    _ = iter.next(); // skip size
    const resident_str = iter.next() orelse return 0;
    const pages = std.fmt.parseInt(u64, resident_str, 10) catch return 0;
    return pages * 4;
}

