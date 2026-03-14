//! tsz runner — spawn child processes with captured output
//!
//! Used by the GUI to run build/test/run commands and display live output.
//! Non-blocking pipe reads so the GUI loop doesn't stall.

const std = @import("std");
const posix = std.posix;
const process = @import("process.zig");

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

    /// Append text to the output ring buffer, prepending timestamps to each line.
    fn appendOutput(self: *Runner, data: []const u8) void {
        if (data.len == 0) return;
        // Prepend timestamp to each newline-delimited chunk
        var pos: usize = 0;
        while (pos < data.len) {
            const nl = std.mem.indexOfScalar(u8, data[pos..], '\n');
            const end = if (nl) |n| pos + n + 1 else data.len;
            // Only timestamp non-empty lines at start of a new line
            if (self.output_len == 0 or (self.output_len > 0 and self.output[self.output_len - 1] == '\n')) {
                const ts = timestamp();
                self.appendRaw(&ts);
            }
            self.appendRaw(data[pos..end]);
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

    /// Set a file descriptor to non-blocking mode.
    fn setNonBlock(fd: posix.fd_t) void {
        const O_NONBLOCK: u32 = 0o4000; // Linux O_NONBLOCK = 04000
        const flags = std.os.linux.fcntl(fd, std.os.linux.F.GETFL, @as(u32, 0));
        _ = std.os.linux.fcntl(fd, std.os.linux.F.SETFL, flags | O_NONBLOCK);
    }

    /// Non-blocking read from child pipes. Call each frame.
    pub fn poll(self: *Runner) void {
        if (self.child == null) return;

        // Read stdout (non-blocking)
        if (self.child.?.stdout) |stdout| {
            var buf: [4096]u8 = undefined;
            const n = posix.read(stdout.handle, &buf) catch 0;
            if (n > 0) self.appendOutput(buf[0..n]);
        }

        // Read stderr (non-blocking)
        if (self.child.?.stderr) |stderr| {
            var buf: [4096]u8 = undefined;
            const n = posix.read(stderr.handle, &buf) catch 0;
            if (n > 0) self.appendOutput(buf[0..n]);
        }

        // Check if child has exited (WNOHANG)
        if (self.child) |*child| {
            const result = posix.waitpid(child.id, 1); // WNOHANG
            if (result.pid != 0) {
                // Child exited — drain remaining
                if (child.stdout) |stdout| {
                    var buf: [4096]u8 = undefined;
                    while (true) {
                        const n = posix.read(stdout.handle, &buf) catch break;
                        if (n == 0) break;
                        self.appendOutput(buf[0..n]);
                    }
                }
                if (child.stderr) |stderr| {
                    var buf: [4096]u8 = undefined;
                    while (true) {
                        const n = posix.read(stderr.handle, &buf) catch break;
                        if (n == 0) break;
                        self.appendOutput(buf[0..n]);
                    }
                }

                const exit_ok = (result.status & 0xFF00) >> 8;
                self.exit_code = @intCast(exit_ok);
                self.status = if (exit_ok == 0) .success else .failed;
                self.child = null;
            }
        }
    }

    /// Kill the running child process.
    pub fn stop(self: *Runner) void {
        if (self.child) |*child| {
            posix.kill(child.id, posix.SIG.TERM) catch {};
            std.Thread.sleep(50 * std.time.ns_per_ms);
            posix.kill(child.id, posix.SIG.KILL) catch {};
            _ = posix.waitpid(child.id, 0);
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
