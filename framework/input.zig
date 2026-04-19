//! TextInput state management for the native engine
//!
//! Each <TextInput> gets a compile-time input ID. Text buffers, cursor
//! position, and focus are managed here. SDL_TEXTINPUT and key events
//! route through these functions.

const std = @import("std");
const c = @import("c.zig").imports;

pub const MAX_INPUTS = 128;
const BUF_SIZE = 4096;

pub const InputState = struct {
    buf: [BUF_SIZE]u8 = [_]u8{0} ** BUF_SIZE,
    len: u16 = 0,
    cursor: u16 = 0,
    sel_start: u16 = 0, // selection start (anchor)
    sel_end: u16 = 0, // selection end (moves with cursor)
    has_selection: bool = false,
    active: bool = false,
    multiline: bool = false,
};

var inputs: [MAX_INPUTS]InputState = [_]InputState{.{}} ** MAX_INPUTS;
var on_change_callbacks: [MAX_INPUTS]?*const fn () void = [_]?*const fn () void{null} ** MAX_INPUTS;
var on_submit_callbacks: [MAX_INPUTS]?*const fn () void = [_]?*const fn () void{null} ** MAX_INPUTS;
var on_focus_callbacks: [MAX_INPUTS]?*const fn () void = [_]?*const fn () void{null} ** MAX_INPUTS;
var on_blur_callbacks: [MAX_INPUTS]?*const fn () void = [_]?*const fn () void{null} ** MAX_INPUTS;
var on_key_callbacks: [MAX_INPUTS]?*const fn (key: c_int, mods: u16) void = [_]?*const fn (key: c_int, mods: u16) void{null} ** MAX_INPUTS;
var focused_id: ?u8 = null;

// ── Submit event bus ────────────────────────────────────────────────────
// On Enter, captures the pre-clear text so cart JS can pick it up later via
// consumeLastSubmit(). Works even when no onSubmit callback is registered,
// letting non-soup-lane carts drive their own submit logic from a poll loop.
var g_last_submit_id: i16 = -1;
var g_last_submit_buf: [BUF_SIZE]u8 = [_]u8{0} ** BUF_SIZE;
var g_last_submit_len: u16 = 0;

pub const SubmitEvent = struct { id: u8, text: []const u8 };

pub fn consumeLastSubmit() ?SubmitEvent {
    if (g_last_submit_id < 0) return null;
    const id: u8 = @intCast(g_last_submit_id);
    const text = g_last_submit_buf[0..g_last_submit_len];
    g_last_submit_id = -1;
    return .{ .id = id, .text = text };
}
var cursor_blink: f32 = 0;
var cursor_visible: bool = true;
var measure_width_fn: ?*const fn ([]const u8, u16) f32 = null;

/// Set the text width measurement callback (provided by engine.zig).
pub fn setMeasureWidthFn(f: *const fn ([]const u8, u16) f32) void {
    measure_width_fn = f;
}

var last_click_ms: u32 = 0;
var click_count: u8 = 0;

/// Track click timing for double/triple click detection. Returns click count.
pub fn trackClick(now_ms: u32) u8 {
    const dt = now_ms -| last_click_ms;
    if (dt < 400) {
        click_count = if (click_count >= 3) 1 else click_count + 1;
    } else {
        click_count = 1;
    }
    last_click_ms = now_ms;
    return click_count;
}

/// Register an input slot. Called at init time.
pub fn register(id: u8) void {
    if (id < MAX_INPUTS) {
        inputs[id].active = true;
        inputs[id].multiline = false;
    }
}

/// Set a change callback for an input. Called when text content changes.
pub fn setOnChange(id: u8, callback: *const fn () void) void {
    if (id < MAX_INPUTS) {
        on_change_callbacks[id] = callback;
    }
}

/// Set a submit callback for an input. Called on Enter key (single-line only).
pub fn setOnSubmit(id: u8, callback: *const fn () void) void {
    if (id < MAX_INPUTS) {
        on_submit_callbacks[id] = callback;
    }
}

