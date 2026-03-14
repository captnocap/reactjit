//! Watchdog — RSS leak guard for development
//!
//! Checks /proc/self/statm every ~60 frames. If RSS exceeds the hard
//! limit or grows faster than the rate limit, prints a warning and
//! calls the shutdown callback. Prevents runaway native code from
//! eating all system memory during dev iteration.
//!
//! Usage:
//!   watchdog.init(512); // 512 MB hard limit
//!   // in main loop:
//!   if (watchdog.check()) break; // true = bail out

const std = @import("std");

var hard_limit_mb: u64 = 512;
var frame_count: u64 = 0;
var last_check_rss_kb: u64 = 0;
var last_check_frame: u64 = 0;
var warned: bool = false;
const CHECK_INTERVAL: u64 = 60; // frames (~1 second at 60fps)
const RATE_LIMIT_KB_PER_CHECK: u64 = 50 * 1024; // 50MB per check interval = leak

// Last crash info for BSOD
var last_reason_buf: [256]u8 = undefined;
var last_reason: []const u8 = "";
var last_detail_buf: [512]u8 = undefined;
var last_detail: []const u8 = "";

/// Set the hard RSS limit in MB. Call once at startup.
pub fn init(limit_mb: u64) void {
    hard_limit_mb = limit_mb;
    last_check_rss_kb = getRssKb();
    last_check_frame = 0;
    frame_count = 0;
    warned = false;
    std.debug.print("[watchdog] Armed: {d}MB hard limit, {d}MB/s rate limit\n", .{ limit_mb, RATE_LIMIT_KB_PER_CHECK / 1024 });
}

/// Call once per frame. Returns true if the app should shut down.
pub fn check() bool {
    frame_count += 1;
    if (frame_count - last_check_frame < CHECK_INTERVAL) return false;

    const rss_kb = getRssKb();
    const rss_mb = rss_kb / 1024;

    // Hard limit
    if (rss_mb >= hard_limit_mb) {
        last_reason = std.fmt.bufPrint(&last_reason_buf, "HARD LIMIT: {d}MB >= {d}MB limit", .{ rss_mb, hard_limit_mb }) catch "HARD LIMIT HIT";
        last_detail = std.fmt.bufPrint(&last_detail_buf, "RSS reached {d}MB which exceeds the {d}MB hard limit. This usually means a memory leak — SDL textures, glyph cache copies, or unbounded allocations.", .{ rss_mb, hard_limit_mb }) catch "Memory limit exceeded.";
        std.debug.print("\n[watchdog] {s}\n", .{last_reason});
        return true;
    }

    // Rate limit — detect leaks early
    if (last_check_rss_kb > 0) {
        const delta = if (rss_kb > last_check_rss_kb) rss_kb - last_check_rss_kb else 0;
        if (delta > RATE_LIMIT_KB_PER_CHECK) {
            if (!warned) {
                last_reason = std.fmt.bufPrint(&last_reason_buf, "LEAK DETECTED: +{d}MB in ~1s", .{delta / 1024}) catch "LEAK DETECTED";
                last_detail = std.fmt.bufPrint(&last_detail_buf, "RSS grew from {d}MB to {d}MB in one check interval (~1s). Rate limit is {d}MB/s. Check for per-frame allocations: texture creation, glyph cache copies, or unbounded buffers.", .{ last_check_rss_kb / 1024, rss_mb, RATE_LIMIT_KB_PER_CHECK / 1024 }) catch "Memory growing too fast.";
                std.debug.print("\n[watchdog] {s}\n", .{last_reason});
                warned = true;
                return true;
            }
        }
    }

    last_check_rss_kb = rss_kb;
    last_check_frame = frame_count;
    return false;
}

/// Read current RSS in KB from /proc/self/statm.
fn getRssKb() u64 {
    const file = std.fs.openFileAbsolute("/proc/self/statm", .{}) catch return 0;
    defer file.close();
    var buf: [128]u8 = undefined;
    const len = file.readAll(&buf) catch return 0;
    const content = buf[0..len];

    // statm format: size resident shared text lib data dt (all in pages)
    // We want field 1 (resident)
    var iter = std.mem.splitScalar(u8, content, ' ');
    _ = iter.next(); // skip size
    const resident_str = iter.next() orelse return 0;
    const pages = std.fmt.parseInt(u64, resident_str, 10) catch return 0;
    return pages * 4; // 4KB pages → KB
}

/// Get current RSS in MB (for display).
pub fn getRssMb() u64 {
    return getRssKb() / 1024;
}

/// Get the reason string for the last watchdog trigger.
pub fn getLastReason() []const u8 {
    return if (last_reason.len > 0) last_reason else "Unknown";
}

/// Get the detail string for the last watchdog trigger.
pub fn getLastDetail() []const u8 {
    return if (last_detail.len > 0) last_detail else "No details available.";
}
