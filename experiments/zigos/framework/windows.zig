//! ZigOS Multi-Window Manager
//!
//! Three window types, one API:
//!
//!   .in_process    — SDL2 renderer in the same process. Zero latency, shared memory.
//!                    Use for: inspector, devtools, debug panels.
//!
//!   .notification  — In-process + X11 notification hints. No focus steal, auto-dismiss.
//!                    Use for: toast notifications, alerts, transient overlays.
//!
//!   .independent   — Separate OS process connected via TCP/NDJSON. Own wgpu surface.
//!                    Use for: docked multi-window UIs, complex multi-panel apps.
//!
//! In-process windows use SDL2 renderers (not wgpu) because gpu.zig is a singleton
//! bound to one surface. This is intentional — secondary windows don't need the full
//! GPU pipeline. Independent windows each get their own process with their own wgpu.
//!
//! Usage:
//!   const win = windows.open("Inspector", 400, 600, .in_process);
//!   windows.setRoot(win, &inspector_tree);
//!   // In main loop:
//!   windows.layoutAll();
//!   windows.paintAndPresent();
//!   // Event loop:
//!   windows.routeEvent(&event);

const std = @import("std");
const c = @import("c.zig").imports;
const layout = @import("layout.zig");
const text_mod = @import("text.zig");
const events = @import("events.zig");
const log = @import("log.zig");

const Node = layout.Node;
const Color = layout.Color;
const TextEngine = text_mod.TextEngine;

// ════════════════════════════════════════════════════════════════════════
// Types
// ════════════════════════════════════════════════════════════════════════

pub const WindowKind = enum {
    /// Same process, SDL2 renderer. Shared address space, zero IPC overhead.
    in_process,
    /// Same process, SDL2 renderer + X11 notification window type.
    /// No focus steal, optional auto-dismiss timer.
    notification,
    /// Separate OS process with its own wgpu surface, connected via TCP/NDJSON.
    /// Full rendering pipeline, crash-isolated.
    independent,
};

const MAX_WINDOWS = 8;

pub const WindowSlot = struct {
    active: bool = false,
    kind: WindowKind = .in_process,

    // SDL2 (in_process + notification)
    window: ?*c.SDL_Window = null,
    renderer: ?*c.SDL_Renderer = null,
    sdl_window_id: u32 = 0,
    text_engine: ?TextEngine = null,
    root: ?*Node = null,
    hovered: ?*Node = null,
    win_w: f32 = 400,
    win_h: f32 = 300,
    bg_color: Color = Color.rgb(24, 24, 32),

    // Notification-specific
    auto_dismiss_ms: u32 = 0, // 0 = no auto-dismiss
    created_at: u32 = 0, // SDL_GetTicks at creation
    opacity: f32 = 1.0, // for fade in/out

    // Independent-specific (TCP/NDJSON — stubbed for now)
    // child_pid: ?std.posix.pid_t = null,
    // ipc_port: u16 = 0,
    // ipc_fd: ?std.posix.fd_t = null,
};

var slots: [MAX_WINDOWS]WindowSlot = [_]WindowSlot{.{}} ** MAX_WINDOWS;
var slot_count: usize = 0;

// ════════════════════════════════════════════════════════════════════════
// Open / Close
// ════════════════════════════════════════════════════════════════════════

pub const OpenOptions = struct {
    title: [*:0]const u8 = "Window",
    width: c_int = 400,
    height: c_int = 300,
    kind: WindowKind = .in_process,
    /// For notifications: auto-dismiss after N milliseconds (0 = manual close).
    auto_dismiss_ms: u32 = 5000,
    /// Position: null = SDL_WINDOWPOS_CENTERED
    x: ?c_int = null,
    y: ?c_int = null,
    /// Background color
    bg_color: Color = Color.rgb(24, 24, 32),
    /// Always on top (notifications default to true)
    always_on_top: bool = false,
    /// Borderless window (notifications default to true)
    borderless: bool = false,
};

