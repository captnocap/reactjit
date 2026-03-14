//! Network Manager — connection registry with auto-reconnect and .onion routing.
//!
//! Port of love2d/lua/network.lua. Central registry for WebSocket connections
//! with automatic reconnection backoff and Tor proxy detection for .onion hosts.
//!
//! Usage:
//!   net.init();
//!   net.connect(1, "ws://echo.example.com/ws", .{});
//!   net.connect(2, "ws://hidden.onion/chat", .{ .reconnect = true });
//!   // each frame:
//!   var events: [32]net.NetEvent = undefined;
//!   const n = net.poll(&events);
//!   for (events[0..n]) |ev| { ... }
//!   net.send(1, "hello");
//!   net.close(1);
//!   // on shutdown:
//!   net.destroy();

const std = @import("std");
const websocket = @import("websocket.zig");
const socks5 = @import("socks5.zig");

// ── Configuration ────────────────────────────────────────────────────────

const MAX_CONNECTIONS = 32;
const MAX_URL = 512;
const MAX_MSG = 65536;
const MAX_EVENTS = 64;
const INITIAL_BACKOFF_MS: u32 = 1000;
const MAX_BACKOFF_MS: u32 = 30000;
const DEFAULT_TOR_PROXY_PORT: u16 = 9050;

// ── Public types ─────────────────────────────────────────────────────────

pub const ConnectOpts = struct {
    reconnect: bool = false,
    tor_proxy_port: u16 = DEFAULT_TOR_PROXY_PORT,
};

pub const NetEventType = enum {
    connected,
    message,
    closed,
    err,
    reconnecting,
};

pub const NetEvent = struct {
    id: u32 = 0,
    event_type: NetEventType = .connected,
    data: [MAX_MSG]u8 = undefined,
    data_len: usize = 0,

    pub fn dataSlice(self: *const NetEvent) []const u8 {
        return self.data[0..self.data_len];
    }
};

const ConnStatus = enum {
    connecting,
    tunneling,
    open,
    reconnecting,
    closed,
};

const Connection = struct {
    active: bool = false,
    id: u32 = 0,
    ws: ?websocket.WebSocket = null,
    url: [MAX_URL]u8 = undefined,
    url_len: usize = 0,
    host: [256]u8 = undefined,
    host_len: usize = 0,
    port: u16 = 80,
    path: [256]u8 = undefined,
    path_len: usize = 0,
    status: ConnStatus = .closed,
    reconnect: bool = false,
    backoff_ms: u32 = INITIAL_BACKOFF_MS,
    next_retry_tick: u32 = 0,
    is_onion: bool = false,
    tor_proxy_port: u16 = DEFAULT_TOR_PROXY_PORT,
};

// ── Module state ─────────────────────────────────────────────────────────

var connections: [MAX_CONNECTIONS]Connection = [_]Connection{.{}} ** MAX_CONNECTIONS;
var event_queue: [MAX_EVENTS]NetEvent = undefined;
var event_count: usize = 0;
var initialized = false;

// ── Public API ───────────────────────────────────────────────────────────

pub fn init() void {
    if (initialized) return;
    for (&connections) |*c| c.active = false;
    event_count = 0;
    initialized = true;
}

/// Open a WebSocket connection. URL format: ws://host:port/path or wss://host:port/path
pub fn connect(id: u32, url: []const u8, opts: ConnectOpts) void {
    const slot = findSlot() orelse return;
    var conn = &connections[slot];
    conn.active = true;
    conn.id = id;
    conn.status = .connecting;
    conn.reconnect = opts.reconnect;
    conn.backoff_ms = INITIAL_BACKOFF_MS;
    conn.tor_proxy_port = opts.tor_proxy_port;

    // Store URL
    const ulen = @min(url.len, MAX_URL);
    @memcpy(conn.url[0..ulen], url[0..ulen]);
    conn.url_len = ulen;

    // Parse URL
    parseUrl(conn, url[0..ulen]);

    // Detect .onion
    conn.is_onion = isOnion(conn.host[0..conn.host_len]);

    // Initiate connection
    startConnection(conn);
}

/// Send data on a connection.
pub fn sendMsg(id: u32, data: []const u8) void {
    if (findById(id)) |conn| {
        if (conn.status == .open) {
            if (conn.ws) |*ws| {
                ws.send(data) catch {};
            }
        }
    }
}

/// Close a connection.
pub fn closeConn(id: u32) void {
    if (findById(id)) |conn| {
        conn.reconnect = false; // prevent reconnect
        if (conn.ws) |*ws| ws.close();
        conn.status = .closed;
        conn.active = false;
    }
}

