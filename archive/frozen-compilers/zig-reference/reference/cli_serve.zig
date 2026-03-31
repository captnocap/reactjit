//! tsz serve [dir] [--port N] — Serve a web build directory over HTTP.
//!
//! Blocking static file server for local development. Streams files
//! of any size (no buffer cap). Sets CORS/COOP/COEP headers needed
//! for SharedArrayBuffer + WebGPU.
//!
//! Usage:
//!   tsz serve carts/myapp/myapp-web           # port 8090
//!   tsz serve carts/myapp/myapp-web --port 3000

const std = @import("std");

pub fn run(alloc: std.mem.Allocator, args: []const []const u8) void {
    var port: u16 = 8090;
    var dir: []const u8 = ".";

    // Parse args: tsz serve [dir] [--port N]
    var i: usize = 2;
    while (i < args.len) : (i += 1) {
        if (std.mem.eql(u8, args[i], "--port") or std.mem.eql(u8, args[i], "-p")) {
            i += 1;
            if (i < args.len) {
                port = std.fmt.parseInt(u16, args[i], 10) catch {
                    std.debug.print("[tsz] Invalid port: {s}\n", .{args[i]});
                    return;
                };
            }
        } else if (!std.mem.startsWith(u8, args[i], "-")) {
            dir = args[i];
        }
    }

    // Resolve to absolute path for display
    var abs_buf: [std.fs.max_path_bytes]u8 = undefined;
    const abs_dir = std.fs.cwd().realpath(dir, &abs_buf) catch dir;

    // Verify directory exists
    std.fs.cwd().access(dir, .{}) catch {
        std.debug.print("[tsz] Directory not found: {s}\n", .{dir});
        return;
    };

    const addr = std.net.Address.parseIp4("0.0.0.0", port) catch {
        std.debug.print("[tsz] Invalid address\n", .{});
        return;
    };

    const server = std.posix.socket(addr.any.family, std.posix.SOCK.STREAM, 0) catch {
        std.debug.print("[tsz] Failed to create socket\n", .{});
        return;
    };

    const optval: c_int = 1;
    std.posix.setsockopt(server, std.posix.SOL.SOCKET, std.posix.SO.REUSEADDR, std.mem.asBytes(&optval)) catch {};

    std.posix.bind(server, &addr.any, addr.getOsSockLen()) catch {
        std.debug.print("[tsz] Port {d} already in use\n", .{port});
        std.posix.close(server);
        return;
    };
    std.posix.listen(server, 16) catch {
        std.debug.print("[tsz] Failed to listen\n", .{});
        std.posix.close(server);
        return;
    };

    std.debug.print("\n  tsz serve\n\n", .{});
    std.debug.print("  serving  {s}\n", .{abs_dir});
    std.debug.print("  local    http://localhost:{d}/\n\n", .{port});

    // Accept loop (blocking, one connection at a time — fine for dev)
    while (true) {
        const client_fd = std.posix.accept(server, null, null, 0) catch continue;
        handleConnection(alloc, client_fd, dir);
    }
}

fn handleConnection(alloc: std.mem.Allocator, fd: std.posix.socket_t, root: []const u8) void {
    defer std.posix.close(fd);
    const stream = std.net.Stream{ .handle = fd };

    // Read request (just need the first line)
    var req_buf: [4096]u8 = undefined;
    const n = stream.read(&req_buf) catch return;
    if (n == 0) return;
    const req = req_buf[0..n];

    // Parse "GET /path HTTP/1.1"
    const first_line_end = std.mem.indexOf(u8, req, "\r\n") orelse return;
    const first_line = req[0..first_line_end];

    var parts = std.mem.splitScalar(u8, first_line, ' ');
    const method = parts.next() orelse return;
    _ = method;
    const raw_path = parts.next() orelse return;

    // Strip query string
    const path = if (std.mem.indexOf(u8, raw_path, "?")) |q| raw_path[0..q] else raw_path;

    // Security: reject traversal
    if (std.mem.indexOf(u8, path, "..") != null) {
        sendError(stream, 403, "Forbidden");
        return;
    }

    // Build filesystem path
    const rel = if (path.len > 1) path[1..] else "index.html";
    const fs_path = if (std.mem.eql(u8, rel, "")) "index.html" else rel;

    // Try to open the file under root
    const full_path = std.fmt.allocPrint(alloc, "{s}/{s}", .{ root, fs_path }) catch return;
    defer alloc.free(full_path);

    const file = std.fs.cwd().openFile(full_path, .{}) catch {
        // Try index.html for directory paths
        if (std.mem.endsWith(u8, path, "/") or std.mem.eql(u8, path, "/")) {
            const idx_path = std.fmt.allocPrint(alloc, "{s}/{s}index.html", .{ root, if (path.len > 1) path[1..] else "" }) catch return;
            defer alloc.free(idx_path);
            const idx_file = std.fs.cwd().openFile(idx_path, .{}) catch {
                sendError(stream, 404, "Not Found");
                return;
            };
            serveFile(alloc, stream, idx_file, "index.html");
            return;
        }
        sendError(stream, 404, "Not Found");
        return;
    };
    serveFile(alloc, stream, file, fs_path);
}

