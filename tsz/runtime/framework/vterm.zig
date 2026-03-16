//! vterm.zig — libvterm wrapper with damage-driven updates
//!
//! Port of love2d/lua/vterm.lua. Wraps libvterm for ANSI parsing,
//! damage tracking, cursor state, and cell access.
//! Uses manual extern declarations to avoid @cImport bitfield issues.

const std = @import("std");

// ── Manual libvterm type declarations ───────────────────────────────
// (Zig's @cImport can't handle C bitfield structs, so we declare manually)

const VTermOpaque = opaque {};
const VTermScreenOpaque = opaque {};

const VTermPos = extern struct {
    row: c_int = 0,
    col: c_int = 0,
};

const VTermRect = extern struct {
    start_row: c_int = 0,
    end_row: c_int = 0,
    start_col: c_int = 0,
    end_col: c_int = 0,
};

// VTermColor: union { type: u8; rgb: { type, r, g, b }; indexed: { type, idx } }
// 4 bytes total
const VTermColor = extern struct {
    type: u8 = 0,
    c1: u8 = 0, // rgb.red or indexed.idx
    c2: u8 = 0, // rgb.green
    c3: u8 = 0, // rgb.blue
};

const VTERM_COLOR_DEFAULT_FG: u8 = 0x02;
const VTERM_COLOR_DEFAULT_BG: u8 = 0x04;
const VTERM_COLOR_TYPE_MASK: u8 = 0x01;
const VTERM_COLOR_INDEXED: u8 = 0x01;

// VTermScreenCell: chars[6] + width + padding + attrs(u32) + fg + bg
// attrs is a C bitfield struct — we store as u32 and extract bits manually
const VTermScreenCell = extern struct {
    chars: [6]u32 = .{ 0, 0, 0, 0, 0, 0 },
    width: u8 = 0,
    _pad1: u8 = 0,
    _pad2: u8 = 0,
    _pad3: u8 = 0,
    attrs: u32 = 0, // bitfield: bold:1 underline:2 italic:1 blink:1 reverse:1 conceal:1 strike:1 ...
    fg: VTermColor = .{},
    bg: VTermColor = .{},
};

// Attr bit extraction from the u32 attrs field
fn attrBold(attrs: u32) bool {
    return (attrs & 0x01) != 0;
}
fn attrUnderline(attrs: u32) bool {
    return ((attrs >> 1) & 0x03) != 0;
}
fn attrItalic(attrs: u32) bool {
    return ((attrs >> 3) & 0x01) != 0;
}
fn attrReverse(attrs: u32) bool {
    return ((attrs >> 5) & 0x01) != 0;
}
fn attrStrike(attrs: u32) bool {
    return ((attrs >> 7) & 0x01) != 0;
}

// VTermValue: union { boolean: c_int, number: c_int, ... }
const VTermValue = extern struct {
    boolean: c_int, // also serves as 'number' (same offset)
    _pad: [12]u8 = undefined, // rest of union (VTermStringFragment is larger)
};

// Constants
const VTERM_PROP_CURSORVISIBLE: c_int = 1;
const VTERM_PROP_ALTSCREEN: c_int = 3;
const VTERM_DAMAGE_ROW: c_int = 1;

// Callback function pointer types
const DamageFn = *const fn (VTermRect, ?*anyopaque) callconv(.c) c_int;
const MoverectFn = *const fn (VTermRect, VTermRect, ?*anyopaque) callconv(.c) c_int;
const MovecursorFn = *const fn (VTermPos, VTermPos, c_int, ?*anyopaque) callconv(.c) c_int;
const SettermpropFn = *const fn (c_int, [*c]VTermValue, ?*anyopaque) callconv(.c) c_int;
const BellFn = *const fn (?*anyopaque) callconv(.c) c_int;
const ResizeFn = *const fn (c_int, c_int, ?*anyopaque) callconv(.c) c_int;
const SbPushlineFn = *const fn (c_int, [*c]const VTermScreenCell, ?*anyopaque) callconv(.c) c_int;
const SbPoplineFn = *const fn (c_int, [*c]VTermScreenCell, ?*anyopaque) callconv(.c) c_int;

const VTermScreenCallbacks = extern struct {
    damage: ?DamageFn = null,
    moverect: ?MoverectFn = null,
    movecursor: ?MovecursorFn = null,
    settermprop: ?SettermpropFn = null,
    bell: ?BellFn = null,
    resize: ?ResizeFn = null,
    sb_pushline: ?SbPushlineFn = null,
    sb_popline: ?SbPoplineFn = null,
};

