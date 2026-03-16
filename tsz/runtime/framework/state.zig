//! ReactJIT State System — Task 1: State & Reactivity
//!
//! Compile-time allocated state slots. Each useState() call in .tsz
//! gets a slot ID at compile time. State changes mark dirty, which
//! triggers tree rebuild + re-layout + repaint in the main loop.
//!
//! Zero heap allocation. Fixed slot array. One dirty flag for the
//! entire state store — any change triggers a full rebuild (correct
//! for small trees, optimize later with per-slot tracking).

const std = @import("std");

pub const MAX_SLOTS = 256;
const STRING_BUF_SIZE = 256;

// ── Array state ─────────────────────────────────────────────────────────

pub const MAX_ARRAY_LEN = 256;
const MAX_ARRAY_SLOTS = 16;

pub const ArraySlot = struct {
    values: [MAX_ARRAY_LEN]i64,
    count: usize,
    dirty: bool,
};

var array_slots: [MAX_ARRAY_SLOTS]ArraySlot = undefined;
var array_slot_count: usize = 0;

/// A state slot holds a tagged union of possible value types.
pub const Value = union(enum) {
    int: i64,
    float: f64,
    boolean: bool,
    string: struct {
        buf: [STRING_BUF_SIZE]u8,
        len: u8,
    },
};

pub const StateSlot = struct {
    value: Value,
    dirty: bool,
};

var slots: [MAX_SLOTS]StateSlot = undefined;
var slot_count: usize = 0;
var _dirty: bool = false;

/// Reserve a contiguous range of slots, all initialized to int(0).
/// Returns the starting index. Used by runtime fragments:
///   const base = state.reserveSlots(panel.SLOT_COUNT);
///   panel.init(base);
/// The fragment's init() then writes typed defaults via setSlot/setSlotFloat/etc.
pub fn reserveSlots(count: usize) usize {
    const base = slot_count;
    std.debug.assert(base + count <= MAX_SLOTS);
    for (0..count) |i| {
        slots[base + i] = .{ .value = .{ .int = 0 }, .dirty = false };
    }
    slot_count += count;
    return base;
}

/// Allocate a new state slot with an initial integer value.
/// Called once per useState() at init time. Returns the slot ID.
pub fn createSlot(initial: i64) usize {
    const id = slot_count;
    std.debug.assert(id < MAX_SLOTS);
    slots[id] = .{
        .value = .{ .int = initial },
        .dirty = false,
    };
    slot_count += 1;
    return id;
}

/// Allocate a new state slot with an initial float value.
pub fn createSlotFloat(initial: f64) usize {
    const id = slot_count;
    std.debug.assert(id < MAX_SLOTS);
    slots[id] = .{
        .value = .{ .float = initial },
        .dirty = false,
    };
    slot_count += 1;
    return id;
}

/// Allocate a new state slot with an initial boolean value.
pub fn createSlotBool(initial: bool) usize {
    const id = slot_count;
    std.debug.assert(id < MAX_SLOTS);
    slots[id] = .{
        .value = .{ .boolean = initial },
        .dirty = false,
    };
    slot_count += 1;
    return id;
}

/// Allocate a new state slot with an initial string value.
pub fn createSlotString(initial: []const u8) usize {
    const id = slot_count;
    std.debug.assert(id < MAX_SLOTS);
    var str_val: Value = .{ .string = .{ .buf = [_]u8{0} ** STRING_BUF_SIZE, .len = 0 } };
    const copy_len: u8 = @intCast(@min(initial.len, STRING_BUF_SIZE));
    @memcpy(str_val.string.buf[0..copy_len], initial[0..copy_len]);
    str_val.string.len = copy_len;
    slots[id] = .{ .value = str_val, .dirty = false };
    slot_count += 1;
    return id;
}

/// Read a string state value. Returns empty string for non-string slots.
pub fn getSlotString(id: usize) []const u8 {
    return switch (slots[id].value) {
        .string => |*s| s.buf[0..s.len],
        else => "",
    };
}

/// Set a string state value. Marks dirty if changed.
pub fn setSlotString(id: usize, val: []const u8) void {
    const current = getSlotString(id);
    if (!std.mem.eql(u8, current, val)) {
        var str_val: Value = .{ .string = .{ .buf = [_]u8{0} ** STRING_BUF_SIZE, .len = 0 } };
        const copy_len: u8 = @intCast(@min(val.len, STRING_BUF_SIZE));
        @memcpy(str_val.string.buf[0..copy_len], val[0..copy_len]);
        str_val.string.len = copy_len;
        slots[id].value = str_val;
        slots[id].dirty = true;
        _dirty = true;
    }
}

/// Read an integer state value.
pub fn getSlot(id: usize) i64 {
    return switch (slots[id].value) {
        .int => |v| v,
        .float => |v| @intFromFloat(v),
        .boolean => |v| if (v) @as(i64, 1) else 0,
        .string => 0,
    };
}

