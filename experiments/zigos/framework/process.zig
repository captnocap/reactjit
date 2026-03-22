//! Process manager — spawn, track, and reap child processes.
//!
//! Standalone module (like pty.zig). Used by windows.zig for independent
//! windows, but available to anything that needs to spawn children.
//!
//! Port of love2d/lua/process_registry.lua — PID file at
//! /tmp/zigos_children_<PARENT_PID> so a watchdog can clean up after crashes.
//!
//! Usage:
//!   var child = try process.spawn(.{ .exe = "./zig-out/bin/zigos-app" });
//!   // ... later ...
//!   if (!child.alive()) { const code = child.exitCode(); ... }
//!   child.kill(.term);  // graceful
//!   child.close();      // reap + deregister

const std = @import("std");
const log = @import("log.zig");

// ════════════════════════════════════════════════════════════════════════
// POSIX externs (libc — linked by build.zig)
// ════════════════════════════════════════════════════════════════════════

extern fn fork() c_int;
extern fn execvp(file: [*:0]const u8, argv: [*]const ?[*:0]const u8) c_int;
extern fn waitpid(pid: c_int, status: *c_int, options: c_int) c_int;
extern fn kill(pid: c_int, sig: c_int) c_int;
extern fn setenv(name: [*:0]const u8, value: [*:0]const u8, overwrite: c_int) c_int;
extern fn chdir(path: [*:0]const u8) c_int;
extern fn close(fd: c_int) c_int;
extern fn _exit(status: c_int) noreturn;
extern fn getpid() c_int;
extern fn open(path: [*:0]const u8, flags: c_int, ...) c_int;
extern fn write(fd: c_int, buf: [*]const u8, count: usize) isize;
extern fn setsid() c_int;

const WNOHANG: c_int = 1;
const SIGTERM: c_int = 15;
const SIGKILL: c_int = 9;
const O_WRONLY: c_int = 1;
const O_CREAT: c_int = 0x40;
const O_TRUNC: c_int = 0x200;

// ════════════════════════════════════════════════════════════════════════
// Process handle
// ════════════════════════════════════════════════════════════════════════

pub const Signal = enum { term, kill_ };

pub const Process = struct {
    pid: c_int,
    closed: bool = false,
    exited: bool = false,
    exit_code: c_int = -1,

    /// Non-blocking liveness check. Reaps zombie if child has exited.
    pub fn alive(self: *Process) bool {
        if (self.closed or self.exited) return false;
        var status: c_int = 0;
        const ret = waitpid(self.pid, &status, WNOHANG);
        if (ret == 0) return true; // still running
        if (ret == self.pid) {
            self.exited = true;
            self.exit_code = (status >> 8) & 0xFF;
            return false;
        }
        // Error (ret < 0) — assume dead
        self.exited = true;
        return false;
    }

    pub fn exitCode(self: *const Process) c_int {
        return self.exit_code;
    }

    /// Send a signal to the child.
    pub fn sendSignal(self: *Process, sig: Signal) void {
        if (self.closed or self.exited) return;
        const s: c_int = switch (sig) {
            .term => SIGTERM,
            .kill_ => SIGKILL,
        };
        _ = kill(self.pid, s);
    }

    /// Graceful shutdown: SIGTERM, spin-wait up to ~200ms, then SIGKILL.
    /// Reaps the zombie. Safe to call multiple times.
    pub fn closeProccess(self: *Process) void {
        if (self.closed) return;
        self.closed = true;

        if (!self.exited) {
            var status: c_int = 0;
            var ret = waitpid(self.pid, &status, WNOHANG);
            if (ret == 0) {
                // Still running — graceful shutdown
                _ = kill(self.pid, SIGTERM);
                // Spin-wait for exit (~200ms)
                for (0..200) |_| {
                    ret = waitpid(self.pid, &status, WNOHANG);
                    if (ret != 0) break;
                    std.Thread.sleep(1 * std.time.ns_per_ms);
                }
                if (ret == 0) {
                    // Force kill
                    _ = kill(self.pid, SIGKILL);
                    _ = waitpid(self.pid, &status, 0); // blocking final reap
                }
            }
            self.exited = true;
            self.exit_code = (status >> 8) & 0xFF;
        }

        // Deregister from the global registry
        deregister(self.pid);
    }
};

// ════════════════════════════════════════════════════════════════════════
// Spawn
// ════════════════════════════════════════════════════════════════════════

pub const EnvVar = struct {
    key: [*:0]const u8,
    value: [*:0]const u8,
};

pub const SpawnOptions = struct {
    /// Executable path (must be a sentinel-terminated string).
    exe: [*:0]const u8,
    /// Arguments (excluding argv[0] which is set to exe). Null-terminated array.
    args: ?[*]const ?[*:0]const u8 = null,
    /// Environment variables to set in the child (additive, not replacing).
    env: []const EnvVar = &.{},
    /// Working directory for the child. Null = inherit parent's cwd.
    cwd: ?[*:0]const u8 = null,
    /// Create a new session (setsid) so the child doesn't share the parent's
    /// controlling terminal. Default true for background children.
    new_session: bool = true,
};

