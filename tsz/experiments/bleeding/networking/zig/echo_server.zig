const std = @import("std");
const net = std.net;
const posix = std.posix;

// Pure Zig TCP echo server
pub const EchoServer = struct {
    listener: net.Server,
    allocator: std.mem.Allocator,

    pub fn init(allocator: std.mem.Allocator, port: u16) !EchoServer {
        const address = net.Address.initIp4(.{ 127, 0, 0, 1 }, port);
        const server = try address.listen(.{
            .reuse_address = true,
        });
        return EchoServer{
            .listener = server,
            .allocator = allocator,
        };
}

    pub fn deinit(self: *EchoServer) void {
        self.listener.deinit();
    }

    pub fn acceptOne(self: *EchoServer) !void {
        const conn = try self.listener.accept();
        defer conn.stream.close();

        var buf: [4096]u8 = undefined;
        while (true) {
            const n = conn.stream.read(&buf) catch |err| switch (err) {
                error.ConnectionResetByPeer => return,
                else => return err,
            };
            if (n == 0) return;
            _ = conn.stream.writeAll(buf[0..n]) catch return;
        }
    }

    /// Run server accepting connections until signaled to stop
    pub fn run(self: *EchoServer, stop: *std.atomic.Value(bool)) void {
        while (!stop.load(.acquire)) {
            self.acceptOne() catch continue;
        }
    }
};

// Pure Zig HTTP GET handler
pub const HttpServer = struct {
    listener: net.Server,
    allocator: std.mem.Allocator,

    pub fn init(allocator: std.mem.Allocator, port: u16) !HttpServer {
        const address = net.Address.initIp4(.{ 127, 0, 0, 1 }, port);
        const server = try address.listen(.{
            .reuse_address = true,
        });
        return HttpServer{
            .listener = server,
            .allocator = allocator,
        };
    }

    pub fn deinit(self: *HttpServer) void {
        self.listener.deinit();
    }

    pub fn acceptOne(self: *HttpServer) !void {
        const conn = try self.listener.accept();
        defer conn.stream.close();

        var buf: [4096]u8 = undefined;
        const n = conn.stream.read(&buf) catch return;
        if (n == 0) return;

        // Parse minimal HTTP request
        const request = buf[0..n];
        if (std.mem.startsWith(u8, request, "GET ")) {
            const body = "Hello, World!";
            const response = "HTTP/1.1 200 OK\r\nContent-Length: 13\r\nConnection: close\r\n\r\nHello, World!";
            _ = body;
            conn.stream.writeAll(response) catch return;
        } else {
            const response = "HTTP/1.1 405 Method Not Allowed\r\nContent-Length: 0\r\nConnection: close\r\n\r\n";
            conn.stream.writeAll(response) catch return;
        }
    }

    pub fn run(self: *HttpServer, stop: *std.atomic.Value(bool)) void {
        while (!stop.load(.acquire)) {
            self.acceptOne() catch continue;
        }
    }
};

// Connection pool (fixed-size, no allocator needed)
pub const ConnectionPool = struct {
    const MAX_POOL = 32;
    const PoolEntry = struct {
        stream: ?net.Stream = null,
        in_use: bool = false,
    };

    entries: [MAX_POOL]PoolEntry = [_]PoolEntry{.{}} ** MAX_POOL,
    count: usize = 0,
    target: net.Address,

    pub fn init(target: net.Address) ConnectionPool {
        return ConnectionPool{ .target = target };
    }

    pub fn deinit(self: *ConnectionPool) void {
        for (&self.entries) |*entry| {
            if (entry.stream) |s| s.close();
            entry.* = .{};
        }
        self.count = 0;
    }

    pub fn acquire(self: *ConnectionPool) !net.Stream {
        for (&self.entries) |*entry| {
            if (entry.stream != null and !entry.in_use) {
                entry.in_use = true;
                return entry.stream.?;
            }
        }
        if (self.count < MAX_POOL) {
            const stream = try net.tcpConnectToAddress(self.target);
            self.entries[self.count] = .{ .stream = stream, .in_use = true };
            self.count += 1;
            return stream;
        }
        return error.PoolExhausted;
    }

    pub fn release(self: *ConnectionPool, stream: net.Stream) void {
        for (&self.entries) |*entry| {
            if (entry.stream) |s| {
                if (s.handle == stream.handle) {
                    entry.in_use = false;
                    return;
                }
            }
        }
    }
};

pub fn main() !void {
    var gpa = std.heap.GeneralPurposeAllocator(.{}){};
    defer _ = gpa.deinit();
    const allocator = gpa.allocator();

    // Run echo server standalone for testing
    var server = try EchoServer.init(allocator, 9100);
    defer server.deinit();

    std.debug.print("Zig echo server listening on :9100\n", .{});

    var stop = std.atomic.Value(bool).init(false);
    server.run(&stop);
}
