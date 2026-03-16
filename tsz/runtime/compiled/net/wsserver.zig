//! WebSocket server — non-blocking, multi-client, broadcast + unicast.
//!
//! Port of love2d/lua/wsserver.lua. Accepts connections, performs HTTP
//! upgrade handshake, then frames flow. Non-blocking poll each frame.
//!
//! Usage:
//!   var server = try wsserver.listen(8080);
//!   // each frame:
//!   var events: [32]wsserver.ServerEvent = undefined;
//!   const n = server.update(&events);
//!   for (events[0..n]) |ev| { ... }
//!   server.broadcast("hello everyone");
//!   server.send(client_id, "hello you");
//!   server.close();

const std = @import("std");

// ── Constants ────────────────────────────────────────────────────────────

const MAGIC_GUID = "258EAFA5-E914-47DA-95CA-5AB515859764";
const MAX_CLIENTS = 64;
const MAX_MSG = 65536;
const MAX_HDR = 4096;

// ── Public types ─────────────────────────────────────────────────────────

pub const ServerEventType = enum {
    client_connected,
    client_message,
    client_disconnected,
};

pub const ServerEvent = struct {
    client_id: u32 = 0,
    event_type: ServerEventType = .client_connected,
    data: [MAX_MSG]u8 = undefined,
    data_len: usize = 0,

    pub fn dataSlice(self: *const ServerEvent) []const u8 {
        return self.data[0..self.data_len];
    }
};

const ClientStatus = enum { handshake, open, closed };

const Client = struct {
    active: bool = false,
    id: u32 = 0,
    stream: ?std.net.Stream = null,
    status: ClientStatus = .closed,
    handshake_buf: [MAX_HDR]u8 = undefined,
    handshake_len: usize = 0,
    read_buf: [MAX_MSG]u8 = undefined,
    read_len: usize = 0,
};

// ── Server ───────────────────────────────────────────────────────────────