/// Check if any window with this root is already open.
pub fn isRootOpen(root: *Node) bool {
    for (0..MAX_WINDOWS) |i| {
        if (slots[i].active and slots[i].root == root) return true;
    }
    return false;
}

/// Open a new window. Returns slot index, or null on failure.
pub fn open(opts: OpenOptions) ?usize {
    // Find a free slot
    var idx: usize = 0;
    while (idx < MAX_WINDOWS) : (idx += 1) {
        if (!slots[idx].active) break;
    }
    if (idx >= MAX_WINDOWS) {
        log.warn(.engine, "windows: all {d} slots full", .{MAX_WINDOWS});
        return null;
    }

    switch (opts.kind) {
        .in_process, .notification => return openInProcess(idx, opts),
        .independent => return openIndependent(idx, opts),
    }
}

fn openInProcess(idx: usize, opts: OpenOptions) ?usize {
    const is_notif = opts.kind == .notification;
    const pos_x = opts.x orelse c.SDL_WINDOWPOS_CENTERED;
    const pos_y = opts.y orelse c.SDL_WINDOWPOS_CENTERED;

    var flags: u32 = c.SDL_WINDOW_SHOWN | c.SDL_WINDOW_RESIZABLE;
    if (is_notif or opts.borderless) flags |= c.SDL_WINDOW_BORDERLESS;
    if (is_notif or opts.always_on_top) flags |= c.SDL_WINDOW_ALWAYS_ON_TOP;
    // Notifications should not steal focus
    if (is_notif) flags = (flags & ~@as(u32, c.SDL_WINDOW_RESIZABLE)) | c.SDL_WINDOW_SKIP_TASKBAR;

    const window = c.SDL_CreateWindow(
        opts.title,
        pos_x,
        pos_y,
        opts.width,
        opts.height,
        flags,
    ) orelse {
        log.err(.engine, "windows: SDL_CreateWindow failed", .{});
        return null;
    };

    const renderer = c.SDL_CreateRenderer(
        window,
        -1,
        c.SDL_RENDERER_ACCELERATED | c.SDL_RENDERER_PRESENTVSYNC,
    ) orelse {
        log.err(.engine, "windows: SDL_CreateRenderer failed", .{});
        c.SDL_DestroyWindow(window);
        return null;
    };
    _ = c.SDL_SetRenderDrawBlendMode(renderer, c.SDL_BLENDMODE_BLEND);

    const sdl_id = c.SDL_GetWindowID(window);

    // Each in-process window gets its own text engine (SDL2 renderer mode)
    const te = TextEngine.init(renderer, "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf") catch {
        log.err(.engine, "windows: TextEngine init failed", .{});
        c.SDL_DestroyRenderer(renderer);
        c.SDL_DestroyWindow(window);
        return null;
    };

    // X11 notification window type hint
    if (is_notif) setX11NotificationType(window);

    slots[idx] = .{
        .active = true,
        .kind = opts.kind,
        .window = window,
        .renderer = renderer,
        .sdl_window_id = sdl_id,
        .text_engine = te,
        .root = null,
        .hovered = null,
        .win_w = @floatFromInt(opts.width),
        .win_h = @floatFromInt(opts.height),
        .bg_color = opts.bg_color,
        .auto_dismiss_ms = if (is_notif) opts.auto_dismiss_ms else 0,
        .created_at = c.SDL_GetTicks(),
        .opacity = if (is_notif) 0.0 else 1.0, // notifications fade in
    };
    slot_count += 1;

    log.info(.engine, "windows: opened slot {d} ({s}) as {s}", .{
        idx,
        opts.title,
        if (is_notif) "notification" else "in_process",
    });
    return idx;
}

