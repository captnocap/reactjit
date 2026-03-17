//! ZigOS Shell — Slots Architecture (TSZ UI + JS Logic)
//!
//! UI defined in Zig (rebuilt each frame from slots). JS only pokes state.
//! No JSON serialization. Arena-allocated node tree rebuilt per frame.

const std = @import("std");
const c = @import("framework/c.zig").imports;
const layout = @import("framework/layout.zig");
const text_mod = @import("framework/text.zig");
const qjs = @import("src/qjs.zig");
const slots_mod = @import("src/slots.zig");

const Node = layout.Node;
const Style = layout.Style;
const Color = layout.Color;
const TextEngine = text_mod.TextEngine;
const Slots = slots_mod.Slots;

var g_text_engine: ?*TextEngine = null;

fn measureCallback(t: []const u8, font_size: u16, max_width: f32, letter_spacing: f32, line_height: f32, max_lines: u16, no_wrap: bool) layout.TextMetrics {
    if (g_text_engine) |te| return te.measureTextWrappedEx(t, font_size, max_width, letter_spacing, line_height, max_lines, no_wrap);
    return .{};
}
fn measureImageCallback(_: []const u8) layout.ImageDims { return .{}; }

// ── Arena-based UI builder ───────────────────────────────────────

var frame_arena: std.heap.ArenaAllocator = undefined;
var text_bufs: [256][128]u8 = undefined;
var text_buf_count: usize = 0;
var total_nodes: usize = 0;

fn textBuf(comptime fmt: []const u8, args: anytype) []const u8 {
    if (text_buf_count >= 256) return "...";
    const idx = text_buf_count;
    text_buf_count += 1;
    return std.fmt.bufPrint(&text_bufs[idx], fmt, args) catch "???";
}

fn makeChildren(items: []const Node) []Node {
    const alloc = frame_arena.allocator();
    const children = alloc.alloc(Node, items.len) catch return &.{};
    @memcpy(children, items);
    total_nodes += items.len;
    return children;
}

fn textNode(txt: []const u8, size: u16, color: Color) Node {
    total_nodes += 1;
    return Node{ .text = txt, .font_size = size, .text_color = color };
}

fn boxNode(style: Style, children: []Node) Node {
    total_nodes += 1;
    return Node{ .style = style, .children = children };
}

fn toggleBtn(slots: *Slots, bool_slot: usize, label_slot: usize) Node {
    const active = slots.getBool(bool_slot);
    return boxNode(
        .{ .padding = 8, .background_color = if (active) Color.rgb(233, 69, 96) else Color.rgb(42, 48, 80), .border_radius = 6 },
        makeChildren(&.{textNode(slots.getString(label_slot), 12, if (active) Color.rgb(255, 255, 255) else Color.rgb(136, 153, 170))}),
    );
}

fn simpleBtn(label: []const u8) Node {
    return boxNode(
        .{ .padding = 8, .background_color = Color.rgb(42, 48, 80), .border_radius = 6 },
        makeChildren(&.{textNode(label, 12, Color.rgb(136, 153, 170))}),
    );
}

fn nestedBox(depth: usize, max_depth: usize) Node {
    if (depth >= max_depth) {
        return textNode(textBuf("Leaf {d}", .{depth}), 11, Color.rgb(136, 170, 204));
    }
    const r: u8 = @intCast(@min(255, 20 + depth * 8));
    const g: u8 = @intCast(@min(255, 20 + depth * 5));
    const b: u8 = @intCast(@min(255, 40 + depth * 10));

    return boxNode(.{
        .padding = 4, .background_color = Color.rgb(r, g, b), .border_radius = 4,
        .flex_direction = .column, .gap = 2,
    }, makeChildren(&.{
        textNode(textBuf("Depth {d}", .{depth}), 10, Color.rgb(102, 119, 136)),
        nestedBox(depth + 1, max_depth),
        nestedBox(depth + 1, max_depth),
    }));
}