/// Read a float state value.
pub fn getSlotFloat(id: usize) f64 {
    return switch (slots[id].value) {
        .int => |v| @floatFromInt(v),
        .float => |v| v,
        .boolean => |v| if (v) @as(f64, 1.0) else 0.0,
        .string => 0.0,
    };
}

/// Read a boolean state value.
pub fn getSlotBool(id: usize) bool {
    return switch (slots[id].value) {
        .int => |v| v != 0,
        .float => |v| v != 0.0,
        .boolean => |v| v,
        .string => |s| s.len > 0,
    };
}

/// Set an integer state value. Marks dirty if changed.
pub fn setSlot(id: usize, val: i64) void {
    const current = getSlot(id);
    if (current != val) {
        slots[id].value = .{ .int = val };
        slots[id].dirty = true;
        _dirty = true;
    }
}

/// Set a float state value. Marks dirty if changed.
pub fn setSlotFloat(id: usize, val: f64) void {
    const current = getSlotFloat(id);
    if (current != val) {
        slots[id].value = .{ .float = val };
        slots[id].dirty = true;
        _dirty = true;
    }
}

/// Set a boolean state value. Marks dirty if changed.
pub fn setSlotBool(id: usize, val: bool) void {
    const current = getSlotBool(id);
    if (current != val) {
        slots[id].value = .{ .boolean = val };
        slots[id].dirty = true;
        _dirty = true;
    }
}

/// Check if a specific slot has changed since last clearDirty().
pub fn slotDirty(id: usize) bool {
    if (id >= slot_count) return false;
    return slots[id].dirty;
}

/// Check if any state has changed since last clearDirty().
pub fn isDirty() bool {
    return _dirty;
}

/// Clear the dirty flag after rebuilding the tree.
pub fn clearDirty() void {
    for (0..slot_count) |i| {
        slots[i].dirty = false;
    }
    for (0..array_slot_count) |i| {
        array_slots[i].dirty = false;
    }
    _dirty = false;
}

/// Reset all state (for testing or hot-reload).
pub fn reset() void {
    slot_count = 0;
    array_slot_count = 0;
    _dirty = false;
}

/// Get current slot count (for debugging).
pub fn slotCount() usize {
    return slot_count;
}

// ── Convenience: increment/decrement for counters ────────────────────────

/// Increment an integer slot by 1. Common pattern for counter state.
pub fn incrementSlot(id: usize) void {
    setSlot(id, getSlot(id) + 1);
}

/// Decrement an integer slot by 1.
pub fn decrementSlot(id: usize) void {
    setSlot(id, getSlot(id) - 1);
}

/// Toggle a boolean slot.
pub fn toggleSlot(id: usize) void {
    setSlotBool(id, !getSlotBool(id));
}

// ── Format helper for dynamic text ───────────────────────────────────────

/// Format a signed integer into a buffer, returning the slice.
/// Used by generated code for template literals like `Count: ${count}`.
pub fn fmtInt(buf: []u8, val: i64) []const u8 {
    return std.fmt.bufPrint(buf, "{d}", .{val}) catch "?";
}

// ── Array state functions ────────────────────────────────────────────────

/// Create a new array state slot with initial values.
pub fn createArraySlot(initial: []const i64) usize {
    const id = array_slot_count;
    std.debug.assert(id < MAX_ARRAY_SLOTS);
    array_slots[id] = .{
        .values = [_]i64{0} ** MAX_ARRAY_LEN,
        .count = initial.len,
        .dirty = false,
    };
    @memcpy(array_slots[id].values[0..initial.len], initial);
    array_slot_count += 1;
    return id;
}

/// Get current array values as a slice.
pub fn getArraySlot(id: usize) []const i64 {
    return array_slots[id].values[0..array_slots[id].count];
}

/// Replace entire array contents.
pub fn setArraySlot(id: usize, values: []const i64) void {
    const new_count = @min(values.len, MAX_ARRAY_LEN);
    @memcpy(array_slots[id].values[0..new_count], values[0..new_count]);
    array_slots[id].count = new_count;
    array_slots[id].dirty = true;
    _dirty = true;
}

/// Append a value to an array slot.
pub fn pushArraySlot(id: usize, value: i64) void {
    if (array_slots[id].count < MAX_ARRAY_LEN) {
        array_slots[id].values[array_slots[id].count] = value;
        array_slots[id].count += 1;
        array_slots[id].dirty = true;
        _dirty = true;
    }
}

/// Remove the last element from an array slot. Returns the removed value (0 if empty).
pub fn popArraySlot(id: usize) i64 {
    if (array_slots[id].count > 0) {
        array_slots[id].count -= 1;
        const val = array_slots[id].values[array_slots[id].count];
        array_slots[id].dirty = true;
        _dirty = true;
        return val;
    }
    return 0;
}

/// Get the current length of an array slot.
pub fn getArrayLen(id: usize) usize {
    return array_slots[id].count;
}

/// Get a single element from an array slot by index.
/// Returns 0 for out-of-bounds access (safe default).
pub fn getArrayElement(id: usize, index: usize) i64 {
    if (index >= array_slots[id].count) return 0;
    return array_slots[id].values[index];
}