fn openIndependent(_: usize, _: OpenOptions) ?usize {
    // TODO: spawn child process, set up TCP server, connect via NDJSON
    // The child process runs the engine binary in "child-window" mode:
    //   - Own SDL_Window + wgpu surface (full GPU pipeline)
    //   - No QuickJS, no app logic — pure renderer
    //   - Receives tree mutations over TCP
    //   - Sends input events back over TCP
    log.warn(.engine, "windows: independent (TCP) windows not yet implemented", .{});
    return null;
}

/// Close a window by slot index.
pub fn close(idx: usize) void {
    if (idx >= MAX_WINDOWS or !slots[idx].active) return;

    switch (slots[idx].kind) {
        .in_process, .notification => {
            if (slots[idx].text_engine) |*te| te.deinit();
            if (slots[idx].renderer) |r| c.SDL_DestroyRenderer(r);
            if (slots[idx].window) |w| c.SDL_DestroyWindow(w);
        },
        .independent => {
            // TODO: send quit message over TCP, wait for child, close socket
        },
    }

    log.info(.engine, "windows: closed slot {d}", .{idx});
    slots[idx] = .{};
    if (slot_count > 0) slot_count -= 1;
}

/// Close all windows.
pub fn deinitAll() void {
    for (0..MAX_WINDOWS) |i| {
        if (slots[i].active) close(i);
    }
}

// ════════════════════════════════════════════════════════════════════════
// Tree binding
// ════════════════════════════════════════════════════════════════════════

/// Set the root node tree for a window.
pub fn setRoot(idx: usize, root: *Node) void {
    if (idx >= MAX_WINDOWS or !slots[idx].active) return;
    slots[idx].root = root;
}

// ════════════════════════════════════════════════════════════════════════
// Event routing
// ════════════════════════════════════════════════════════════════════════

/// Find which window slot an SDL window ID belongs to. Returns null for main window.
pub fn findByWindowId(sdl_window_id: u32) ?usize {
    for (0..MAX_WINDOWS) |i| {
        if (slots[i].active and slots[i].sdl_window_id == sdl_window_id) return i;
    }
    return null;
}

/// Route an SDL event to the correct window. Returns true if the event was consumed.
/// The engine should call this before its own event handling — if it returns true,
/// the event belongs to a secondary window and the engine should skip it.
pub fn routeEvent(event: *c.SDL_Event) bool {
    switch (event.type) {
        c.SDL_WINDOWEVENT => {
            const win_id = event.window.windowID;
            const idx = findByWindowId(win_id) orelse return false;
            switch (event.window.event) {
                c.SDL_WINDOWEVENT_CLOSE => close(idx),
                c.SDL_WINDOWEVENT_SIZE_CHANGED => {
                    slots[idx].win_w = @floatFromInt(event.window.data1);
                    slots[idx].win_h = @floatFromInt(event.window.data2);
                },
                else => {},
            }
            return true;
        },
        c.SDL_MOUSEBUTTONDOWN => {
            const win_id = event.button.windowID;
            const idx = findByWindowId(win_id) orelse return false;
            if (event.button.button == c.SDL_BUTTON_LEFT) {
                handleClick(idx, @floatFromInt(event.button.x), @floatFromInt(event.button.y));
            }
            return true;
        },
        c.SDL_MOUSEMOTION => {
            const win_id = event.motion.windowID;
            const idx = findByWindowId(win_id) orelse return false;
            handleMouseMotion(idx, @floatFromInt(event.motion.x), @floatFromInt(event.motion.y));
            return true;
        },
        c.SDL_MOUSEWHEEL => {
            const win_id = event.wheel.windowID;
            const idx = findByWindowId(win_id) orelse return false;
            // Get mouse position relative to this window
            var mx: c_int = 0;
            var my: c_int = 0;
            _ = c.SDL_GetMouseState(&mx, &my);
            handleWheel(idx, @floatFromInt(mx), @floatFromInt(my), @floatFromInt(event.wheel.y));
            return true;
        },
        else => return false,
    }
}