fn buildUI(slots: *Slots) Node {
    text_buf_count = 0;
    total_nodes = 0;

    const js_time = slots.getInt(7);
    const compute_color = if (js_time > 8) Color.rgb(233, 69, 96) else Color.rgb(78, 201, 176);

    // Collect root children in a fixed buffer, then copy to arena
    var root_buf: [16]Node = undefined;
    var root_len: usize = 0;

    // Title
    root_buf[root_len] = textNode("ZigOS Stress Test (Slots)", 24, Color.rgb(233, 69, 96));
    root_len += 1;

    // Telemetry row
    root_buf[root_len] = boxNode(.{
        .flex_direction = .row, .gap = 16, .padding = 8,
        .background_color = Color.rgb(26, 26, 46), .border_radius = 4,
    }, makeChildren(&.{
        textNode(slots.getString(14), 14, Color.rgb(255, 255, 255)),
        textNode(slots.getString(15), 14, Color.rgb(102, 119, 136)),
        textNode(slots.getString(16), 14, compute_color),
        textNode(slots.getString(17), 14, Color.rgb(170, 187, 204)),
    }));
    root_len += 1;

    // Toggle buttons
    root_buf[root_len] = boxNode(.{ .flex_direction = .row, .gap = 8 }, makeChildren(&.{
        toggleBtn(slots, 2, 9),
        toggleBtn(slots, 3, 10),
        toggleBtn(slots, 4, 11),
        toggleBtn(slots, 5, 12),
        toggleBtn(slots, 6, 13),
    }));
    root_len += 1;

    // Action buttons
    root_buf[root_len] = boxNode(.{ .flex_direction = .row, .gap = 8 }, makeChildren(&.{
        simpleBtn("+ Count"),
        simpleBtn("Reset All"),
    }));
    root_len += 1;

    // Dynamic list
    if (slots.getBool(4)) {
        const counter_val = slots.getInt(0);
        var list_buf: [200]Node = undefined;
        var li: usize = 0;
        while (li < 200) : (li += 1) {
            list_buf[li] = boxNode(.{
                .flex_direction = .row, .gap = 8, .padding = 4,
                .background_color = if (li % 2 == 0) Color.rgb(26, 32, 48) else Color.rgb(30, 36, 56),
            }, makeChildren(&.{
                textNode(textBuf("#{d}", .{li}), 11, Color.rgb(68, 85, 102)),
                textNode(textBuf("Item {d} - value: {d}", .{ li, @mod(@as(i64, @intCast(li)) * 17 + counter_val, 1000) }), 12, Color.rgb(170, 187, 204)),
            }));
        }
        // Copy list to arena
        const list_items = makeChildren(&list_buf);

        root_buf[root_len] = boxNode(.{
            .flex_direction = .column, .gap = 1, .padding = 4,
            .background_color = Color.rgb(15, 21, 32), .border_radius = 4,
        }, list_items);
        root_len += 1;
    }

    // Nested tree
    if (slots.getBool(5)) {
        root_buf[root_len] = nestedBox(0, 8);
        root_len += 1;
    }

    total_nodes += 1;
    return Node{
        .style = .{
            .width = 1024, .flex_direction = .column, .gap = 8, .padding = 16,
            .background_color = Color.rgb(18, 18, 32),
        },
        .children = makeChildren(root_buf[0..root_len]),
    };
}

// ── Painter ──────────────────────────────────────────────────────

fn paintNode(renderer: *c.SDL_Renderer, te: *TextEngine, node: *Node) void {
    if (node.style.display == .none) return;
    const r = node.computed;
    if (r.w <= 0 or r.h <= 0) return;

    if (node.style.background_color) |bg| {
        if (bg.a > 0) {
            _ = c.SDL_SetRenderDrawColor(renderer, bg.r, bg.g, bg.b, bg.a);
            var rect = c.SDL_Rect{ .x = @intFromFloat(r.x), .y = @intFromFloat(r.y), .w = @intFromFloat(r.w), .h = @intFromFloat(r.h) };
            _ = c.SDL_RenderFillRect(renderer, &rect);
        }
    }

    if (node.text) |txt| {
        if (txt.len > 0) {
            const tc = node.text_color orelse Color.rgb(255, 255, 255);
            const pad_l = node.style.padLeft();
            const pad_t = node.style.padTop();
            const pad_r = node.style.padRight();
            te.drawTextWrapped(txt, r.x + pad_l, r.y + pad_t, node.font_size, @max(1.0, r.w - pad_l - pad_r), tc);
        }
    }

    for (node.children) |*child| paintNode(renderer, te, child);
}

