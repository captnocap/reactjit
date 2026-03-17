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
const tray = @import("tray.zig");
const runner = @import("runner.zig");
const builtin = @import("builtin");
const native_os = builtin.os.tag;
const win32 = if (native_os == .windows) @import("win32.zig") else undefined;

// Signal flag: set by SIGUSR2 handler to raise the window
var sig_raise_window: bool = false;

fn sigusr2Handler(_: c_int) callconv(.c) void {
    sig_raise_window = true;
}

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

// Visible log lines (set during paint, used for selection hit testing)
const LogLineInfo = struct {
    text_start: usize, // byte offset into output
    text_end: usize,
    y: f32, // screen y of this line
};
const MAX_LOG_LINES = 256;
var visible_log_lines: [MAX_LOG_LINES]LogLineInfo = undefined;
var visible_log_count: usize = 0;
var log_text_x: f32 = 12; // x offset where log text starts
var log_font_size: u16 = 11;

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
        TextEngine.init(renderer, "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf") catch
        TextEngine.init(renderer, "/System/Library/Fonts/Supplemental/Arial.ttf") catch
        TextEngine.init(renderer, "/System/Library/Fonts/SFNS.ttf") catch
        TextEngine.init(renderer, "C:/Windows/Fonts/segoeui.ttf") catch
        TextEngine.init(renderer, "C:/Windows/Fonts/arial.ttf") catch return;
    defer te.deinit();

    var reg = registry.load(alloc);
    process.cleanStale(&reg);

    // Singleton: check if another GUI is already running
    const gui_pid = process.readPid("__gui__");
    if (gui_pid) |pid| {
        if (process.isRunning(pid)) {
            std.debug.print("[tsz] Dashboard already running (pid {d}). Raising window.\n", .{pid});
            // Send SIGUSR2 to raise the existing window (POSIX only)
            if (native_os != .windows) {
                std.posix.kill(pid, std.posix.SIG.USR2) catch {};
            }
            return;
        }
    }
    // Write our PID + install SIGUSR2 handler for window raise
    if (native_os == .windows) {
        process.writePid("__gui__", win32.GetCurrentProcessId());
    } else {
        process.writePid("__gui__", std.os.linux.getpid());
    }
    defer process.removePid("__gui__");
    if (native_os != .windows) {
        const posix = std.posix;
        const sa = posix.Sigaction{
            .handler = .{ .handler = sigusr2Handler },
            .mask = posix.sigemptyset(),
            .flags = 0,
        };
        posix.sigaction(posix.SIG.USR2, &sa, null);
    }

    // Init system tray
    const has_tray = tray.init();
    if (has_tray) {
        tray.buildMenu(&reg);
    }
    defer tray.deinit();

    var win_w: f32 = 900;
    var win_h: f32 = 500;
    var scroll_y: f32 = 0;
    var running = true;
    var frame: u32 = 0;
    var hover_mx: f32 = 0;
    var hover_my: f32 = 0;
    var window_visible = true;
    var log_scroll: f32 = 0;
    var log_panel_h: f32 = 160;
    var log_dragging: bool = false;
    var log_drag_start_y: f32 = 0;
    var log_drag_start_h: f32 = 0;
    var log_last_len: usize = 0; // track output length for auto-scroll

    // Log panel text selection
    var log_sel_start_line: usize = 0;
    var log_sel_start_char: usize = 0;
    var log_sel_end_line: usize = 0;
    var log_sel_end_char: usize = 0;
    var log_sel_active: bool = false;
    var log_sel_dragging: bool = false;
    var log_sel_all: bool = false;
    var log_click_time: u32 = 0;
    var log_click_count: u32 = 0;

    // New project input mode
    var input_mode: bool = false;
    var input_buf: [256]u8 = undefined;
    var input_len: usize = 0;

    var dirty = true;
    while (running) {
        var event: c.SDL_Event = undefined;
        while (c.SDL_PollEvent(&event) != 0) {
            dirty = true; // any event triggers repaint
            switch (event.type) {
                c.SDL_QUIT => {
                    if (has_tray) {
                        // Hide to tray instead of quitting
                        c.SDL_HideWindow(window);
                        window_visible = false;
                    } else {
                        running = false;
                    }
                },
                c.SDL_WINDOWEVENT => {
                    if (event.window.event == c.SDL_WINDOWEVENT_CLOSE) {
                        if (has_tray) {
                            c.SDL_HideWindow(window);
                            window_visible = false;
                        } else {
                            running = false;
                        }
                    } else if (event.window.event == c.SDL_WINDOWEVENT_SIZE_CHANGED) {
                        win_w = @floatFromInt(event.window.data1);
                        win_h = @floatFromInt(event.window.data2);
                    }
                },
                c.SDL_TEXTINPUT => {
                    if (input_mode) {
                        // Append typed characters
                        const text_ptr: [*]const u8 = @ptrCast(&event.text.text);
                        var ti: usize = 0;
                        while (ti < 32 and text_ptr[ti] != 0) : (ti += 1) {
                            if (input_len < input_buf.len - 1) {
                                input_buf[input_len] = text_ptr[ti];
                                input_len += 1;
                            }
                        }
                    }
                },
                c.SDL_KEYDOWN => {
                    const ctrl = (event.key.keysym.mod & c.KMOD_CTRL) != 0;

                    // Input mode key handling
                    if (input_mode) {
                        if (event.key.keysym.sym == c.SDLK_ESCAPE) {
                            input_mode = false;
                            input_len = 0;
                        } else if (event.key.keysym.sym == c.SDLK_RETURN and input_len > 0) {
                            // Create project
                            const proj_name = input_buf[0..input_len];
                            const argv = [_][]const u8{ "/proc/self/exe", "init", proj_name };
                            const result = std.process.Child.run(.{
                                .allocator = alloc,
                                .argv = &argv,
                            }) catch { break; };
                            alloc.free(result.stdout);
                            alloc.free(result.stderr);
                            c.SDL_StopTextInput();
                            // Reload registry
                            reg = registry.load(alloc);
                            process.cleanStale(&reg);
                            if (has_tray) tray.buildMenu(&reg);
                            input_mode = false;
                            input_len = 0;
                        } else if (event.key.keysym.sym == c.SDLK_BACKSPACE and input_len > 0) {
                            input_len -= 1;
                        }
                        continue;
                    }

                    if (event.key.keysym.sym == c.SDLK_ESCAPE) running = false;
                    if (event.key.keysym.sym == c.SDLK_r and !ctrl) {
                        reg = registry.load(alloc);
                        process.cleanStale(&reg);
                    }
                    // Ctrl+A — select all log text
                    if (ctrl and event.key.keysym.sym == c.SDLK_a) {
                        if (runner.getActive() != null and visible_log_count > 0) {
                            log_sel_all = true;
                            log_sel_active = true;
                            dirty = true;
                        }
                    }
                    // Ctrl+C — copy selected log text
                    if (ctrl and event.key.keysym.sym == c.SDLK_c) {
                        if (runner.getActive()) |active| {
                            const output = active.getOutput();
                            if (log_sel_all) {
                                // Copy all output
                                if (output.len > 0 and output.len < 16383) {
                                    var clip: [16384]u8 = undefined;
                                    @memcpy(clip[0..output.len], output);
                                    clip[output.len] = 0;
                                    _ = c.SDL_SetClipboardText(@ptrCast(&clip));
                                }
                            } else if (log_sel_active and visible_log_count > 0) {
                                // Copy selected range
                                var clip: [16384]u8 = undefined;
                                var cp: usize = 0;
                                const lo_line = @min(log_sel_start_line, log_sel_end_line);
                                const hi_line = @max(log_sel_start_line, log_sel_end_line);
                                for (lo_line..hi_line + 1) |li| {
                                    if (li >= visible_log_count) break;
                                    const vl = &visible_log_lines[li];
                                    var ls: usize = 0;
                                    var le: usize = vl.text_end - vl.text_start;
                                    if (li == lo_line) ls = @min(log_sel_start_char, log_sel_end_char);
                                    if (li == hi_line) le = @max(log_sel_start_char, log_sel_end_char);
                                    if (lo_line == hi_line) {
                                        ls = @min(log_sel_start_char, log_sel_end_char);
                                        le = @max(log_sel_start_char, log_sel_end_char);
                                    }
                                    const text = output[vl.text_start..vl.text_end];
                                    const safe_le = @min(le, text.len);
                                    const safe_ls = @min(ls, safe_le);
                                    if (safe_le > safe_ls) {
                                        const chunk = text[safe_ls..safe_le];
                                        const n = @min(chunk.len, clip.len - cp - 2);
                                        @memcpy(clip[cp .. cp + n], chunk[0..n]);
                                        cp += n;
                                        if (li < hi_line and cp < clip.len - 1) {
                                            clip[cp] = '\n';
                                            cp += 1;
                                        }
                                    }
                                }
                                if (cp > 0) {
                                    clip[cp] = 0;
                                    _ = c.SDL_SetClipboardText(@ptrCast(&clip));
                                }
                            }
                        }
                    }
                },
                c.SDL_MOUSEMOTION => {
                    hover_mx = @floatFromInt(event.motion.x);
                    hover_my = @floatFromInt(event.motion.y);
                    // Drag to resize log panel
                    if (log_dragging) {
                        const delta = log_drag_start_y - hover_my;
                        log_panel_h = @max(80, @min(win_h - 100, log_drag_start_h + delta));
                        dirty = true;
                    }
                    // Drag text selection in log
                    if (log_sel_dragging and runner.getActive() != null) {
                        for (0..visible_log_count) |li| {
                            const vl = &visible_log_lines[li];
                            const lh = te.lineHeight(log_font_size);
                            if (hover_my >= vl.y and hover_my < vl.y + lh) {
                                const output = runner.getActive().?.getOutput();
                                const line_text = output[vl.text_start..vl.text_end];
                                log_sel_end_line = li;
                                log_sel_end_char = te.hitTestLine(line_text, hover_mx - log_text_x, log_font_size);
                                dirty = true;
                                break;
                            }
                        }
                    }
                },
                c.SDL_MOUSEBUTTONDOWN => {
                    const mx: f32 = @floatFromInt(event.button.x);
                    const my: f32 = @floatFromInt(event.button.y);

                    // Check log panel interactions
                    if (runner.getActive() != null) {
                        const panel_top = win_h - log_panel_h - 30;
                        if (my >= panel_top - 3 and my <= panel_top + 3) {
                            // Drag handle
                            log_dragging = true;
                            log_drag_start_y = my;
                            log_drag_start_h = log_panel_h;
                        } else if (my >= panel_top and my <= panel_top + 20 and mx >= win_w - 70 and mx <= win_w - 10) {
                            // Pop-out button
                            openLogPopout(&te, renderer);
                        } else if (my > panel_top + 20 and my < win_h - 30) {
                            // Click in log text area — start selection
                            const now = c.SDL_GetTicks();
                            log_sel_all = false;

                            // Find which visible line was clicked
                            var clicked_line: ?usize = null;
                            for (0..visible_log_count) |li| {
                                const vl = &visible_log_lines[li];
                                const lh = te.lineHeight(log_font_size);
                                if (my >= vl.y and my < vl.y + lh) {
                                    clicked_line = li;
                                    break;
                                }
                            }

                            if (clicked_line) |cli| {
                                const vl = &visible_log_lines[cli];
                                const output = runner.getActive().?.getOutput();
                                const line_text = output[vl.text_start..vl.text_end];
                                const char_idx = te.hitTestLine(line_text, mx - log_text_x, log_font_size);

                                // Multi-click detection
                                if (now -% log_click_time < 400) {
                                    log_click_count += 1;
                                } else {
                                    log_click_count = 1;
                                }
                                log_click_time = now;

                                if (log_click_count >= 2) {
                                    // Double click — select entire line
                                    log_sel_start_line = cli;
                                    log_sel_start_char = 0;
                                    log_sel_end_line = cli;
                                    log_sel_end_char = line_text.len;
                                    log_sel_active = true;
                                    log_sel_dragging = false;
                                } else {
                                    // Single click — start drag selection
                                    log_sel_start_line = cli;
                                    log_sel_start_char = char_idx;
                                    log_sel_end_line = cli;
                                    log_sel_end_char = char_idx;
                                    log_sel_active = true;
                                    log_sel_dragging = true;
                                }
                            }
                        }
                    }

                    if (findHit(mx, my)) |hit| {
                        // "New Project" button sentinel
                        if (hit.project_idx == 0xFFFF and hit.action_idx == 0xFF) {
                            input_mode = true;
                            input_len = 0;
                            c.SDL_StartTextInput();
                        } else {
                        // Find action name
                        var ai: u8 = 0;
                        for (actions_mod.ALL) |a| {
                            if (!a.show_in_gui) continue;
                            if (ai == hit.action_idx) {
                                const p = &reg.projects[hit.project_idx];
                                if (std.mem.eql(u8, a.name, "rm")) {
                                    process.killProject(p.getName());
                                    _ = reg.remove(p.getName());
                                    registry.save(&reg);
                                } else {
                                    // Use runner for captured output
                                    var lbl_buf: [80]u8 = undefined;
                                    const lbl = std.fmt.bufPrint(&lbl_buf, "{s}:{s}", .{ p.getName(), a.name }) catch a.name;
                                    const r = runner.getRunner(lbl);
                                    const argv = [_][]const u8{ "/proc/self/exe", a.name, p.getPath() };
                                    _ = r.start(&argv, alloc);
                                }
                                break;
                            }
                            ai += 1;
                        }
                        } // close else from sentinel check
                    }
                },
                c.SDL_MOUSEBUTTONUP => {
                    log_dragging = false;
                    log_sel_dragging = false;
                },
                c.SDL_MOUSEWHEEL => {
                    const has_log_wh = runner.getActive() != null;
                    const list_bot = if (has_log_wh) win_h - log_panel_h - 30 else win_h - 30;
                    const panel_top = win_h - log_panel_h - 30;
                    const in_log_panel = (hover_my >= panel_top and has_log_wh);
                    if (in_log_panel) {
                        log_scroll -= @as(f32, @floatFromInt(event.wheel.y)) * 20.0;
                        log_scroll = @max(0, log_scroll);
                    } else {
                        scroll_y -= @as(f32, @floatFromInt(event.wheel.y)) * 30.0;
                        const ch: f32 = 50 + 28 + @as(f32, @floatFromInt(reg.count)) * 38;
                        const ms = @max(0, ch - list_bot);
                        scroll_y = @max(0, @min(scroll_y, ms));
                    }
                },
                else => {},
            }
        }

        // Pump GTK events for tray
        if (has_tray) {
            tray.update();
            // Check tray flags
            if (tray.should_show_gui) {
                tray.should_show_gui = false;
                c.SDL_RestoreWindow(window);
                c.SDL_ShowWindow(window);
                c.SDL_RaiseWindow(window);
                _ = c.SDL_SetWindowInputFocus(window);
                window_visible = true;
            }
            if (tray.should_quit) {
                running = false;
            }
            // Process tray menu actions
            tray.resolvePendingAction(&reg, alloc);
        }

        // Poll runners for output
        const prev_running = if (runner.getActive()) |a| a.isRunning() else false;
        runner.pollAll();
        const now_running = if (runner.getActive()) |a| a.isRunning() else false;
        if (runner.getActive() != null) dirty = true;
        // Transition: was running → no longer running = just finished
        if (prev_running and !now_running) {
            reg = registry.load(alloc);
            process.cleanStale(&reg);
            if (has_tray) tray.buildMenu(&reg);
        }

        // SIGUSR2 from another `tsz gui` → raise window
        if (sig_raise_window) {
            sig_raise_window = false;
            c.SDL_RestoreWindow(window);
            c.SDL_ShowWindow(window);
            c.SDL_RaiseWindow(window);
            _ = c.SDL_SetWindowInputFocus(window);
            window_visible = true;
            dirty = true;
        }

        // Periodic refresh
        frame += 1;
        if (frame % 120 == 0) {
            reg = registry.load(alloc);
            process.cleanStale(&reg);
            if (has_tray) tray.buildMenu(&reg);
            dirty = true;
        }

        // Skip rendering when window is hidden (tray-only mode)
        if (!window_visible) {
            std.Thread.sleep(100 * std.time.ns_per_ms);
            continue;
        }

        // Only repaint when something changed
        if (!dirty) {
            c.SDL_Delay(16); // ~60fps cap when idle
            continue;
        }
        dirty = false;

        // ── Paint ─────────────────────────────────────────────────
        hit_count = 0;
        _ = c.SDL_SetRenderDrawColor(renderer, bg.r, bg.g, bg.b, 255);
        _ = c.SDL_RenderClear(renderer);

        // Calculate project list area (above log panel + footer)
        const has_log = runner.getActive() != null;
        const list_bottom: f32 = if (has_log) win_h - log_panel_h - 30 else win_h - 30;

        // Clamp project scroll to available space
        const content_h: f32 = 50 + 28 + @as(f32, @floatFromInt(reg.count)) * 38 + 38; // +38 for "New Project" row
        const max_scroll = @max(0, content_h - list_bottom);
        scroll_y = @min(scroll_y, max_scroll);

        // Clip project list to area above log panel
        var list_clip = c.SDL_Rect{
            .x = 0,
            .y = 0,
            .w = @intFromFloat(win_w),
            .h = @intFromFloat(list_bottom),
        };
        _ = c.SDL_RenderSetClipRect(renderer, &list_clip);

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
        if (reg.count == 0 and !input_mode) {
            te.drawText("No projects registered.", 16, y + 20, 14, muted);
        }

        // "New Project" row
        const new_row_h: f32 = 38;
        if (input_mode) {
            // Input field
            fillRect(renderer, 0, y, win_w, new_row_h, Color.rgb(25, 35, 30));
            fillRect(renderer, 80, y + 8, 300, 22, Color.rgb(35, 45, 40));
            // Border
            fillRect(renderer, 80, y + 8, 300, 1, accent);
            fillRect(renderer, 80, y + 29, 300, 1, accent);
            fillRect(renderer, 80, y + 8, 1, 22, accent);
            fillRect(renderer, 379, y + 8, 1, 22, accent);

            te.drawText("Name:", 16, y + 10, 13, accent);
            if (input_len > 0) {
                te.drawText(input_buf[0..input_len], 88, y + 10, 13, text_color);
                // Cursor
                const cursor_x = 88 + te.textWidth(input_buf[0..input_len], 13);
                fillRect(renderer, cursor_x, y + 10, 1, 16, text_color);
            } else {
                te.drawText("project-name", 88, y + 10, 13, Color.rgb(70, 70, 90));
                fillRect(renderer, 88, y + 10, 1, 16, text_color);
            }
            te.drawText("Enter = create  |  Esc = cancel", 400, y + 12, 10, muted);
        } else {
            // "+ New Project" button
            const btn_hover = (hover_my >= y and hover_my < y + new_row_h);
            fillRect(renderer, 0, y, win_w, new_row_h, if (btn_hover) Color.rgb(30, 35, 42) else Color.rgb(25, 25, 35));
            te.drawText("+ New Project", 16, y + 10, 13, accent);
            addHit(0, y, win_w, new_row_h, 0xFFFF, 0xFF); // special sentinel
        }
        y += new_row_h;

        // Clear clip before drawing log panel + footer
        _ = c.SDL_RenderSetClipRect(renderer, null);

        // ── Detail panel (live output from active runner) ─────────
        if (runner.getActive()) |active| {
            const panel_y = win_h - log_panel_h - 30 + scroll_y;

            // Panel background
            fillRect(renderer, 0, panel_y, win_w, log_panel_h, Color.rgb(18, 18, 24));
            // Drag handle (top border — thicker, highlighted on hover)
            const handle_top = panel_y;
            const handle_hovered = (hover_my >= handle_top - 3 and hover_my <= handle_top + 3);
            fillRect(renderer, 0, handle_top, win_w, if (handle_hovered) 3 else 1, if (handle_hovered) accent else Color.rgb(55, 55, 75));

            // Pop-out button
            fillRect(renderer, win_w - 65, panel_y + 3, 55, 16, Color.rgb(45, 45, 60));
            te.drawText("Pop out", win_w - 60, panel_y + 4, 10, muted);

            // Label + status
            const status_str: []const u8 = switch (active.status) {
                .running => "running...",
                .success => "done",
                .failed => "FAILED",
                .idle => "",
            };
            const status_col = switch (active.status) {
                .running => accent,
                .success => success,
                .failed => danger,
                .idle => muted,
            };
            te.drawText(active.getLabel(), 12, panel_y + 6, 11, accent);
            te.drawText(status_str, 200, panel_y + 6, 11, status_col);

            // Output text — split into lines, scrollable
            const output = active.getOutput();
            if (output.len > 0) {
                const line_h = te.lineHeight(11);
                const visible_h = log_panel_h - 24;
                const max_visible: usize = @intFromFloat(visible_h / line_h);

                // Collect all lines (forward scan)
                var all_starts: [256]usize = undefined;
                var all_ends: [256]usize = undefined;
                var total_lines: usize = 0;
                var scan: usize = 0;
                while (scan < output.len and total_lines < 256) {
                    const nl = std.mem.indexOfScalar(u8, output[scan..], '\n');
                    const end = if (nl) |n| scan + n else output.len;
                    all_starts[total_lines] = scan;
                    all_ends[total_lines] = end;
                    total_lines += 1;
                    scan = if (nl) |n| scan + n + 1 else output.len;
                }

                // Auto-scroll to bottom when new output arrives
                const max_log_scroll = if (total_lines > max_visible) @as(f32, @floatFromInt(total_lines - max_visible)) * line_h else 0;
                if (output.len != log_last_len) {
                    log_last_len = output.len;
                    log_scroll = max_log_scroll;
                }
                log_scroll = @min(log_scroll, max_log_scroll);

                const skip_lines: usize = @intFromFloat(log_scroll / line_h);
                const auto_bottom = (log_scroll >= max_log_scroll - line_h);
                const first_line = if (auto_bottom and total_lines > max_visible) total_lines - max_visible else skip_lines;

                // Clip to panel area
                _ = c.SDL_SetRenderDrawColor(renderer, 18, 18, 24, 255);
                var clip = c.SDL_Rect{
                    .x = 0,
                    .y = @intFromFloat(panel_y + 22),
                    .w = @intFromFloat(win_w),
                    .h = @intFromFloat(visible_h),
                };
                _ = c.SDL_RenderSetClipRect(renderer, &clip);

                visible_log_count = 0;
                var out_y = panel_y + 22;
                var li = first_line;
                var vis_idx: usize = 0;
                while (li < total_lines and (out_y - panel_y - 22) < visible_h) {
                    const ls = all_starts[li];
                    const le = all_ends[li];

                    // Store visible line info for selection hit testing
                    if (vis_idx < MAX_LOG_LINES) {
                        visible_log_lines[vis_idx] = .{ .text_start = ls, .text_end = le, .y = out_y };
                        vis_idx += 1;
                    }

                    if (le > ls) {
                        const line = output[ls..le];
                        const max_chars: usize = @intFromFloat(win_w / 6.5);
                        const display = if (line.len > max_chars) line[0..max_chars] else line;

                        // Draw selection highlight behind text
                        const vi = vis_idx - 1; // current visible index
                        if (log_sel_all) {
                            te.drawSelectionRect(display, log_text_x, out_y, log_font_size, 0, display.len, Color.rgba(60, 120, 200, 140));
                        } else if (log_sel_active) {
                            const lo = @min(log_sel_start_line, log_sel_end_line);
                            const hi = @max(log_sel_start_line, log_sel_end_line);
                            if (vi >= lo and vi <= hi) {
                                var s0: usize = 0;
                                var s1: usize = display.len;
                                if (lo == hi) {
                                    s0 = @min(log_sel_start_char, log_sel_end_char);
                                    s1 = @max(log_sel_start_char, log_sel_end_char);
                                } else if (vi == lo) {
                                    s0 = if (log_sel_start_line <= log_sel_end_line) log_sel_start_char else log_sel_end_char;
                                } else if (vi == hi) {
                                    s1 = if (log_sel_start_line <= log_sel_end_line) log_sel_end_char else log_sel_start_char;
                                }
                                s0 = @min(s0, display.len);
                                s1 = @min(s1, display.len);
                                if (s1 > s0) {
                                    te.drawSelectionRect(display, log_text_x, out_y, log_font_size, s0, s1, Color.rgba(60, 120, 200, 140));
                                }
                            }
                        }

                        const line_col = if (std.mem.indexOf(u8, display, "FAIL") != null or std.mem.indexOf(u8, display, "error") != null)
                            danger
                        else if (std.mem.indexOf(u8, display, "PASS") != null or std.mem.indexOf(u8, display, "Built") != null or std.mem.indexOf(u8, display, "done") != null)
                            success
                        else if (std.mem.indexOf(u8, display, "[tsz]") != null)
                            accent
                        else if (std.mem.indexOf(u8, display, "warning") != null or std.mem.indexOf(u8, display, "Warning") != null)
                            warning
                        else
                            Color.rgb(170, 170, 185);
                        te.drawText(display, log_text_x, out_y, log_font_size, line_col);
                    }
                    out_y += line_h;
                    li += 1;
                }
                visible_log_count = vis_idx;

                // Clear clip
                _ = c.SDL_RenderSetClipRect(renderer, null);
            }
        }

        // Footer
        const footer_y = win_h - 30 + scroll_y;
        fillRect(renderer, 0, footer_y, win_w, 30, Color.rgb(20, 20, 28));
        const footer_text = if (runner.getActive() != null) "R = refresh  |  Esc = quit  |  Output panel showing live logs" else "R = refresh  |  Esc = quit  |  Scroll = mouse wheel";
        te.drawText(footer_text, 16, footer_y + 8, 10, muted);

        c.SDL_RenderPresent(renderer);
    }
}

