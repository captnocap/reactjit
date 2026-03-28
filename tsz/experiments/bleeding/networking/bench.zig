const std = @import("std");
const net = std.net;
const posix = std.posix;
const time = std.time;
const fs = std.fs;

// Benchmark configuration
const ECHO_ITERATIONS = 2000;
const HTTP_ITERATIONS = 1000;
const POOL_ITERATIONS = 1000;
const PAYLOAD_SIZE = 256;
const WARMUP = 100;

const Result = struct {
    name: []const u8,
    runtime: []const u8,
    iterations: u64,
    total_us: u64,
    avg_latency_us: f64,
    p99_latency_us: f64,
    throughput_rps: f64,
    rss_kb: u64,
};

fn getTimeUs() u64 {
    return @intCast(time.microTimestamp());
}

fn getRssKb() u64 {
    const file = fs.openFileAbsolute("/proc/self/status", .{}) catch return 0;
    defer file.close();
    var buf: [4096]u8 = undefined;
    const n = file.readAll(&buf) catch return 0;
    const content = buf[0..n];
    var lines = std.mem.splitScalar(u8, content, '\n');
    while (lines.next()) |line| {
        if (std.mem.startsWith(u8, line, "VmRSS:")) {
            var it = std.mem.tokenizeScalar(u8, line, ' ');
            _ = it.next();
            if (it.next()) |val| {
                return std.fmt.parseInt(u64, val, 10) catch 0;
            }
        }
    }
    return 0;
}

fn percentile(latencies: []u64, p: f64) f64 {
    if (latencies.len == 0) return 0;
    std.mem.sort(u64, latencies, {}, std.sort.asc(u64));
    const idx = @min(@as(usize, @intFromFloat(@as(f64, @floatFromInt(latencies.len - 1)) * p)), latencies.len - 1);
    return @floatFromInt(latencies[idx]);
}

fn benchEcho(allocator: std.mem.Allocator, port: u16, runtime_name: []const u8) !Result {
    const latencies = try allocator.alloc(u64, ECHO_ITERATIONS);
    defer allocator.free(latencies);

    var payload: [PAYLOAD_SIZE]u8 = undefined;
    for (&payload) |*b| b.* = 'A';
    var recv_buf: [PAYLOAD_SIZE]u8 = undefined;

    // Warmup
    for (0..WARMUP) |_| {
        const addr = net.Address.initIp4(.{ 127, 0, 0, 1 }, port);
        const stream = net.tcpConnectToAddress(addr) catch continue;
        defer stream.close();
        stream.writeAll(&payload) catch continue;
        _ = stream.read(&recv_buf) catch continue;
    }

    const rss_before = getRssKb();
    const start = getTimeUs();

    for (0..ECHO_ITERATIONS) |i| {
        const addr = net.Address.initIp4(.{ 127, 0, 0, 1 }, port);
        const stream = net.tcpConnectToAddress(addr) catch continue;
        defer stream.close();

        const t0 = getTimeUs();
        stream.writeAll(&payload) catch continue;

        var total_read: usize = 0;
        while (total_read < PAYLOAD_SIZE) {
            const n = stream.read(recv_buf[total_read..]) catch break;
            if (n == 0) break;
            total_read += n;
        }
        const t1 = getTimeUs();
        latencies[i] = t1 - t0;
    }

    const total = getTimeUs() - start;
    const rss_after = getRssKb();

    return Result{
        .name = "tcp_echo",
        .runtime = runtime_name,
        .iterations = ECHO_ITERATIONS,
        .total_us = total,
        .avg_latency_us = @as(f64, @floatFromInt(total)) / @as(f64, @floatFromInt(ECHO_ITERATIONS)),
        .p99_latency_us = percentile(latencies, 0.99),
        .throughput_rps = @as(f64, @floatFromInt(ECHO_ITERATIONS)) / (@as(f64, @floatFromInt(total)) / 1_000_000.0),
        .rss_kb = @max(rss_after, rss_before),
    };
}

fn benchHttp(allocator: std.mem.Allocator, port: u16, runtime_name: []const u8) !Result {
    const latencies = try allocator.alloc(u64, HTTP_ITERATIONS);
    defer allocator.free(latencies);

    const request = "GET / HTTP/1.1\r\nHost: localhost\r\nConnection: close\r\n\r\n";
    var recv_buf: [4096]u8 = undefined;

    for (0..WARMUP) |_| {
        const addr = net.Address.initIp4(.{ 127, 0, 0, 1 }, port);
        const stream = net.tcpConnectToAddress(addr) catch continue;
        defer stream.close();
        stream.writeAll(request) catch continue;
        _ = stream.read(&recv_buf) catch continue;
    }

    const rss_before = getRssKb();
    const start = getTimeUs();

    for (0..HTTP_ITERATIONS) |i| {
        const addr = net.Address.initIp4(.{ 127, 0, 0, 1 }, port);
        const stream = net.tcpConnectToAddress(addr) catch continue;
        defer stream.close();

        const t0 = getTimeUs();
        stream.writeAll(request) catch continue;
        _ = stream.read(&recv_buf) catch {};
        const t1 = getTimeUs();
        latencies[i] = t1 - t0;
    }

    const total = getTimeUs() - start;
    const rss_after = getRssKb();

    return Result{
        .name = "http_get",
        .runtime = runtime_name,
        .iterations = HTTP_ITERATIONS,
        .total_us = total,
        .avg_latency_us = @as(f64, @floatFromInt(total)) / @as(f64, @floatFromInt(HTTP_ITERATIONS)),
        .p99_latency_us = percentile(latencies, 0.99),
        .throughput_rps = @as(f64, @floatFromInt(HTTP_ITERATIONS)) / (@as(f64, @floatFromInt(total)) / 1_000_000.0),
        .rss_kb = @max(rss_after, rss_before),
    };
}

