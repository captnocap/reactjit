//! Generic comptime table lookup — the kernel's table scanner.
//!
//! All rule files define comptime arrays of structs. This module provides
//! generic lookup functions that work across all rule tables.

const std = @import("std");

/// Find an entry in a comptime table by matching a named string field.
/// Returns the full entry struct or null if not found.
pub fn find(comptime T: type, comptime table: []const T, comptime field: []const u8, key: []const u8) ?T {
    inline for (table) |entry| {
        if (std.mem.eql(u8, @field(entry, field), key)) return entry;
    }
    return null;
}

/// Find and return a specific output field from a comptime table.
/// Equivalent to find(...).?.out_field but avoids the optional unwrap.
pub fn map(comptime T: type, comptime table: []const T, comptime in_field: []const u8, comptime out_field: []const u8, key: []const u8) ?[]const u8 {
    inline for (table) |entry| {
        if (std.mem.eql(u8, @field(entry, in_field), key)) return @field(entry, out_field);
    }
    return null;
}
