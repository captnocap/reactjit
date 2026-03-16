//! Input Simulation for tsz testing
//!
//! Inject synthetic SDL events into the event queue to simulate
//! user interactions: mouse clicks, keyboard input, text typing.
//!
//! Used by the test runner to drive UI interactions programmatically.

const std = @import("std");
const c = @import("c.zig").imports;
const layout = @import("layout.zig");
const query = @import("query.zig");
const Node = layout.Node;

// ── Mouse ─────────────────────────────────────────────────────────────────

/// Simulate a mouse click at (x, y). Pushes MOUSEBUTTONDOWN + MOUSEBUTTONUP.
pub fn click(x: f32, y: f32) void {
    const ix: i32 = @intFromFloat(x);
    const iy: i32 = @intFromFloat(y);

    var down: c.SDL_Event = std.mem.zeroes(c.SDL_Event);
    down.type = c.SDL_MOUSEBUTTONDOWN;
    down.button.x = ix;
    down.button.y = iy;
    down.button.button = c.SDL_BUTTON_LEFT;
    down.button.state = c.SDL_PRESSED;
    down.button.clicks = 1;
    _ = c.SDL_PushEvent(&down);

    var up: c.SDL_Event = std.mem.zeroes(c.SDL_Event);
    up.type = c.SDL_MOUSEBUTTONUP;
    up.button.x = ix;
    up.button.y = iy;
    up.button.button = c.SDL_BUTTON_LEFT;
    up.button.state = c.SDL_RELEASED;
    up.button.clicks = 1;
    _ = c.SDL_PushEvent(&up);
}

/// Click a node found by query. Returns true if found and clicked.
pub fn clickNode(root: *Node, opts: query.QueryOpts) bool {
    if (query.find(root, opts)) |result| {
        click(result.cx, result.cy);
        return true;
    }
    return false;
}

/// Simulate a mouse move to (x, y).
pub fn moveMouse(x: f32, y: f32) void {
    var event: c.SDL_Event = std.mem.zeroes(c.SDL_Event);
    event.type = c.SDL_MOUSEMOTION;
    event.motion.x = @intFromFloat(x);
    event.motion.y = @intFromFloat(y);
    _ = c.SDL_PushEvent(&event);
}

// ── Keyboard ──────────────────────────────────────────────────────────────

/// Simulate a key press + release.
pub fn key(sym: c_int) void {
    var down: c.SDL_Event = std.mem.zeroes(c.SDL_Event);
    down.type = c.SDL_KEYDOWN;
    down.key.keysym.sym = sym;
    down.key.state = c.SDL_PRESSED;
    _ = c.SDL_PushEvent(&down);

    var up: c.SDL_Event = std.mem.zeroes(c.SDL_Event);
    up.type = c.SDL_KEYUP;
    up.key.keysym.sym = sym;
    up.key.state = c.SDL_RELEASED;
    _ = c.SDL_PushEvent(&up);
}

/// Simulate typing text character by character via SDL_TEXTINPUT events.
pub fn typeText(text: []const u8) void {
    for (text) |ch| {
        var event: c.SDL_Event = std.mem.zeroes(c.SDL_Event);
        event.type = c.SDL_TEXTINPUT;
        event.text.text[0] = @intCast(ch);
        event.text.text[1] = 0;
        _ = c.SDL_PushEvent(&event);
    }
}

// ── Window ────────────────────────────────────────────────────────────────

/// Simulate a window resize event.
pub fn resize(w: i32, h: i32) void {
    var event: c.SDL_Event = std.mem.zeroes(c.SDL_Event);
    event.type = c.SDL_WINDOWEVENT;
    event.window.event = c.SDL_WINDOWEVENT_SIZE_CHANGED;
    event.window.data1 = w;
    event.window.data2 = h;
    _ = c.SDL_PushEvent(&event);
}

/// Simulate a mouse wheel scroll.
pub fn scroll(x: i32, y: i32) void {
    var event: c.SDL_Event = std.mem.zeroes(c.SDL_Event);
    event.type = c.SDL_MOUSEWHEEL;
    event.wheel.x = x;
    event.wheel.y = y;
    _ = c.SDL_PushEvent(&event);
}

/// Push a quit event.
pub fn quit() void {
    var event: c.SDL_Event = std.mem.zeroes(c.SDL_Event);
    event.type = c.SDL_QUIT;
    _ = c.SDL_PushEvent(&event);
}

// ── Screenshots ───────────────────────────────────────────────────────────

const stb_write = @cImport(@cInclude("stb/stb_image_write.h"));

/// Capture the current renderer contents and write to a PNG file.
/// renderer: the SDL_Renderer to read pixels from.
/// path: null-terminated output file path (e.g. "screenshot.png").
/// Returns true on success.
pub fn screenshot(renderer: *c.SDL_Renderer, path: [*:0]const u8) bool {
    // Get renderer output size
    var w: c_int = 0;
    var h: c_int = 0;
    if (c.SDL_GetRendererOutputSize(renderer, &w, &h) != 0) return false;
    if (w <= 0 or h <= 0) return false;

    // Allocate pixel buffer (RGBA, 4 bytes per pixel)
    const stride: usize = @intCast(w * 4);
    const size: usize = stride * @as(usize, @intCast(h));
    const pixels = std.heap.page_allocator.alloc(u8, size) catch return false;
    defer std.heap.page_allocator.free(pixels);

    // Read pixels from renderer
    if (c.SDL_RenderReadPixels(
        renderer,
        null, // full renderer
        c.SDL_PIXELFORMAT_ABGR8888, // RGBA byte order for stb
        @ptrCast(pixels.ptr),
        @intCast(stride),
    ) != 0) return false;

    // Write PNG via stb_image_write
    const result = stb_write.stbi_write_png(
        path,
        w,
        h,
        4, // RGBA channels
        @ptrCast(pixels.ptr),
        @intCast(stride),
    );
    return result != 0;
}
