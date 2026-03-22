//! IPC — NDJSON over TCP for inter-process communication.
//!
//! Port of love2d/lua/window_ipc.lua. Provides a lightweight, non-blocking
//! TCP channel using newline-delimited JSON (NDJSON) for message framing.
//!
//! Used by windows.zig for independent (multi-process) windows, but
//! available to any module that needs local IPC.
//!
//! Protocol (matching the Lua implementation):
//!   Parent → Child:
//!     {"type":"init","commands":[...]}       — Initial subtree
//!     {"type":"mutations","commands":[...]}  — Incremental updates
//!     {"type":"resize","width":N,"height":N} — Window resized
//!     {"type":"quit"}                        — Shutdown
//!
//!   Child → Parent:
//!     {"type":"event","payload":{...}}           — Input event
//!     {"type":"windowEvent","handler":"onClose"} — Window lifecycle
//!     {"type":"ready"}                           — Connection established
//!
//! Usage (server / parent side):
//!   var server = try ipc.Server.bind(0);       // port 0 = OS-assigned
//!   const port = server.getPort();             // tell child this port
//!   // per-frame:
//!   server.acceptClient();                     // non-blocking
//!   server.send("{\"type\":\"quit\"}\n");
//!   var msgs = server.poll();                  // returns slice of complete lines
//!   server.close();
//!
//! Usage (client / child side):
//!   var client = try ipc.Client.connect(port);
//!   client.send("{\"type\":\"ready\"}\n");
//!   var msgs = client.poll();
//!   client.close();

const std = @import("std");

// ════════════════════════════════════════════════════════════════════════
// Constants
// ════════════════════════════════════════════════════════════════════════

const MAX_MSG_SIZE = 65536; // max bytes per NDJSON line
const READ_BUF_SIZE = 8192; // per-read chunk

// ════════════════════════════════════════════════════════════════════════
// Message iterator — yields complete NDJSON lines from a buffer
// ════════════════════════════════════════════════════════════════════════

pub const Message = struct {
    data: []const u8, // one complete JSON line (without trailing \n)
};

/// Up to 32 messages per poll cycle.
pub const MAX_MESSAGES_PER_POLL = 32;

// ════════════════════════════════════════════════════════════════════════
// Receive buffer — accumulates partial lines across reads
// ════════════════════════════════════════════════════════════════════════

const RecvBuffer = struct {
    buf: [MAX_MSG_SIZE]u8 = undefined,
    len: usize = 0,

    /// Append raw bytes from a read.
    fn append(self: *RecvBuffer, data: []const u8) void {
        const space = self.buf.len - self.len;
        const n = @min(data.len, space);
        if (n > 0) {
            @memcpy(self.buf[self.len..][0..n], data[0..n]);
            self.len += n;
        }
    }

    /// Extract complete lines (terminated by \n) into the output slice.
    /// Returns how many messages were extracted. Compacts remaining data.
    fn drain(self: *RecvBuffer, out: []Message) usize {
        var count: usize = 0;
        var start: usize = 0;

        for (0..self.len) |i| {
            if (self.buf[i] == '\n') {
                const line = self.buf[start..i];
                if (line.len > 0 and count < out.len) {
                    out[count] = .{ .data = line };
                    count += 1;
                }
                start = i + 1;
            }
        }

        // Compact: move unconsumed bytes to front
        if (start > 0) {
            const remaining = self.len - start;
            if (remaining > 0) {
                std.mem.copyForwards(u8, self.buf[0..remaining], self.buf[start..self.len]);
            }
            self.len = remaining;
        }

        return count;
    }
};

// ════════════════════════════════════════════════════════════════════════
// Server (parent side)
// ════════════════════════════════════════════════════════════════════════

