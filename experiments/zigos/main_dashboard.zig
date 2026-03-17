//! ZigOS Dashboard — Real-world monitoring UI
//!
//! TSZ layout + SDL2 paint. JS pushes metrics via slots every 1s.
//! Tests: many text nodes, computed strings, multi-panel layout,
//! tables, sparkline bars — the kind of UI a real app would have.

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
var frame_arena: std.heap.ArenaAllocator = undefined;
var text_bufs: [512][128]u8 = undefined;
var text_buf_count: usize = 0;
var total_nodes: usize = 0;

fn measureCallback(t: []const u8, fs: u16, mw: f32, ls: f32, lh: f32, ml: u16, nw: bool) layout.TextMetrics {
    if (g_text_engine) |te| return te.measureTextWrappedEx(t, fs, mw, ls, lh, ml, nw);
    return .{};
}
fn measureImageCallback(_: []const u8) layout.ImageDims { return .{}; }

fn tb(comptime fmt: []const u8, args: anytype) []const u8 {
    if (text_buf_count >= 512) return "...";
    const idx = text_buf_count;
    text_buf_count += 1;
    return std.fmt.bufPrint(&text_bufs[idx], fmt, args) catch "???";
}

fn mc(items: []const Node) []Node {
    const a = frame_arena.allocator();
    const children = a.alloc(Node, items.len) catch return &.{};
    @memcpy(children, items);
    total_nodes += items.len;
    return children;
}

fn txt(t: []const u8, size: u16, color: Color) Node {
    total_nodes += 1;
    return .{ .text = t, .font_size = size, .text_color = color };
}

fn box(style: Style, children: []Node) Node {
    total_nodes += 1;
    return .{ .style = style, .children = children };
}

// Colors
const BG_DARK = Color.rgb(13, 17, 23);
const BG_CARD = Color.rgb(22, 27, 34);
const BG_CARD_ALT = Color.rgb(27, 32, 40);
const BG_BAR = Color.rgb(33, 38, 48);
const GREEN = Color.rgb(63, 185, 80);
const YELLOW = Color.rgb(210, 153, 34);
const RED = Color.rgb(248, 81, 73);
const BLUE = Color.rgb(88, 166, 255);
const CYAN = Color.rgb(121, 192, 255);
const GREY = Color.rgb(139, 148, 158);
const WHITE = Color.rgb(230, 237, 243);
const DIM = Color.rgb(110, 118, 129);

fn statusColor(s: *Slots) Color {
    const status = s.getString(42);
    if (std.mem.indexOf(u8, status, "CRITICAL") != null) return RED;
    if (std.mem.indexOf(u8, status, "DEGRADED") != null) return RED;
    if (std.mem.indexOf(u8, status, "WARNING") != null) return YELLOW;
    return GREEN;
}

fn statCard(label: []const u8, value: []const u8, color: Color) Node {
    return box(.{
        .flex_direction = .column, .padding = 12, .gap = 4,
        .background_color = BG_CARD, .border_radius = 6,
        .flex_grow = 1,
    }, mc(&.{
        txt(label, 11, DIM),
        txt(value, 22, color),
    }));
}

fn sparkBar(value: i64, max_val: i64, color: Color) Node {
    const pct: f32 = if (max_val > 0) @as(f32, @floatFromInt(@min(value, max_val))) / @as(f32, @floatFromInt(max_val)) else 0;
    const bar_w: f32 = @max(2, pct * 120);
    return box(.{ .flex_direction = .row, .gap = 4, .align_items = .center }, mc(&.{
        box(.{
            .width = bar_w, .height = 8, .border_radius = 4,
            .background_color = color,
        }, &.{}),
        txt(tb("{d}%", .{@as(i64, @intFromFloat(pct * 100))}), 10, DIM),
    }));
}

fn historyRow(label: []const u8, s: *Slots, base_slot: usize, max_val: i64, color: Color) Node {
    var bars: [10]Node = undefined;
    for (0..10) |i| {
        const v = s.getInt(base_slot + i);
        const pct: f32 = if (max_val > 0) @as(f32, @floatFromInt(@min(v, max_val))) / @as(f32, @floatFromInt(max_val)) else 0;
        const h: f32 = @max(2, pct * 32);
        bars[i] = box(.{
            .width = 10, .height = h, .background_color = color,
            .border_radius = 2, .align_self = .end,
        }, &.{});
    }
    return box(.{ .flex_direction = .column, .gap = 4 }, mc(&.{
        txt(label, 10, DIM),
        box(.{ .flex_direction = .row, .gap = 2, .height = 36, .align_items = .end }, mc(&bars)),
    }));
}