fn serveFile(alloc: std.mem.Allocator, stream: std.net.Stream, file: std.fs.File, path: []const u8) void {
    defer file.close();

    const stat = file.stat() catch {
        sendError(stream, 500, "Stat Error");
        return;
    };
    const file_size = stat.size;
    const content_type = mimeType(path);

    // Send headers — include CORS + COOP/COEP for SharedArrayBuffer + WebGPU
    var hdr_buf: [1024]u8 = undefined;
    const hdr = std.fmt.bufPrint(&hdr_buf,
        "HTTP/1.1 200 OK\r\n" ++
            "Content-Type: {s}\r\n" ++
            "Content-Length: {d}\r\n" ++
            "Cross-Origin-Opener-Policy: same-origin\r\n" ++
            "Cross-Origin-Embedder-Policy: require-corp\r\n" ++
            "Cache-Control: no-cache\r\n" ++
            "Connection: close\r\n\r\n",
        .{ content_type, file_size },
    ) catch {
        sendError(stream, 500, "Header Error");
        return;
    };
    stream.writeAll(hdr) catch return;

    // Stream file in chunks (handles multi-MB .wasm, .iso, .data files)
    const chunk_size: usize = 64 * 1024;
    const buf = alloc.alloc(u8, chunk_size) catch {
        sendError(stream, 500, "Alloc Error");
        return;
    };
    defer alloc.free(buf);

    var sent: u64 = 0;
    while (sent < file_size) {
        const read = file.read(buf) catch return;
        if (read == 0) break;
        stream.writeAll(buf[0..read]) catch return;
        sent += read;
    }

    // Log
    const size_str = if (file_size > 1024 * 1024)
        std.fmt.allocPrint(alloc, "{d:.1}MB", .{@as(f64, @floatFromInt(file_size)) / (1024.0 * 1024.0)}) catch "?"
    else if (file_size > 1024)
        std.fmt.allocPrint(alloc, "{d:.1}KB", .{@as(f64, @floatFromInt(file_size)) / 1024.0}) catch "?"
    else
        std.fmt.allocPrint(alloc, "{d}B", .{file_size}) catch "?";

    std.debug.print("  200 {s} ({s})\n", .{ path, size_str });
}

fn sendError(stream: std.net.Stream, status: u16, body: []const u8) void {
    var hdr_buf: [256]u8 = undefined;
    const hdr = std.fmt.bufPrint(&hdr_buf,
        "HTTP/1.1 {d} {s}\r\n" ++
            "Content-Type: text/plain\r\n" ++
            "Content-Length: {d}\r\n" ++
            "Connection: close\r\n\r\n",
        .{ status, body, body.len },
    ) catch return;
    stream.writeAll(hdr) catch {};
    stream.writeAll(body) catch {};
}

fn mimeType(path: []const u8) []const u8 {
    if (std.mem.endsWith(u8, path, ".html")) return "text/html";
    if (std.mem.endsWith(u8, path, ".js")) return "application/javascript";
    if (std.mem.endsWith(u8, path, ".wasm")) return "application/wasm";
    if (std.mem.endsWith(u8, path, ".data")) return "application/octet-stream";
    if (std.mem.endsWith(u8, path, ".css")) return "text/css";
    if (std.mem.endsWith(u8, path, ".json")) return "application/json";
    if (std.mem.endsWith(u8, path, ".png")) return "image/png";
    if (std.mem.endsWith(u8, path, ".jpg") or std.mem.endsWith(u8, path, ".jpeg")) return "image/jpeg";
    if (std.mem.endsWith(u8, path, ".gif")) return "image/gif";
    if (std.mem.endsWith(u8, path, ".svg")) return "image/svg+xml";
    if (std.mem.endsWith(u8, path, ".ico")) return "image/x-icon";
    if (std.mem.endsWith(u8, path, ".ttf")) return "font/ttf";
    if (std.mem.endsWith(u8, path, ".woff2")) return "font/woff2";
    if (std.mem.endsWith(u8, path, ".woff")) return "font/woff";
    if (std.mem.endsWith(u8, path, ".bin")) return "application/octet-stream";
    if (std.mem.endsWith(u8, path, ".iso")) return "application/octet-stream";
    if (std.mem.endsWith(u8, path, ".txt")) return "text/plain";
    if (std.mem.endsWith(u8, path, ".xml")) return "application/xml";
    return "application/octet-stream";
}