// ── Hit testing ──────────────────────────────────────────────────

fn hitTestButtons(node: *Node, mx: f32, my: f32) ?u32 {
    // Walk children back-to-front
    if (node.children.len > 0) {
        var i = node.children.len;
        while (i > 0) {
            i -= 1;
            if (hitTestButtons(&node.children[i], mx, my)) |id| return id;
        }
    }

    // A button: has border_radius, background, single text child
    const r = node.computed;
    if (r.w <= 0 or r.h <= 0) return null;
    if (!(mx >= r.x and mx < r.x + r.w and my >= r.y and my < r.y + r.h)) return null;

    if (node.style.border_radius > 0 and node.children.len == 1 and node.children[0].text != null) {
        const txt = node.children[0].text orelse return null;
        if (std.mem.startsWith(u8, txt, "Effect")) return 1;
        if (std.mem.startsWith(u8, txt, "Memo")) return 2;
        if (std.mem.startsWith(u8, txt, "200")) return 3;
        if (std.mem.startsWith(u8, txt, "Nested")) return 4;
        if (std.mem.startsWith(u8, txt, "Rapid")) return 5;
        if (std.mem.startsWith(u8, txt, "+ Count")) return 10;
        if (std.mem.startsWith(u8, txt, "Reset")) return 11;
    }
    return null;
}

// ── Main ─────────────────────────────────────────────────────────

