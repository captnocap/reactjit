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
var log_file: ?std.fs.File = null;

fn ensureInit() void {
    if (initialized) return;
    initialized = true;
    std.debug.print("[log] ensureInit called\n", .{});

    if (std.posix.getenv("ZIGOS_LOG_FILE")) |path| {
        log_file = std.fs.createFileAbsolute(path, .{ .truncate = true }) catch |e| blk: {
            std.debug.print("ZIGOS_LOG_FILE open failed: {}\n", .{e});
            break :blk null;
        };
        if (log_file != null) std.debug.print("ZIGOS_LOG_FILE: {s}\n", .{path});
    }

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

/// Write a line to the log file (always, regardless of category filters).
/// Used by engine.zig for unconditional telemetry.
pub fn writeLine(comptime fmt: []const u8, args: anytype) void {
    ensureInit();
    const f = log_file orelse return;
    var buf: [512]u8 = undefined;
    const s = std.fmt.bufPrint(&buf, fmt ++ "\n", args) catch return;
    _ = f.write(s) catch {};
}

pub fn isEnabled(cat: Category) bool {
    ensureInit();
    return enabled[@intFromEnum(cat)];
}

fn fileWrite(s: []const u8) void {
    if (log_file) |f| _ = f.write(s) catch {};
}

pub fn info(cat: Category, comptime fmt: []const u8, args: anytype) void {
    ensureInit();
    if (!enabled[@intFromEnum(cat)]) return;
    const name = @tagName(cat);
    var buf: [1024]u8 = undefined;
    const s = std.fmt.bufPrint(&buf, "[{s}] " ++ fmt ++ "\n", .{name} ++ args) catch return;
    std.debug.print("{s}", .{s});
    fileWrite(s);
}

pub fn warn(cat: Category, comptime fmt: []const u8, args: anytype) void {
    ensureInit();
    if (!enabled[@intFromEnum(cat)]) return;
    const name = @tagName(cat);
    var buf: [1024]u8 = undefined;
    const s = std.fmt.bufPrint(&buf, "[{s}] WARN: " ++ fmt ++ "\n", .{name} ++ args) catch return;
    std.debug.print("{s}", .{s});
    fileWrite(s);
}

pub fn err(cat: Category, comptime fmt: []const u8, args: anytype) void {
    ensureInit();
    if (!enabled[@intFromEnum(cat)]) return;
    const name = @tagName(cat);
    var buf: [1024]u8 = undefined;
    const s = std.fmt.bufPrint(&buf, "[{s}] ERROR: " ++ fmt ++ "\n", .{name} ++ args) catch return;
    std.debug.print("{s}", .{s});
    fileWrite(s);
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