/// Set a single element in an array slot by index.
/// No-op for out-of-bounds access.
pub fn setArrayElement(id: usize, index: usize, value: i64) void {
    if (index >= array_slots[id].count) return;
    array_slots[id].values[index] = value;
    array_slots[id].dirty = true;
    _dirty = true;
}

// ── State persistence for dev mode hot reload ────────────────────────────

const STATE_FILE = "/tmp/tsz-state.bin";

/// Save all state slots to disk. Called before app is killed during dev mode.
/// Format: 8-byte slot count, then per slot: 1-byte type tag + value data.
/// Type tags: 0=int, 1=float, 2=bool, 3=string.
/// Breaking change from previous i64-only format — old state files are ignored.
pub fn saveState() void {
    const file = std.fs.createFileAbsolute(STATE_FILE, .{}) catch return;
    defer file.close();

    // Write slot count
    const count_bytes: [8]u8 = @bitCast(@as(u64, slot_count));
    file.writeAll(&count_bytes) catch return;

    // Write each slot with type tag
    for (0..slot_count) |i| {
        switch (slots[i].value) {
            .int => |v| {
                file.writeAll(&[_]u8{0}) catch return;
                const val_bytes: [8]u8 = @bitCast(v);
                file.writeAll(&val_bytes) catch return;
            },
            .float => |v| {
                file.writeAll(&[_]u8{1}) catch return;
                const val_bytes: [8]u8 = @bitCast(v);
                file.writeAll(&val_bytes) catch return;
            },
            .boolean => |v| {
                file.writeAll(&[_]u8{2}) catch return;
                file.writeAll(&[_]u8{if (v) 1 else 0}) catch return;
            },
            .string => |s| {
                file.writeAll(&[_]u8{3}) catch return;
                file.writeAll(&[_]u8{s.len}) catch return;
                file.writeAll(s.buf[0..s.len]) catch return;
            },
        }
    }
}

/// Load state slots from disk if available. Call after createSlot() calls.
/// Overwrites initial values with saved values (preserves state across reload).
/// Returns true if state was restored.
/// Handles typed format (type tag + value). Old i64-only files will fail gracefully.
pub fn loadState() bool {
    const file = std.fs.openFileAbsolute(STATE_FILE, .{}) catch return false;
    defer file.close();
    // Delete the file after reading (one-shot restore)
    defer std.fs.deleteFileAbsolute(STATE_FILE) catch {};

    // Read slot count
    var count_bytes: [8]u8 = undefined;
    _ = file.readAll(&count_bytes) catch return false;
    const saved_count: u64 = @bitCast(count_bytes);

    // Restore values (only up to min of saved and current slot count)
    const restore_count = @min(saved_count, slot_count);
    for (0..restore_count) |i| {
        // Read type tag
        var tag_byte: [1]u8 = undefined;
        _ = file.readAll(&tag_byte) catch break;

        switch (tag_byte[0]) {
            0 => { // int
                var val_bytes: [8]u8 = undefined;
                _ = file.readAll(&val_bytes) catch break;
                const val: i64 = @bitCast(val_bytes);
                slots[i].value = .{ .int = val };
            },
            1 => { // float
                var val_bytes: [8]u8 = undefined;
                _ = file.readAll(&val_bytes) catch break;
                const val: f64 = @bitCast(val_bytes);
                slots[i].value = .{ .float = val };
            },
            2 => { // bool
                var bool_byte: [1]u8 = undefined;
                _ = file.readAll(&bool_byte) catch break;
                slots[i].value = .{ .boolean = bool_byte[0] != 0 };
            },
            3 => { // string
                var len_byte: [1]u8 = undefined;
                _ = file.readAll(&len_byte) catch break;
                const slen: u8 = len_byte[0];
                var str_val: Value = .{ .string = .{ .buf = [_]u8{0} ** STRING_BUF_SIZE, .len = slen } };
                _ = file.read(str_val.string.buf[0..slen]) catch break;
                slots[i].value = str_val;
            },
            else => break, // unknown tag — stop restoring
        }
    }

    if (restore_count > 0) {
        _dirty = true; // trigger re-render with restored values
        std.debug.print("[state] Restored {d} slots from previous session\n", .{restore_count});
    }
    return restore_count > 0;
}

// ── Signal handler for dev mode state save ──────────────────────────────
// POSIX: SIGUSR1 triggers state save before restart.
// Windows: no equivalent signal; state save is triggered by other means.

const builtin = @import("builtin");
var _sigusr1_installed = false;

pub fn installSignalHandler() void {
    if (comptime builtin.os.tag == .windows) return; // no SIGUSR1 on Windows
    if (_sigusr1_installed) return;
    const handler = std.posix.Sigaction{
        .handler = .{ .handler = sigusr1Handler },
        .mask = std.posix.sigemptyset(),
        .flags = 0,
    };
    std.posix.sigaction(std.posix.SIG.USR1, &handler, null);
    _sigusr1_installed = true;
}

fn sigusr1Handler(_: c_int) callconv(.c) void {
    saveState();
}
