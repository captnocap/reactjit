//! iLoveReact Windows Self-Extracting Launcher
//!
//! This is a SUBSYSTEM:WINDOWS stub exe (no console window).
//!
//! Packaging format:
//!   [launcher.exe bytes] [zip payload bytes] [8-byte LE uint64: zip start offset]
//!
//! On first run:
//!   - Reads the embedded zip payload from itself
//!   - Extracts to %LOCALAPPDATA%\reactjit\<crc32_hex>\
//!   - Writes a .ready marker
//! On subsequent runs:
//!   - Checks for .ready marker → skips extraction
//! Then launches game.exe from the cache dir.

const std = @import("std");
const builtin = @import("builtin");

// MessageBoxA lives in user32.dll, not kernel32.
extern "user32" fn MessageBoxA(hWnd: ?*anyopaque, lpText: [*:0]const u8, lpCaption: [*:0]const u8, uType: u32) callconv(.winapi) i32;

pub fn main() void {
    run() catch |err| {
        // SUBSYSTEM:WINDOWS has no console — show an error dialog instead.
        var msg_buf: [256]u8 = undefined;
        const msg = std.fmt.bufPrintZ(&msg_buf, "ReactJIT failed to start: {}", .{err}) catch "ReactJIT failed to start.";
        _ = MessageBoxA(null, msg.ptr, "ReactJIT", 0x10); // MB_ICONERROR
    };
}

fn run() !void {
    var gpa = std.heap.GeneralPurposeAllocator(.{}){};
    defer _ = gpa.deinit();
    const allocator = gpa.allocator();

    // ── 1. Open self ─────────────────────────────────────────────────────────
    var self_path_buf: [std.fs.max_path_bytes]u8 = undefined;
    const self_path = try std.fs.selfExePath(&self_path_buf);

    const self_file = try std.fs.openFileAbsolute(self_path, .{});
    defer self_file.close();

    const file_size = try self_file.getEndPos();
    if (file_size < 8) return error.TruncatedPayload;

    // ── 2. Read zip offset from last 8 bytes ─────────────────────────────────
    var offset_buf: [8]u8 = undefined;
    try self_file.seekTo(file_size - 8);
    _ = try self_file.readAll(&offset_buf);
    const zip_offset = std.mem.readInt(u64, &offset_buf, .little);
    if (zip_offset >= file_size - 8) return error.InvalidPayloadOffset;
    const zip_size = file_size - 8 - zip_offset;

    // ── 3. CRC32 of first 4 KB of the zip for cache key ──────────────────────
    var sample_buf: [4096]u8 = undefined;
    const sample_len: usize = @intCast(@min(zip_size, sample_buf.len));
    try self_file.seekTo(zip_offset);
    _ = try self_file.readAll(sample_buf[0..sample_len]);
    const crc = std.hash.Crc32.hash(sample_buf[0..sample_len]);

    // ── 4. Build cache directory path ─────────────────────────────────────────
    const local_app_data = std.process.getEnvVarOwned(allocator, "LOCALAPPDATA") catch
        try allocator.dupe(u8, "C:\\Temp");
    defer allocator.free(local_app_data);

    const cache_root = try std.fs.path.join(allocator, &.{ local_app_data, "reactjit" });
    defer allocator.free(cache_root);

    const cache_dir_name = try std.fmt.allocPrint(allocator, "{x:0>8}", .{crc});
    defer allocator.free(cache_dir_name);

    const cache_dir_path = try std.fs.path.join(allocator, &.{ cache_root, cache_dir_name });
    defer allocator.free(cache_dir_path);

    const ready_path = try std.fs.path.join(allocator, &.{ cache_dir_path, ".ready" });
    defer allocator.free(ready_path);

    // ── 5. Extract if not already cached ─────────────────────────────────────
    const need_extract = blk: {
        std.fs.accessAbsolute(ready_path, .{}) catch break :blk true;
        break :blk false;
    };

    if (need_extract) {
        // Clean up old cache versions then create fresh dir.
        std.fs.deleteTreeAbsolute(cache_root) catch {};
        try std.fs.makeDirAbsolute(cache_root);
        try std.fs.makeDirAbsolute(cache_dir_path);

        // Write embedded zip to a temp file so std.zip can seek within it.
        const tmp_zip_path = try std.fs.path.join(allocator, &.{ cache_root, "_payload.zip" });
        defer allocator.free(tmp_zip_path);

        {
            const tmp = try std.fs.createFileAbsolute(tmp_zip_path, .{});
            defer tmp.close();

            try self_file.seekTo(zip_offset);
            var copy_buf: [65536]u8 = undefined;
            var remaining: u64 = zip_size;
            while (remaining > 0) {
                const to_read: usize = @intCast(@min(remaining, copy_buf.len));
                const n = try self_file.read(copy_buf[0..to_read]);
                if (n == 0) return error.UnexpectedEOF;
                try tmp.writeAll(copy_buf[0..n]);
                remaining -= n;
            }
        }

        // Extract.
        {
            var dest = try std.fs.openDirAbsolute(cache_dir_path, .{});
            defer dest.close();

            const zip_file = try std.fs.openFileAbsolute(tmp_zip_path, .{});
            defer zip_file.close();

            var read_buf: [65536]u8 = undefined;
            var fr = zip_file.reader(&read_buf);
            try std.zip.extract(dest, &fr, .{ .allow_backslashes = true });
        }

        std.fs.deleteFileAbsolute(tmp_zip_path) catch {};

        // Write .ready marker.
        const ready_file = try std.fs.createFileAbsolute(ready_path, .{});
        ready_file.close();
    }

    // ── 6. Launch the game ───────────────────────────────────────────────────
    const game_exe = try std.fs.path.join(allocator, &.{ cache_dir_path, "game.exe" });
    defer allocator.free(game_exe);

    var child = std.process.Child.init(&.{game_exe}, allocator);
    child.cwd = cache_dir_path;
    try child.spawn();
    // Don't wait — let the game window take over, launcher exits cleanly.
}
