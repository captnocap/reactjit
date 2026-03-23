//! CartridgeOS HTTP bridge — connects WASM frontend to Linux kernel.
//!
//! Uses framework/net/httpserver.zig. Handles:
//!   GET /info        — system info (JSON)
//!   GET /exec?cmd    — run a shell command
//!   GET /read?path   — read a file
//!   GET /ps          — process list
//!
//! Runs inside the CartridgeOS initramfs on port 8080.

const std = @import("std");
const httpserver = @import("httpserver.zig");

pub fn main() !void {
    var server = try httpserver.HttpServer.listen(8080, &.{
        .{ .path = "/info", .route_type = .handler },
        .{ .path = "/exec", .route_type = .handler },
        .{ .path = "/read", .route_type = .handler },
        .{ .path = "/ps", .route_type = .handler },
    });

    // Poll loop
    while (true) {
        var events: [16]httpserver.HttpEvent = undefined;
        const n = server.update(&events);

        for (events[0..n]) |*ev| {
            const path = ev.pathSlice();

            if (std.mem.startsWith(u8, path, "/info")) {
                handleInfo(&server, ev);
            } else if (std.mem.startsWith(u8, path, "/exec")) {
                handleExec(&server, ev);
            } else if (std.mem.startsWith(u8, path, "/read")) {
                handleRead(&server, ev);
            } else if (std.mem.startsWith(u8, path, "/ps")) {
                handlePs(&server, ev);
            } else {
                server.respond(ev.client_id, 404, "text/plain", "not found");
            }
        }

        // ~100 polls/sec
        const ts = std.os.linux.timespec{ .sec = 0, .nsec = 10_000_000 };
        _ = std.os.linux.nanosleep(&ts, null);
    }
}

// ── Handlers ────────────────────────────────────────────────────────────

fn handleInfo(server: *httpserver.HttpServer, ev: *httpserver.HttpEvent) void {
    var buf: [4096]u8 = undefined;

    var uptime_buf: [64]u8 = undefined;
    const uptime = readFileSlice("/proc/uptime", &uptime_buf);
    const uptime_val = if (uptime.len > 0) blk: {
        const sp = std.mem.indexOf(u8, uptime, " ") orelse uptime.len;
        break :blk uptime[0..sp];
    } else "0";

    var mem_buf: [4096]u8 = undefined;
    const meminfo = readFileSlice("/proc/meminfo", &mem_buf);
    const mem_total = extractMemValue(meminfo, "MemTotal:");
    const mem_avail = extractMemValue(meminfo, "MemAvailable:");

    var ver_buf: [256]u8 = undefined;
    const version = readFileSlice("/proc/version", &ver_buf);
    const kernel = if (version.len > 0) blk: {
        var it = std.mem.splitScalar(u8, version, ' ');
        _ = it.next(); // "Linux"
        _ = it.next(); // "version"
        break :blk it.next() orelse "unknown";
    } else "unknown";

    const json = std.fmt.bufPrint(&buf,
        \\{{"uptime":"{s}","kernel":"{s}","mem_total_kb":{s},"mem_avail_kb":{s}}}
    , .{ uptime_val, kernel, mem_total, mem_avail }) catch "{}";

    server.respond(ev.client_id, 200, "application/json", json);
}

fn handleExec(server: *httpserver.HttpServer, ev: *httpserver.HttpEvent) void {
    const path = ev.pathSlice();
    const query = if (std.mem.indexOf(u8, path, "?")) |q| path[q + 1 ..] else "";

    if (query.len == 0) {
        server.respond(ev.client_id, 400, "text/plain", "usage: /exec?command+args");
        return;
    }

    var cmd_buf: [1024]u8 = undefined;
    const cmd = urlDecode(query, &cmd_buf);

    // Fork+exec sh with temp script, capture output
    // Write cmd to a temp script, run it, capture output
    {
        const script_path = "/tmp/_bridge_cmd.sh";
        const script_file = std.fs.createFileAbsolute(script_path, .{}) catch {
            server.respond(ev.client_id, 500, "text/plain", "cannot create script");
            return;
        };
        script_file.writeAll(cmd) catch {};
        script_file.close();

        // Execute and capture via redirect
        const out_path = "/tmp/_bridge_out.txt";
        var full_cmd_buf: [2048]u8 = undefined;
        const full_cmd = std.fmt.bufPrint(&full_cmd_buf, "/bin/sh {s} > {s} 2>&1", .{ script_path, out_path }) catch {
            server.respond(ev.client_id, 500, "text/plain", "cmd too long");
            return;
        };
        // Use system() equivalent — fork+exec sh -c
        const pid_rc = std.os.linux.fork();
        const pid: isize = @bitCast(pid_rc);
        if (pid == 0) {
            // child
            const sh_argv = [_:null]?[*:0]const u8{ "/bin/sh", "-c", @ptrCast(full_cmd.ptr), null };
            const envp = [_:null]?[*:0]const u8{ "PATH=/bin:/usr/bin", null };
            _ = std.os.linux.execve("/bin/sh", &sh_argv, &envp);
            std.os.linux.exit(1);
        }
        if (pid > 0) {
            var status: u32 = 0;
            _ = std.os.linux.wait4(@intCast(pid_rc), &status, 0, null);
        }

        var out_buf: [32768]u8 = undefined;
        const output = readFileSlice(out_path, &out_buf);
        server.respond(ev.client_id, 200, "text/plain", output);
    }
}

