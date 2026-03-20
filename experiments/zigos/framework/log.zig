//! Runtime logging — always compiled in, enabled by ZIGOS_LOG env var.
//!
//! Usage in framework code:
//!     const log = @import("log.zig");
//!     log.info(.events, "mouse down at ({d}, {d})", .{mx, my});
//!     log.warn(.state, "slot {d} overflow", .{id});
//!
//! Enable at runtime:
//!     ZIGOS_LOG=all ./app              — everything
//!     ZIGOS_LOG=events,state ./app     — specific categories
//!     (no env var)                     — silent

const std = @import("std");

pub const Category = enum {
    engine,
    events,
    layout,
    state,
    selection,
    gpu,
    geometry,
    text,
    ffi,
    tick,
    render,
};

const NUM_CATEGORIES = @typeInfo(Category).@"enum".fields.len;

var enabled: [NUM_CATEGORIES]bool = [_]bool{false} ** NUM_CATEGORIES;
var initialized: bool = false;

fn ensureInit() void {
    if (initialized) return;
    initialized = true;

    const env = std.posix.getenv("ZIGOS_LOG") orelse return;

    if (std.mem.eql(u8, env, "all")) {
        for (&enabled) |*e| e.* = true;
        return;
    }

    var iter = std.mem.splitScalar(u8, env, ',');
    while (iter.next()) |name| {
        const trimmed = std.mem.trim(u8, name, " ");
        inline for (@typeInfo(Category).@"enum".fields, 0..) |field, i| {
            if (std.mem.eql(u8, trimmed, field.name)) {
                enabled[i] = true;
            }
        }
    }
}

pub fn isEnabled(cat: Category) bool {
    ensureInit();
    return enabled[@intFromEnum(cat)];
}

pub fn info(cat: Category, comptime fmt: []const u8, args: anytype) void {
    ensureInit();
    if (!enabled[@intFromEnum(cat)]) return;
    const name = @tagName(cat);
    std.debug.print("[{s}] " ++ fmt ++ "\n", .{name} ++ args);
}

pub fn warn(cat: Category, comptime fmt: []const u8, args: anytype) void {
    ensureInit();
    if (!enabled[@intFromEnum(cat)]) return;
    const name = @tagName(cat);
    std.debug.print("[{s}] WARN: " ++ fmt ++ "\n", .{name} ++ args);
}

pub fn err(cat: Category, comptime fmt: []const u8, args: anytype) void {
    ensureInit();
    if (!enabled[@intFromEnum(cat)]) return;
    const name = @tagName(cat);
    std.debug.print("[{s}] ERROR: " ++ fmt ++ "\n", .{name} ++ args);
}

// ── Telemetry ────────────────────────────────────────────────────────────

pub fn telemetryEnabledMask() u16 {
    ensureInit();
    var mask: u16 = 0;
    for (0..NUM_CATEGORIES) |i| {
        if (enabled[i]) mask |= @as(u16, 1) << @intCast(i);
    }
    return mask;
}
