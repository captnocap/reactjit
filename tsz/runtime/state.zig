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

/// A state slot holds a tagged union of possible value types.
/// Phase 1 supports i64 only. Extend with f64, bool, []const u8 later.
pub const Value = union(enum) {
    int: i64,
    float: f64,
    boolean: bool,
};

pub const StateSlot = struct {
    value: Value,
    dirty: bool,
};

var slots: [MAX_SLOTS]StateSlot = undefined;
var slot_count: usize = 0;
var _dirty: bool = false;

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

/// Read an integer state value.
pub fn getSlot(id: usize) i64 {
    return switch (slots[id].value) {
        .int => |v| v,
        .float => |v| @intFromFloat(v),
        .boolean => |v| if (v) @as(i64, 1) else 0,
    };
}

/// Read a float state value.
pub fn getSlotFloat(id: usize) f64 {
    return switch (slots[id].value) {
        .int => |v| @floatFromInt(v),
        .float => |v| v,
        .boolean => |v| if (v) @as(f64, 1.0) else 0.0,
    };
}

/// Read a boolean state value.
pub fn getSlotBool(id: usize) bool {
    return switch (slots[id].value) {
        .int => |v| v != 0,
        .float => |v| v != 0.0,
        .boolean => |v| v,
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

/// Check if any state has changed since last clearDirty().
pub fn isDirty() bool {
    return _dirty;
}

/// Clear the dirty flag after rebuilding the tree.
pub fn clearDirty() void {
    for (0..slot_count) |i| {
        slots[i].dirty = false;
    }
    _dirty = false;
}

/// Reset all state (for testing or hot-reload).
pub fn reset() void {
    slot_count = 0;
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

// ── State persistence for dev mode hot reload ────────────────────────────

const STATE_FILE = "/tmp/tsz-state.bin";

/// Save all state slots to disk. Called before app is killed during dev mode.
pub fn saveState() void {
    const file = std.fs.createFileAbsolute(STATE_FILE, .{}) catch return;
    defer file.close();

    // Write slot count
    const count_bytes: [8]u8 = @bitCast(@as(u64, slot_count));
    file.writeAll(&count_bytes) catch return;

    // Write each slot's i64 value
    for (0..slot_count) |i| {
        const val = getSlot(i);
        const val_bytes: [8]u8 = @bitCast(val);
        file.writeAll(&val_bytes) catch return;
    }
}

/// Load state slots from disk if available. Call after createSlot() calls.
/// Overwrites initial values with saved values (preserves state across reload).
/// Returns true if state was restored.
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
        var val_bytes: [8]u8 = undefined;
        _ = file.readAll(&val_bytes) catch break;
        const val: i64 = @bitCast(val_bytes);
        slots[i].value = .{ .int = val };
    }

    if (restore_count > 0) {
        _dirty = true; // trigger re-render with restored values
        std.debug.print("[state] Restored {d} slots from previous session\n", .{restore_count});
    }
    return restore_count > 0;
}

// ── SIGUSR1 handler for dev mode state save ──────────────────────────────

var _sigusr1_installed = false;

pub fn installSignalHandler() void {
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