fn handleRead(server: *httpserver.HttpServer, ev: *httpserver.HttpEvent) void {
    const path = ev.pathSlice();
    const query = if (std.mem.indexOf(u8, path, "?")) |q| path[q + 1 ..] else "";

    if (query.len == 0) {
        server.respond(ev.client_id, 400, "text/plain", "usage: /read?/proc/uptime");
        return;
    }

    var file_path_buf: [512]u8 = undefined;
    const file_path = urlDecode(query, &file_path_buf);

    if (std.mem.indexOf(u8, file_path, "..") != null) {
        server.respond(ev.client_id, 403, "text/plain", "forbidden");
        return;
    }

    var buf: [32768]u8 = undefined;
    const content = readFileSlice(file_path, &buf);
    if (content.len == 0) {
        server.respond(ev.client_id, 404, "text/plain", "not found or empty");
        return;
    }
    server.respond(ev.client_id, 200, "text/plain", content);
}

fn handlePs(server: *httpserver.HttpServer, ev: *httpserver.HttpEvent) void {
    // Run ps via the exec mechanism
    const pid_rc = std.os.linux.fork();
    const pid: isize = @bitCast(pid_rc);
    if (pid == 0) {
        const sh_argv = [_:null]?[*:0]const u8{ "/bin/sh", "-c", "ps > /tmp/_bridge_ps.txt 2>&1", null };
        const envp = [_:null]?[*:0]const u8{ "PATH=/bin:/usr/bin", null };
        _ = std.os.linux.execve("/bin/sh", &sh_argv, &envp);
        std.os.linux.exit(1);
    }
    if (pid > 0) {
        var status: u32 = 0;
        _ = std.os.linux.wait4(@intCast(pid_rc), &status, 0, null);
    }
    var buf: [8192]u8 = undefined;
    const output = readFileSlice("/tmp/_bridge_ps.txt", &buf);
    server.respond(ev.client_id, 200, "text/plain", output);
}

// ── Helpers ─────────────────────────────────────────────────────────────

fn readFileSlice(path: []const u8, buf: []u8) []const u8 {
    const file = std.fs.openFileAbsolute(path, .{}) catch return "";
    defer file.close();
    const n = file.read(buf) catch return "";
    if (n > 0 and buf[n - 1] == '\n') return buf[0 .. n - 1];
    return buf[0..n];
}

fn extractMemValue(meminfo: []const u8, key: []const u8) []const u8 {
    var lines = std.mem.splitScalar(u8, meminfo, '\n');
    while (lines.next()) |line| {
        if (std.mem.startsWith(u8, line, key)) {
            var it = std.mem.tokenizeScalar(u8, line, ' ');
            _ = it.next(); // key
            return it.next() orelse "0";
        }
    }
    return "0";
}

fn urlDecode(input: []const u8, buf: []u8) []const u8 {
    var i: usize = 0;
    var o: usize = 0;
    while (i < input.len and o < buf.len) {
        if (input[i] == '+') {
            buf[o] = ' ';
            i += 1;
            o += 1;
        } else if (input[i] == '%' and i + 2 < input.len) {
            buf[o] = hexByte(input[i + 1], input[i + 2]);
            i += 3;
            o += 1;
        } else {
            buf[o] = input[i];
            i += 1;
            o += 1;
        }
    }
    return buf[0..o];
}

fn hexByte(hi: u8, lo: u8) u8 {
    const h: u8 = hexNibble(hi);
    const l: u8 = hexNibble(lo);
    return (h << 4) | l;
}

fn hexNibble(c: u8) u8 {
    if (c >= '0' and c <= '9') return c - '0';
    if (c >= 'a' and c <= 'f') return c - 'a' + 10;
    if (c >= 'A' and c <= 'F') return c - 'A' + 10;
    return 0;
}
