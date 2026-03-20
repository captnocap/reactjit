//! Input simulation — inject synthetic SDL events for automated testing.
//!
//! Pushes SDL_Event structs directly into the event queue to simulate
//! mouse clicks, keyboard input, text typing, scroll, and resize.

const std = @import("std");
const c = @import("c.zig").imports;
const layout = @import("layout.zig");
const Node = layout.Node;
const query = @import("query.zig");
const QueryOpts = query.QueryOpts;

/// Simulate a mouse click at (x, y). Pushes MOUSEBUTTONDOWN + MOUSEBUTTONUP.
pub fn click(x: f32, y: f32) void {
    const ix: c_int = @intFromFloat(x);
    const iy: c_int = @intFromFloat(y);

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
pub fn clickNode(root: *Node, opts: QueryOpts) bool {
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

/// Simulate typing a string (one SDL_TEXTINPUT event per character).
pub fn typeText(text: []const u8) void {
    for (text) |ch| {
        var event: c.SDL_Event = std.mem.zeroes(c.SDL_Event);
        event.type = c.SDL_TEXTINPUT;
        event.text.text[0] = @intCast(ch);
        event.text.text[1] = 0;
        _ = c.SDL_PushEvent(&event);
    }
}

/// Simulate a window resize.
pub fn resize(w: c_int, h: c_int) void {
    var event: c.SDL_Event = std.mem.zeroes(c.SDL_Event);
    event.type = c.SDL_WINDOWEVENT;
    event.window.event = c.SDL_WINDOWEVENT_SIZE_CHANGED;
    event.window.data1 = w;
    event.window.data2 = h;
    _ = c.SDL_PushEvent(&event);
}

/// Simulate a mouse wheel scroll.
pub fn scroll(x: c_int, y: c_int) void {
    var event: c.SDL_Event = std.mem.zeroes(c.SDL_Event);
    event.type = c.SDL_MOUSEWHEEL;
    event.wheel.x = x;
    event.wheel.y = y;
    _ = c.SDL_PushEvent(&event);
}

/// Push a SDL_QUIT event.
pub fn quit() void {
    var event: c.SDL_Event = std.mem.zeroes(c.SDL_Event);
    event.type = c.SDL_QUIT;
    _ = c.SDL_PushEvent(&event);
}