// ── libvterm extern functions ───────────────────────────────────────

extern "vterm" fn vterm_new(rows: c_int, cols: c_int) ?*VTermOpaque;
extern "vterm" fn vterm_free(vt: *VTermOpaque) void;
extern "vterm" fn vterm_set_size(vt: *VTermOpaque, rows: c_int, cols: c_int) void;
extern "vterm" fn vterm_set_utf8(vt: *VTermOpaque, is_utf8: c_int) void;
extern "vterm" fn vterm_input_write(vt: *VTermOpaque, bytes: [*]const u8, len: usize) usize;
extern "vterm" fn vterm_output_read(vt: *VTermOpaque, buffer: [*]u8, len: usize) usize;
extern "vterm" fn vterm_obtain_screen(vt: *VTermOpaque) *VTermScreenOpaque;
extern "vterm" fn vterm_screen_set_callbacks(screen: *VTermScreenOpaque, callbacks: *const VTermScreenCallbacks, user: ?*anyopaque) void;
extern "vterm" fn vterm_screen_enable_altscreen(screen: *VTermScreenOpaque, altscreen: c_int) void;
extern "vterm" fn vterm_screen_enable_reflow(screen: *VTermScreenOpaque, reflow: c_int) void;
extern "vterm" fn vterm_screen_reset(screen: *VTermScreenOpaque, hard: c_int) void;
extern "vterm" fn vterm_screen_flush_damage(screen: *VTermScreenOpaque) void;
extern "vterm" fn vterm_screen_set_damage_merge(screen: *VTermScreenOpaque, size: c_int) void;
extern "vterm" fn vterm_screen_get_text(screen: *const VTermScreenOpaque, str: [*]u8, len: usize, rect: VTermRect) usize;
extern "vterm" fn vterm_screen_get_cell(screen: *const VTermScreenOpaque, pos: VTermPos, cell: *VTermScreenCell) c_int;
extern "vterm" fn vterm_screen_is_eol(screen: *const VTermScreenOpaque, pos: VTermPos) c_int;
extern "vterm" fn vterm_screen_convert_color_to_rgb(screen: *const VTermScreenOpaque, col: *VTermColor) void;

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

// ── VTerm wrapper ───────────────────────────────────────────────────

