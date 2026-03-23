//! CartridgeOS init — PID 1 (Zig, static musl)
//!
//! Boots Alpine rootfs, loads virtio-gpu, launches QuickJS.
//! No display server. No X11. No Wayland. Direct DRM/KMS.

const std = @import("std");
const linux = std.os.linux;

// ── Syscall helpers ─────────────────────────────────────────────────────

fn mount(source: [*:0]const u8, target: [*:0]const u8, fstype: [*:0]const u8, flags: u32, data: ?[*:0]const u8) void {
    _ = linux.mount(source, target, fstype, flags, if (data) |d| @intFromPtr(d) else 0);
}

fn mkdir(path: [*:0]const u8) void {
    _ = linux.mkdir(path, 0o755);
}

fn write_all(fd: i32, buf: []const u8) void {
    var written: usize = 0;
    while (written < buf.len) {
        const rc = linux.write(@intCast(fd), buf[written..].ptr, buf[written..].len);
        if (@as(isize, @bitCast(rc)) <= 0) break;
        written += rc;
    }
}

fn puts(msg: []const u8) void {
    write_all(1, msg);
    write_all(1, "\n");
}

fn open_file(path: [*:0]const u8, flags: linux.O) i32 {
    const rc = linux.open(path, flags, 0);
    return if (@as(isize, @bitCast(rc)) < 0) -1 else @intCast(rc);
}

fn close_fd(fd: i32) void {
    _ = linux.close(@intCast(fd));
}

fn dup2(old: i32, new: i32) void {
    _ = linux.dup3(@intCast(old), @intCast(new), 0);
}

fn sleep_us(us: u64) void {
    const ts = linux.timespec{
        .sec = @intCast(us / 1_000_000),
        .nsec = @intCast((us % 1_000_000) * 1000),
    };
    _ = linux.nanosleep(&ts, null);
}

fn access(path: [*:0]const u8) bool {
    const rc = linux.faccessat(linux.AT.FDCWD, path, linux.F_OK, 0);
    return @as(isize, @bitCast(rc)) == 0;
}

fn setenv(key: [*:0]const u8, val: [*:0]const u8) void {
    // For a static musl binary, we write to /proc/self/environ indirectly
    // by using execve's envp. We'll accumulate env and pass to execve.
    _ = key;
    _ = val;
}

// ── Fork + exec helper ──────────────────────────────────────────────────

fn run_wait(argv: [*:null]const ?[*:0]const u8) void {
    const pid_rc = linux.fork();
    const pid: isize = @bitCast(pid_rc);
    if (pid == 0) {
        // child
        _ = linux.execve(argv[0].?, argv, @ptrCast(std.os.environ.ptr));
        linux.exit(1);
    }
    if (pid > 0) {
        var status: u32 = 0;
        _ = linux.wait4(@intCast(pid_rc), &status, 0, null);
    }
}

// ── Main ────────────────────────────────────────────────────────────────

pub fn main() void {
    // ── Mount filesystems ───────────────────────────────────────────────
    mount("proc", "/proc", "proc", 0, null);
    mount("sysfs", "/sys", "sysfs", 0, null);
    mount("devtmpfs", "/dev", "devtmpfs", 0, null);

    // Suppress kernel messages on console
    const printk_fd = open_file("/proc/sys/kernel/printk", .{ .ACCMODE = .WRONLY });
    if (printk_fd >= 0) {
        write_all(printk_fd, "1\n");
        close_fd(printk_fd);
    }

    // Redirect stdio to console
    const con = open_file("/dev/console", .{ .ACCMODE = .RDWR });
    if (con >= 0) {
        dup2(con, 0);
        dup2(con, 1);
        dup2(con, 2);
        if (con > 2) close_fd(con);
    }

    // ── Busybox applets ─────────────────────────────────────────────────
    const bb_argv = [_:null]?[*:0]const u8{ "/bin/busybox", "--install", "-s", "/bin", null };
    run_wait(&bb_argv);

    // ── Banner ──────────────────────────────────────────────────────────
    puts("");
    puts("  CartridgeOS v0.2 (Zig + QuickJS)");
    puts("  Kernel mode — rendering is WASM's job");
    puts("");

    const envp = [_:null]?[*:0]const u8{
        "HOME=/tmp",
        "PATH=/bin:/usr/bin",
        null,
    };

    // ── Network setup ───────────────────────────────────────────────────
    puts("  Configuring network...");
    // Bring up loopback
    const lo_up = [_:null]?[*:0]const u8{ "/bin/ifconfig", "lo", "up", null };
    run_wait(&lo_up);
    // Bring up eth0
    const eth_up = [_:null]?[*:0]const u8{ "/bin/ifconfig", "eth0", "up", null };
    run_wait(&eth_up);
    // DHCP — busybox udhcpc
    const dhcp = [_:null]?[*:0]const u8{ "/bin/udhcpc", "-i", "eth0", "-q", "-s", "/bin/true", null };
    run_wait(&dhcp);
    sleep_us(500_000);
    // Check IP
    const ip_check = [_:null]?[*:0]const u8{ "/bin/ifconfig", "eth0", null };
    run_wait(&ip_check);

    // ── Start HTTP bridge (Zig server using framework/net/httpserver) ───
    // Browser WASM frontend talks to kernel via HTTP on port 8080.
    puts("  Starting HTTP bridge on :8080...");
    const bridge_argv = [_:null]?[*:0]const u8{ "/usr/bin/bridge", null };
    const bridge_pid_rc = linux.fork();
    const bridge_pid: isize = @bitCast(bridge_pid_rc);
    if (bridge_pid == 0) {
        _ = linux.execve(bridge_argv[0].?, &bridge_argv, &envp);
        linux.exit(1);
    }
    if (bridge_pid > 0) {
        puts("  HTTP bridge: running");
    }

    // ── Launch QuickJS ──────────────────────────────────────────────────
    puts("  Launching QuickJS...");
    puts("");

    const qjs_argv = [_:null]?[*:0]const u8{ "/usr/bin/qjs", "/app/main.js", null };

    const pid_rc = linux.fork();
    const pid: isize = @bitCast(pid_rc);
    if (pid == 0) {
        _ = linux.execve(qjs_argv[0].?, &qjs_argv, &envp);
        puts("  [init] execve qjs failed");
        linux.exit(1);
    }

    if (pid > 0) {
        var status: u32 = 0;
        _ = linux.wait4(@intCast(pid_rc), &status, 0, null);
        puts("");
        puts("  [init] QuickJS exited");
    } else {
        puts("  [init] fork failed");
    }

    // ── Fallback shell ──────────────────────────────────────────────────
    puts("  [init] dropping to shell (Ctrl-D to reboot)");
    puts("");
    const sh_argv = [_:null]?[*:0]const u8{ "/bin/sh", null };
    _ = linux.execve(sh_argv[0].?, &sh_argv, &envp);

    // PID 1 must not exit
    while (true) {
        sleep_us(1_000_000);
    }
}
