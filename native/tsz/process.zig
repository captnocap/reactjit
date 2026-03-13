//! tsz process management — PID tracking, process lifecycle
//!
//! Each running .tsz project gets a PID file at ~/.config/tsz/pids/<name>.pid.
//! CLI commands are stateless: read PID file, check /proc, act.

const std = @import("std");
const posix = std.posix;
const registry = @import("registry.zig");

pub const Status = enum { running, stopped, stale };

/// Check if a process is alive via kill(pid, 0).
pub fn isRunning(pid: posix.pid_t) bool {
    posix.kill(pid, 0) catch return false;
    return true;
}

/// Build the PID file path for a project name.
fn pidPath(name: []const u8, buf: *[512]u8) []const u8 {
    return std.fmt.bufPrint(buf, "{s}/pids/{s}.pid", .{ registry.configDir(), name }) catch name;
}

/// Read the PID file for a project. Returns null if not found or invalid.
pub fn readPid(name: []const u8) ?posix.pid_t {
    var path_buf: [512]u8 = undefined;
    const path = pidPath(name, &path_buf);

    const file = std.fs.cwd().openFile(path, .{}) catch return null;
    defer file.close();

    var buf: [32]u8 = undefined;
    const len = file.readAll(&buf) catch return null;
    const trimmed = std.mem.trim(u8, buf[0..len], &[_]u8{ ' ', '\n', '\r', '\t' });
    if (trimmed.len == 0) return null;

    return std.fmt.parseInt(posix.pid_t, trimmed, 10) catch null;
}

/// Write PID file for a project.
pub fn writePid(name: []const u8, pid: posix.pid_t) void {
    registry.ensureConfigDir();
    var path_buf: [512]u8 = undefined;
    const path = pidPath(name, &path_buf);

    const file = std.fs.cwd().createFile(path, .{}) catch return;
    defer file.close();

    var num_buf: [20]u8 = undefined;
    const pid_str = std.fmt.bufPrint(&num_buf, "{d}", .{pid}) catch return;
    file.writeAll(pid_str) catch {};
}

/// Remove PID file for a project.
pub fn removePid(name: []const u8) void {
    var path_buf: [512]u8 = undefined;
    const path = pidPath(name, &path_buf);
    std.fs.cwd().deleteFile(path) catch {};
}

/// Get the status of a project by checking its PID file.
pub fn getStatus(name: []const u8) Status {
    const pid = readPid(name) orelse return .stopped;
    if (isRunning(pid)) return .running;
    // PID file exists but process is dead — stale
    removePid(name); // clean up
    return .stale;
}

/// Kill a running project. Sends SIGUSR1 (state save), waits 50ms,
/// then SIGTERM. Removes PID file after.
pub fn killProject(name: []const u8) void {
    const pid = readPid(name) orelse return;
    if (!isRunning(pid)) {
        removePid(name);
        return;
    }

    // Signal state save
    posix.kill(pid, posix.SIG.USR1) catch {};
    std.Thread.sleep(50 * std.time.ns_per_ms);

    // Terminate
    posix.kill(pid, posix.SIG.TERM) catch {};

    // Wait for exit (with 2s timeout)
    var waited: u32 = 0;
    while (waited < 20) : (waited += 1) {
        if (!isRunning(pid)) break;
        std.Thread.sleep(100 * std.time.ns_per_ms);
    }

    // Force kill if still alive
    if (isRunning(pid)) {
        posix.kill(pid, posix.SIG.KILL) catch {};
        std.Thread.sleep(50 * std.time.ns_per_ms);
    }

    // Reap zombie
    _ = posix.waitpid(pid, 0);

    removePid(name);
}

/// Clean up stale PID files for all registered projects.
pub fn cleanStale(reg: *const registry.Registry) void {
    for (0..reg.count) |i| {
        const name = reg.projects[i].getName();
        const status = getStatus(name);
        if (status == .stale) {
            std.debug.print("[tsz] Cleaned stale PID for {s}\n", .{name});
        }
    }
}
