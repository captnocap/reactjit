//! pty.zig — POSIX PTY spawning + non-blocking I/O
//!
//! Port of love2d/lua/pty.lua. Opens a pseudo-terminal, forks a shell,
//! provides non-blocking bidirectional I/O via the master fd.
//! Linux/macOS only (Windows would need ConPTY).

const std = @import("std");
const vterm_mod = @import("vterm.zig");

// POSIX headers for PTY operations
// _GNU_SOURCE needed for posix_openpt, ptsname_r on glibc
const c = @cImport({
    @cDefine("_GNU_SOURCE", {});
    @cInclude("stdlib.h"); // posix_openpt, grantpt, unlockpt, ptsname_r
    @cInclude("unistd.h"); // fork, setsid, dup2, close, execvp, _exit, read, write
    @cInclude("fcntl.h"); // O_RDWR, O_NOCTTY, O_CLOEXEC, O_NONBLOCK, fcntl, open
    @cInclude("sys/ioctl.h"); // ioctl, TIOCSWINSZ, TIOCSCTTY, struct winsize
    @cInclude("sys/wait.h"); // waitpid, WNOHANG
    @cInclude("signal.h"); // kill, SIGTERM, SIGKILL
});

const EAGAIN: c_int = 11;
const EINTR: c_int = 4;
const EIO: c_int = 5;

fn getErrno() c_int {
    return std.c._errno().*;
}

// ── PTY struct ──────────────────────────────────────────────────────