fn endpointRow(s: *Slots, i: usize) Node {
    const name = s.getString(51 + i);
    const rps = s.getInt(61 + i);
    const p50 = s.getInt(71 + i);
    const err_rate = s.getInt(81 + i);
    const err_color: Color = if (err_rate > 10) RED else if (err_rate > 5) YELLOW else GREEN;

    return box(.{
        .flex_direction = .row, .gap = 8, .padding = 6,
        .background_color = if (i % 2 == 0) BG_CARD else BG_CARD_ALT,
    }, mc(&.{
        box(.{ .width = 180 }, mc(&.{txt(name, 12, WHITE)})),
        box(.{ .width = 70 }, mc(&.{txt(tb("{d} rps", .{rps}), 12, CYAN)})),
        box(.{ .width = 70 }, mc(&.{txt(tb("{d}ms", .{p50}), 12, BLUE)})),
        box(.{ .width = 70 }, mc(&.{txt(tb("{d}/1k", .{err_rate}), 12, err_color)})),
    }));
}

fn buildDashboard(s: *Slots) Node {
    text_buf_count = 0;
    total_nodes = 0;

    const sc = statusColor(s);

    // Header
    const header = box(.{
        .flex_direction = .row, .padding = 12, .gap = 16,
        .background_color = BG_CARD, .align_items = .center,
    }, mc(&.{
        txt("ZigOS Dashboard", 20, WHITE),
        txt(s.getString(42), 14, sc),
        box(.{ .flex_grow = 1 }, &.{}),
        txt(s.getString(43), 12, if (sc.r > 200) sc else DIM),
        txt(tb("Uptime: {d}s", .{s.getInt(0)}), 12, DIM),
    }));

    // Top stats row
    const stats_row = box(.{ .flex_direction = .row, .gap = 8 }, mc(&.{
        statCard("CPU", tb("{d}%", .{s.getInt(1)}), if (s.getInt(1) > 80) RED else if (s.getInt(1) > 60) YELLOW else GREEN),
        statCard("Memory", tb("{d}/{d} MB", .{ s.getInt(2), s.getInt(3) }), BLUE),
        statCard("Requests", tb("{d}", .{s.getInt(6)}), WHITE),
        statCard("Errors", tb("{d}", .{s.getInt(7)}), if (s.getInt(7) > 100) RED else YELLOW),
        statCard("Avg Latency", tb("{d}ms", .{s.getInt(8)}), CYAN),
        statCard("P99", tb("{d}ms", .{s.getInt(9)}), if (s.getInt(9) > 200) RED else BLUE),
    }));

    // Second stats row
    const stats_row2 = box(.{ .flex_direction = .row, .gap = 8 }, mc(&.{
        statCard("Connections", tb("{d}", .{s.getInt(10)}), WHITE),
        statCard("Queue", tb("{d}", .{s.getInt(11)}), if (s.getInt(11) > 20) YELLOW else GREEN),
        statCard("Net In", tb("{d} KB/s", .{s.getInt(4)}), CYAN),
        statCard("Net Out", tb("{d} KB/s", .{s.getInt(5)}), BLUE),
        statCard("DB Queries", tb("{d}/s", .{s.getInt(45)}), WHITE),
        statCard("DB Avg", tb("{d}ms", .{s.getInt(46)}), CYAN),
    }));

    // Third stats row
    const stats_row3 = box(.{ .flex_direction = .row, .gap = 8 }, mc(&.{
        statCard("Cache Hit", tb("{d}%", .{s.getInt(47)}), GREEN),
        statCard("Cache Size", tb("{d}", .{s.getInt(48)}), DIM),
        statCard("Disk", tb("{d}%", .{s.getInt(49)}), if (s.getInt(49) > 85) RED else GREEN),
        statCard("GC Pause", tb("{d}ms", .{s.getInt(50)}), if (s.getInt(50) > 10) YELLOW else GREEN),
    }));

    // Sparkline history panel
    const history_panel = box(.{
        .flex_direction = .row, .gap = 16, .padding = 12,
        .background_color = BG_CARD, .border_radius = 6,
    }, mc(&.{
        historyRow("CPU %", s, 12, 100, GREEN),
        historyRow("Latency ms", s, 22, 100, CYAN),
        historyRow("RPS", s, 32, 1500, BLUE),
    }));

    // Endpoint table
    const table_header = box(.{
        .flex_direction = .row, .gap = 8, .padding = 6,
        .background_color = BG_BAR,
    }, mc(&.{
        box(.{ .width = 180 }, mc(&.{txt("Endpoint", 11, DIM)})),
        box(.{ .width = 70 }, mc(&.{txt("RPS", 11, DIM)})),
        box(.{ .width = 70 }, mc(&.{txt("P50", 11, DIM)})),
        box(.{ .width = 70 }, mc(&.{txt("Err Rate", 11, DIM)})),
    }));

    var table_rows: [11]Node = undefined;
    table_rows[0] = table_header;
    for (0..10) |i| {
        table_rows[1 + i] = endpointRow(s, i);
    }

    const endpoint_table = box(.{
        .flex_direction = .column, .border_radius = 6,
        .background_color = BG_CARD,
    }, mc(&table_rows));

    // Root
    total_nodes += 1;
    return Node{
        .style = .{
            .flex_direction = .column, .gap = 8, .padding = 12,
            .background_color = BG_DARK,
        },
        .children = mc(&.{ header, stats_row, stats_row2, stats_row3, history_panel, endpoint_table }),
    };
}