pub fn main() !void {
    var gpa = std.heap.GeneralPurposeAllocator(.{}){};
    defer _ = gpa.deinit();
    const alloc = gpa.allocator();

    frame_arena = std.heap.ArenaAllocator.init(alloc);
    defer frame_arena.deinit();

    const args = try std.process.argsAlloc(alloc);
    defer std.process.argsFree(alloc, args);
    const cart_path = if (args.len > 1) args[1] else "carts/stress-slots/logic.js";

    const js_source = std.fs.cwd().readFileAlloc(alloc, cart_path, 1024 * 1024) catch |err| {
        std.log.err("Failed to read: {s} ({any})", .{ cart_path, err });
        return err;
    };
    defer alloc.free(js_source);

    if (c.SDL_Init(c.SDL_INIT_VIDEO) != 0) return error.SDLInitFailed;
    defer c.SDL_Quit();

    const window = c.SDL_CreateWindow("ZigOS Slots", c.SDL_WINDOWPOS_CENTERED, c.SDL_WINDOWPOS_CENTERED, 1024, 768, c.SDL_WINDOW_SHOWN | c.SDL_WINDOW_RESIZABLE) orelse return error.WindowCreateFailed;
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

    var slots = Slots.init(alloc);
    defer slots.deinit();
    slots_mod.bindSlots(&slots);

    var vm = try qjs.VM.init(alloc);
    defer vm.deinit();
    vm.bind();
    slots.registerHostFunctions(vm.ctx);

    std.log.info("Loading: {s}", .{cart_path});
    vm.eval(js_source, cart_path) catch {
        std.log.err("Cartridge failed to load", .{});
        return error.CartridgeLoadFailed;
    };

    var win_w: f32 = 1024;
    var win_h: f32 = 768;
    var running = true;
    var fps_frames: u32 = 0;
    var fps_last_tick: u32 = c.SDL_GetTicks();
    var fps_display: u32 = 0;
    var tick_us: u64 = 0;
    var build_us: u64 = 0;
    var layout_us: u64 = 0;
    var paint_us: u64 = 0;
    var title_buf: [256]u8 = undefined;

    // Mutable root for hit testing after layout
    var ui_root: Node = .{};

    // Telemetry CSV log
    const log_file = std.fs.cwd().createFile("telemetry.csv", .{}) catch null;
    defer if (log_file) |f| f.close();
    if (log_file) |f| {
        f.writeAll("time_s,fps,tick_us,build_us,layout_us,paint_us,nodes,rss_kb,effect,memo,list,tree,rapid\n") catch {};
    }
    var log_time: u32 = 0;

    while (running) {
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
                        if (hitTestButtons(&ui_root, mx, my)) |press_id| {
                            vm.dispatchPress(press_id);
                        }
                    }
                },
                else => {},
            }
        }

        const t0 = std.time.microTimestamp();
        vm.tick();
        const t1 = std.time.microTimestamp();
        tick_us = @intCast(@max(0, t1 - t0));

        _ = c.SDL_SetRenderDrawColor(renderer, 18, 18, 28, 255);
        _ = c.SDL_RenderClear(renderer);

        // Reset frame arena and rebuild tree
        _ = frame_arena.reset(.retain_capacity);

        const t2 = std.time.microTimestamp();
        ui_root = buildUI(&slots);
        const t3 = std.time.microTimestamp();
        build_us = @intCast(@max(0, t3 - t2));

        const t4 = std.time.microTimestamp();
        layout.layout(&ui_root, 0, 0, win_w, win_h);
        const t5 = std.time.microTimestamp();
        layout_us = @intCast(@max(0, t5 - t4));

        const t6 = std.time.microTimestamp();
        paintNode(renderer, &text_engine, &ui_root);
        const t7 = std.time.microTimestamp();
        paint_us = @intCast(@max(0, t7 - t6));

        // Telemetry overlay
        {
            const bar_y = win_h - 24;
            _ = c.SDL_SetRenderDrawColor(renderer, 0, 0, 0, 200);
            var bar_rect = c.SDL_Rect{ .x = 0, .y = @intFromFloat(bar_y), .w = @intFromFloat(win_w), .h = 24 };
            _ = c.SDL_RenderFillRect(renderer, &bar_rect);

            const rss = readRssKb();
            var buf: [512]u8 = undefined;
            const str = std.fmt.bufPrint(&buf, "FPS: {d}  |  tick: {d}us  build: {d}us  layout: {d}us  paint: {d}us  |  nodes: {d}  |  RSS: {d}KB", .{
                fps_display, tick_us, build_us, layout_us, paint_us, total_nodes, rss,
            }) catch "???";
            text_engine.drawText(str, 8, bar_y + 4, 13, Color.rgb(180, 220, 180));
        }

        c.SDL_RenderPresent(renderer);

        fps_frames += 1;
        const now = c.SDL_GetTicks();
        if (now - fps_last_tick >= 1000) {
            fps_display = fps_frames;
            fps_frames = 0;
            fps_last_tick = now;
            const rss_now = readRssKb();
            const t = std.fmt.bufPrint(&title_buf, "ZigOS Slots - {d} FPS  {d} nodes  {d}KB\x00", .{
                fps_display, total_nodes, rss_now,
            }) catch "ZigOS\x00";
            c.SDL_SetWindowTitle(window, t.ptr);

            // CSV snapshot (1 per second, monotonic)
            if (log_file) |f| {
                var csv_buf: [256]u8 = undefined;
                const csv = std.fmt.bufPrint(&csv_buf, "{d},{d},{d},{d},{d},{d},{d},{d},{d},{d},{d},{d},{d}\n", .{
                    log_time,
                    fps_display,
                    tick_us,
                    build_us,
                    layout_us,
                    paint_us,
                    total_nodes,
                    rss_now,
                    @as(u8, if (slots.getBool(2)) 1 else 0),
                    @as(u8, if (slots.getBool(3)) 1 else 0),
                    @as(u8, if (slots.getBool(4)) 1 else 0),
                    @as(u8, if (slots.getBool(5)) 1 else 0),
                    @as(u8, if (slots.getBool(6)) 1 else 0),
                }) catch "";
                f.writeAll(csv) catch {};
                log_time += 1;
            }
        }
    }
}

fn readRssKb() u64 {
    var buf: [128]u8 = undefined;
    const f = std.fs.openFileAbsolute("/proc/self/statm", .{}) catch return 0;
    defer f.close();
    const n = f.readAll(&buf) catch return 0;
    var iter = std.mem.splitScalar(u8, buf[0..n], ' ');
    _ = iter.next();
    const r = iter.next() orelse return 0;
    return (std.fmt.parseInt(u64, r, 10) catch 0) * 4;
}