/// Spawn a child process. Returns a Process handle, or error on fork failure.
pub fn spawn(opts: SpawnOptions) !Process {
    const pid = fork();
    if (pid < 0) return error.ForkFailed;

    if (pid == 0) {
        // ── CHILD ──
        if (opts.new_session) _ = setsid();
        if (opts.cwd) |cwd| _ = chdir(cwd);

        // Set additional env vars
        for (opts.env) |ev| {
            _ = setenv(ev.key, ev.value, 1);
        }

        // Build argv: [exe, ...args, null]
        if (opts.args) |args_ptr| {
            // Count args (until null sentinel)
            var argc: usize = 0;
            while (args_ptr[argc] != null) argc += 1;

            // Build full argv on stack (max 32 args)
            var argv_buf: [34]?[*:0]const u8 = undefined;
            argv_buf[0] = opts.exe;
            for (0..argc) |i| {
                if (i + 1 >= 33) break;
                argv_buf[i + 1] = args_ptr[i];
            }
            const total = @min(argc + 1, 33);
            argv_buf[total] = null;
            _ = execvp(opts.exe, &argv_buf);
        } else {
            var argv = [_]?[*:0]const u8{ opts.exe, null };
            _ = execvp(opts.exe, &argv);
        }

        // exec failed
        _exit(127);
    }

    // ── PARENT ──
    register(pid);
    log.info(.engine, "process: spawned PID {d}", .{pid});

    return Process{ .pid = pid };
}

// ════════════════════════════════════════════════════════════════════════
// PID Registry — track all children for crash cleanup
// ════════════════════════════════════════════════════════════════════════

const MAX_CHILDREN = 32;

var registered: [MAX_CHILDREN]c_int = [_]c_int{0} ** MAX_CHILDREN;
var reg_count: usize = 0;
var registry_path_buf: [128]u8 = undefined;
var registry_path_len: usize = 0;
var registry_initialized: bool = false;

fn ensureRegistryInit() void {
    if (registry_initialized) return;
    registry_initialized = true;
    const parent_pid = getpid();
    registry_path_len = (std.fmt.bufPrint(&registry_path_buf, "/tmp/zigos_children_{d}", .{parent_pid}) catch return).len;
}

fn registryPath() ?[*:0]const u8 {
    ensureRegistryInit();
    if (registry_path_len == 0) return null;
    // bufPrint wrote into registry_path_buf — add sentinel
    if (registry_path_len < registry_path_buf.len) {
        registry_path_buf[registry_path_len] = 0;
        return @ptrCast(registry_path_buf[0..registry_path_len]);
    }
    return null;
}

fn register(pid: c_int) void {
    // Deduplicate
    for (0..reg_count) |i| {
        if (registered[i] == pid) return;
    }
    if (reg_count >= MAX_CHILDREN) return;
    registered[reg_count] = pid;
    reg_count += 1;
    writeRegistryFile();
}

fn deregister(pid: c_int) void {
    var write_idx: usize = 0;
    for (0..reg_count) |i| {
        if (registered[i] != pid) {
            registered[write_idx] = registered[i];
            write_idx += 1;
        }
    }
    reg_count = write_idx;
    writeRegistryFile();
}

fn writeRegistryFile() void {
    const path = registryPath() orelse return;
    const fd = open(path, O_WRONLY | O_CREAT | O_TRUNC, @as(c_int, 0o644));
    if (fd < 0) return;
    defer _ = close(fd);

    var buf: [512]u8 = undefined;
    var pos: usize = 0;
    for (0..reg_count) |i| {
        const line = std.fmt.bufPrint(buf[pos..], "{d}\n", .{registered[i]}) catch break;
        pos += line.len;
    }
    if (pos > 0) {
        _ = write(fd, &buf, pos);
    }
}

/// Kill all registered children (SIGTERM → wait 200ms → SIGKILL).
/// Called from engine shutdown and by external watchdogs.
pub fn killAll() void {
    if (reg_count == 0) {
        cleanup();
        return;
    }

    log.info(.engine, "process: killing {d} child process(es)", .{reg_count});

    // SIGTERM first
    for (0..reg_count) |i| {
        _ = kill(registered[i], SIGTERM);
    }

    // Brief wait
    std.Thread.sleep(200 * std.time.ns_per_ms);

    // SIGKILL survivors
    for (0..reg_count) |i| {
        _ = kill(registered[i], SIGKILL);
    }

    // Reap all
    for (0..reg_count) |i| {
        var status: c_int = 0;
        _ = waitpid(registered[i], &status, WNOHANG);
    }

    reg_count = 0;
    cleanup();
}

/// Remove the PID registry file.
pub fn cleanup() void {
    const path = registryPath() orelse return;
    // Use std.fs since we just need to delete a file
    const slice = registry_path_buf[0..registry_path_len];
    std.fs.deleteFileAbsolute(slice) catch {};
    _ = path;
}

/// Return how many children are registered.
pub fn count() usize {
    return reg_count;
}

/// Get a registered PID by index (for telemetry/debug).
pub fn getPid(index: usize) c_int {
    if (index >= reg_count) return -1;
    return registered[index];
}