// ── Painter + hit test (same as slots main) ──────────────────────

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
    if (node.text) |t| {
        if (t.len > 0) {
            const tc = node.text_color orelse WHITE;
            const pl = node.style.padLeft();
            const pt = node.style.padTop();
            const pr = node.style.padRight();
            te.drawTextWrapped(t, r.x + pl, r.y + pt, node.font_size, @max(1.0, r.w - pl - pr), tc);
        }
    }
    for (node.children) |*child| paintNode(renderer, te, child);
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
    const cart_path = if (args.len > 1) args[1] else "carts/dashboard/logic.js";

    const js_source = std.fs.cwd().readFileAlloc(alloc, cart_path, 1024 * 1024) catch |err| {
        std.log.err("Failed to read: {s} ({any})", .{ cart_path, err });
        return err;
    };
    defer alloc.free(js_source);

    if (c.SDL_Init(c.SDL_INIT_VIDEO) != 0) return error.SDLInitFailed;
    defer c.SDL_Quit();

    const window = c.SDL_CreateWindow("ZigOS Dashboard", c.SDL_WINDOWPOS_CENTERED, c.SDL_WINDOWPOS_CENTERED, 1100, 800, c.SDL_WINDOW_SHOWN | c.SDL_WINDOW_RESIZABLE) orelse return error.WindowCreateFailed;
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

    var slots = slots_mod.Slots.init(alloc);
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

    var win_w: f32 = 1100;
    var win_h: f32 = 800;
    var running = true;
    var fps_frames: u32 = 0;
    var fps_last_tick: u32 = c.SDL_GetTicks();
    var fps_display: u32 = 0;
    var tick_us: u64 = 0;
    var build_us: u64 = 0;
    var layout_us: u64 = 0;
    var paint_us: u64 = 0;
    var title_buf: [256]u8 = undefined;
    var ui_root: Node = .{};

    const log_file = std.fs.cwd().createFile("telemetry.csv", .{}) catch null;
    defer if (log_file) |f| f.close();
    if (log_file) |f| f.writeAll("time_s,fps,tick_us,build_us,layout_us,paint_us,nodes,rss_kb\n") catch {};
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
                else => {},
            }
        }

        const t0 = std.time.microTimestamp();
        vm.tick();
        const t1 = std.time.microTimestamp();
        tick_us = @intCast(@max(0, t1 - t0));

        _ = c.SDL_SetRenderDrawColor(renderer, 13, 17, 23, 255);
        _ = c.SDL_RenderClear(renderer);

        _ = frame_arena.reset(.retain_capacity);

        const t2 = std.time.microTimestamp();
        ui_root = buildDashboard(&slots);
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

        // Telemetry bar
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
            const t = std.fmt.bufPrint(&title_buf, "ZigOS Dashboard - {d} FPS  {d} nodes  {d}KB\x00", .{
                fps_display, total_nodes, rss_now,
            }) catch "ZigOS\x00";
            c.SDL_SetWindowTitle(window, t.ptr);

            if (log_file) |f| {
                var csv_buf: [256]u8 = undefined;
                const csv = std.fmt.bufPrint(&csv_buf, "{d},{d},{d},{d},{d},{d},{d},{d}\n", .{
                    log_time, fps_display, tick_us, build_us, layout_us, paint_us, total_nodes, rss_now,
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
