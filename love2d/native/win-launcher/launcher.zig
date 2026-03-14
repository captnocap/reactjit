//! ReactJIT Windows Self-Extracting Launcher
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

fn showError(comptime fmt: []const u8, args: anytype) void {
    var msg_buf: [512]u8 = undefined;
    const msg = std.fmt.bufPrintZ(&msg_buf, fmt, args) catch "ReactJIT failed to start.";
    _ = MessageBoxA(null, msg.ptr, "ReactJIT", 0x10);
}

pub fn main() void {
    run() catch {};
}

fn run() !void {
    var gpa = std.heap.GeneralPurposeAllocator(.{}){};
    defer _ = gpa.deinit();
    const allocator = gpa.allocator();

    // ── 1. Open self ─────────────────────────────────────────────────────────
    // Try GetModuleFileNameW first (native Windows), fall back to argv[0] (Wine/Proton).
    var self_path_buf: [std.fs.max_path_bytes]u8 = undefined;
    const self_path = std.fs.selfExePath(&self_path_buf) catch blk: {
        // Wine/Proton don't implement GetModuleFileNameW reliably.
        // Fall back to argv[0] which they do handle.
        var args = std.process.argsWithAllocator(allocator) catch |err| {
            showError("Step 1a: no selfExePath and no argv: {}", .{err});
            return err;
        };
        defer args.deinit();
        const arg0 = args.next() orelse {
            showError("Step 1a: argv empty", .{});
            return error.FileNotFound;
        };
        // Copy into our buffer so lifetime outlasts args iterator
        const len = @min(arg0.len, self_path_buf.len - 1);
        @memcpy(self_path_buf[0..len], arg0[0..len]);
        break :blk self_path_buf[0..len];
    };

    const self_file = std.fs.openFileAbsolute(self_path, .{}) catch |err| {
        showError("Step 1b: openFile failed: {}", .{err});
        return err;
    };
    defer self_file.close();

    const file_size = self_file.getEndPos() catch |err| {
        showError("Step 1c: getEndPos failed: {}", .{err});
        return err;
    };
    if (file_size < 8) {
        showError("Step 1d: file too small ({d} bytes)", .{file_size});
        return error.TruncatedPayload;
    }

    // ── 2. Read zip offset from last 8 bytes ─────────────────────────────────
    var offset_buf: [8]u8 = undefined;
    self_file.seekTo(file_size - 8) catch |err| {
        showError("Step 2a: seekTo offset failed: {}", .{err});
        return err;
    };
    _ = self_file.readAll(&offset_buf) catch |err| {
        showError("Step 2b: readAll offset failed: {}", .{err});
        return err;
    };
    const zip_offset = std.mem.readInt(u64, &offset_buf, .little);
    if (zip_offset >= file_size - 8) {
        showError("Step 2c: invalid offset {d} (file size {d})", .{ zip_offset, file_size });
        return error.InvalidPayloadOffset;
    }
    const zip_size = file_size - 8 - zip_offset;

    // ── 3. CRC32 of first 4 KB of the zip for cache key ──────────────────────
    var sample_buf: [4096]u8 = undefined;
    const sample_len: usize = @intCast(@min(zip_size, sample_buf.len));
    self_file.seekTo(zip_offset) catch |err| {
        showError("Step 3a: seekTo zip failed: {}", .{err});
        return err;
    };
    _ = self_file.readAll(sample_buf[0..sample_len]) catch |err| {
        showError("Step 3b: readAll sample failed: {}", .{err});
        return err;
    };
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
        std.fs.makeDirAbsolute(cache_root) catch |err| {
            showError("Step 5a: mkdir cache_root failed: {}", .{err});
            return err;
        };
        std.fs.makeDirAbsolute(cache_dir_path) catch |err| {
            showError("Step 5b: mkdir cache_dir failed: {}", .{err});
            return err;
        };

        // Write embedded zip to a temp file so std.zip can seek within it.
        const tmp_zip_path = try std.fs.path.join(allocator, &.{ cache_root, "_payload.zip" });
        defer allocator.free(tmp_zip_path);

        {
            const tmp = std.fs.createFileAbsolute(tmp_zip_path, .{}) catch |err| {
                showError("Step 5c: createFile payload failed: {}", .{err});
                return err;
            };
            defer tmp.close();

            self_file.seekTo(zip_offset) catch |err| {
                showError("Step 5d: seekTo zip copy failed: {}", .{err});
                return err;
            };
            var copy_buf: [65536]u8 = undefined;
            var remaining: u64 = zip_size;
            while (remaining > 0) {
                const to_read: usize = @intCast(@min(remaining, copy_buf.len));
                const n = self_file.read(copy_buf[0..to_read]) catch |err| {
                    showError("Step 5e: read failed ({d} remaining): {}", .{ remaining, err });
                    return err;
                };
                if (n == 0) {
                    showError("Step 5f: unexpected EOF ({d} remaining)", .{remaining});
                    return error.UnexpectedEOF;
                }
                tmp.writeAll(copy_buf[0..n]) catch |err| {
                    showError("Step 5g: writeAll failed: {}", .{err});
                    return err;
                };
                remaining -= n;
            }
        }

        // Extract.
        {
            var dest = std.fs.openDirAbsolute(cache_dir_path, .{}) catch |err| {
                showError("Step 5h: openDir dest failed: {}", .{err});
                return err;
            };
            defer dest.close();

            const zip_file = std.fs.openFileAbsolute(tmp_zip_path, .{}) catch |err| {
                showError("Step 5i: openFile payload.zip failed: {}", .{err});
                return err;
            };
            defer zip_file.close();

            var read_buf: [65536]u8 = undefined;
            var fr = zip_file.reader(&read_buf);
            std.zip.extract(dest, &fr, .{ .allow_backslashes = true }) catch |err| {
                showError("Step 5j: zip extract failed: {}", .{err});
                return err;
            };
        }

        std.fs.deleteFileAbsolute(tmp_zip_path) catch {};

        // Write .ready marker.
        const ready_file = std.fs.createFileAbsolute(ready_path, .{}) catch |err| {
            showError("Step 5k: create .ready failed: {}", .{err});
            return err;
        };
        ready_file.close();
    }

    // ── 6. Launch the game ───────────────────────────────────────────────────
    const game_exe = try std.fs.path.join(allocator, &.{ cache_dir_path, "game.exe" });
    defer allocator.free(game_exe);

    var child = std.process.Child.init(&.{game_exe}, allocator);
    child.cwd = cache_dir_path;
    child.spawn() catch |err| {
        showError("Step 6: spawn game.exe failed: {}", .{err});
        return err;
    };
    // Don't wait — let the game window take over, launcher exits cleanly.
}