pub const Server = struct {
    listener: std.posix.socket_t,
    client_fd: ?std.posix.socket_t = null,
    recv_buf: RecvBuffer = .{},
    msg_out: [MAX_MESSAGES_PER_POLL]Message = undefined,
    port: u16 = 0,
    dead: bool = false,

    /// Bind a TCP server on localhost. Pass port=0 to let the OS pick a free port.
    pub fn bind(port: u16) !Server {
        const addr = try std.net.Address.parseIp4("127.0.0.1", port);
        const fd = try std.posix.socket(addr.any.family, std.posix.SOCK.STREAM | std.posix.SOCK.NONBLOCK, 0);
        errdefer std.posix.close(fd);

        // SO_REUSEADDR
        const optval: c_int = 1;
        try std.posix.setsockopt(fd, std.posix.SOL.SOCKET, std.posix.SO.REUSEADDR, std.mem.asBytes(&optval));

        try std.posix.bind(fd, &addr.any, addr.getOsSockLen());
        try std.posix.listen(fd, 1); // single client expected

        // Read back the assigned port
        var bound_addr: std.posix.sockaddr = undefined;
        var addr_len: std.posix.socklen_t = @sizeOf(std.posix.sockaddr);
        try std.posix.getsockname(fd, &bound_addr, &addr_len);
        // Extract port from the sockaddr_in
        const sa_in: *const std.posix.sockaddr.in = @ptrCast(@alignCast(&bound_addr));
        const assigned_port = std.mem.bigToNative(u16, sa_in.port);

        return Server{
            .listener = fd,
            .port = assigned_port,
        };
    }

    /// The port the server is listening on.
    pub fn getPort(self: *const Server) u16 {
        return self.port;
    }

    /// Non-blocking accept. Call once per frame. Returns true if a client connected.
    pub fn acceptClient(self: *Server) bool {
        if (self.client_fd != null) return true; // already connected
        const accepted = std.posix.accept(self.listener, null, null, std.posix.SOCK.NONBLOCK) catch return false;
        // TCP_NODELAY
        const optval: c_int = 1;
        std.posix.setsockopt(accepted, std.posix.IPPROTO.TCP, std.posix.TCP.NODELAY, std.mem.asBytes(&optval)) catch {};
        self.client_fd = accepted;
        return true;
    }

    /// Non-blocking poll for messages. Returns a slice of complete NDJSON lines.
    /// Sets self.dead = true if the connection was closed by the remote end.
    pub fn poll(self: *Server) []const Message {
        const fd = self.client_fd orelse return self.msg_out[0..0];
        return pollFd(fd, &self.recv_buf, &self.msg_out, &self.dead);
    }

    /// Send a raw NDJSON line (must include trailing \n).
    pub fn send(self: *Server, data: []const u8) bool {
        const fd = self.client_fd orelse return false;
        return sendAll(fd, data);
    }

    /// Send a message string and append \n.
    pub fn sendLine(self: *Server, line: []const u8) bool {
        if (!self.send(line)) return false;
        return self.send("\n");
    }

    /// Is a client connected?
    pub fn connected(self: *const Server) bool {
        return self.client_fd != null and !self.dead;
    }

    /// Close the server and any connected client.
    pub fn close(self: *Server) void {
        if (self.client_fd) |fd| {
            std.posix.close(fd);
            self.client_fd = null;
        }
        std.posix.close(self.listener);
        self.dead = true;
    }
};

// ════════════════════════════════════════════════════════════════════════
// Client (child side)
// ════════════════════════════════════════════════════════════════════════

pub const Client = struct {
    fd: std.posix.socket_t,
    recv_buf: RecvBuffer = .{},
    msg_out: [MAX_MESSAGES_PER_POLL]Message = undefined,
    dead: bool = false,

    /// Connect to a server on localhost:port. Blocking connect, then sets non-blocking.
    pub fn connect(port: u16) !Client {
        const addr = try std.net.Address.parseIp4("127.0.0.1", port);
        const fd = try std.posix.socket(addr.any.family, std.posix.SOCK.STREAM, 0);
        errdefer std.posix.close(fd);

        try std.posix.connect(fd, &addr.any, addr.getOsSockLen());

        // Set non-blocking after connect (raw POSIX constants for Zig 0.15)
        const F_GETFL: i32 = 3;
        const F_SETFL: i32 = 4;
        const O_NONBLOCK: usize = 0x800;
        const cur_flags = std.posix.fcntl(fd, F_GETFL, @as(usize, 0)) catch 0;
        _ = std.posix.fcntl(fd, F_SETFL, cur_flags | O_NONBLOCK) catch {};

        // TCP_NODELAY
        const optval: c_int = 1;
        std.posix.setsockopt(fd, std.posix.IPPROTO.TCP, std.posix.TCP.NODELAY, std.mem.asBytes(&optval)) catch {};

        return Client{ .fd = fd };
    }

    /// Non-blocking poll for messages.
    pub fn poll(self: *Client) []const Message {
        return pollFd(self.fd, &self.recv_buf, &self.msg_out, &self.dead);
    }

    /// Send a raw NDJSON line (must include trailing \n).
    pub fn send(self: *Client, data: []const u8) bool {
        return sendAll(self.fd, data);
    }

    /// Send a message string and append \n.
    pub fn sendLine(self: *Client, line: []const u8) bool {
        if (!self.send(line)) return false;
        return self.send("\n");
    }

    /// Close the connection.
    pub fn close(self: *Client) void {
        std.posix.close(self.fd);
        self.dead = true;
    }
};

// ════════════════════════════════════════════════════════════════════════
// Shared helpers
// ════════════════════════════════════════════════════════════════════════

/// Non-blocking read + line extraction on a socket fd.
fn pollFd(
    fd: std.posix.socket_t,
    recv_buf: *RecvBuffer,
    msg_out: []Message,
    dead: *bool,
) []const Message {
    // Read all available data
    var tmp: [READ_BUF_SIZE]u8 = undefined;
    while (true) {
        const n = std.posix.read(fd, &tmp) catch |err| switch (err) {
            error.WouldBlock => break,
            else => {
                dead.* = true;
                break;
            },
        };
        if (n == 0) {
            dead.* = true; // EOF — remote closed
            break;
        }
        recv_buf.append(tmp[0..n]);
    }

    // Extract complete lines
    const count = recv_buf.drain(msg_out);
    return msg_out[0..count];
}

/// Blocking write-all on a socket fd. Returns false on error.
fn sendAll(fd: std.posix.socket_t, data: []const u8) bool {
    var written: usize = 0;
    while (written < data.len) {
        const n = std.posix.write(fd, data[written..]) catch return false;
        if (n == 0) return false;
        written += n;
    }
    return true;
}