fn handleMouseMotion(idx: usize, mx: f32, my: f32) void {
    if (idx >= MAX_WINDOWS or !slots[idx].active) return;
    if (slots[idx].root) |root| {
        const prev = slots[idx].hovered;
        slots[idx].hovered = events.hitTestHoverable(root, mx, my);
        if (prev != slots[idx].hovered) {
            if (prev) |p| {
                if (p.handlers.on_hover_exit) |h| h();
            }
            if (slots[idx].hovered) |n| {
                if (n.handlers.on_hover_enter) |h| h();
            }
        }
    }
}

fn handleClick(idx: usize, mx: f32, my: f32) void {
    if (idx >= MAX_WINDOWS or !slots[idx].active) return;
    if (slots[idx].root) |root| {
        if (events.hitTest(root, mx, my)) |node| {
            if (node.handlers.on_press) |handler| handler();
        }
    }
}

fn handleWheel(idx: usize, mx: f32, my: f32, dy: f32) void {
    if (idx >= MAX_WINDOWS or !slots[idx].active) return;
    if (slots[idx].root) |root| {
        if (events.findScrollContainer(root, mx, my)) |scroll_node| {
            scroll_node.scroll_y -= dy * 30.0;
            const max_scroll = @max(0.0, scroll_node.content_height - scroll_node.computed.h);
            scroll_node.scroll_y = @max(0.0, @min(scroll_node.scroll_y, max_scroll));
        }
    }
}

// ════════════════════════════════════════════════════════════════════════
// Layout
// ════════════════════════════════════════════════════════════════════════

/// Layout all active in-process windows.
pub fn layoutAll() void {
    for (0..MAX_WINDOWS) |i| {
        if (!slots[i].active) continue;
        if (slots[i].kind == .independent) continue; // independent windows layout themselves
        if (slots[i].root) |root| {
            layout.layout(root, 0, 0, slots[i].win_w, slots[i].win_h);
        }
    }
}

// ════════════════════════════════════════════════════════════════════════
// Paint (SDL2 renderer for in-process windows)
// ════════════════════════════════════════════════════════════════════════

/// Paint and present all active in-process windows.
pub fn paintAndPresent() void {
    const now = c.SDL_GetTicks();

    for (0..MAX_WINDOWS) |i| {
        if (!slots[i].active) continue;
        if (slots[i].kind == .independent) continue;

        // Notification lifecycle: fade in, hold, fade out, auto-close
        if (slots[i].kind == .notification) {
            if (!tickNotification(i, now)) continue; // was closed
        }

        const rend = slots[i].renderer orelse continue;
        const root = slots[i].root orelse continue;
        if (slots[i].text_engine == null) continue;
        const te: *TextEngine = &slots[i].text_engine.?;

        // Clear with background color
        const bg = slots[i].bg_color;
        _ = c.SDL_SetRenderDrawColor(rend, bg.r, bg.g, bg.b, bg.a);
        _ = c.SDL_RenderClear(rend);

        // Paint tree
        paintNode(rend, te, root, slots[i].hovered, slots[i].opacity);

        c.SDL_RenderPresent(rend);
    }
}

fn paintNode(
    rend: *c.SDL_Renderer,
    te: *TextEngine,
    node: *Node,
    hovered: ?*Node,
    window_opacity: f32,
) void {
    paintNodeImpl(rend, te, node, hovered, window_opacity, 1.0);
}

