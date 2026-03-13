//! TextInput state management for the native engine
//!
//! Each <TextInput> gets a compile-time input ID. Text buffers, cursor
//! position, and focus are managed here. SDL_TEXTINPUT and key events
//! route through these functions.

const std = @import("std");
const c = @import("c.zig").imports;

const MAX_INPUTS = 16;
const BUF_SIZE = 256;

pub const InputState = struct {
    buf: [BUF_SIZE]u8 = [_]u8{0} ** BUF_SIZE,
    len: u16 = 0,
    cursor: u16 = 0,
    active: bool = false,
};

var inputs: [MAX_INPUTS]InputState = [_]InputState{.{}} ** MAX_INPUTS;
var focused_id: ?u8 = null;
var cursor_blink: f32 = 0;
var cursor_visible: bool = true;

/// Register an input slot. Called at init time.
pub fn register(id: u8) void {
    if (id < MAX_INPUTS) {
        inputs[id].active = true;
    }
}

/// Get the text content of an input.
pub fn getText(id: u8) []const u8 {
    if (id >= MAX_INPUTS) return "";
    return inputs[id].buf[0..inputs[id].len];
}

/// Get the text as a null-terminated pointer (for rendering).
pub fn getTextZ(id: u8) ?[]const u8 {
    if (id >= MAX_INPUTS or inputs[id].len == 0) return null;
    return inputs[id].buf[0..inputs[id].len];
}

/// Focus an input. Starts SDL text input.
pub fn focus(id: u8) void {
    focused_id = id;
    cursor_blink = 0;
    cursor_visible = true;
    c.SDL_StartTextInput();
}

/// Unfocus all inputs. Stops SDL text input.
pub fn unfocus() void {
    focused_id = null;
    c.SDL_StopTextInput();
}

/// Check if a specific input is focused.
pub fn isFocused(id: u8) bool {
    return focused_id != null and focused_id.? == id;
}

/// Get the currently focused input ID, or null.
pub fn getFocusedId() ?u8 {
    return focused_id;
}

/// Handle SDL_TEXTINPUT event — insert characters at cursor.
pub fn handleTextInput(text: [*:0]const u8) void {
    const id = focused_id orelse return;
    if (id >= MAX_INPUTS) return;
    var inp = &inputs[id];

    // Get the length of the input text
    var text_len: u16 = 0;
    while (text[text_len] != 0 and text_len < 32) : (text_len += 1) {}

    if (inp.len + text_len > BUF_SIZE - 1) return; // buffer full

    // Shift chars right from cursor to make room
    if (inp.cursor < inp.len) {
        var i: u16 = inp.len;
        while (i > inp.cursor) {
            inp.buf[i + text_len - 1] = inp.buf[i - 1];
            i -= 1;
        }
    }

    // Insert
    for (0..text_len) |j| {
        inp.buf[inp.cursor + @as(u16, @intCast(j))] = text[j];
    }
    inp.len += text_len;
    inp.cursor += text_len;
    cursor_blink = 0;
    cursor_visible = true;
}

/// Handle key events for the focused input.
pub fn handleKey(sym: c_int) bool {
    const id = focused_id orelse return false;
    if (id >= MAX_INPUTS) return false;
    var inp = &inputs[id];

    if (sym == c.SDLK_BACKSPACE) {
        if (inp.cursor > 0) {
            // Shift left
            var i = inp.cursor - 1;
            while (i < inp.len - 1) : (i += 1) {
                inp.buf[i] = inp.buf[i + 1];
            }
            inp.len -= 1;
            inp.cursor -= 1;
            cursor_blink = 0;
            cursor_visible = true;
        }
        return true;
    }

    if (sym == c.SDLK_DELETE) {
        if (inp.cursor < inp.len) {
            var i = inp.cursor;
            while (i < inp.len - 1) : (i += 1) {
                inp.buf[i] = inp.buf[i + 1];
            }
            inp.len -= 1;
        }
        return true;
    }

    if (sym == c.SDLK_LEFT) {
        if (inp.cursor > 0) inp.cursor -= 1;
        cursor_blink = 0;
        cursor_visible = true;
        return true;
    }

    if (sym == c.SDLK_RIGHT) {
        if (inp.cursor < inp.len) inp.cursor += 1;
        cursor_blink = 0;
        cursor_visible = true;
        return true;
    }

    if (sym == c.SDLK_HOME) {
        inp.cursor = 0;
        cursor_blink = 0;
        cursor_visible = true;
        return true;
    }

    if (sym == c.SDLK_END) {
        inp.cursor = inp.len;
        cursor_blink = 0;
        cursor_visible = true;
        return true;
    }

    if (sym == c.SDLK_RETURN or sym == c.SDLK_KP_ENTER) {
        // Submit handled externally — return true so caller knows
        return true;
    }

    if (sym == c.SDLK_TAB) {
        // Cycle to next active input
        const current = id;
        var next = current +% 1;
        var tried: u8 = 0;
        while (tried < MAX_INPUTS) : (tried += 1) {
            if (next >= MAX_INPUTS) next = 0;
            if (inputs[next].active) {
                focus(next);
                return true;
            }
            next +%= 1;
        }
        return true;
    }

    if (sym == c.SDLK_ESCAPE) {
        unfocus();
        return true;
    }

    return false;
}

/// Tick cursor blink. Call once per frame with delta time.
/// Returns whether the cursor should be visible.
pub fn tickBlink(dt: f32) bool {
    cursor_blink += dt;
    if (cursor_blink >= 0.53) {
        cursor_blink = 0;
        cursor_visible = !cursor_visible;
    }
    return cursor_visible;
}

/// Get cursor position in an input (character index).
pub fn getCursorPos(id: u8) u16 {
    if (id >= MAX_INPUTS) return 0;
    return inputs[id].cursor;
}

/// Clear an input's text.
pub fn clear(id: u8) void {
    if (id >= MAX_INPUTS) return;
    inputs[id].len = 0;
    inputs[id].cursor = 0;
}

/// Set text programmatically (e.g. from state restoration).
pub fn setText(id: u8, text: []const u8) void {
    if (id >= MAX_INPUTS) return;
    const copy_len = @min(text.len, BUF_SIZE - 1);
    @memcpy(inputs[id].buf[0..copy_len], text[0..copy_len]);
    inputs[id].len = @intCast(copy_len);
    inputs[id].cursor = @intCast(copy_len);
}