pub const VTerm = struct {
    handle: *VTermOpaque,
    screen: *VTermScreenOpaque,
    rows: u16,
    cols: u16,

    // Damage tracking (set by callbacks)
    dirty_rows: [256]bool = [_]bool{false} ** 256,
    has_damage: bool = false,
    scrolled: bool = false,

    // Cursor state (set by movecursor callback)
    cursor_row: u16 = 0,
    cursor_col: u16 = 0,
    cursor_visible: bool = true,
    cursor_moved: bool = false,

    // Render lifecycle (set by settermprop callback)
    render_in_progress: bool = false,
    render_completed: bool = false,
    alt_screen: bool = false,

    // Reusable cell buffer
    cell_buf: VTermScreenCell = .{},

    pub fn init(rows: u16, cols: u16) !VTerm {
        const handle = vterm_new(@intCast(rows), @intCast(cols)) orelse
            return error.VTermCreateFailed;

        vterm_set_utf8(handle, 1);

        const screen = vterm_obtain_screen(handle);
        vterm_screen_enable_altscreen(screen, 1);
        vterm_screen_enable_reflow(screen, 1);

        var self = VTerm{
            .handle = handle,
            .screen = screen,
            .rows = rows,
            .cols = cols,
        };

        // Register callbacks
        vterm_screen_set_callbacks(screen, &screen_callbacks, @ptrCast(&self));

        // Row-level damage merge
        vterm_screen_set_damage_merge(screen, VTERM_DAMAGE_ROW);

        // Reset screen
        vterm_screen_reset(screen, 1);

        // Clear initial damage from reset
        self.clearDamage();

        return self;
    }

    pub fn feedData(self: *VTerm, data: []const u8) void {
        if (data.len == 0) return;
        // Re-register callbacks (self may have moved if stored in optional)
        vterm_screen_set_callbacks(self.screen, &screen_callbacks, @ptrCast(self));
        _ = vterm_input_write(self.handle, data.ptr, data.len);
        vterm_screen_flush_damage(self.screen);
    }

    pub fn readOutputData(self: *VTerm, buf: []u8) ?[]const u8 {
        const len = vterm_output_read(self.handle, buf.ptr, buf.len);
        if (len > 0) return buf[0..len];
        return null;
    }

    pub fn getRowText(self: *VTerm, row: u16, buf: []u8) []const u8 {
        const rect = VTermRect{
            .start_row = @intCast(row),
            .end_row = @intCast(row + 1),
            .start_col = 0,
            .end_col = @intCast(self.cols),
        };
        const len = vterm_screen_get_text(self.screen, buf.ptr, buf.len, rect);
        if (len == 0) return buf[0..0];

        // Trim trailing spaces
        var end: usize = len;
        while (end > 0 and buf[end - 1] == ' ') end -= 1;
        return buf[0..end];
    }

    pub fn getCell(self: *VTerm, row: u16, col: u16) Cell {
        const pos = VTermPos{ .row = @intCast(row), .col = @intCast(col) };
        _ = vterm_screen_get_cell(self.screen, pos, &self.cell_buf);

        var result = Cell{
            .width = if (self.cell_buf.width > 0) self.cell_buf.width else 1,
            .bold = attrBold(self.cell_buf.attrs),
            .italic = attrItalic(self.cell_buf.attrs),
            .underline = attrUnderline(self.cell_buf.attrs),
            .strike = attrStrike(self.cell_buf.attrs),
            .reverse = attrReverse(self.cell_buf.attrs),
        };

        // Decode Unicode codepoint to UTF-8
        const cp = self.cell_buf.chars[0];
        if (cp > 0) {
            if (cp < 0x80) {
                result.char_buf[0] = @intCast(cp);
                result.char_len = 1;
            } else if (cp < 0x800) {
                result.char_buf[0] = @intCast(0xC0 | (cp >> 6));
                result.char_buf[1] = @intCast(0x80 | (cp & 0x3F));
                result.char_len = 2;
            } else if (cp < 0x10000) {
                result.char_buf[0] = @intCast(0xE0 | (cp >> 12));
                result.char_buf[1] = @intCast(0x80 | ((cp >> 6) & 0x3F));
                result.char_buf[2] = @intCast(0x80 | (cp & 0x3F));
                result.char_len = 3;
            } else if (cp <= 0x10FFFF) {
                result.char_buf[0] = @intCast(0xF0 | (cp >> 18));
                result.char_buf[1] = @intCast(0x80 | ((cp >> 12) & 0x3F));
                result.char_buf[2] = @intCast(0x80 | ((cp >> 6) & 0x3F));
                result.char_buf[3] = @intCast(0x80 | (cp & 0x3F));
                result.char_len = 4;
            }
        }

        // Resolve colors
        result.fg = resolveColor(self.screen, &self.cell_buf.fg);
        result.bg = resolveColor(self.screen, &self.cell_buf.bg);

        return result;
    }

    pub fn resizeTerminal(self: *VTerm, new_rows: u16, new_cols: u16) void {
        self.rows = new_rows;
        self.cols = new_cols;
        vterm_set_size(self.handle, @intCast(new_rows), @intCast(new_cols));
    }

    pub fn clearDamage(self: *VTerm) void {
        self.dirty_rows = [_]bool{false} ** 256;
        self.has_damage = false;
        self.scrolled = false;
        self.cursor_moved = false;
        self.render_completed = false;
    }

    pub fn deinitVterm(self: *VTerm) void {
        vterm_free(self.handle);
    }
};

// ── Color resolution ────────────────────────────────────────────────

fn resolveColor(screen: *const VTermScreenOpaque, col: *VTermColor) ?Color {
    if (col.type & VTERM_COLOR_DEFAULT_FG != 0) return null;
    if (col.type & VTERM_COLOR_DEFAULT_BG != 0) return null;

    if (col.type & VTERM_COLOR_TYPE_MASK == VTERM_COLOR_INDEXED) {
        var tmp = col.*;
        vterm_screen_convert_color_to_rgb(screen, &tmp);
        return Color{ .r = tmp.c1, .g = tmp.c2, .b = tmp.c3 };
    }

    return Color{ .r = col.c1, .g = col.c2, .b = col.c3 };
}

// ── libvterm callbacks ──────────────────────────────────────────────