fn paintNodeImpl(
    rend: *c.SDL_Renderer,
    te: *TextEngine,
    node: *Node,
    hovered: ?*Node,
    window_opacity: f32,
    parent_opacity: f32,
) void {
    if (node.style.display == .none) return;
    const effective_opacity = parent_opacity * node.style.opacity * window_opacity;
    if (effective_opacity <= 0) return;

    const r = node.computed;
    const ix = @as(i32, @intFromFloat(r.x));
    const iy = @as(i32, @intFromFloat(r.y));
    const iw = @as(i32, @intFromFloat(r.w));
    const ih = @as(i32, @intFromFloat(r.h));

    // Background
    if (node.style.background_color) |col| {
        const is_hov = (hovered != null and hovered.? == node);
        const paint_col = if (is_hov) brightenColor(col) else col;
        const a: u8 = @intFromFloat(@as(f32, @floatFromInt(paint_col.a)) * effective_opacity);
        _ = c.SDL_SetRenderDrawColor(rend, paint_col.r, paint_col.g, paint_col.b, a);
        var rect = c.SDL_Rect{ .x = ix, .y = iy, .w = iw, .h = ih };
        _ = c.SDL_RenderFillRect(rend, &rect);
    }

    // Border
    if (node.style.border_width > 0) {
        const bw = @as(i32, @intFromFloat(node.style.border_width));
        const bc = node.style.border_color orelse Color.rgb(255, 255, 255);
        const ba: u8 = @intFromFloat(@as(f32, @floatFromInt(bc.a)) * effective_opacity);
        _ = c.SDL_SetRenderDrawColor(rend, bc.r, bc.g, bc.b, ba);
        // top
        var top_r = c.SDL_Rect{ .x = ix, .y = iy, .w = iw, .h = bw };
        _ = c.SDL_RenderFillRect(rend, &top_r);
        // bottom
        var bot_r = c.SDL_Rect{ .x = ix, .y = iy + ih - bw, .w = iw, .h = bw };
        _ = c.SDL_RenderFillRect(rend, &bot_r);
        // left
        var left_r = c.SDL_Rect{ .x = ix, .y = iy + bw, .w = bw, .h = ih - bw * 2 };
        _ = c.SDL_RenderFillRect(rend, &left_r);
        // right
        var right_r = c.SDL_Rect{ .x = ix + iw - bw, .y = iy + bw, .w = bw, .h = ih - bw * 2 };
        _ = c.SDL_RenderFillRect(rend, &right_r);
    }

    // Text
    if (node.text) |txt| {
        if (txt.len > 0) {
            const tc = node.text_color orelse Color.rgb(255, 255, 255);
            const pl = node.style.padLeft();
            const pt = node.style.padTop();
            const pr = node.style.padRight();
            const text_max_w = r.w - pl - pr;
            var color_with_opacity = tc;
            color_with_opacity.a = @intFromFloat(@as(f32, @floatFromInt(tc.a)) * effective_opacity);
            te.drawTextWrappedFull(
                txt,
                r.x + pl,
                r.y + pt,
                node.font_size,
                text_max_w,
                color_with_opacity,
                node.style.text_align,
                node.letter_spacing,
                node.line_height,
                node.number_of_lines,
            );
        }
    }

    // Children
    for (node.children) |*child| {
        paintNodeImpl(rend, te, child, hovered, window_opacity, effective_opacity);
    }
}

fn brightenColor(col: Color) Color {
    return .{
        .r = @min(255, @as(u16, col.r) + 20),
        .g = @min(255, @as(u16, col.g) + 20),
        .b = @min(255, @as(u16, col.b) + 20),
        .a = col.a,
    };
}

// ════════════════════════════════════════════════════════════════════════
// Notification lifecycle
// ════════════════════════════════════════════════════════════════════════

const FADE_IN_MS: u32 = 200;
const FADE_OUT_MS: u32 = 300;

