//! tsz GUI dashboard — SDL2 window showing registered projects
//!
//! Direct SDL2 rendering (no flex layout engine — keeps it in-module).
//! Actions auto-populated from actions.zig — adding a CLI command surfaces here.
//! Pattern: same as bsod.zig — manual y-cursor painting with TextEngine.

const std = @import("std");
const engine = @import("engine.zig");
const c = engine.c;
const Color = engine.Color;
const TextEngine = engine.TextEngine;
const registry = @import("registry.zig");
const process = @import("process.zig");
const actions_mod = @import("actions.zig");

// ── Colors ──────────────────────────────────────────────────────────────

const bg = Color.rgb(22, 22, 30);
const surface = Color.rgb(30, 30, 42);
const text_color = Color.rgb(220, 220, 235);
const muted = Color.rgb(120, 120, 145);
const accent = Color.rgb(78, 201, 176);
const danger = Color.rgb(235, 87, 87);
const success = Color.rgb(76, 204, 102);
const warning = Color.rgb(247, 164, 29);

fn actionColor(name: []const u8) Color {
    if (std.mem.eql(u8, name, "build")) return Color.rgb(33, 120, 200);
    if (std.mem.eql(u8, name, "run")) return Color.rgb(60, 150, 70);
    if (std.mem.eql(u8, name, "dev")) return Color.rgb(130, 50, 160);
    if (std.mem.eql(u8, name, "test")) return Color.rgb(200, 130, 20);
    if (std.mem.eql(u8, name, "rm")) return Color.rgb(120, 50, 50);
    return Color.rgb(60, 60, 80);
}

// ── Button hit regions (computed during paint, checked on click) ─────────

const HitRegion = struct {
    x: f32,
    y: f32,
    w: f32,
    h: f32,
    project_idx: u16,
    action_idx: u8,
};

const MAX_HITS = 512;
var hit_regions: [MAX_HITS]HitRegion = undefined;
var hit_count: usize = 0;

fn addHit(x: f32, y: f32, w: f32, h: f32, project_idx: u16, action_idx: u8) void {
    if (hit_count >= MAX_HITS) return;
    hit_regions[hit_count] = .{ .x = x, .y = y, .w = w, .h = h, .project_idx = project_idx, .action_idx = action_idx };
    hit_count += 1;
}

fn findHit(mx: f32, my: f32) ?*const HitRegion {
    for (0..hit_count) |i| {
        const h = &hit_regions[i];
        if (mx >= h.x and mx < h.x + h.w and my >= h.y and my < h.y + h.h) return h;
    }
    return null;
}

// ── Main GUI ────────────────────────────────────────────────────────────