fn getSelf(user: ?*anyopaque) ?*VTerm {
    if (user) |ptr| return @ptrCast(@alignCast(ptr));
    return null;
}

fn cb_damage(rect: VTermRect, user: ?*anyopaque) callconv(.c) c_int {
    const self = getSelf(user) orelse return 0;
    var r: usize = @intCast(rect.start_row);
    const end: usize = @intCast(rect.end_row);
    while (r < end) : (r += 1) {
        if (r < 256) self.dirty_rows[r] = true;
    }
    self.has_damage = true;
    return 0;
}

fn cb_moverect(dest: VTermRect, src: VTermRect, user: ?*anyopaque) callconv(.c) c_int {
    const self = getSelf(user) orelse return 0;
    var r: usize = @intCast(dest.start_row);
    while (r < @as(usize, @intCast(dest.end_row))) : (r += 1) {
        if (r < 256) self.dirty_rows[r] = true;
    }
    r = @intCast(src.start_row);
    while (r < @as(usize, @intCast(src.end_row))) : (r += 1) {
        if (r < 256) self.dirty_rows[r] = true;
    }
    self.has_damage = true;
    self.scrolled = true;
    return 0;
}

fn cb_movecursor(pos: VTermPos, _: VTermPos, visible: c_int, user: ?*anyopaque) callconv(.c) c_int {
    const self = getSelf(user) orelse return 0;
    self.cursor_row = @intCast(pos.row);
    self.cursor_col = @intCast(pos.col);
    self.cursor_visible = (visible != 0);
    self.cursor_moved = true;
    return 0;
}

fn cb_settermprop(prop: c_int, val: [*c]VTermValue, user: ?*anyopaque) callconv(.c) c_int {
    const self = getSelf(user) orelse return 0;

    if (prop == VTERM_PROP_CURSORVISIBLE) {
        const was_visible = self.cursor_visible;
        self.cursor_visible = (val[0].boolean != 0);
        if (was_visible and !self.cursor_visible) {
            self.render_in_progress = true;
        } else if (!was_visible and self.cursor_visible) {
            self.render_in_progress = false;
            self.render_completed = true;
        }
    } else if (prop == VTERM_PROP_ALTSCREEN) {
        self.alt_screen = (val[0].boolean != 0);
    }
    return 1;
}

fn cb_bell(_: ?*anyopaque) callconv(.c) c_int {
    return 0;
}

fn cb_resize(_: c_int, _: c_int, _: ?*anyopaque) callconv(.c) c_int {
    return 0;
}

fn cb_sb_pushline(_: c_int, _: [*c]const VTermScreenCell, _: ?*anyopaque) callconv(.c) c_int {
    return 0;
}

fn cb_sb_popline(_: c_int, _: [*c]VTermScreenCell, _: ?*anyopaque) callconv(.c) c_int {
    return 0;
}

const screen_callbacks = VTermScreenCallbacks{
    .damage = &cb_damage,
    .moverect = &cb_moverect,
    .movecursor = &cb_movecursor,
    .settermprop = &cb_settermprop,
    .bell = &cb_bell,
    .resize = &cb_resize,
    .sb_pushline = &cb_sb_pushline,
    .sb_popline = &cb_sb_popline,
};

// ── Global instance + module API ────────────────────────────────────

var g_vterm: ?VTerm = null;
var g_text_buf: [2048]u8 = undefined;

pub fn initVterm(rows: u16, cols: u16) void {
    if (g_vterm != null) {
        g_vterm.?.deinitVterm();
    }
    g_vterm = VTerm.init(rows, cols) catch |err| {
        std.debug.print("[vterm] init failed: {}\n", .{err});
        return;
    };
}

pub fn feed(data: []const u8) void {
    if (g_vterm) |*v| v.feedData(data);
}

pub fn readOutput(buf: []u8) ?[]const u8 {
    if (g_vterm) |*v| return v.readOutputData(buf);
    return null;
}

pub fn getRowText(row: u16) []const u8 {
    if (g_vterm) |*v| return v.getRowText(row, &g_text_buf);
    return g_text_buf[0..0];
}

pub fn getCell(row: u16, col: u16) Cell {
    if (g_vterm) |*v| return v.getCell(row, col);
    return Cell{};
}

pub fn getCursorRow() u16 {
    if (g_vterm) |v| return v.cursor_row;
    return 0;
}