/// Set a focus callback for an input. Called when the input gains focus.
pub fn setOnFocus(id: u8, callback: *const fn () void) void {
    if (id < MAX_INPUTS) {
        on_focus_callbacks[id] = callback;
    }
}

/// Set a blur callback for an input. Called when the input loses focus.
pub fn setOnBlur(id: u8, callback: *const fn () void) void {
    if (id < MAX_INPUTS) {
        on_blur_callbacks[id] = callback;
    }
}

/// Set a key callback for an input. Called on key-down while focused.
pub fn setOnKey(id: u8, callback: *const fn (key: c_int, mods: u16) void) void {
    if (id < MAX_INPUTS) {
        on_key_callbacks[id] = callback;
    }
}

/// Register a multiline input slot (TextArea).
pub fn registerMultiline(id: u8) void {
    if (id < MAX_INPUTS) {
        inputs[id].active = true;
        inputs[id].multiline = true;
    }
}

/// Release an input slot so it can be reused by a newly mounted field.
pub fn unregister(id: u8) void {
    if (id >= MAX_INPUTS) return;
    if (focused_id != null and focused_id.? == id) {
        focused_id = null;
    }
    if (undo_input_id != null and undo_input_id.? == id) {
        undo_input_id = null;
        undo_count = 0;
    }
    if (g_last_submit_id >= 0 and @as(u8, @intCast(g_last_submit_id)) == id) {
        g_last_submit_id = -1;
        g_last_submit_len = 0;
    }
    on_change_callbacks[id] = null;
    on_submit_callbacks[id] = null;
    on_focus_callbacks[id] = null;
    on_blur_callbacks[id] = null;
    on_key_callbacks[id] = null;
    inputs[id] = .{};
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
    if (id >= MAX_INPUTS) return;
    if (focused_id != null and focused_id.? == id) {
        cursor_blink = 0;
        cursor_visible = true;
        return;
    }
    if (focused_id) |prev| {
        if (prev < MAX_INPUTS) {
            if (on_blur_callbacks[prev]) |cb| cb();
        }
    }
    focused_id = id;
    cursor_blink = 0;
    cursor_visible = true;
    if (on_focus_callbacks[id]) |cb| cb();
    // SDL3: text input is started once at engine init (requires window param)
}

/// Unfocus all inputs. Text input events continue flowing so terminals
/// and other consumers (PTY, render surfaces) still receive SDL_TEXTINPUT.
pub fn unfocus() void {
    if (focused_id) |prev| {
        focused_id = null;
        if (prev < MAX_INPUTS) {
            if (on_blur_callbacks[prev]) |cb| cb();
        }
        return;
    }
    focused_id = null;
}

/// Check if a specific input is focused.
pub fn isFocused(id: u8) bool {
    return focused_id != null and focused_id.? == id;
}

pub fn isMultiline(id: u8) bool {
    if (id >= MAX_INPUTS) return false;
    return inputs[id].multiline;
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

    // Delete selection if any (typing replaces selection)
    if (inp.has_selection) {
        pushUndo(id, inp);
        deleteSelection(inp);
    }

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
    if (on_change_callbacks[id]) |cb| cb();
}

