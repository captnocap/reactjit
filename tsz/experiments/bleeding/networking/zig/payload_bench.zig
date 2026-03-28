const std = @import("std");
const json = std.json;
const fs = std.fs;
const posix = std.posix;
const time = std.time;

fn getTimeUs() i64 {
    return time.microTimestamp();
}

fn getRssKb() u64 {
    const file = fs.openFileAbsolute("/proc/self/status", .{}) catch return 0;
    defer file.close();
    var buf: [8192]u8 = undefined;
    const n = file.readAll(&buf) catch return 0;
    var lines = std.mem.splitScalar(u8, buf[0..n], '\n');
    while (lines.next()) |line| {
        if (std.mem.startsWith(u8, line, "VmRSS:")) {
            var it = std.mem.tokenizeScalar(u8, line, ' ');
            _ = it.next();
            if (it.next()) |val| return std.fmt.parseInt(u64, val, 10) catch 0;
        }
    }
    return 0;
}

fn readFileAlloc(allocator: std.mem.Allocator, path: []const u8) ![]u8 {
    const file = try fs.cwd().openFile(path, .{});
    defer file.close();
    return try file.readToEndAlloc(allocator, 16 * 1024 * 1024);
}

// Benchmark functions
fn benchParse(allocator: std.mem.Allocator, payload: []const u8) !void {
    const parsed = try json.parseFromSlice(json.Value, allocator, payload, .{});
    defer parsed.deinit();
    // Force materialization
    std.mem.doNotOptimizeAway(&parsed);
}

fn benchExtract(allocator: std.mem.Allocator, payload: []const u8) !void {
    const parsed = try json.parseFromSlice(json.Value, allocator, payload, .{});
    defer parsed.deinit();
    const root = parsed.value;

    // Extract nested fields
    var id: f64 = 0;
    if (root.object.get("id")) |v| {
        switch (v) {
            .integer => |i| id = @floatFromInt(i),
            .float => |f| id = f,
            else => {},
        }
    }

    var name: []const u8 = "";
    if (root.object.get("user")) |user| {
        if (user.object.get("name")) |n| {
            switch (n) {
                .string => |s| name = s,
                else => {},
            }
        }
    }

    var item_count: usize = 0;
    if (root.object.get("items")) |items| {
        switch (items) {
            .array => |arr| item_count = arr.items.len,
            else => {},
        }
    }

    std.mem.doNotOptimizeAway(&id);
    std.mem.doNotOptimizeAway(&name);
    std.mem.doNotOptimizeAway(&item_count);
}

fn benchValidate(allocator: std.mem.Allocator, payload: []const u8) !bool {
    const parsed = try json.parseFromSlice(json.Value, allocator, payload, .{});
    defer parsed.deinit();
    const root = parsed.value;

    // Validate schema
    if (root != .object) return false;
    const obj = root.object;

    const id = obj.get("id") orelse return false;
    switch (id) {
        .integer, .float => {},
        else => return false,
    }

    const user = obj.get("user") orelse return false;
    if (user != .object) return false;
    const name = user.object.get("name") orelse return false;
    if (name != .string) return false;
    const email = user.object.get("email") orelse return false;
    if (email != .string) return false;

    const items = obj.get("items") orelse return false;
    if (items != .array) return false;
    for (items.array.items) |item| {
        if (item != .object) return false;
        const iid = item.object.get("id") orelse return false;
        switch (iid) {
            .integer, .float => {},
            else => return false,
        }
        const iname = item.object.get("name") orelse return false;
        if (iname != .string) return false;
        const price = item.object.get("price") orelse return false;
        switch (price) {
            .integer, .float => {},
            else => return false,
        }
    }
    return true;
}

fn benchTotal(allocator: std.mem.Allocator, payload: []const u8) !f64 {
    const parsed = try json.parseFromSlice(json.Value, allocator, payload, .{});
    defer parsed.deinit();
    const root = parsed.value;

    var total: f64 = 0;
    if (root.object.get("items")) |items| {
        if (items == .array) {
            for (items.array.items) |item| {
                if (item.object.get("price")) |price| {
                    switch (price) {
                        .integer => |i| total += @floatFromInt(i),
                        .float => |f| total += f,
                        else => {},
                    }
                }
            }
        }
    }
    return total;
}

