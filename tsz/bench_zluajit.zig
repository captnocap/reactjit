//! LuaJIT Worker Benchmarks — zluajit idiomatic bindings
//!
//! Same 6 benchmarks as bench_lua_worker.zig but using zluajit instead of raw @cImport.
//! Build: zig build bench-luajit -DReleaseFast
//! Run:   ./zig-out/bin/bench-luajit

const std = @import("std");
const zluajit = @import("zluajit");

// ── Message queue (thread-safe) ─────────────────────────────────────────

const Message = struct {
    data: [256]u8 = undefined,
    len: usize = 0,

    fn fromSlice(s: []const u8) Message {
        var m = Message{};
        const copy_len = @min(s.len, 256);
        @memcpy(m.data[0..copy_len], s[0..copy_len]);
        m.len = copy_len;
        return m;
    }

    fn slice(self: *const Message) []const u8 {
        return self.data[0..self.len];
    }
};

const MessageQueue = struct {
    buf: [4096]Message = undefined,
    head: usize = 0,
    tail: usize = 0,
    mutex: std.Thread.Mutex = .{},

    fn push(self: *MessageQueue, msg: Message) bool {
        self.mutex.lock();
        defer self.mutex.unlock();
        const next = (self.tail + 1) % 4096;
        if (next == self.head) return false;
        self.buf[self.tail] = msg;
        self.tail = next;
        return true;
    }

    fn pop(self: *MessageQueue) ?Message {
        self.mutex.lock();
        defer self.mutex.unlock();
        if (self.head == self.tail) return null;
        const msg = self.buf[self.head];
        self.head = (self.head + 1) % 4096;
        return msg;
    }

    fn count(self: *MessageQueue) usize {
        self.mutex.lock();
        defer self.mutex.unlock();
        if (self.tail >= self.head) return self.tail - self.head;
        return 4096 - self.head + self.tail;
    }
};

// ── Worker context ──────────────────────────────────────────────────────

const WorkerCtx = struct {
    inbox: MessageQueue = .{},
    outbox: MessageQueue = .{},
    script: [*:0]const u8,
    running: std.atomic.Value(bool) = std.atomic.Value(bool).init(true),
    lua_path: ?[*:0]const u8 = null,
};

threadlocal var tl_ctx: ?*WorkerCtx = null;

// ── Host functions using zluajit wrapFn ─────────────────────────────────

fn hostRecv(state: zluajit.State) c_int {
    const ctx = tl_ctx orelse return 0;
    if (ctx.inbox.pop()) |msg| {
        state.pushString(msg.slice());
        return 1;
    }
    return 0; // nil
}

fn hostSend(state: zluajit.State) c_int {
    const ctx = tl_ctx orelse return 0;
    if (state.toString(1)) |s| {
        _ = ctx.outbox.push(Message.fromSlice(s));
    }
    return 0;
}

fn hostRunning(state: zluajit.State) c_int {
    const ctx = tl_ctx orelse {
        state.pushBool(false);
        return 1;
    };
    state.pushBool(ctx.running.load(.monotonic));
    return 1;
}

// ── Worker thread ───────────────────────────────────────────────────────

fn workerThread(ctx: *WorkerCtx) void {
    tl_ctx = ctx;

    const state = zluajit.State.init(.{}) catch {
        std.debug.print("[lua-worker] Failed to create Lua state\n", .{});
        return;
    };
    defer state.deinit();
    state.openLibs();

    // Set package.path if needed
    if (ctx.lua_path) |path| {
        _ = state.getGlobal("package");
        state.pushString(std.mem.span(path));
        state.setField(-2, "path");
        state.pop(1);
    }

    // Register host functions — zluajit wrapFn with State param
    state.pushZFunction(hostRecv);
    state.setGlobal("host_recv");
    state.pushZFunction(hostSend);
    state.setGlobal("host_send");
    state.pushZFunction(hostRunning);
    state.setGlobal("host_running");

    state.doString(std.mem.span(ctx.script), null) catch |err| {
        std.debug.print("[lua-worker] Error: {}\n", .{err});
    };
}

// ── Benchmark 1: VM startup ─────────────────────────────────────────────

fn benchVMStartup() void {
    std.debug.print("\n=== Benchmark: LuaJIT VM startup (zluajit) ===\n", .{});
    const N = 10000;
    const t0 = std.time.microTimestamp();

    for (0..N) |_| {
        const state = zluajit.State.init(.{}) catch continue;
        state.openLibs();
        state.doString("return 1+1", null) catch {};
        state.deinit();
    }

    const t1 = std.time.microTimestamp();
    const total_us = t1 - t0;
    const per_vm = @divTrunc(total_us, N);
    std.debug.print("  {d} VMs created+destroyed in {d}ms\n", .{ N, @divTrunc(total_us, 1000) });
    std.debug.print("  {d}us per VM lifecycle\n", .{per_vm});
}