// ── Log pop-out window ──────────────────────────────────────────────────

fn openLogPopout(te: *TextEngine, _: *c.SDL_Renderer) void {
    const active = runner.getActive() orelse return;
    const output = active.getOutput();
    if (output.len == 0) return;

    // Create a new window showing the full log
    const pop_win = c.SDL_CreateWindow(
        "tsz — build log",
        c.SDL_WINDOWPOS_CENTERED,
        c.SDL_WINDOWPOS_CENTERED,
        800,
        500,
        c.SDL_WINDOW_SHOWN | c.SDL_WINDOW_RESIZABLE,
    ) orelse return;

    const pop_rend = c.SDL_CreateRenderer(pop_win, -1, c.SDL_RENDERER_ACCELERATED | c.SDL_RENDERER_PRESENTVSYNC) orelse {
        c.SDL_DestroyWindow(pop_win);
        return;
    };
    _ = c.SDL_SetRenderDrawBlendMode(pop_rend, c.SDL_BLENDMODE_BLEND);

    // Create a text engine for the popout (shares FreeType lib but needs own SDL renderer binding)
    var pop_te = TextEngine.init(pop_rend, "fonts/base/DejaVuSans-Regular.ttf") catch
        TextEngine.init(pop_rend, "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf") catch
        TextEngine.init(pop_rend, "/System/Library/Fonts/Supplemental/Arial.ttf") catch
        TextEngine.init(pop_rend, "/System/Library/Fonts/SFNS.ttf") catch
        TextEngine.init(pop_rend, "C:/Windows/Fonts/segoeui.ttf") catch
        TextEngine.init(pop_rend, "C:/Windows/Fonts/arial.ttf") catch {
        c.SDL_DestroyRenderer(pop_rend);
        c.SDL_DestroyWindow(pop_win);
        return;
    };
    _ = te; // suppress unused

    defer {
        pop_te.deinit();
        c.SDL_DestroyRenderer(pop_rend);
        c.SDL_DestroyWindow(pop_win);
    }

    var pop_scroll: f32 = 99999; // start at bottom
    var pop_running = true;
    var pop_w: f32 = 800;
    var pop_h: f32 = 500;
    var pop_dirty = true;
    var pop_mx: f32 = 0;
    var pop_my: f32 = 0;

    // Selection state for popout
    var psel_start_line: usize = 0;
    var psel_start_char: usize = 0;
    var psel_end_line: usize = 0;
    var psel_end_char: usize = 0;
    var psel_active: bool = false;
    var psel_dragging: bool = false;
    var psel_all: bool = false;
    var psel_click_time: u32 = 0;
    var psel_click_count: u32 = 0;

    // Visible line tracking for hit testing
    var pop_vis_starts: [512]usize = undefined;
    var pop_vis_ends: [512]usize = undefined;
    var pop_vis_ys: [512]f32 = undefined;
    var pop_vis_count: usize = 0;

    const pop_font: u16 = 12;
    const pop_text_x: f32 = 8;

    while (pop_running) {
        var event: c.SDL_Event = undefined;
        while (c.SDL_PollEvent(&event) != 0) {
            pop_dirty = true;
            switch (event.type) {
                c.SDL_QUIT => {}, // ignore — main window handles quit
                c.SDL_WINDOWEVENT => {
                    if (event.window.event == c.SDL_WINDOWEVENT_CLOSE) pop_running = false
                    else if (event.window.event == c.SDL_WINDOWEVENT_SIZE_CHANGED) {
                        pop_w = @floatFromInt(event.window.data1);
                        pop_h = @floatFromInt(event.window.data2);
                    }
                },
                c.SDL_KEYDOWN => {
                    const ctrl = (event.key.keysym.mod & c.KMOD_CTRL) != 0;
                    if (event.key.keysym.sym == c.SDLK_ESCAPE) pop_running = false;
                    if (ctrl and event.key.keysym.sym == c.SDLK_a) {
                        psel_all = true;
                        psel_active = true;
                    }
                    if (ctrl and event.key.keysym.sym == c.SDLK_c) {
                        const cur = if (runner.getActive()) |a| a.getOutput() else output;
                        if (psel_all or !psel_active) {
                            // Copy all output (Ctrl+A+C or Ctrl+C with no selection)
                            if (cur.len > 0) {
                                const clen = @min(cur.len, 16383);
                                var clip: [16384]u8 = undefined;
                                @memcpy(clip[0..clen], cur[0..clen]);
                                clip[clen] = 0;
                                _ = c.SDL_SetClipboardText(@ptrCast(&clip));
                            }
                        } else if (psel_active and pop_vis_count > 0) {
                            var clip: [16384]u8 = undefined;
                            var cp: usize = 0;
                            const lo = @min(psel_start_line, psel_end_line);
                            const hi = @max(psel_start_line, psel_end_line);
                            for (lo..hi + 1) |pli| {
                                if (pli >= pop_vis_count) break;
                                const cur2 = if (runner.getActive()) |a| a.getOutput() else output;
                                const txt = cur2[pop_vis_starts[pli]..pop_vis_ends[pli]];
                                var s0: usize = 0;
                                var s1: usize = txt.len;
                                if (lo == hi) { s0 = @min(psel_start_char, psel_end_char); s1 = @max(psel_start_char, psel_end_char); } else if (pli == lo) { s0 = if (psel_start_line <= psel_end_line) psel_start_char else psel_end_char; } else if (pli == hi) { s1 = if (psel_start_line <= psel_end_line) psel_end_char else psel_start_char; }
                                s0 = @min(s0, txt.len);
                                s1 = @min(s1, txt.len);
                                if (s1 > s0) {
                                    const n = @min(s1 - s0, clip.len - cp - 2);
                                    @memcpy(clip[cp .. cp + n], txt[s0 .. s0 + n]);
                                    cp += n;
                                    if (pli < hi and cp < clip.len - 1) { clip[cp] = '\n'; cp += 1; }
                                }
                            }
                            if (cp > 0) { clip[cp] = 0; _ = c.SDL_SetClipboardText(@ptrCast(&clip)); }
                        }
                    }
                },
                c.SDL_MOUSEMOTION => {
                    pop_mx = @floatFromInt(event.motion.x);
                    pop_my = @floatFromInt(event.motion.y);
                    if (psel_dragging) {
                        const lh2 = pop_te.lineHeight(pop_font);
                        for (0..pop_vis_count) |pli| {
                            if (pop_my >= pop_vis_ys[pli] and pop_my < pop_vis_ys[pli] + lh2) {
                                const cur = if (runner.getActive()) |a| a.getOutput() else output;
                                const txt = cur[pop_vis_starts[pli]..pop_vis_ends[pli]];
                                psel_end_line = pli;
                                psel_end_char = pop_te.hitTestLine(txt, pop_mx - pop_text_x, pop_font);
                                break;
                            }
                        }
                    }
                },
                c.SDL_MOUSEBUTTONDOWN => {
                    psel_all = false;
                    const lh2 = pop_te.lineHeight(pop_font);
                    const now = c.SDL_GetTicks();
                    for (0..pop_vis_count) |pli| {
                        if (pop_my >= pop_vis_ys[pli] and pop_my < pop_vis_ys[pli] + lh2) {
                            const cur = if (runner.getActive()) |a| a.getOutput() else output;
                            const txt = cur[pop_vis_starts[pli]..pop_vis_ends[pli]];
                            const ci = pop_te.hitTestLine(txt, pop_mx - pop_text_x, pop_font);
                            if (now -% psel_click_time < 400) { psel_click_count += 1; } else { psel_click_count = 1; }
                            psel_click_time = now;
                            if (psel_click_count >= 2) {
                                psel_start_line = pli; psel_start_char = 0;
                                psel_end_line = pli; psel_end_char = txt.len;
                                psel_active = true; psel_dragging = false;
                            } else {
                                psel_start_line = pli; psel_start_char = ci;
                                psel_end_line = pli; psel_end_char = ci;
                                psel_active = true; psel_dragging = true;
                            }
                            break;
                        }
                    }
                },
                c.SDL_MOUSEBUTTONUP => { psel_dragging = false; },
                c.SDL_MOUSEWHEEL => {
                    pop_scroll -= @as(f32, @floatFromInt(event.wheel.y)) * 20.0;
                    pop_scroll = @max(0, pop_scroll);
                },
                else => {},
            }
        }

        if (!pop_dirty) { c.SDL_Delay(16); continue; }
        pop_dirty = false;

        const cur_output = if (runner.getActive()) |a| a.getOutput() else output;
        if (runner.getActive() != null) pop_dirty = true; // keep refreshing while running

        var starts: [512]usize = undefined;
        var ends: [512]usize = undefined;
        var nlines: usize = 0;
        var scan: usize = 0;
        while (scan < cur_output.len and nlines < 512) {
            const nl = std.mem.indexOfScalar(u8, cur_output[scan..], '\n');
            const end = if (nl) |n| scan + n else cur_output.len;
            starts[nlines] = scan;
            ends[nlines] = end;
            nlines += 1;
            scan = if (nl) |n| scan + n + 1 else cur_output.len;
        }

        const lh = pop_te.lineHeight(pop_font);
        const max_vis: usize = @intFromFloat(pop_h / lh);
        const max_scr = if (nlines > max_vis) @as(f32, @floatFromInt(nlines - max_vis)) * lh else 0;
        pop_scroll = @min(pop_scroll, max_scr);
        const first: usize = @intFromFloat(pop_scroll / lh);

        _ = c.SDL_SetRenderDrawColor(pop_rend, 18, 18, 24, 255);
        _ = c.SDL_RenderClear(pop_rend);

        pop_vis_count = 0;
        var py: f32 = 4;
        var li = first;
        while (li < nlines and py < pop_h) {
            const vi = pop_vis_count;
            if (vi < 512) {
                pop_vis_starts[vi] = starts[li];
                pop_vis_ends[vi] = ends[li];
                pop_vis_ys[vi] = py;
                pop_vis_count += 1;
            }

            if (ends[li] > starts[li]) {
                const line = cur_output[starts[li]..ends[li]];

                // Selection highlight
                if (psel_all) {
                    pop_te.drawSelectionRect(line, pop_text_x, py, pop_font, 0, line.len, Color.rgba(60, 120, 200, 140));
                } else if (psel_active) {
                    const lo = @min(psel_start_line, psel_end_line);
                    const hi = @max(psel_start_line, psel_end_line);
                    if (vi >= lo and vi <= hi) {
                        var s0: usize = 0;
                        var s1: usize = line.len;
                        if (lo == hi) { s0 = @min(psel_start_char, psel_end_char); s1 = @max(psel_start_char, psel_end_char); } else if (vi == lo) { s0 = if (psel_start_line <= psel_end_line) psel_start_char else psel_end_char; } else if (vi == hi) { s1 = if (psel_start_line <= psel_end_line) psel_end_char else psel_start_char; }
                        s0 = @min(s0, line.len);
                        s1 = @min(s1, line.len);
                        if (s1 > s0) pop_te.drawSelectionRect(line, pop_text_x, py, pop_font, s0, s1, Color.rgba(60, 120, 200, 140));
                    }
                }

                const col = if (std.mem.indexOf(u8, line, "FAIL") != null or std.mem.indexOf(u8, line, "error") != null)
                    Color.rgb(235, 87, 87)
                else if (std.mem.indexOf(u8, line, "PASS") != null or std.mem.indexOf(u8, line, "Built") != null)
                    Color.rgb(76, 204, 102)
                else if (std.mem.indexOf(u8, line, "[tsz]") != null)
                    Color.rgb(78, 201, 176)
                else
                    Color.rgb(170, 170, 185);
                pop_te.drawText(line, pop_text_x, py, pop_font, col);
            }
            py += lh;
            li += 1;
        }

        c.SDL_RenderPresent(pop_rend);
    }
}

// ── Helpers ─────────────────────────────────────────────────────────────

fn fillRect(rend: *c.SDL_Renderer, x: f32, y: f32, w: f32, h: f32, color: Color) void {
    _ = c.SDL_SetRenderDrawColor(rend, color.r, color.g, color.b, color.a);
    var r = c.SDL_Rect{
        .x = @intFromFloat(x),
        .y = @intFromFloat(y),
        .w = @intFromFloat(w),
        .h = @intFromFloat(h),
    };
    _ = c.SDL_RenderFillRect(rend, &r);
}