/// Handle key events for the focused input.
pub fn handleKey(sym: c_int, mods: u16) bool {
    const id = focused_id orelse return false;
    if (id >= MAX_INPUTS) return false;
    if (on_key_callbacks[id]) |cb| cb(sym, mods);
    var inp = &inputs[id];
    const prev_len = inp.len;

    if (sym == c.SDLK_BACKSPACE) {
        if (inp.has_selection) {
            pushUndo(id, inp);
            deleteSelection(inp);
        } else if (inp.cursor > 0) {
            pushUndo(id, inp);
            var i = inp.cursor - 1;
            while (i < inp.len - 1) : (i += 1) {
                inp.buf[i] = inp.buf[i + 1];
            }
            inp.len -= 1;
            inp.cursor -= 1;
        }
        cursor_blink = 0;
        cursor_visible = true;
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
        clearSelection(inp);
        cursor_blink = 0;
        cursor_visible = true;
        return true;
    }

    if (sym == c.SDLK_RIGHT) {
        if (inp.cursor < inp.len) inp.cursor += 1;
        clearSelection(inp);
        cursor_blink = 0;
        cursor_visible = true;
        return true;
    }

    if (sym == c.SDLK_HOME) {
        inp.cursor = 0;
        clearSelection(inp);
        cursor_blink = 0;
        cursor_visible = true;
        return true;
    }

    if (sym == c.SDLK_END) {
        inp.cursor = inp.len;
        clearSelection(inp);
        cursor_blink = 0;
        cursor_visible = true;
        return true;
    }

    if (sym == c.SDLK_RETURN or sym == c.SDLK_KP_ENTER) {
        if (inp.multiline) {
            // Insert newline
            if (inp.len < BUF_SIZE - 1) {
                // Shift right
                if (inp.cursor < inp.len) {
                    var i: u16 = inp.len;
                    while (i > inp.cursor) {
                        inp.buf[i] = inp.buf[i - 1];
                        i -= 1;
                    }
                }
                inp.buf[inp.cursor] = '\n';
                inp.len += 1;
                inp.cursor += 1;
                cursor_blink = 0;
                cursor_visible = true;
            }
            return true;
        }
        // Single-line: capture the pre-clear text for the submit bus,
        // fire submit callback, then clear input.
        if (inp.len > 0) {
            @memcpy(g_last_submit_buf[0..inp.len], inp.buf[0..inp.len]);
            g_last_submit_len = inp.len;
            g_last_submit_id = @intCast(id);
        }
        if (on_submit_callbacks[id]) |cb| cb();
        // Clear the input after submit
        inp.len = 0;
        inp.cursor = 0;
        if (on_change_callbacks[id]) |ccb| ccb();
        return true;
    }

    if (sym == c.SDLK_TAB) {
        if (inp.multiline) {
            // Insert 4 spaces
            const spaces = "    ";
            if (inp.len + 4 <= BUF_SIZE - 1) {
                if (inp.cursor < inp.len) {
                    var i: u16 = inp.len + 3;
                    while (i > inp.cursor + 3) {
                        inp.buf[i] = inp.buf[i - 4];
                        i -= 1;
                    }
                }
                for (0..4) |j| {
                    inp.buf[inp.cursor + @as(u16, @intCast(j))] = spaces[j];
                }
                inp.len += 4;
                inp.cursor += 4;
                cursor_blink = 0;
                cursor_visible = true;
            }
            return true;
        }
        // Single-line: cycle to next/previous active input
        const reverse = (mods & c.SDL_KMOD_SHIFT) != 0;
        const current = id;
        var next = current;
        var tried: u8 = 0;
        while (tried < MAX_INPUTS) : (tried += 1) {
            if (reverse) {
                next = if (next == 0) MAX_INPUTS - 1 else next - 1;
            } else {
                next +%= 1;
                if (next >= MAX_INPUTS) next = 0;
            }
            if (inputs[next].active) {
                focus(next);
                return true;
            }
        }
        return true;
    }

    if (sym == c.SDLK_ESCAPE) {
        unfocus();
        return true;
    }

    if (inp.len != prev_len) {
        if (on_change_callbacks[id]) |cb| cb();
    }

    return false;
}

// ── Selection helpers ────────────────────────────────────────────────

/// Get the selection range (lo, hi) ordered.
pub fn getSelection(id: u8) struct { lo: u16, hi: u16 } {
    if (id >= MAX_INPUTS) return .{ .lo = 0, .hi = 0 };
    const inp = &inputs[id];
    if (!inp.has_selection) return .{ .lo = inp.cursor, .hi = inp.cursor };
    return if (inp.sel_start <= inp.sel_end)
        .{ .lo = inp.sel_start, .hi = inp.sel_end }
    else
        .{ .lo = inp.sel_end, .hi = inp.sel_start };
}