pub fn run(alloc: std.mem.Allocator) !void {
    if (c.SDL_Init(c.SDL_INIT_VIDEO) != 0) {
        std.debug.print("[tsz gui] SDL init failed\n", .{});
        return;
    }
    defer c.SDL_Quit();

    const window = c.SDL_CreateWindow(
        "tsz",
        c.SDL_WINDOWPOS_CENTERED,
        c.SDL_WINDOWPOS_CENTERED,
        900,
        500,
        c.SDL_WINDOW_SHOWN | c.SDL_WINDOW_RESIZABLE,
    ) orelse return;
    defer c.SDL_DestroyWindow(window);

    const renderer = c.SDL_CreateRenderer(window, -1, c.SDL_RENDERER_ACCELERATED | c.SDL_RENDERER_PRESENTVSYNC) orelse return;
    defer c.SDL_DestroyRenderer(renderer);
    _ = c.SDL_SetRenderDrawBlendMode(renderer, c.SDL_BLENDMODE_BLEND);

    var te = TextEngine.init(renderer, "fonts/base/DejaVuSans-Regular.ttf") catch
        TextEngine.init(renderer, "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf") catch return;
    defer te.deinit();

    var reg = registry.load(alloc);
    process.cleanStale(&reg);

    var win_w: f32 = 900;
    var win_h: f32 = 500;
    var scroll_y: f32 = 0;
    var running = true;
    var frame: u32 = 0;
    var hover_mx: f32 = 0;
    var hover_my: f32 = 0;

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
                    if (event.key.keysym.sym == c.SDLK_r) {
                        reg = registry.load(alloc);
                        process.cleanStale(&reg);
                    }
                },
                c.SDL_MOUSEMOTION => {
                    hover_mx = @floatFromInt(event.motion.x);
                    hover_my = @floatFromInt(event.motion.y);
                },
                c.SDL_MOUSEBUTTONDOWN => {
                    const mx: f32 = @floatFromInt(event.button.x);
                    const my: f32 = @floatFromInt(event.button.y);
                    if (findHit(mx, my)) |hit| {
                        // Find action name
                        var ai: u8 = 0;
                        for (actions_mod.ALL) |a| {
                            if (!a.show_in_gui) continue;
                            if (ai == hit.action_idx) {
                                const p = &reg.projects[hit.project_idx];
                                // Spawn the CLI action as a subprocess
                                if (std.mem.eql(u8, a.name, "rm")) {
                                    process.killProject(p.getName());
                                    _ = reg.remove(p.getName());
                                    registry.save(&reg);
                                } else {
                                    const argv = [_][]const u8{ "./zig-out/bin/tsz", a.name, p.getPath() };
                                    var child = std.process.Child.init(&argv, alloc);
                                    child.spawn() catch {};
                                }
                                // Refresh
                                std.Thread.sleep(200 * std.time.ns_per_ms);
                                reg = registry.load(alloc);
                                process.cleanStale(&reg);
                                break;
                            }
                            ai += 1;
                        }
                    }
                },
                c.SDL_MOUSEWHEEL => {
                    scroll_y -= @as(f32, @floatFromInt(event.wheel.y)) * 30.0;
                    // Clamp: header(50) + col_header(28) + rows(38 each) + footer(30)
                    const content_h: f32 = 50 + 28 + @as(f32, @floatFromInt(reg.count)) * 38 + 30;
                    const max_scroll = @max(0, content_h - win_h);
                    scroll_y = @max(0, @min(scroll_y, max_scroll));
                },
                else => {},
            }
        }

        // Periodic refresh
        frame += 1;
        if (frame % 120 == 0) {
            reg = registry.load(alloc);
            process.cleanStale(&reg);
        }

        // ── Paint ─────────────────────────────────────────────────
        hit_count = 0;
        _ = c.SDL_SetRenderDrawColor(renderer, bg.r, bg.g, bg.b, 255);
        _ = c.SDL_RenderClear(renderer);

        var y: f32 = -scroll_y;

        // Header bar
        fillRect(renderer, 0, y, win_w, 50, surface);
        te.drawText("tsz", 16, y + 12, 22, accent);
        te.drawText("dashboard", 60, y + 18, 13, muted);
        // Project count
        var count_buf: [32]u8 = undefined;
        const count_str = std.fmt.bufPrint(&count_buf, "{d} projects", .{reg.count}) catch "?";
        te.drawText(count_str, win_w - 120, y + 18, 12, muted);
        y += 50;

        // Column headers
        fillRect(renderer, 0, y, win_w, 28, Color.rgb(25, 25, 35));
        te.drawText("STATUS", 16, y + 7, 10, muted);
        te.drawText("NAME", 80, y + 7, 10, muted);
        te.drawText("BUILD", 220, y + 7, 10, muted);
        te.drawText("PATH", 280, y + 7, 10, muted);
        te.drawText("ACTIONS", win_w - 260, y + 7, 10, muted);
        y += 28;

        // Project rows
        for (0..reg.count) |i| {
            const p = &reg.projects[i];
            const name = p.getName();
            const status = process.getStatus(name);
            const row_h: f32 = 38;

            // Alternate row bg
            const row_bg = if (i % 2 == 0) Color.rgb(28, 28, 38) else bg;
            // Hover highlight
            const is_hovered = (hover_my >= y and hover_my < y + row_h and hover_my > 0);
            const final_bg = if (is_hovered) Color.rgb(35, 35, 50) else row_bg;
            fillRect(renderer, 0, y, win_w, row_h, final_bg);

            // Status dot
            const dot_color = switch (status) {
                .running => success,
                .stopped => muted,
                .stale => warning,
            };
            fillRect(renderer, 20, y + 14, 8, 8, dot_color);

            // Status text
            const status_str: []const u8 = switch (status) {
                .running => "running",
                .stopped => "stopped",
                .stale => "stale",
            };
            te.drawText(status_str, 34, y + 12, 10, dot_color);

            // Name
            te.drawText(name, 80, y + 10, 14, text_color);

            // Build badge
            const badge_str: []const u8 = switch (p.last_build) {
                .pass => "pass",
                .fail => "FAIL",
                .unknown => "-",
            };
            const badge_col = switch (p.last_build) {
                .pass => success,
                .fail => danger,
                .unknown => muted,
            };
            te.drawText(badge_str, 224, y + 12, 11, badge_col);

            // Path (truncated)
            const path = p.getPath();
            const path_display = if (path.len > 50) path[path.len - 50 ..] else path;
            te.drawText(path_display, 280, y + 14, 10, muted);

            // Action buttons (auto-generated from actions table)
            var btn_x: f32 = win_w - 260;
            var btn_idx: u8 = 0;
            for (actions_mod.ALL) |a| {
                if (!a.show_in_gui) continue;
                const btn_w = te.textWidth(a.label, 11) + 16;
                const btn_h: f32 = 22;
                const btn_y = y + 8;

                // Hover detection for button
                const btn_hovered = (hover_mx >= btn_x and hover_mx < btn_x + btn_w and hover_my >= btn_y and hover_my < btn_y + btn_h);
                const btn_color = actionColor(a.name);
                const final_btn = if (btn_hovered) Color.rgb(
                    @min(@as(u8, 255), @as(u8, @intCast(@as(u16, btn_color.r) + 30))),
                    @min(@as(u8, 255), @as(u8, @intCast(@as(u16, btn_color.g) + 30))),
                    @min(@as(u8, 255), @as(u8, @intCast(@as(u16, btn_color.b) + 30))),
                ) else btn_color;

                fillRect(renderer, btn_x, btn_y, btn_w, btn_h, final_btn);
                te.drawText(a.label, btn_x + 8, btn_y + 4, 11, Color.rgb(255, 255, 255));
                addHit(btn_x, btn_y, btn_w, btn_h, @intCast(i), btn_idx);

                btn_x += btn_w + 4;
                btn_idx += 1;
            }

            y += row_h;
        }

        // Empty state
        if (reg.count == 0) {
            te.drawText("No projects registered.", 16, y + 20, 14, muted);
            te.drawText("Run: tsz add <directory>", 16, y + 44, 12, muted);
        }

        // Footer
        y = @max(y, win_h - 30 + scroll_y);
        fillRect(renderer, 0, y, win_w, 30, Color.rgb(20, 20, 28));
        te.drawText("R = refresh  |  Esc = quit  |  Scroll = mouse wheel", 16, y + 8, 10, muted);

        c.SDL_RenderPresent(renderer);
    }
}

// ── Helpers ─────────────────────────────────────────────────────────────

fn fillRect(renderer: *c.SDL_Renderer, x: f32, y: f32, w: f32, h: f32, color: Color) void {
    _ = c.SDL_SetRenderDrawColor(renderer, color.r, color.g, color.b, color.a);
    var r = c.SDL_Rect{
        .x = @intFromFloat(x),
        .y = @intFromFloat(y),
        .w = @intFromFloat(w),
        .h = @intFromFloat(h),
    };
    _ = c.SDL_RenderFillRect(renderer, &r);
}