pub const PTY = struct {
    master_fd: c_int = -1,
    child_pid: c_int = -1,
    closed: bool = true,
    exited: bool = false,
    child_exited: bool = false,
    exit_code: i32 = -1,
    rows: u16 = 24,
    cols: u16 = 80,

    const READ_BUF_SIZE = 8192;

    /// Spawn a shell in a new PTY. Returns the PTY or error.
    pub fn spawn(shell: [*:0]const u8, rows: u16, cols: u16) !PTY {
        // 1. Open PTY master
        const master_fd = c.posix_openpt(c.O_RDWR | c.O_NOCTTY | c.O_CLOEXEC);
        if (master_fd < 0) return error.OpenPTFailed;

        // 2. Grant and unlock slave
        if (c.grantpt(master_fd) != 0) {
            _ = c.close(master_fd);
            return error.GrantPTFailed;
        }
        if (c.unlockpt(master_fd) != 0) {
            _ = c.close(master_fd);
            return error.UnlockPTFailed;
        }

        // 3. Get slave device path (/dev/pts/N)
        var namebuf: [64]u8 = undefined;
        if (c.ptsname_r(master_fd, &namebuf, 64) != 0) {
            _ = c.close(master_fd);
            return error.PtsnameFailed;
        }

        // 4. Fork
        const pid = c.fork();
        if (pid < 0) {
            _ = c.close(master_fd);
            return error.ForkFailed;
        }

        if (pid == 0) {
            // ── CHILD ──────────────────────────────────────────────────
            _ = c.close(master_fd);

            // CRITICAL: create new session BEFORE opening slave
            if (c.setsid() < 0) c._exit(1);

            // Open slave PTY
            const slave_fd = c.open(&namebuf, c.O_RDWR, @as(c_uint, 0));
            if (slave_fd < 0) c._exit(1);

            // CRITICAL: set as controlling terminal (arg=0: only if session has none)
            _ = c.ioctl(slave_fd, c.TIOCSCTTY, @as(c_int, 0));

            // Redirect stdio to slave
            _ = c.dup2(slave_fd, 0);
            _ = c.dup2(slave_fd, 1);
            _ = c.dup2(slave_fd, 2);
            if (slave_fd > 2) _ = c.close(slave_fd);

            // Set TERM (don't overwrite if already set)
            _ = c.setenv("TERM", "xterm-256color", 0);

            // exec shell
            var argv = [_][*c]u8{ @constCast(@ptrCast(shell)), null };
            _ = c.execvp(shell, @ptrCast(&argv));

            // Only reached if exec failed
            c._exit(127);
        }

        // ── PARENT ─────────────────────────────────────────────────────

        // Set initial window size BEFORE child renders first prompt
        var ws = c.winsize{
            .ws_row = rows,
            .ws_col = cols,
            .ws_xpixel = 0,
            .ws_ypixel = 0,
        };
        _ = c.ioctl(master_fd, c.TIOCSWINSZ, &ws);

        // Set master to non-blocking
        const flags = c.fcntl(master_fd, c.F_GETFL);
        if (flags >= 0) {
            _ = c.fcntl(master_fd, c.F_SETFL, flags | c.O_NONBLOCK);
        }

        return PTY{
            .master_fd = master_fd,
            .child_pid = pid,
            .closed = false,
            .rows = rows,
            .cols = cols,
        };
    }

    /// Non-blocking drain: returns all currently available output, or null.
    pub fn read(self: *PTY, buf: []u8) ?[]const u8 {
        if (self.closed or self.master_fd < 0) return null;

        var total: usize = 0;
        while (total < buf.len) {
            const n = c.read(self.master_fd, @ptrCast(buf.ptr + total), buf.len - total);
            if (n > 0) {
                total += @intCast(@as(usize, @intCast(n)));
            } else if (n == 0) {
                self.child_exited = true;
                break;
            } else {
                const e = getErrno();
                if (e == EAGAIN or e == EINTR) {
                    break;
                } else if (e == EIO) {
                    self.child_exited = true;
                    break;
                } else {
                    break;
                }
            }
        }

        if (total == 0) return null;
        return buf[0..total];
    }

    /// Write data to PTY master (keyboard input to shell).
    pub fn write(self: *PTY, data: []const u8) !void {
        if (self.closed or self.master_fd < 0) return error.PTYClosed;
        if (data.len == 0) return;

        var written: usize = 0;
        while (written < data.len) {
            const n = c.write(self.master_fd, @ptrCast(data.ptr + written), data.len - written);
            if (n < 0) {
                const e = getErrno();
                if (e == EAGAIN or e == EINTR) continue;
                if (e == EIO) {
                    self.child_exited = true;
                    return error.ChildExited;
                }
                return error.WriteFailed;
            }
            written += @intCast(@as(usize, @intCast(n)));
        }
    }

    /// Resize terminal and send SIGWINCH to child.
    pub fn resize(self: *PTY, new_rows: u16, new_cols: u16) void {
        if (self.closed or self.master_fd < 0) return;
        self.rows = new_rows;
        self.cols = new_cols;
        var ws = c.winsize{
            .ws_row = new_rows,
            .ws_col = new_cols,
            .ws_xpixel = 0,
            .ws_ypixel = 0,
        };
        _ = c.ioctl(self.master_fd, c.TIOCSWINSZ, &ws);
    }

    /// Non-blocking liveness check.
    pub fn alive(self: *PTY) bool {
        if (self.closed or self.exited) return false;

        var status: c_int = 0;
        if (self.child_exited) {
            const ret = c.waitpid(self.child_pid, &status, c.WNOHANG);
            if (ret == self.child_pid or ret < 0) {
                self.exited = true;
                self.exit_code = @intCast(@as(u32, @bitCast(status)) >> 8 & 0xFF);
                return false;
            }
            return true;
        }

        const ret = c.waitpid(self.child_pid, &status, c.WNOHANG);
        if (ret == 0) return true;
        if (ret == self.child_pid) {
            self.exited = true;
            self.exit_code = @intCast(@as(u32, @bitCast(status)) >> 8 & 0xFF);
            return false;
        }
        self.exited = true;
        return false;
    }

    /// Close PTY and reap child. Safe to call multiple times.
    pub fn close(self: *PTY) void {
        if (self.closed) return;
        self.closed = true;

        // Closing master sends SIGHUP to child's process group
        if (self.master_fd >= 0) {
            _ = c.close(self.master_fd);
            self.master_fd = -1;
        }

        if (!self.exited) {
            var status: c_int = 0;
            var ret = c.waitpid(self.child_pid, &status, c.WNOHANG);
            if (ret == 0) {
                // Child still running: SIGTERM, then SIGKILL
                _ = c.kill(self.child_pid, c.SIGTERM);
                var i: u32 = 0;
                while (i < 200) : (i += 1) {
                    ret = c.waitpid(self.child_pid, &status, c.WNOHANG);
                    if (ret != 0) break;
                }
                if (ret == 0) {
                    _ = c.kill(self.child_pid, c.SIGKILL);
                    _ = c.waitpid(self.child_pid, &status, 0); // blocking final reap
                }
            }
            self.exited = true;
            self.exit_code = @intCast(@as(u32, @bitCast(status)) >> 8 & 0xFF);
        }
    }
};

// ── Global instance + module API ────────────────────────────────────

var g_pty: PTY = .{};
var g_read_buf: [PTY.READ_BUF_SIZE]u8 = undefined;