pub const WsServer = struct {
    listener: std.posix.socket_t,
    clients: [MAX_CLIENTS]Client = [_]Client{.{}} ** MAX_CLIENTS,
    next_client_id: u32 = 1,
    event_buf: [64]ServerEvent = undefined,
    event_count: usize = 0,

    /// Start listening on a port.
    pub fn listen(port: u16) !WsServer {
        const addr = try std.net.Address.parseIp4("0.0.0.0", port);
        const fd = try std.posix.socket(addr.any.family, std.posix.SOCK.STREAM | std.posix.SOCK.NONBLOCK, 0);
        errdefer std.posix.close(fd);

        // SO_REUSEADDR
        const optval: c_int = 1;
        try std.posix.setsockopt(fd, std.posix.SOL.SOCKET, std.posix.SO.REUSEADDR, std.mem.asBytes(&optval));

        try std.posix.bind(fd, &addr.any, addr.getOsSockLen());
        try std.posix.listen(fd, 16);

        return WsServer{ .listener = fd };
    }

    /// Non-blocking poll. Call once per frame. Returns event count.
    pub fn update(self: *WsServer, out: []ServerEvent) usize {
        self.event_count = 0;

        // Accept new connections
        self.acceptClients(out);

        // Process existing clients
        for (&self.clients) |*client| {
            if (!client.active) continue;
            switch (client.status) {
                .handshake => self.processHandshake(client, out),
                .open => self.processFrames(client, out),
                .closed => {},
            }
        }

        return @min(self.event_count, out.len);
    }

    /// Send to a specific client.
    pub fn send(self: *WsServer, client_id: u32, data: []const u8) void {
        for (&self.clients) |*client| {
            if (client.active and client.id == client_id and client.status == .open) {
                if (client.stream) |stream| {
                    writeServerFrameWithOpcode(stream, 0x81, data) catch {
                        client.status = .closed;
                        client.active = false;
                    };
                }
                return;
            }
        }
    }

    /// Broadcast to all connected clients.
    pub fn broadcast(self: *WsServer, data: []const u8) void {
        for (&self.clients) |*client| {
            if (client.active and client.status == .open) {
                if (client.stream) |stream| {
                    writeServerFrameWithOpcode(stream, 0x81, data) catch {
                        client.status = .closed;
                        client.active = false;
                    };
                }
            }
        }
    }

    /// Shut down the server and all clients.
    pub fn close(self: *WsServer) void {
        for (&self.clients) |*client| {
            if (client.active) {
                if (client.stream) |s| s.close();
                client.active = false;
            }
        }
        std.posix.close(self.listener);
    }

    // ── Internal ─────────────────────────────────────────────────────

    fn acceptClients(self: *WsServer, out: []ServerEvent) void {
        // Try to accept (non-blocking)
        while (true) {
            const accepted = std.posix.accept(self.listener, null, null, std.posix.SOCK.NONBLOCK) catch break;
            const slot = self.findClientSlot() orelse {
                std.posix.close(accepted);
                break;
            };
            self.clients[slot] = .{
                .active = true,
                .id = self.next_client_id,
                .stream = .{ .handle = accepted },
                .status = .handshake,
            };
            self.next_client_id += 1;
            _ = out;
        }
    }

    fn processHandshake(self: *WsServer, client: *Client, out: []ServerEvent) void {
        const stream = client.stream orelse return;
        // Read HTTP upgrade request
        const n = stream.read(client.handshake_buf[client.handshake_len..]) catch |err| {
            if (err == error.WouldBlock) return;
            client.status = .closed;
            client.active = false;
            return;
        };
        if (n == 0) {
            client.status = .closed;
            client.active = false;
            return;
        }
        client.handshake_len += n;

        // Check for complete headers
        const headers = client.handshake_buf[0..client.handshake_len];
        if (std.mem.indexOf(u8, headers, "\r\n\r\n") == null) return;

        // Extract Sec-WebSocket-Key
        const key = extractHeader(headers, "Sec-WebSocket-Key: ") orelse {
            client.status = .closed;
            client.active = false;
            return;
        };

        // Compute accept hash: SHA1(key + MAGIC_GUID) base64
        var hasher = std.crypto.hash.Sha1.init(.{});
        hasher.update(key);
        hasher.update(MAGIC_GUID);
        const digest = hasher.finalResult();
        const accept = std.base64.standard.Encoder.encode(&([_]u8{0} ** 28), &digest);

        // Send 101 response
        const writer = stream.writer();
        writer.print(
            "HTTP/1.1 101 Switching Protocols\r\n" ++
                "Upgrade: websocket\r\n" ++
                "Connection: Upgrade\r\n" ++
                "Sec-WebSocket-Accept: {s}\r\n\r\n",
            .{accept},
        ) catch {
            client.status = .closed;
            client.active = false;
            return;
        };

        client.status = .open;
        self.pushEvent(out, client.id, .client_connected, "");
    }

    fn processFrames(self: *WsServer, client: *Client, out: []ServerEvent) void {
        const stream = client.stream orelse return;

        // Read available data
        if (client.read_len < MAX_MSG) {
            const n = stream.read(client.read_buf[client.read_len..]) catch |err| {
                if (err == error.WouldBlock) {
                    if (client.read_len >= 2) self.tryParseClientFrame(client, out);
                    return;
                }
                self.pushEvent(out, client.id, .client_disconnected, "");
                client.status = .closed;
                client.active = false;
                return;
            };
            if (n == 0) {
                self.pushEvent(out, client.id, .client_disconnected, "");
                client.status = .closed;
                client.active = false;
                return;
            }
            client.read_len += n;
        }

        self.tryParseClientFrame(client, out);
    }

    fn tryParseClientFrame(self: *WsServer, client: *Client, out: []ServerEvent) void {
        if (client.read_len < 2) return;

        const byte0 = client.read_buf[0];
        const byte1 = client.read_buf[1];
        const opcode = byte0 & 0x0F;
        const masked = (byte1 & 0x80) != 0;
        var payload_len: usize = byte1 & 0x7F;
        var header_len: usize = 2;

        if (payload_len == 126) {
            if (client.read_len < 4) return;
            payload_len = (@as(usize, client.read_buf[2]) << 8) | client.read_buf[3];
            header_len = 4;
        } else if (payload_len == 127) {
            if (client.read_len < 10) return;
            payload_len = 0;
            for (2..10) |i| {
                payload_len = (payload_len << 8) | client.read_buf[i];
            }
            header_len = 10;
        }
        payload_len = @min(payload_len, MAX_MSG);

        var mask_key: [4]u8 = .{ 0, 0, 0, 0 };
        if (masked) {
            if (client.read_len < header_len + 4) return;
            @memcpy(&mask_key, client.read_buf[header_len .. header_len + 4]);
            header_len += 4;
        }

        const total = header_len + payload_len;
        if (client.read_len < total) return;

        // Extract and unmask payload
        var payload: [MAX_MSG]u8 = undefined;
        @memcpy(payload[0..payload_len], client.read_buf[header_len .. header_len + payload_len]);
        if (masked) {
            for (0..payload_len) |i| payload[i] ^= mask_key[i % 4];
        }

        // Consume from buffer
        const remaining = client.read_len - total;
        if (remaining > 0) {
            std.mem.copyForwards(u8, client.read_buf[0..remaining], client.read_buf[total..client.read_len]);
        }
        client.read_len = remaining;

        // Handle opcode
        if (opcode == 1 or opcode == 2) {
            // Text or binary
            self.pushEvent(out, client.id, .client_message, payload[0..payload_len]);
        } else if (opcode == 8) {
            // Close
            self.pushEvent(out, client.id, .client_disconnected, "");
            if (client.stream) |s| s.close();
            client.status = .closed;
            client.active = false;
        } else if (opcode == 9) {
            // Ping → send pong (opcode 0x0A)
            if (client.stream) |s| writeServerFrameWithOpcode(s, 0x8A, payload[0..payload_len]) catch {};
        }
    }

    fn findClientSlot(self: *WsServer) ?usize {
        for (0..MAX_CLIENTS) |i| {
            if (!self.clients[i].active) return i;
        }
        return null;
    }

    fn pushEvent(self: *WsServer, out: []ServerEvent, client_id: u32, event_type: ServerEventType, data: []const u8) void {
        if (self.event_count >= out.len) return;
        var ev = &out[self.event_count];
        ev.client_id = client_id;
        ev.event_type = event_type;
        const dlen = @min(data.len, MAX_MSG);
        if (dlen > 0) @memcpy(ev.data[0..dlen], data[0..dlen]);
        ev.data_len = dlen;
        self.event_count += 1;
    }
};

