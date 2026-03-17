//! tsz process management — PID tracking, process lifecycle
//!
//! Each running .tsz project gets a PID file at ~/.config/tsz/pids/<name>.pid.
//! CLI commands are stateless: read PID file, check /proc, act.
//!
//! Cross-platform: POSIX signals on Linux/macOS, TerminateProcess on Windows.

const std = @import("std");
const builtin = @import("builtin");
const native_os = builtin.os.tag;
const registry = @import("registry.zig");
const win32 = if (native_os == .windows) @import("win32.zig") else undefined;

pub const Status = enum { running, stopped, stale };

/// Platform-agnostic PID type: pid_t on POSIX, DWORD (u32) on Windows.
pub const PidType = if (native_os == .windows) u32 else std.posix.pid_t;

/// Check if a process is alive.
pub fn isRunning(pid: PidType) bool {
    if (native_os == .windows) {
        const handle = win32.OpenProcess(
            win32.PROCESS_QUERY_LIMITED_INFORMATION,
            0,
            pid,
        ) orelse return false;
        defer win32.closeHandle(handle);
        var exit_code: win32.DWORD = 0;
        if (win32.GetExitCodeProcess(handle, &exit_code) == 0) return false;
        return exit_code == win32.STILL_ACTIVE;
    } else {
        std.posix.kill(pid, 0) catch return false;
        return true;
    }
}

/// Build the PID file path for a project name.
fn pidPath(name: []const u8, buf: *[512]u8) []const u8 {
    const sep = if (native_os == .windows) "\\" else "/";
    return std.fmt.bufPrint(buf, "{s}" ++ sep ++ "pids" ++ sep ++ "{s}.pid", .{ registry.configDir(), name }) catch name;
}

/// Read the PID file for a project. Returns null if not found or invalid.
pub fn readPid(name: []const u8) ?PidType {
    var path_buf: [512]u8 = undefined;
    const path = pidPath(name, &path_buf);

    const file = std.fs.cwd().openFile(path, .{}) catch return null;
    defer file.close();

    var buf: [32]u8 = undefined;
    const len = file.readAll(&buf) catch return null;
    const trimmed = std.mem.trim(u8, buf[0..len], &[_]u8{ ' ', '\n', '\r', '\t' });
    if (trimmed.len == 0) return null;

    return std.fmt.parseInt(PidType, trimmed, 10) catch null;
}

/// Write PID file for a project.
pub fn writePid(name: []const u8, pid: PidType) void {
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

/// Kill a running project.
/// POSIX: Sends SIGUSR1 (state save), waits 50ms, then SIGTERM.
/// Windows: TerminateProcess (no graceful signal equivalent).
pub fn killProject(name: []const u8) void {
    const pid = readPid(name) orelse return;
    if (!isRunning(pid)) {
        removePid(name);
        return;
    }

    if (native_os == .windows) {
        const handle = win32.OpenProcess(
            win32.PROCESS_TERMINATE,
            0,
            pid,
        ) orelse {
            removePid(name);
            return;
        };
        defer win32.closeHandle(handle);
        _ = win32.TerminateProcess(handle, 1);

        // Wait for exit (2s timeout)
        var waited: u32 = 0;
        while (waited < 20) : (waited += 1) {
            if (!isRunning(pid)) break;
            std.Thread.sleep(100 * std.time.ns_per_ms);
        }
    } else {
        const posix = std.posix;
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
    }

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