// ── Benchmark 2: Message throughput ─────────────────────────────────────

fn benchMessageThroughput() void {
    std.debug.print("\n=== Benchmark: Message passing throughput (zluajit) ===\n", .{});

    const script =
        \\local count = 0
        \\while host_running() do
        \\  local msg = host_recv()
        \\  if msg then
        \\    count = count + 1
        \\    host_send("ack:" .. count)
        \\  end
        \\end
        \\host_send("done:" .. count)
    ;

    var ctx = WorkerCtx{ .script = script };
    const thread = std.Thread.spawn(.{}, workerThread, .{&ctx}) catch {
        std.debug.print("  Failed to spawn thread\n", .{});
        return;
    };

    const t0 = std.time.microTimestamp();
    var sent: u64 = 0;
    var received: u64 = 0;

    while (std.time.microTimestamp() - t0 < 1_000_000) {
        for (0..100) |_| {
            if (ctx.inbox.push(Message.fromSlice("ping"))) sent += 1;
        }
        while (ctx.outbox.pop()) |_| received += 1;
    }

    ctx.running.store(false, .monotonic);
    std.Thread.sleep(10_000_000);
    while (ctx.outbox.pop()) |_| received += 1;
    thread.join();

    const t1 = std.time.microTimestamp();
    const total_us = t1 - t0;
    const msgs_per_sec = @divTrunc(sent * 1_000_000, @as(u64, @intCast(total_us)));

    std.debug.print("  Sent: {d}, Received: {d}\n", .{ sent, received });
    std.debug.print("  {d} msgs/sec round-trip\n", .{msgs_per_sec});
}

// ── Benchmark 3: Off-thread compute ─────────────────────────────────────