// ── Helpers ──────────────────────────────────────────────────────────────

fn extractHeader(headers: []const u8, name: []const u8) ?[]const u8 {
    var pos: usize = 0;
    while (pos < headers.len) {
        if (std.mem.startsWith(u8, headers[pos..], name)) {
            const start = pos + name.len;
            const end = std.mem.indexOf(u8, headers[start..], "\r\n") orelse (headers.len - start);
            return headers[start .. start + end];
        }
        // Skip to next line
        if (std.mem.indexOf(u8, headers[pos..], "\r\n")) |nl| {
            pos += nl + 2;
        } else break;
    }
    return null;
}

/// Write an unmasked server→client frame with a specific first byte (FIN+opcode).
fn writeServerFrameWithOpcode(stream: std.net.Stream, first_byte: u8, payload: []const u8) !void {
    const writer = stream.writer();
    try writer.writeByte(first_byte);
    if (payload.len > 65535) {
        try writer.writeByte(127);
        var len_bytes: [8]u8 = undefined;
        std.mem.writeInt(u64, &len_bytes, payload.len, .big);
        try writer.writeAll(&len_bytes);
    } else if (payload.len > 125) {
        try writer.writeByte(126);
        var len_bytes: [2]u8 = undefined;
        std.mem.writeInt(u16, &len_bytes, @intCast(payload.len), .big);
        try writer.writeAll(&len_bytes);
    } else {
        try writer.writeByte(@intCast(payload.len));
    }
    try writer.writeAll(payload);
}