/// Spawn a shell in a new PTY.
pub fn spawn(shell: [*:0]const u8, rows: u16, cols: u16) void {
    if (!g_pty.closed) g_pty.close();
    g_pty = PTY.spawn(shell, rows, cols) catch |err| {
        std.debug.print("[pty] spawn failed: {}\n", .{err});
        return;
    };
    std.debug.print("[pty] spawned PID={d} {d}x{d}\n", .{ g_pty.child_pid, cols, rows });
}

/// Poll: read PTY → feed vterm → write back vterm output. Returns true if new data arrived.
pub fn poll() bool {
    if (g_pty.closed) return false;

    const data = g_pty.read(&g_read_buf) orelse return false;
    vterm_mod.feed(data);

    // Write back any vterm output (terminal query responses like device attributes)
    var out_buf: [1024]u8 = undefined;
    if (vterm_mod.readOutput(&out_buf)) |output| {
        g_pty.write(output) catch {};
    }

    return true;
}

/// Write raw bytes to PTY (keyboard input to shell).
pub fn writePty(data: []const u8) void {
    g_pty.write(data) catch {};
}

/// Write a single byte to PTY (for control chars like Ctrl+C = 0x03).
pub fn writeByte(byte: u8) void {
    const buf = [1]u8{byte};
    g_pty.write(&buf) catch {};
}

/// Write an escape sequence string to PTY.
pub fn writeEscape(seq: [*:0]const u8) void {
    const len = std.mem.len(seq);
    g_pty.write(seq[0..len]) catch {};
}

/// Handle a key event from SDL — translate keysym + mods to PTY bytes.
/// Reference: love2d/lua/capabilities/terminal.lua:766-914
pub fn handleKey(sym: c_int, mods: u16) void {
    if (g_pty.closed) return;

    const ctrl = (mods & 0x00C0) != 0; // KMOD_CTRL = LCTRL|RCTRL
    const SCANCODE_MASK: c_int = 1 << 30; // SDL_SCANCODE_TO_KEYCODE

    if (ctrl) {
        // Ctrl + letter → control character (0x01-0x1A)
        if (sym >= 'a' and sym <= 'z') {
            const ctrl_byte: u8 = @intCast(sym - 'a' + 1);
            writeByte(ctrl_byte);
            return;
        }
    }

    // Special keys → escape sequences
    if (sym == '\r') { writePty("\r"); return; }
    if (sym == '\x08') { writePty("\x7f"); return; } // Backspace → DEL
    if (sym == '\t') { writePty("\t"); return; }
    if (sym == '\x7f') { writePty("\x1b[3~"); return; } // Delete
    if (sym == '\x1b') { writePty("\x1b"); return; } // Escape

    // Arrow keys, Home/End, PgUp/PgDown (SDL_SCANCODE_TO_KEYCODE range)
    if (sym >= SCANCODE_MASK) {
        const sc = sym & ~SCANCODE_MASK;
        switch (sc) {
            79 => writePty("\x1b[C"), // RIGHT
            80 => writePty("\x1b[D"), // LEFT
            81 => writePty("\x1b[B"), // DOWN
            82 => writePty("\x1b[A"), // UP
            74 => writePty("\x1b[H"), // HOME
            77 => writePty("\x1b[F"), // END
            75 => writePty("\x1b[5~"), // PAGEUP
            78 => writePty("\x1b[6~"), // PAGEDOWN
            73 => writePty("\x1b[2~"), // INSERT
            else => {},
        }
        return;
    }

    // Printable ASCII → write directly (SDL_TEXTINPUT may double)
    if (!ctrl and sym >= 0x20 and sym <= 0x7E) {
        writeByte(@intCast(sym));
    }
}

/// Handle SDL_TEXTINPUT — forward raw text to PTY.
pub fn handleTextInput(text: [*:0]const u8) void {
    if (g_pty.closed) return;
    const len = std.mem.len(text);
    if (len > 0) g_pty.write(text[0..len]) catch {};
}

/// Resize terminal.
pub fn resizePty(rows: u16, cols: u16) void {
    g_pty.resize(rows, cols);
    vterm_mod.resizeVterm(rows, cols);
}

/// Check if child is alive.
pub fn isAlive() bool {
    return g_pty.alive();
}

/// Close PTY and clean up.
pub fn closePty() void {
    g_pty.close();
}

/// Full cleanup (called on app exit).
pub fn deinit() void {
    g_pty.close();
    vterm_mod.deinit();
}