/// Tick a notification window's lifecycle. Returns false if the window was closed.
fn tickNotification(idx: usize, now: u32) bool {
    const slot = &slots[idx];
    const age = now -| slot.created_at;
    const dismiss = slot.auto_dismiss_ms;

    if (dismiss > 0 and age >= dismiss + FADE_OUT_MS) {
        // Expired — close it
        close(idx);
        return false;
    }

    // Fade in
    if (age < FADE_IN_MS) {
        slot.opacity = @as(f32, @floatFromInt(age)) / @as(f32, @floatFromInt(FADE_IN_MS));
        if (slot.window) |w| _ = c.SDL_SetWindowOpacity(w, slot.opacity);
        return true;
    }

    // Fade out
    if (dismiss > 0 and age >= dismiss) {
        const fade_age = age - dismiss;
        slot.opacity = 1.0 - @as(f32, @floatFromInt(fade_age)) / @as(f32, @floatFromInt(FADE_OUT_MS));
        slot.opacity = @max(0.0, slot.opacity);
        if (slot.window) |w| _ = c.SDL_SetWindowOpacity(w, slot.opacity);
        return true;
    }

    // Full opacity
    slot.opacity = 1.0;
    return true;
}

// ════════════════════════════════════════════════════════════════════════
// X11 notification window type
// ════════════════════════════════════════════════════════════════════════

/// Set X11 _NET_WM_WINDOW_TYPE to _NET_WM_WINDOW_TYPE_NOTIFICATION.
/// This tells the WM: no taskbar entry, no focus steal, float above other windows.
fn setX11NotificationType(window: *c.SDL_Window) void {
    var info: c.SDL_SysWMinfo = undefined;
    c.SDL_VERSION(&info.version);
    if (c.SDL_GetWindowWMInfo(window, &info) != c.SDL_TRUE) return;

    // Only on X11
    if (info.subsystem != c.SDL_SYSWM_X11) return;

    const display = info.info.x11.display;
    const x11_window = info.info.x11.window;

    const wm_type = x11Atom(display, "_NET_WM_WINDOW_TYPE");
    const notif_type = x11Atom(display, "_NET_WM_WINDOW_TYPE_NOTIFICATION");
    if (wm_type == 0 or notif_type == 0) return;

    // XChangeProperty(display, window, property, type, format, mode, data, nelements)
    const XA_ATOM: c_ulong = 4;
    const PropModeReplace: c_int = 0;
    var val = notif_type;
    _ = x11ChangeProperty(display, x11_window, wm_type, XA_ATOM, 32, PropModeReplace, @ptrCast(&val), 1);
}

// X11 FFI helpers — SDL2 exposes the display/window but not Xlib functions directly.
// We call through the C imports since SDL2 pulls in X11 headers on Linux.
extern fn XInternAtom(display: ?*anyopaque, name: [*:0]const u8, only_if_exists: c_int) c_ulong;
extern fn XChangeProperty(display: ?*anyopaque, window: c_ulong, property: c_ulong, prop_type: c_ulong, format: c_int, mode: c_int, data: ?*const anyopaque, nelements: c_int) c_int;

fn x11Atom(display: ?*anyopaque, name: [*:0]const u8) c_ulong {
    return XInternAtom(display, name, 0);
}

fn x11ChangeProperty(display: ?*anyopaque, window: c_ulong, property: c_ulong, prop_type: c_ulong, format: c_int, mode: c_int, data: ?*const anyopaque, nelements: c_int) c_int {
    return XChangeProperty(display, window, property, prop_type, format, mode, data, nelements);
}

// ════════════════════════════════════════════════════════════════════════
// Queries
// ════════════════════════════════════════════════════════════════════════

/// Return how many windows are active.
pub fn count() usize {
    return slot_count;
}

/// Get a slot (for external read access).
pub fn getSlot(idx: usize) ?*WindowSlot {
    if (idx >= MAX_WINDOWS or !slots[idx].active) return null;
    return &slots[idx];
}

/// Iterate all active slots. Callback receives (slot_index, *WindowSlot).
pub fn forEach(callback: *const fn (usize, *WindowSlot) void) void {
    for (0..MAX_WINDOWS) |i| {
        if (slots[i].active) callback(i, &slots[i]);
    }
}

// ── Telemetry ────────────────────────────────────────────────────────────

pub fn telemetryActiveCount() u32 {
    var n: u32 = 0;
    for (0..MAX_WINDOWS) |i| {
        if (slots[i].active) n += 1;
    }
    return n;
}