/// Delete the selected range and collapse cursor to the start.
fn deleteSelection(inp: *InputState) void {
    if (!inp.has_selection) return;
    const lo = if (inp.sel_start <= inp.sel_end) inp.sel_start else inp.sel_end;
    const hi = if (inp.sel_start <= inp.sel_end) inp.sel_end else inp.sel_start;
    const del_len = hi - lo;
    if (del_len == 0) return;
    // Shift left
    var i = lo;
    while (i < inp.len - del_len) : (i += 1) {
        inp.buf[i] = inp.buf[i + del_len];
    }
    inp.len -= del_len;
    inp.cursor = lo;
    inp.has_selection = false;
}

fn clearSelection(inp: *InputState) void {
    inp.has_selection = false;
    inp.sel_start = inp.cursor;
    inp.sel_end = inp.cursor;
}

// ── Undo state ──────────────────────────────────────────────────────

const MAX_UNDO = 32;
const UndoEntry = struct {
    buf: [BUF_SIZE]u8 = [_]u8{0} ** BUF_SIZE,
    len: u16 = 0,
    cursor: u16 = 0,
};

var undo_stack: [MAX_UNDO]UndoEntry = [_]UndoEntry{.{}} ** MAX_UNDO;
var undo_count: u16 = 0;
var undo_input_id: ?u8 = null; // which input the undo stack belongs to

fn pushUndo(id: u8, inp: *const InputState) void {
    if (undo_input_id != null and undo_input_id.? != id) {
        // Different input — reset undo stack
        undo_count = 0;
    }
    undo_input_id = id;
    if (undo_count < MAX_UNDO) {
        @memcpy(undo_stack[undo_count].buf[0..inp.len], inp.buf[0..inp.len]);
        undo_stack[undo_count].len = inp.len;
        undo_stack[undo_count].cursor = inp.cursor;
        undo_count += 1;
    }
}

fn popUndo(inp: *InputState) void {
    if (undo_count > 0) {
        undo_count -= 1;
        const entry = &undo_stack[undo_count];
        @memcpy(inp.buf[0..entry.len], entry.buf[0..entry.len]);
        inp.len = entry.len;
        inp.cursor = entry.cursor;
        inp.has_selection = false;
    }
}

// ── Ctrl+Key handler ────────────────────────────────────────────────

