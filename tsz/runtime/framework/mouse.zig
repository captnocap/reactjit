//! Shared mouse state — updated once per frame from the event loop.
//!
//! Any module that needs mouse position or button state reads from here
//! instead of doing its own SDL calls. One writer (main.zig event loop),
//! many readers (panel, overlay, bsod, .tsz handlers, etc.)

const std = @import("std");

var _x: f32 = 0;
var _y: f32 = 0;
var _left_down: bool = false;
var _right_down: bool = false;
var _prev_x: f32 = 0;
var _prev_y: f32 = 0;

// ── Writer API (called from main.zig event loop only) ────────────

/// Update position on SDL_MOUSEMOTION.
pub fn updatePosition(new_x: f32, new_y: f32) void {
    _prev_x = _x;
    _prev_y = _y;
    _x = new_x;
    _y = new_y;
}

/// Update button state on SDL_MOUSEBUTTONDOWN/UP.
pub fn updateButton(button: u8, down: bool) void {
    if (button == 1) _left_down = down;
    if (button == 3) _right_down = down;
}

// ── Reader API (anyone can call) ─────────────────────────────────

pub fn x() f32 {
    return _x;
}

pub fn y() f32 {
    return _y;
}

pub fn prevX() f32 {
    return _prev_x;
}

pub fn prevY() f32 {
    return _prev_y;
}

pub fn deltaX() f32 {
    return _x - _prev_x;
}

pub fn deltaY() f32 {
    return _y - _prev_y;
}

pub fn leftDown() bool {
    return _left_down;
}

pub fn rightDown() bool {
    return _right_down;
}