fn benchComputeOffThread() void {
    std.debug.print("\n=== Benchmark: Off-thread compute (zluajit) ===\n", .{});

    const script =
        \\local function serialize(t)
        \\  if type(t) == "table" then
        \\    local parts = {}
        \\    for k, v in pairs(t) do
        \\      parts[#parts+1] = '"' .. tostring(k) .. '":' .. serialize(v)
        \\    end
        \\    return '{' .. table.concat(parts, ',') .. '}'
        \\  elseif type(t) == "string" then
        \\    return '"' .. t .. '"'
        \\  else
        \\    return tostring(t)
        \\  end
        \\end
        \\
        \\local count = 0
        \\while host_running() do
        \\  local msg = host_recv()
        \\  if msg then
        \\    local data = {
        \\      id = count,
        \\      name = "user_" .. count,
        \\      score = count * 17 % 100,
        \\      active = count % 2 == 0,
        \\      tags = { "lua", "worker", "bench" }
        \\    }
        \\    local result = serialize(data)
        \\    host_send(result)
        \\    count = count + 1
        \\  end
        \\end
    ;

    var ctx = WorkerCtx{ .script = script };
    const thread = std.Thread.spawn(.{}, workerThread, .{&ctx}) catch {
        std.debug.print("  Failed to spawn thread\n", .{});
        return;
    };

    const t0 = std.time.microTimestamp();
    var sent: u64 = 0;
    var received: u64 = 0;

    while (std.time.microTimestamp() - t0 < 1_000_000) {
        for (0..50) |_| {
            if (ctx.inbox.push(Message.fromSlice("compute"))) sent += 1;
        }
        while (ctx.outbox.pop()) |_| received += 1;
    }

    ctx.running.store(false, .monotonic);
    std.Thread.sleep(10_000_000);
    while (ctx.outbox.pop()) |_| received += 1;
    thread.join();

    const t1 = std.time.microTimestamp();
    const total_us = t1 - t0;
    const ops_per_sec = @divTrunc(received * 1_000_000, @as(u64, @intCast(total_us)));

    std.debug.print("  Sent: {d}, Computed+Received: {d}\n", .{ sent, received });
    std.debug.print("  {d} compute ops/sec (serialize table -> JSON string)\n", .{ops_per_sec});
}

// ── Benchmark 4: Multi-worker ───────────────────────────────────────────

fn benchMultiWorker() void {
    std.debug.print("\n=== Benchmark: Multiple workers (4 threads, zluajit) ===\n", .{});

    const script =
        \\local sum = 0
        \\while host_running() do
        \\  local msg = host_recv()
        \\  if msg then
        \\    local n = 0
        \\    for i = 1, 1000 do
        \\      n = n + i * i
        \\    end
        \\    sum = sum + n
        \\    host_send(tostring(sum))
        \\  end
        \\end
    ;

    const NUM_WORKERS = 4;
    var contexts: [NUM_WORKERS]WorkerCtx = undefined;
    var threads: [NUM_WORKERS]std.Thread = undefined;

    for (0..NUM_WORKERS) |i| {
        contexts[i] = WorkerCtx{ .script = script };
        threads[i] = std.Thread.spawn(.{}, workerThread, .{&contexts[i]}) catch {
            std.debug.print("  Failed to spawn worker {d}\n", .{i});
            return;
        };
    }

    const t0 = std.time.microTimestamp();
    var total_sent: u64 = 0;
    var total_received: u64 = 0;

    while (std.time.microTimestamp() - t0 < 1_000_000) {
        for (0..NUM_WORKERS) |i| {
            for (0..20) |_| {
                if (contexts[i].inbox.push(Message.fromSlice("work"))) total_sent += 1;
            }
            while (contexts[i].outbox.pop()) |_| total_received += 1;
        }
    }

    for (0..NUM_WORKERS) |i| contexts[i].running.store(false, .monotonic);
    std.Thread.sleep(10_000_000);
    for (0..NUM_WORKERS) |i| {
        while (contexts[i].outbox.pop()) |_| total_received += 1;
        threads[i].join();
    }

    const t1 = std.time.microTimestamp();
    const total_us = t1 - t0;
    const ops_per_sec = @divTrunc(total_received * 1_000_000, @as(u64, @intCast(total_us)));

    std.debug.print("  {d} workers, Sent: {d}, Received: {d}\n", .{ NUM_WORKERS, total_sent, total_received });
    std.debug.print("  {d} total ops/sec across all workers\n", .{ops_per_sec});
    std.debug.print("  {d} ops/sec per worker\n", .{@divTrunc(ops_per_sec, NUM_WORKERS)});
}

// ── Benchmark 5: Love2D module load ─────────────────────────────────────

fn benchLoveModuleLoad() void {
    std.debug.print("\n=== Benchmark: Load love2d modules (zluajit) ===\n", .{});

    const lua_path = "/home/siah/creative/reactjit/love2d/lua/?.lua;/home/siah/creative/reactjit/love2d/lua/?/init.lua";

    const modules = [_]struct { name: []const u8, code: [:0]const u8 }{
        .{ .name = "json", .code =
            \\local json = require("json")
            \\local encoded = json.encode({name="test", value=42, tags={"a","b","c"}})
            \\local decoded = json.decode(encoded)
            \\return decoded.name
        },
        .{ .name = "math_utils", .code =
            \\local mu = require("math_utils")
            \\return type(mu)
        },
        .{ .name = "color", .code =
            \\local color = require("color")
            \\return type(color)
        },
    };

    for (modules) |mod| {
        const state = zluajit.State.init(.{}) catch {
            std.debug.print("  Failed to create state\n", .{});
            return;
        };
        defer state.deinit();
        state.openLibs();

        // Set package.path
        _ = state.getGlobal("package");
        state.pushString(lua_path);
        state.setField(-2, "path");
        state.pop(1);

        const t0 = std.time.microTimestamp();
        state.doString(mod.code[0..mod.code.len], null) catch {
            std.debug.print("  {s}: FAIL\n", .{mod.name});
            continue;
        };
        const t1 = std.time.microTimestamp();
        std.debug.print("  {s}: OK ({d}us)\n", .{ mod.name, t1 - t0 });
    }
}

// ── Benchmark 6: Memory footprint ───────────────────────────────────────

fn benchMemoryFootprint() void {
    std.debug.print("\n=== Benchmark: Memory footprint (zluajit) ===\n", .{});

    const NUM_VMS = 100;
    var states: [NUM_VMS]?zluajit.State = undefined;

    const t0 = std.time.microTimestamp();
    for (0..NUM_VMS) |i| {
        states[i] = zluajit.State.init(.{}) catch null;
        if (states[i]) |s| {
            s.openLibs();
            s.doString("local t = {}; for i=1,100 do t[i] = i*i end; return t", null) catch {};
        }
    }
    const t1 = std.time.microTimestamp();

    std.debug.print("  {d} VMs created in {d}us ({d}us each)\n", .{
        NUM_VMS,
        t1 - t0,
        @divTrunc(t1 - t0, NUM_VMS),
    });

    for (0..NUM_VMS) |i| {
        if (states[i]) |s| s.deinit();
    }

    std.debug.print("  Estimated: ~{d}MB for {d} VMs (LuaJIT base ~400KB each)\n", .{
        NUM_VMS * 400 / 1024,
        NUM_VMS,
    });
}

// ── Main ────────────────────────────────────────────────────────────────

pub fn main() !void {
    std.debug.print("╔════════════════════════════════════════════════════╗\n", .{});
    std.debug.print("║  LuaJIT Worker Benchmark (zluajit bindings)       ║\n", .{});
    std.debug.print("╚════════════════════════════════════════════════════╝\n", .{});

    benchVMStartup();
    benchMessageThroughput();
    benchComputeOffThread();
    benchMultiWorker();
    benchLoveModuleLoad();
    benchMemoryFootprint();

    std.debug.print("\n=== Done ===\n", .{});
}