/// Poll for events. Call once per frame. Returns count of events.
pub fn poll(out: []NetEvent) usize {
    event_count = 0;

    for (&connections) |*conn| {
        if (!conn.active) continue;

        switch (conn.status) {
            .open, .connecting => {
                if (conn.ws) |*ws| {
                    // Poll WebSocket for events (drain all available)
                    var safety: u32 = 0;
                    while (safety < 100) : (safety += 1) {
                        if (ws.update()) |event| {
                            switch (event) {
                                .open => pushEvent(out, conn.id, .connected, ""),
                                .message => |msg| pushEvent(out, conn.id, .message, msg),
                                .close => |cl| {
                                    pushEvent(out, conn.id, .closed, cl.reason);
                                    handleDisconnect(conn);
                                },
                                .err => |e| {
                                    pushEvent(out, conn.id, .err, e);
                                    handleDisconnect(conn);
                                },
                            }
                        } else break;
                    }
                }
            },
            .reconnecting => {
                // Check if it's time to retry
                const now = getTicks();
                if (now >= conn.next_retry_tick) {
                    pushEvent(out, conn.id, .reconnecting, "");
                    startConnection(conn);
                }
            },
            .closed, .tunneling => {},
        }
    }

    return @min(event_count, out.len);
}

/// Shutdown all connections.
pub fn destroy() void {
    for (&connections) |*conn| {
        if (conn.active) {
            if (conn.ws) |*ws| ws.shutdown();
            conn.active = false;
        }
    }
    initialized = false;
}

// ── Internal ─────────────────────────────────────────────────────────────

fn findSlot() ?usize {
    for (0..MAX_CONNECTIONS) |i| {
        if (!connections[i].active) return i;
    }
    return null;
}

fn findById(id: u32) ?*Connection {
    for (&connections) |*conn| {
        if (conn.active and conn.id == id) return conn;
    }
    return null;
}

fn startConnection(conn: *Connection) void {
    const host = conn.host[0..conn.host_len];
    const path = conn.path[0..conn.path_len];

    if (conn.is_onion) {
        // Route through SOCKS5 proxy (Tor)
        const stream = socks5.connect("127.0.0.1", conn.tor_proxy_port, host, conn.port, null, null) catch {
            conn.status = .closed;
            handleDisconnect(conn);
            return;
        };
        conn.ws = websocket.WebSocket.connectViaStream(stream, host, conn.port, path) catch {
            stream.close();
            conn.status = .closed;
            handleDisconnect(conn);
            return;
        };
    } else {
        conn.ws = websocket.WebSocket.connectTcp(host, conn.port, path) catch {
            conn.status = .closed;
            handleDisconnect(conn);
            return;
        };
    }
    conn.status = .connecting;
}

fn handleDisconnect(conn: *Connection) void {
    conn.ws = null;
    if (conn.reconnect) {
        conn.status = .reconnecting;
        conn.next_retry_tick = getTicks() + conn.backoff_ms;
        conn.backoff_ms = @min(conn.backoff_ms * 2, MAX_BACKOFF_MS);
    } else {
        conn.status = .closed;
        conn.active = false;
    }
}

fn pushEvent(out: []NetEvent, id: u32, event_type: NetEventType, data: []const u8) void {
    if (event_count >= out.len) return;
    var ev = &out[event_count];
    ev.id = id;
    ev.event_type = event_type;
    const dlen = @min(data.len, MAX_MSG);
    if (dlen > 0) @memcpy(ev.data[0..dlen], data[0..dlen]);
    ev.data_len = dlen;
    event_count += 1;
}

fn parseUrl(conn: *Connection, url: []const u8) void {
    // Skip ws:// or wss://
    var start: usize = 0;
    if (url.len > 5 and std.mem.eql(u8, url[0..5], "ws://")) {
        start = 5;
        conn.port = 80;
    } else if (url.len > 6 and std.mem.eql(u8, url[0..6], "wss://")) {
        start = 6;
        conn.port = 443;
    }

    // Find host end (: or / or end)
    var host_end = start;
    while (host_end < url.len and url[host_end] != ':' and url[host_end] != '/') : (host_end += 1) {}
    const hlen = host_end - start;
    @memcpy(conn.host[0..hlen], url[start..host_end]);
    conn.host_len = hlen;

    // Port
    if (host_end < url.len and url[host_end] == ':') {
        host_end += 1;
        var port_end = host_end;
        while (port_end < url.len and url[port_end] != '/') : (port_end += 1) {}
        conn.port = std.fmt.parseInt(u16, url[host_end..port_end], 10) catch conn.port;
        host_end = port_end;
    }

    // Path
    if (host_end < url.len and url[host_end] == '/') {
        const plen = url.len - host_end;
        @memcpy(conn.path[0..plen], url[host_end..url.len]);
        conn.path_len = plen;
    } else {
        conn.path[0] = '/';
        conn.path_len = 1;
    }
}

fn isOnion(host: []const u8) bool {
    return host.len > 6 and std.mem.eql(u8, host[host.len - 6 ..], ".onion");
}

fn getTicks() u32 {
    // Use SDL_GetTicks if available, otherwise monotonic clock
    const ns = std.time.Instant.now() catch return 0;
    _ = ns;
    // Fallback: use a simple timestamp
    var ts: std.posix.timespec = undefined;
    std.posix.clock_gettime(.MONOTONIC, &ts);
    return @intCast(@as(u64, @intCast(ts.sec)) * 1000 + @as(u64, @intCast(ts.nsec)) / 1_000_000);
}