fn benchSerialize(allocator: std.mem.Allocator, payload: []const u8) !void {
    const parsed = try json.parseFromSlice(json.Value, allocator, payload, .{});
    defer parsed.deinit();
    const root = parsed.value;

    // Extract, compute, serialize result
    var user_name: []const u8 = "";
    if (root.object.get("user")) |user| {
        if (user.object.get("name")) |n| {
            if (n == .string) user_name = n.string;
        }
    }

    var item_count: usize = 0;
    var total_price: f64 = 0;
    if (root.object.get("items")) |items| {
        if (items == .array) {
            item_count = items.array.items.len;
            for (items.array.items) |item| {
                if (item.object.get("price")) |price| {
                    switch (price) {
                        .integer => |i| total_price += @floatFromInt(i),
                        .float => |f| total_price += f,
                        else => {},
                    }
                }
            }
        }
    }

    // Serialize to JSON
    var buf: [4096]u8 = undefined;
    const result = std.fmt.bufPrint(&buf, "{{\"user_name\":\"{s}\",\"item_count\":{d},\"total_price\":{d:.2}}}", .{
        user_name,
        item_count,
        total_price,
    }) catch return;
    std.mem.doNotOptimizeAway(result.ptr);
}

pub fn main() !void {
    var gpa = std.heap.GeneralPurposeAllocator(.{}){};
    defer _ = gpa.deinit();
    const allocator = gpa.allocator();

    const args = try std.process.argsAlloc(allocator);
    defer std.process.argsFree(allocator, args);

    if (args.len < 4) {
        std.debug.print("Usage: payload_bench <payload_file> <function> <iterations>\n", .{});
        std.debug.print("  function: parse|extract|validate|total|serialize\n", .{});
        return;
    }

    const payload = try readFileAlloc(allocator, args[1]);
    defer allocator.free(payload);
    const func_name = args[2];
    const iterations = try std.fmt.parseInt(u32, args[3], 10);

    const warmup = @max(10, iterations / 10);

    // Select function
    const Func = enum { parse, extract, validate, total, serialize };
    const func: Func = if (std.mem.eql(u8, func_name, "parse"))
        .parse
    else if (std.mem.eql(u8, func_name, "extract"))
        .extract
    else if (std.mem.eql(u8, func_name, "validate"))
        .validate
    else if (std.mem.eql(u8, func_name, "total"))
        .total
    else if (std.mem.eql(u8, func_name, "serialize"))
        .serialize
    else {
        std.debug.print("Unknown function: {s}\n", .{func_name});
        return;
    };

    // Warmup
    for (0..warmup) |_| {
        switch (func) {
            .parse => try benchParse(allocator, payload),
            .extract => try benchExtract(allocator, payload),
            .validate => {
                const v = try benchValidate(allocator, payload);
                std.mem.doNotOptimizeAway(&v);
            },
            .total => {
                const t = try benchTotal(allocator, payload);
                std.mem.doNotOptimizeAway(&t);
            },
            .serialize => try benchSerialize(allocator, payload),
        }
    }

    // Benchmark
    const rss_before = getRssKb();
    const start = getTimeUs();

    for (0..iterations) |_| {
        switch (func) {
            .parse => try benchParse(allocator, payload),
            .extract => try benchExtract(allocator, payload),
            .validate => {
                const v = try benchValidate(allocator, payload);
                std.mem.doNotOptimizeAway(&v);
            },
            .total => {
                const t = try benchTotal(allocator, payload);
                std.mem.doNotOptimizeAway(&t);
            },
            .serialize => try benchSerialize(allocator, payload),
        }
    }

    const elapsed = getTimeUs() - start;
    const rss_after = getRssKb();

    // Zig has no bridge cost — it's all in-process, zero-copy
    const bridge_elapsed: i64 = 0;

    // Output to stdout: func payload_size iters elapsed_us bridge_us rss_kb
    const stdout_file = fs.File{ .handle = posix.STDOUT_FILENO };
    var buf: [512]u8 = undefined;
    const line = std.fmt.bufPrint(&buf, "{s}\t{d}\t{d}\t{d}\t{d}\t{d}\n", .{
        func_name,
        payload.len,
        iterations,
        elapsed,
        bridge_elapsed,
        @max(rss_before, rss_after),
    }) catch return;
    stdout_file.writeAll(line) catch {};
}