/// Handle Ctrl+key combinations. Returns true if handled.
pub fn handleCtrlKey(sym: c_int, mods: u16) bool {
    const id = focused_id orelse return false;
    if (id >= MAX_INPUTS) return false;
    if (on_key_callbacks[id]) |cb| cb(sym, mods);
    var inp = &inputs[id];

    // Ctrl+A — select all
    if (sym == c.SDLK_A) {
        inp.sel_start = 0;
        inp.sel_end = inp.len;
        inp.has_selection = true;
        inp.cursor = inp.len;
        return true;
    }

    // Ctrl+C — copy selection to clipboard
    if (sym == c.SDLK_C) {
        if (inp.has_selection) {
            const sel = getSelection(id);
            if (sel.hi > sel.lo) {
                // Null-terminate for SDL
                var clip_buf: [BUF_SIZE + 1]u8 = undefined;
                const clip_len = sel.hi - sel.lo;
                @memcpy(clip_buf[0..clip_len], inp.buf[sel.lo..sel.hi]);
                clip_buf[clip_len] = 0;
                _ = c.SDL_SetClipboardText(@ptrCast(&clip_buf));
            }
        }
        return true;
    }

    // Ctrl+X — cut selection
    if (sym == c.SDLK_X) {
        if (inp.has_selection) {
            const sel = getSelection(id);
            if (sel.hi > sel.lo) {
                // Copy first
                var clip_buf: [BUF_SIZE + 1]u8 = undefined;
                const clip_len = sel.hi - sel.lo;
                @memcpy(clip_buf[0..clip_len], inp.buf[sel.lo..sel.hi]);
                clip_buf[clip_len] = 0;
                _ = c.SDL_SetClipboardText(@ptrCast(&clip_buf));
                // Then delete
                pushUndo(id, inp);
                deleteSelection(inp);
            }
        }
        return true;
    }

    // Ctrl+V — paste from clipboard
    if (sym == c.SDLK_V) {
        const clip = c.SDL_GetClipboardText();
        if (clip != null) {
            pushUndo(id, inp);
            // Delete selection first if any
            if (inp.has_selection) deleteSelection(inp);
            // Insert clipboard text
            handleTextInput(clip);
            c.SDL_free(@ptrCast(clip));
        }
        return true;
    }

    // Ctrl+Z — undo
    if (sym == c.SDLK_Z) {
        pushUndo(id, inp); // save current for redo (simplified)
        popUndo(inp);
        return true;
    }

    return false;
}
/// Returns whether the cursor should be visible.
pub fn tickBlink(dt: f32) bool {
    cursor_blink += dt;
    if (cursor_blink >= 1.6) {
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
    var inp = &inputs[id];
    const copy_len: u16 = @intCast(@min(text.len, BUF_SIZE - 1));
    @memcpy(inp.buf[0..copy_len], text[0..copy_len]);
    inp.len = copy_len;
    inp.cursor = copy_len;
    inp.has_selection = false;
}

// ── Telemetry ────────────────────────────────────────────────────────────

pub const TelemetryInputStats = struct {
    focused_id: i8,
    active_count: u32,
};

var drag_id: ?u8 = null;
var drag_font_size: u16 = 0;

/// Select all text in the given input.
pub fn selectAll(id: u8) void {
    if (id >= MAX_INPUTS) return;
    const s = &inputs[id];
    s.sel_start = 0;
    s.sel_end = s.len;
    s.has_selection = true;
    s.cursor = s.len;
}

/// Select the word at the cursor position.
pub fn selectWord(id: u8) void {
    if (id >= MAX_INPUTS) return;
    const s = &inputs[id];
    const buf = s.buf[0..s.len];
    var start: u16 = s.cursor;
    var end: u16 = s.cursor;
    while (start > 0 and isWordChar(buf[start - 1])) start -= 1;
    while (end < s.len and isWordChar(buf[end])) end += 1;
    s.sel_start = start;
    s.sel_end = end;
    s.has_selection = start != end;
    s.cursor = end;
}

fn isWordChar(ch: u8) bool {
    return (ch >= 'a' and ch <= 'z') or (ch >= 'A' and ch <= 'Z') or (ch >= '0' and ch <= '9') or ch == '_';
}

/// Set cursor position from a pixel X offset using the measure callback.
pub fn setCursorFromX(id: u8, local_x: f32, font_size: u16) void {
    if (id >= MAX_INPUTS or measure_width_fn == null) return;
    const s = &inputs[id];
    const mfn = measure_width_fn.?;
    var best: u16 = 0;
    var best_dist: f32 = @abs(local_x);
    for (1..@as(usize, s.len) + 1) |i| {
        const w = mfn(s.buf[0..i], font_size);
        const dist = @abs(local_x - w);
        if (dist < best_dist) {
            best_dist = dist;
            best = @intCast(i);
        }
    }
    s.cursor = best;
    s.has_selection = false;
}

/// Begin a drag selection from current cursor position.
pub fn startDrag(id: u8) void {
    if (id >= MAX_INPUTS) return;
    drag_id = id;
    const s = &inputs[id];
    s.sel_start = s.cursor;
    s.sel_end = s.cursor;
    s.has_selection = false;
}

/// Update drag selection to new X position.
pub fn updateDrag(id: u8, local_x: f32, font_size: u16) void {
    if (id >= MAX_INPUTS or measure_width_fn == null) return;
    const s = &inputs[id];
    const mfn = measure_width_fn.?;
    var best: u16 = 0;
    var best_dist: f32 = @abs(local_x);
    for (1..@as(usize, s.len) + 1) |i| {
        const w = mfn(s.buf[0..i], font_size);
        const dist = @abs(local_x - w);
        if (dist < best_dist) {
            best_dist = dist;
            best = @intCast(i);
        }
    }
    s.sel_end = best;
    s.cursor = best;
    s.has_selection = s.sel_start != s.sel_end;
}

pub fn telemetryStats() TelemetryInputStats {
    var count: u32 = 0;
    for (0..MAX_INPUTS) |i| {
        if (inputs[i].active) count += 1;
    }
    return .{
        .focused_id = if (focused_id) |id| @intCast(id) else -1,
        .active_count = count,
    };
}
