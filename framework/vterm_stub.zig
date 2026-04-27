//! framework/vterm_stub.zig — no-op libvterm/PTY surface for builds that
//! aren't carrying libvterm. Matches the public API of vterm_real.zig
//! exactly; every method returns an empty value, false, 0, or null.
//! Selected by framework/vterm.zig when -Dhas-terminal=false.
//!
//! recorder.zig is pure Zig (no C deps), so the recording state stays
//! functional even with the terminal disabled — recordings just never
//! receive PTY data because pollPty/feed are no-ops.

const std = @import("std");
const rec_mod = @import("recorder.zig");

// ── Recording (pure-Zig, always available) ─────────────────────────
var g_recorder: rec_mod.Recorder = .{};
var g_recording_active: bool = false;

pub fn startRecording(rows: u16, cols: u16) void {
    g_recorder.start(rows, cols);
    g_recording_active = true;
}

pub fn stopRecording() void {
    g_recorder.stop();
    g_recording_active = false;
}

pub fn saveRecording(path: []const u8) bool {
    return g_recorder.save(path);
}

pub fn isRecording() bool {
    return g_recording_active;
}

pub fn getRecorder() *const rec_mod.Recorder {
    return &g_recorder;
}

// ── Public types ────────────────────────────────────────────────────

pub const Color = struct {
    r: u8,
    g: u8,
    b: u8,
};

pub const Cell = struct {
    char_buf: [4]u8 = .{ 0, 0, 0, 0 },
    char_len: u8 = 0,
    width: u8 = 1,
    fg: ?Color = null,
    bg: ?Color = null,
    bold: bool = false,
    italic: bool = false,
    underline: bool = false,
    strike: bool = false,
    reverse: bool = false,
};

pub const MAX_TERMINALS: u8 = 4;

// VTerm is exposed as an opaque type for API parity. Nothing outside
// vterm_real.zig actually instantiates it.
pub const VTerm = struct {};

// ── Single-terminal API ────────────────────────────────────────────

pub fn initVterm(_: u16, _: u16) void {}
pub fn feed(_: []const u8) void {}
pub fn readOutput(_: []u8) ?[]const u8 {
    return null;
}
pub fn getRowText(_: u16) []const u8 {
    return "";
}
pub fn getCell(_: u16, _: u16) Cell {
    return .{};
}
pub fn getCursorRow() u16 {
    return 0;
}
pub fn getCursorCol() u16 {
    return 0;
}
pub fn getCursorVisible() bool {
    return false;
}
pub fn hasDamage() bool {
    return false;
}
pub fn clearDamageState() void {}
pub fn getRows() u16 {
    return 0;
}
pub fn getCols() u16 {
    return 0;
}
pub fn resizeVterm(_: u16, _: u16) void {}
pub fn deinit() void {}

// ── PTY ────────────────────────────────────────────────────────────

pub fn setSpawnCwd(_: []const u8) void {}
pub fn spawnShell(_: [*:0]const u8, _: u16, _: u16) void {}
pub fn pollPty() bool {
    return false;
}
pub fn writePty(_: []const u8) void {}
pub fn ptyAlive() bool {
    return false;
}
pub fn closePty() void {}

// ── Scrollback ─────────────────────────────────────────────────────

pub fn getScrollbackCell(_: u16, _: u16) Cell {
    return .{};
}
pub fn scrollbackCount() u16 {
    return 0;
}
pub fn scrollOffset() u16 {
    return 0;
}
pub fn scrollUp(_: u16) void {}
pub fn scrollDown(_: u16) void {}
pub fn scrollToBottom() void {}
pub fn copySelectedText(
    _: u16, _: u16,
    _: u16, _: u16,
    _: []u8,
) usize {
    return 0;
}

// ── Multi-terminal Idx variants ────────────────────────────────────

pub fn scrollUpIdx(_: u8, _: u16) void {}
pub fn scrollDownIdx(_: u8, _: u16) void {}
pub fn spawnShellIdx(_: u8, _: [*:0]const u8, _: u16, _: u16) void {}
pub fn resizeVtermIdx(_: u8, _: u16, _: u16) void {}
pub fn pollPtyIdx(_: u8) bool {
    return false;
}
pub fn ptyAliveIdx(_: u8) bool {
    return false;
}
pub fn getCellIdx(_: u8, _: u16, _: u16) Cell {
    return .{};
}
pub fn getColsIdx(_: u8) u16 {
    return 0;
}
pub fn getRowsIdx(_: u8) u16 {
    return 0;
}
pub fn getCursorRowIdx(_: u8) u16 {
    return 0;
}
pub fn getCursorColIdx(_: u8) u16 {
    return 0;
}
pub fn getCursorVisibleIdx(_: u8) bool {
    return false;
}
pub fn getRowTextIdx(_: u8, _: u16) []const u8 {
    return "";
}
pub fn getScrollbackCellIdx(_: u8, _: u16, _: u16) Cell {
    return .{};
}
pub fn scrollOffsetIdx(_: u8) u16 {
    return 0;
}
pub fn scrollToBottomIdx(_: u8) void {}
pub fn copySelectedTextIdx(
    _: u8,
    _: u16, _: u16,
    _: u16, _: u16,
    _: []u8,
) usize {
    return 0;
}
pub fn writePtyIdx(_: u8, _: []const u8) void {}