fn benchPool(allocator: std.mem.Allocator, port: u16, runtime_name: []const u8) !Result {
    const latencies = try allocator.alloc(u64, POOL_ITERATIONS);
    defer allocator.free(latencies);

    var payload: [PAYLOAD_SIZE]u8 = undefined;
    for (&payload) |*b| b.* = 'B';
    var recv_buf: [PAYLOAD_SIZE]u8 = undefined;

    const max_pool = 10;
    var pool: [max_pool]?net.Stream = [_]?net.Stream{null} ** max_pool;

    const rss_before = getRssKb();
    const start = getTimeUs();

    for (0..POOL_ITERATIONS) |i| {
        const slot = i % max_pool;
        if (pool[slot] == null) {
            const addr = net.Address.initIp4(.{ 127, 0, 0, 1 }, port);
            pool[slot] = net.tcpConnectToAddress(addr) catch {
                latencies[i] = 0;
                continue;
            };
        }
        const stream = pool[slot].?;

        const t0 = getTimeUs();
        stream.writeAll(&payload) catch {
            stream.close();
            const addr = net.Address.initIp4(.{ 127, 0, 0, 1 }, port);
            pool[slot] = net.tcpConnectToAddress(addr) catch {
                pool[slot] = null;
                latencies[i] = 0;
                continue;
            };
            latencies[i] = getTimeUs() - t0;
            continue;
        };

        var total_read: usize = 0;
        while (total_read < PAYLOAD_SIZE) {
            const n = stream.read(recv_buf[total_read..]) catch break;
            if (n == 0) break;
            total_read += n;
        }
        const t1 = getTimeUs();
        latencies[i] = t1 - t0;
    }

    const total = getTimeUs() - start;
    const rss_after = getRssKb();

    for (&pool) |*s| {
        if (s.*) |stream| {
            stream.close();
            s.* = null;
        }
    }

    return Result{
        .name = "conn_pool",
        .runtime = runtime_name,
        .iterations = POOL_ITERATIONS,
        .total_us = total,
        .avg_latency_us = @as(f64, @floatFromInt(total)) / @as(f64, @floatFromInt(POOL_ITERATIONS)),
        .p99_latency_us = percentile(latencies, 0.99),
        .throughput_rps = @as(f64, @floatFromInt(POOL_ITERATIONS)) / (@as(f64, @floatFromInt(total)) / 1_000_000.0),
        .rss_kb = @max(rss_after, rss_before),
    };
}

fn printResult(result: Result) void {
    std.debug.print("| {s:<10} | {s:<8} | {d:>8} | {d:>10.1} | {d:>10.1} | {d:>12.0} | {d:>8} |\n", .{
        result.name,
        result.runtime,
        result.iterations,
        result.avg_latency_us,
        result.p99_latency_us,
        result.throughput_rps,
        result.rss_kb,
    });
}

// Write result as a pipe-delimited line to stdout via direct write syscall
fn writeResult(result: Result) void {
    var buf: [512]u8 = undefined;
    const line = std.fmt.bufPrint(&buf, "| {s:<10} | {s:<8} | {d:>8} | {d:>10.1} | {d:>10.1} | {d:>12.0} | {d:>8} |\n", .{
        result.name,
        result.runtime,
        result.iterations,
        result.avg_latency_us,
        result.p99_latency_us,
        result.throughput_rps,
        result.rss_kb,
    }) catch return;
    // Write to stdout fd directly
    const stdout_file = fs.File{ .handle = posix.STDOUT_FILENO };
    stdout_file.writeAll(line) catch {};
}

pub fn main() !void {
    var gpa = std.heap.GeneralPurposeAllocator(.{}){};
    defer _ = gpa.deinit();
    const allocator = gpa.allocator();

    const args = try std.process.argsAlloc(allocator);
    defer std.process.argsFree(allocator, args);

    if (args.len < 4) {
        std.debug.print("Usage: bench <runtime> <test> <port>\n", .{});
        std.debug.print("  runtime: zig|luajit|quickjs\n", .{});
        std.debug.print("  test: echo|http|pool|all\n", .{});
        std.debug.print("  port: server port number\n", .{});
        return;
    }

    const runtime_name = args[1];
    const test_name = args[2];
    const port = try std.fmt.parseInt(u16, args[3], 10);

    if (std.mem.eql(u8, test_name, "echo") or std.mem.eql(u8, test_name, "all")) {
        const result = try benchEcho(allocator, port, runtime_name);
        writeResult(result);
        printResult(result);
    }
    if (std.mem.eql(u8, test_name, "http") or std.mem.eql(u8, test_name, "all")) {
        const result = try benchHttp(allocator, port + 1, runtime_name);
        writeResult(result);
        printResult(result);
    }
    if (std.mem.eql(u8, test_name, "pool") or std.mem.eql(u8, test_name, "all")) {
        const result = try benchPool(allocator, port, runtime_name);
        writeResult(result);
        printResult(result);
    }
}
