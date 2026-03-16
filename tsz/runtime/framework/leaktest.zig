//! Intentional memory leak for testing the watchdog.
//! DO NOT use this in real apps.

const std = @import("std");

var total_leaked: u64 = 0;

/// Leak 64MB of memory. Returns total MB leaked.
pub fn leak64() i64 {
    const size: usize = 64 * 1024 * 1024;
    const ptr = std.c.malloc(size);
    if (ptr) |p| {
        // Touch every page so it actually maps into RSS
        const bytes: [*]volatile u8 = @ptrCast(p);
        var i: usize = 0;
        while (i < size) : (i += 4096) {
            bytes[i] = 0xFF;
        }
        total_leaked += 64;
        std.debug.print("[leaktest] Leaked 64MB (total: {d}MB)\n", .{total_leaked});
    }
    return @intCast(total_leaked);
}
