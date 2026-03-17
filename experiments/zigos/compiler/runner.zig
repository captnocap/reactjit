//! tsz runner — spawn child processes with captured output
//!
//! Used by the GUI to run build/test/run commands and display live output.
//! Non-blocking pipe reads so the GUI loop doesn't stall.
//!
//! Cross-platform: fcntl on Linux/macOS, SetNamedPipeHandleState on Windows.

const std = @import("std");
const builtin = @import("builtin");
const native_os = builtin.os.tag;
const process = @import("process.zig");
const win32 = if (native_os == .windows) @import("win32.zig") else undefined;

pub const Status = enum { idle, running, success, failed };

const BUFFER_SIZE = 32768;
const MAX_RUNNERS = 4;

pub const Runner = struct {
    child: ?std.process.Child = null,
    output: [BUFFER_SIZE]u8 = undefined,
    output_len: usize = 0,
    status: Status = .idle,
    exit_code: ?u8 = null,
    label: [64]u8 = undefined,
    label_len: u8 = 0,

    pub fn setLabel(self: *Runner, text: []const u8) void {
        const n = @min(text.len, self.label.len);
        @memcpy(self.label[0..n], text[0..n]);
        self.label_len = @intCast(n);
    }

    pub fn getLabel(self: *const Runner) []const u8 {
        return self.label[0..self.label_len];
    }

    pub fn getOutput(self: *const Runner) []const u8 {
        return self.output[0..self.output_len];
    }

    /// Get a timestamp string like "[12:34:56] "
    fn timestamp() [11]u8 {
        const epoch = std.time.timestamp();
        const day_secs: u64 = @intCast(@mod(epoch, 86400));
        const h: u8 = @intCast(day_secs / 3600);
        const m: u8 = @intCast((day_secs % 3600) / 60);
        const s: u8 = @intCast(day_secs % 60);
        var buf: [11]u8 = undefined;
        _ = std.fmt.bufPrint(&buf, "[{d:0>2}:{d:0>2}:{d:0>2}] ", .{ h, m, s }) catch {};
        return buf;
    }

    /// Check if a line is noise that should be filtered out.
    /// Tracks whether we're inside a noise block (GPA trace).
    /// Once we see a noise-starting line, suppress everything until
    /// we see a non-noise line (like [tsz] or a real error).
    var noise_block: bool = false;

    fn isNoiseLine(line: []const u8) bool {
        const trimmed = std.mem.trimLeft(u8, line, &[_]u8{ ' ', '\t' });

        // Always allow [tsz] status lines through — these end noise blocks
        if (std.mem.indexOf(u8, trimmed, "[tsz]") != null) {
            noise_block = false;
            return false;
        }

        // Start of a noise block
        if (std.mem.indexOf(u8, trimmed, "error(gpa):") != null) { noise_block = true; return true; }
        if (std.mem.indexOf(u8, trimmed, "memory address 0x") != null) { noise_block = true; return true; }

        // If we're inside a noise block, suppress everything
        if (noise_block) return true;

        // Stack trace file:line:col patterns
        if (std.mem.indexOf(u8, trimmed, ".zig:") != null and std.mem.indexOf(u8, trimmed, ": 0x") != null) return true;
        if (std.mem.indexOf(u8, trimmed, "/lib/zig/std/") != null) return true;

        // Lines that are just whitespace + caret
        var only_ws_caret = true;
        for (trimmed) |ch| {
            if (ch != ' ' and ch != '^' and ch != '\r' and ch != '\n' and ch != '\t') {
                only_ws_caret = false;
                break;
            }
        }
        if (only_ws_caret and trimmed.len > 0) return true;

        return false;
    }

    /// Append text to the output ring buffer, prepending timestamps to each line.
    /// Filters out noise (GPA leak traces, stack frames from successful builds).
    fn appendOutput(self: *Runner, data: []const u8) void {
        if (data.len == 0) return;
        var pos: usize = 0;
        while (pos < data.len) {
            const nl = std.mem.indexOfScalar(u8, data[pos..], '\n');
            const end = if (nl) |n| pos + n + 1 else data.len;
            const line = data[pos..end];

            // Filter noise
            if (!isNoiseLine(line)) {
                if (self.output_len == 0 or (self.output_len > 0 and self.output[self.output_len - 1] == '\n')) {
                    const ts = timestamp();
                    self.appendRaw(&ts);
                }
                self.appendRaw(line);
            }
            pos = end;
        }
    }

    /// Raw append without timestamps.
    fn appendRaw(self: *Runner, data: []const u8) void {
        if (data.len == 0) return;
        const space = BUFFER_SIZE - self.output_len;
        if (data.len <= space) {
            @memcpy(self.output[self.output_len .. self.output_len + data.len], data);
            self.output_len += data.len;
        } else {
            // Buffer full — shift left to make room
            const shift = data.len - space;
            const keep = self.output_len - shift;
            std.mem.copyForwards(u8, self.output[0..keep], self.output[shift..self.output_len]);
            self.output_len = keep;
            @memcpy(self.output[self.output_len .. self.output_len + data.len], data);
            self.output_len += data.len;
        }
    }

    /// Start a command. Returns true on success.
    pub fn start(self: *Runner, argv: []const []const u8, alloc: std.mem.Allocator) bool {
        self.stop();
        self.output_len = 0;
        self.exit_code = null;
        self.status = .running;

        // Debug: log argv
        std.debug.print("[runner] start: ", .{});
        for (argv) |a| std.debug.print("{s} ", .{a});
        std.debug.print("\n", .{});

        var child = std.process.Child.init(argv, alloc);
        child.stdout_behavior = .Pipe;
        child.stderr_behavior = .Pipe;
        child.spawn() catch |err| {
            var buf: [128]u8 = undefined;
            const msg = std.fmt.bufPrint(&buf, "Failed to start: {}\n", .{err}) catch "Failed to start\n";
            self.appendOutput(msg);
            self.status = .failed;
            return false;
        };
        // Set pipes to non-blocking so poll() doesn't freeze the GUI
        if (child.stdout) |stdout| setNonBlock(stdout.handle);
        if (child.stderr) |stderr| setNonBlock(stderr.handle);
        self.child = child;
        return true;
    }

    /// Set a file descriptor/handle to non-blocking mode.
    fn setNonBlock(handle: anytype) void {
        if (native_os == .windows) {
            var mode: win32.DWORD = win32.PIPE_NOWAIT;
            _ = win32.SetNamedPipeHandleState(handle, &mode, null, null);
        } else {
            const O_NONBLOCK: u32 = 0o4000;
            const flags = std.os.linux.fcntl(handle, std.os.linux.F.GETFL, @as(u32, 0));
            _ = std.os.linux.fcntl(handle, std.os.linux.F.SETFL, flags | O_NONBLOCK);
        }
    }

    /// Read bytes from a pipe handle (cross-platform, non-blocking).
    fn readPipe(handle: anytype, buf: []u8) usize {
        if (native_os == .windows) {
            var bytes_read: win32.DWORD = 0;
            const result = win32.ReadFile(handle, buf.ptr, @intCast(buf.len), &bytes_read, null);
            if (result == 0) return 0;
            return bytes_read;
        } else {
            return std.posix.read(handle, buf) catch 0;
        }
    }

    /// Check if child has exited (non-blocking).
    fn checkChildExited(child: *std.process.Child) ?u8 {
        if (native_os == .windows) {
            var exit_code: win32.DWORD = 0;
            if (win32.GetExitCodeProcess(child.id, &exit_code) == 0) return null;
            if (exit_code == win32.STILL_ACTIVE) return null;
            return @intCast(exit_code & 0xFF);
        } else {
            const result = std.posix.waitpid(child.id, 1); // WNOHANG
            if (result.pid == 0) return null;
            return @intCast((result.status & 0xFF00) >> 8);
        }
    }

    /// Non-blocking read from child pipes. Call each frame.
    pub fn poll(self: *Runner) void {
        if (self.child == null) return;

        // Read stdout (non-blocking)
        if (self.child.?.stdout) |stdout| {
            var buf: [4096]u8 = undefined;
            const n = readPipe(stdout.handle, &buf);
            if (n > 0) self.appendOutput(buf[0..n]);
        }

        // Read stderr (non-blocking)
        if (self.child.?.stderr) |stderr| {
            var buf: [4096]u8 = undefined;
            const n = readPipe(stderr.handle, &buf);
            if (n > 0) self.appendOutput(buf[0..n]);
        }

        // Check if child has exited
        if (self.child) |*child| {
            if (checkChildExited(child)) |exit_ok| {
                // Child exited — drain remaining
                if (child.stdout) |stdout| {
                    var buf: [4096]u8 = undefined;
                    while (true) {
                        const n = readPipe(stdout.handle, &buf);
                        if (n == 0) break;
                        self.appendOutput(buf[0..n]);
                    }
                }
                if (child.stderr) |stderr| {
                    var buf: [4096]u8 = undefined;
                    while (true) {
                        const n = readPipe(stderr.handle, &buf);
                        if (n == 0) break;
                        self.appendOutput(buf[0..n]);
                    }
                }

                self.exit_code = exit_ok;
                self.status = if (exit_ok == 0) .success else .failed;
                self.child = null;
            }
        }
    }

    /// Kill the running child process.
    pub fn stop(self: *Runner) void {
        if (self.child) |*child| {
            if (native_os == .windows) {
                _ = win32.TerminateProcess(child.id, 1);
                std.Thread.sleep(100 * std.time.ns_per_ms);
            } else {
                std.posix.kill(child.id, std.posix.SIG.TERM) catch {};
                std.Thread.sleep(50 * std.time.ns_per_ms);
                std.posix.kill(child.id, std.posix.SIG.KILL) catch {};
                _ = std.posix.waitpid(child.id, 0);
            }
            self.child = null;
            self.status = .idle;
        }
    }

    pub fn isRunning(self: *const Runner) bool {
        return self.status == .running;
    }
};