pub fn getCursorCol() u16 {
    if (g_vterm) |v| return v.cursor_col;
    return 0;
}

pub fn getCursorVisible() bool {
    if (g_vterm) |v| return v.cursor_visible;
    return false;
}

pub fn hasDamage() bool {
    if (g_vterm) |v| return v.has_damage;
    return false;
}

pub fn clearDamageState() void {
    if (g_vterm) |*v| v.clearDamage();
}

pub fn getRows() u16 {
    if (g_vterm) |v| return v.rows;
    return 0;
}

pub fn getCols() u16 {
    if (g_vterm) |v| return v.cols;
    return 0;
}

pub fn resizeVterm(rows: u16, cols: u16) void {
    if (g_vterm) |*v| v.resizeTerminal(rows, cols);
}

// ── Terminal cell painter ───────────────────────────────────────────
// Renders colored cells directly via GPU, bypassing the node tree.
// Called after compositor.frame() in the generated main loop.

const gpu = @import("gpu.zig");

const DEFAULT_FG = Color{ .r = 205, .g = 214, .b = 244 }; // #cdd6f4
const DEFAULT_BG = Color{ .r = 17, .g = 17, .b = 27 }; // #11111b
const CURSOR_COLOR = Color{ .r = 166, .g = 227, .b = 161 }; // #a6e3a1

/// Paint terminal rows with per-row color into a screen region.
/// Uses one drawTextLine per row (24 calls) instead of per-cell (1920 calls).
/// Per-row color comes from the first non-default fg cell in each row.
pub fn paintTerminal(x: f32, y: f32, _: f32, h: f32) void {
    const v = &(g_vterm orelse return);

    const font_size: u16 = 13;
    const char_w: f32 = 7.8;
    const line_h: f32 = 18.0;
    const max_row: u16 = @intFromFloat(@min(@as(f32, @floatFromInt(v.rows)), h / line_h));

    var row_buf: [512]u8 = undefined;
    var cell_buf: VTermScreenCell = .{};

    var row: u16 = 0;
    while (row < max_row) : (row += 1) {
        const cy = y + @as(f32, @floatFromInt(row)) * line_h;

        // Get row text
        const rect = VTermRect{
            .start_row = @intCast(row),
            .end_row = @intCast(row + 1),
            .start_col = 0,
            .end_col = @intCast(v.cols),
        };
        const len = vterm_screen_get_text(v.screen, &row_buf, row_buf.len, rect);
        if (len == 0) continue;

        // Trim trailing spaces
        var text_end: usize = len;
        while (text_end > 0 and row_buf[text_end - 1] == ' ') text_end -= 1;
        if (text_end == 0) continue;

        // Find dominant fg color (first non-default fg in this row)
        var row_color = DEFAULT_FG;
        var col: u16 = 0;
        while (col < v.cols) : (col += 1) {
            const pos = VTermPos{ .row = @intCast(row), .col = @intCast(col) };
            _ = vterm_screen_get_cell(v.screen, pos, &cell_buf);
            if (cell_buf.chars[0] > 0x20) { // non-space character
                if (resolveColor(v.screen, &cell_buf.fg)) |fg| {
                    row_color = fg;
                    break;
                }
            }
        }

        gpu.drawTextLine(
            row_buf[0..text_end],
            x, cy,
            font_size,
            @as(f32, @floatFromInt(row_color.r)) / 255.0,
            @as(f32, @floatFromInt(row_color.g)) / 255.0,
            @as(f32, @floatFromInt(row_color.b)) / 255.0,
            1.0,
        );
    }

    // Cursor
    if (v.cursor_visible and v.cursor_row < max_row) {
        const cursor_x = x + @as(f32, @floatFromInt(v.cursor_col)) * char_w;
        const cursor_y = y + @as(f32, @floatFromInt(v.cursor_row)) * line_h;
        gpu.drawRect(
            cursor_x, cursor_y, char_w, line_h,
            @as(f32, @floatFromInt(CURSOR_COLOR.r)) / 255.0,
            @as(f32, @floatFromInt(CURSOR_COLOR.g)) / 255.0,
            @as(f32, @floatFromInt(CURSOR_COLOR.b)) / 255.0,
            0.5,
            0, 0, 0, 0, 0, 0,
        );
    }
}

pub fn deinit() void {
    if (g_vterm) |*v| {
        v.deinitVterm();
        g_vterm = null;
    }
}