// ── Global runner pool ──────────────────────────────────────────────────

var runners: [MAX_RUNNERS]Runner = [_]Runner{.{}} ** MAX_RUNNERS;
var runner_count: usize = 0;

/// Get or create a runner for a given label (project + action).
pub fn getRunner(label: []const u8) *Runner {
    // Find existing
    for (0..runner_count) |i| {
        if (std.mem.eql(u8, runners[i].getLabel(), label)) return &runners[i];
    }
    // Allocate new (recycle oldest if full)
    if (runner_count >= MAX_RUNNERS) {
        // Stop oldest and reuse slot 0
        runners[0].stop();
        std.mem.copyForwards(Runner, runners[0 .. MAX_RUNNERS - 1], runners[1..MAX_RUNNERS]);
        runner_count -= 1;
    }
    const idx = runner_count;
    runners[idx] = .{};
    runners[idx].setLabel(label);
    runner_count += 1;
    return &runners[idx];
}

/// Poll all active runners. Call each frame.
pub fn pollAll() void {
    for (0..runner_count) |i| {
        runners[i].poll();
    }
}

/// Get the most recently active runner (for display in detail panel).
pub fn getActive() ?*Runner {
    // Return the last runner that's running, or the last one used
    var best: ?*Runner = null;
    for (0..runner_count) |i| {
        if (runners[i].status == .running) return &runners[i];
        if (runners[i].status != .idle) best = &runners[i];
    }
    return best;
}
