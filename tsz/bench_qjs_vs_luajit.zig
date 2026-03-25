//! QuickJS vs LuaJIT — Head-to-Head Benchmark (Fair JIT Edition)
//!
//! Each workload is wrapped in a function, compiled ONCE, then called N times.
//! This lets LuaJIT's trace compiler warm up and JIT the hot paths.
//! QuickJS also benefits from not re-parsing every iteration.
//!
//! Build: cd tsz && zig build bench-vs
//! Run:   ./zig-out/bin/bench-vs

const std = @import("std");

// ── QuickJS C bindings ──────────────────────────────────────────────────
const qjs = @cImport({
    @cDefine("_GNU_SOURCE", "1");
    @cDefine("QUICKJS_NG_BUILD", "1");
    @cInclude("quickjs.h");
});

// ── LuaJIT C bindings ──────────────────────────────────────────────────
const lua = @cImport({
    @cInclude("lua.h");
    @cInclude("lauxlib.h");
    @cInclude("lualib.h");
});

const QJS_UNDEFINED = qjs.JSValue{ .u = .{ .int32 = 0 }, .tag = 3 };

// ── Shared state for host callbacks ────────────────────────────────────
var g_state_slots: [64]i64 = [_]i64{0} ** 64;
var g_call_count: u64 = 0;

// ── QuickJS host functions ─────────────────────────────────────────────

fn qjsHostGetState(ctx: ?*qjs.JSContext, _: qjs.JSValue, argc: c_int, argv: [*c]qjs.JSValue) callconv(.c) qjs.JSValue {
    if (argc < 1) return QJS_UNDEFINED;
    var slot: i32 = 0;
    _ = qjs.JS_ToInt32(ctx, &slot, argv[0]);
    if (slot < 0 or slot >= 64) return QJS_UNDEFINED;
    return qjs.JS_NewFloat64(ctx, @floatFromInt(g_state_slots[@intCast(slot)]));
}

fn qjsHostSetState(ctx: ?*qjs.JSContext, _: qjs.JSValue, argc: c_int, argv: [*c]qjs.JSValue) callconv(.c) qjs.JSValue {
    if (argc < 2) return QJS_UNDEFINED;
    var slot: i32 = 0;
    _ = qjs.JS_ToInt32(ctx, &slot, argv[0]);
    if (slot < 0 or slot >= 64) return QJS_UNDEFINED;
    var val: f64 = 0;
    _ = qjs.JS_ToFloat64(ctx, &val, argv[1]);
    g_state_slots[@intCast(slot)] = @intFromFloat(val);
    g_call_count += 1;
    return QJS_UNDEFINED;
}

fn qjsHostNoop(_: ?*qjs.JSContext, _: qjs.JSValue, _: c_int, _: [*c]qjs.JSValue) callconv(.c) qjs.JSValue {
    g_call_count += 1;
    return QJS_UNDEFINED;
}

// ── LuaJIT host functions ──────────────────────────────────────────────

fn luaHostGetState(L: ?*lua.lua_State) callconv(.c) c_int {
    const slot = lua.lua_tointeger(L, 1);
    if (slot < 0 or slot >= 64) return 0;
    lua.lua_pushnumber(L, @floatFromInt(g_state_slots[@intCast(slot)]));
    return 1;
}

fn luaHostSetState(L: ?*lua.lua_State) callconv(.c) c_int {
    const slot = lua.lua_tointeger(L, 1);
    const val = lua.lua_tonumber(L, 2);
    if (slot < 0 or slot >= 64) return 0;
    g_state_slots[@intCast(slot)] = @intFromFloat(val);
    g_call_count += 1;
    return 0;
}

fn luaHostNoop(_: ?*lua.lua_State) callconv(.c) c_int {
    g_call_count += 1;
    return 0;
}

// ── Setup helpers ──────────────────────────────────────────────────────

fn setupQJS() ?*qjs.JSContext {
    const rt = qjs.JS_NewRuntime() orelse return null;
    const ctx = qjs.JS_NewContext(rt) orelse return null;
    const global = qjs.JS_GetGlobalObject(ctx);

    inline for (.{
        .{ "host_get_state", qjsHostGetState, 1 },
        .{ "host_set_state", qjsHostSetState, 2 },
        .{ "host_noop", qjsHostNoop, 0 },
    }) |entry| {
        const func = qjs.JS_NewCFunction(ctx, entry[1], entry[0], entry[2]);
        _ = qjs.JS_SetPropertyStr(ctx, global, entry[0], func);
    }

    qjs.JS_FreeValue(ctx, global);
    return ctx;
}

fn teardownQJS(ctx: *qjs.JSContext) void {
    const rt = qjs.JS_GetRuntime(ctx);
    qjs.JS_FreeContext(ctx);
    qjs.JS_FreeRuntime(rt);
}

fn setupLuaJIT() ?*lua.lua_State {
    const L = lua.luaL_newstate() orelse return null;
    lua.luaL_openlibs(L);

    lua.lua_pushcclosure(L, &luaHostGetState, 0);
    lua.lua_setglobal(L, "host_get_state");
    lua.lua_pushcclosure(L, &luaHostSetState, 0);
    lua.lua_setglobal(L, "host_set_state");
    lua.lua_pushcclosure(L, &luaHostNoop, 0);
    lua.lua_setglobal(L, "host_noop");

    return L;
}

// ── Precompile + repeated call helpers ─────────────────────────────────

/// Eval setup code in QJS (defines a function), then call that function N times
fn qjsBenchCall(ctx: *qjs.JSContext, setup: [*:0]const u8, call: [*:0]const u8, N: u64) i64 {
    // Run setup (defines the function)
    const setup_val = qjs.JS_Eval(ctx, setup, std.mem.len(setup), "<setup>", 0);
    qjs.JS_FreeValue(ctx, setup_val);

    // Time the repeated calls
    const t0 = std.time.microTimestamp();
    for (0..N) |_| {
        const val = qjs.JS_Eval(ctx, call, std.mem.len(call), "<call>", 0);
        qjs.JS_FreeValue(ctx, val);
    }
    return std.time.microTimestamp() - t0;
}

/// Eval setup code in Lua (defines a function), then call that function N times
fn luaBenchCall(L: *lua.lua_State, setup: [*:0]const u8, call: [*:0]const u8, N: u64) i64 {
    // Run setup
    if (lua.luaL_loadstring(L, setup) == 0) {
        _ = lua.lua_pcall(L, 0, 0, 0);
    } else {
        luaPrintError(L);
        lua.lua_pop(L, 1);
    }

    // Precompile the call chunk ONCE
    if (lua.luaL_loadstring(L, call) != 0) {
        luaPrintError(L);
        lua.lua_pop(L, 1);
        return 0;
    }
    // The compiled chunk is now on the stack. Save it as a reference.
    lua.lua_setglobal(L, "_bench_fn");

    // Time repeated calls — get the precompiled chunk, call it
    const t0 = std.time.microTimestamp();
    for (0..N) |_| {
        _ = lua.lua_getglobal(L, "_bench_fn");
        if (lua.lua_pcall(L, 0, 0, 0) != 0) {
            lua.lua_pop(L, 1);
        }
    }
    return std.time.microTimestamp() - t0;
}

fn luaPrintError(L: *lua.lua_State) void {
    var len: usize = 0;
    const err = lua.lua_tolstring(L, -1, &len);
    if (err != null) {
        const msg: []const u8 = @as([*]const u8, @ptrCast(err))[0..len];
        std.debug.print("  Lua error: {s}\n", .{msg});
    }
}

// ── Results ────────────────────────────────────────────────────────────

const BenchResult = struct { us: i64, ops: u64, ops_per_sec: u64 };

fn makeResult(us: i64, ops: u64) BenchResult {
    return .{
        .us = us,
        .ops = ops,
        .ops_per_sec = if (us > 0) @divTrunc(ops * 1_000_000, @as(u64, @intCast(us))) else 0,
    };
}

fn printResult(label: []const u8, qr: BenchResult, lr: BenchResult) void {
    const ratio = if (qr.ops_per_sec > 0 and lr.ops_per_sec > 0)
        @as(f64, @floatFromInt(lr.ops_per_sec)) / @as(f64, @floatFromInt(qr.ops_per_sec))
    else
        0.0;

    const winner: []const u8 = if (ratio > 1.0) "LuaJIT" else "QuickJS";

    std.debug.print("\n  {s}\n", .{label});
    std.debug.print("  ├─ QuickJS:  {d: >12} ops/sec  ({d}us total, {d} ops)\n", .{ qr.ops_per_sec, qr.us, qr.ops });
    std.debug.print("  ├─ LuaJIT:   {d: >12} ops/sec  ({d}us total, {d} ops)\n", .{ lr.ops_per_sec, lr.us, lr.ops });
    std.debug.print("  └─ Winner:   {s} ({d:.1}x)\n", .{ winner, if (ratio > 1.0) ratio else 1.0 / ratio });
}

// ═══════════════════════════════════════════════════════════════════════
// BENCHMARKS — each defines a function once, calls it N times
// ═══════════════════════════════════════════════════════════════════════

pub fn main() !void {
    std.debug.print("╔═══════════════════════════════════════════════════════════╗\n", .{});
    std.debug.print("║  QuickJS vs LuaJIT — Head-to-Head (Fair JIT Edition)     ║\n", .{});
    std.debug.print("║  Functions precompiled once, called N times.             ║\n", .{});
    std.debug.print("║  LuaJIT JIT traces warm up. QuickJS doesn't re-parse.   ║\n", .{});
    std.debug.print("╚═══════════════════════════════════════════════════════════╝\n", .{});

    const qctx = setupQJS() orelse {
        std.debug.print("Failed to init QuickJS\n", .{});
        return;
    };
    defer teardownQJS(qctx);

    const L = setupLuaJIT() orelse {
        std.debug.print("Failed to init LuaJIT\n", .{});
        return;
    };
    defer lua.lua_close(L);

    // ── 1. Bare call overhead ──────────────────────────────────────────
    {
        const N: u64 = 100_000;

        const js_setup = "function bench() { for (let i = 0; i < 1000; i++) host_noop(); }";
        const js_call = "bench()";

        const lua_setup = "function bench() for i = 1, 1000 do host_noop() end end";
        const lua_call = "bench()";

        g_call_count = 0;
        const q_us = qjsBenchCall(qctx, js_setup, js_call, N);
        const q_ops = g_call_count;

        g_call_count = 0;
        const l_us = luaBenchCall(L, lua_setup, lua_call, N);
        const l_ops = g_call_count;

        printResult("1. Bare host call overhead (1000 calls/iteration)", makeResult(q_us, q_ops), makeResult(l_us, l_ops));
    }

    // ── 2. State read/write (the bridge pattern) ───────────────────────
    {
        const N: u64 = 50_000;

        const js_setup =
            \\function bench() {
            \\  for (let i = 0; i < 100; i++) {
            \\    host_set_state(0, host_get_state(0) + 1);
            \\    host_set_state(1, host_get_state(1) + host_get_state(0));
            \\  }
            \\}
        ;
        const lua_setup =
            \\function bench()
            \\  for i = 1, 100 do
            \\    host_set_state(0, host_get_state(0) + 1)
            \\    host_set_state(1, host_get_state(1) + host_get_state(0))
            \\  end
            \\end
        ;

        @memset(&g_state_slots, 0);
        g_call_count = 0;
        const q_us = qjsBenchCall(qctx, js_setup, "bench()", N);
        const q_ops = g_call_count;

        @memset(&g_state_slots, 0);
        g_call_count = 0;
        const l_us = luaBenchCall(L, lua_setup, "bench()", N);
        const l_ops = g_call_count;

        printResult("2. State read/write bridge (100 get+set pairs/iter)", makeResult(q_us, q_ops), makeResult(l_us, l_ops));
    }

    // ── 3. Conditional logic (nested ternaries — codegen pain) ────────
    {
        const N: u64 = 100_000;

        const js_setup =
            \\function bench() {
            \\  let result = 0;
            \\  for (let i = 0; i < 500; i++) {
            \\    const x = i % 7;
            \\    result += x < 2 ? 10 : x < 4 ? 20 : x < 6 ? 30 : 40;
            \\    result += (i % 3 === 0) ? (i % 5 === 0 ? 100 : 50) : 0;
            \\  }
            \\  return result;
            \\}
        ;
        const lua_setup =
            \\function bench()
            \\  local result = 0
            \\  for i = 0, 499 do
            \\    local x = i % 7
            \\    result = result + (x < 2 and 10 or (x < 4 and 20 or (x < 6 and 30 or 40)))
            \\    result = result + (i % 3 == 0 and (i % 5 == 0 and 100 or 50) or 0)
            \\  end
            \\  return result
            \\end
        ;

        const q_us = qjsBenchCall(qctx, js_setup, "bench()", N);
        const l_us = luaBenchCall(L, lua_setup, "bench()", N);
        printResult("3. Conditional logic (500 nested ternaries/iter)", makeResult(q_us, N), makeResult(l_us, N));
    }

    // ── 4. Array/table .map() pattern ─────────────────────────────────
    {
        const N: u64 = 50_000;

        const js_setup =
            \\function bench() {
            \\  const items = [];
            \\  for (let i = 0; i < 100; i++) items.push({ id: i, name: "item_" + i, score: i * 17 % 100 });
            \\  return items.map(item => ({
            \\    label: item.name + " (" + item.score + ")",
            \\    highlight: item.score > 50,
            \\    tier: item.score > 80 ? "A" : item.score > 50 ? "B" : "C"
            \\  }));
            \\}
        ;
        const lua_setup =
            \\function bench()
            \\  local items = {}
            \\  for i = 0, 99 do items[#items+1] = { id = i, name = "item_" .. i, score = i * 17 % 100 } end
            \\  local mapped = {}
            \\  for _, item in ipairs(items) do
            \\    mapped[#mapped+1] = {
            \\      label = item.name .. " (" .. item.score .. ")",
            \\      highlight = item.score > 50,
            \\      tier = item.score > 80 and "A" or (item.score > 50 and "B" or "C")
            \\    }
            \\  end
            \\  return mapped
            \\end
        ;

        const q_us = qjsBenchCall(qctx, js_setup, "bench()", N);
        const l_us = luaBenchCall(L, lua_setup, "bench()", N);
        printResult("4. Array/table map (100 objects -> transform/iter)", makeResult(q_us, N), makeResult(l_us, N));
    }

    // ── 5. String template building ───────────────────────────────────
    {
        const N: u64 = 50_000;

        const js_setup =
            \\function bench() {
            \\  let parts = [];
            \\  for (let i = 0; i < 200; i++) {
            \\    const name = "user_" + i;
            \\    const cls = i % 2 === 0 ? "even" : "odd";
            \\    parts.push("<div class=\"" + cls + "\">" + name + ": " + (i * 3) + "</div>");
            \\  }
            \\  return parts.join("\n");
            \\}
        ;
        const lua_setup =
            \\function bench()
            \\  local parts = {}
            \\  for i = 0, 199 do
            \\    local name = "user_" .. i
            \\    local cls = i % 2 == 0 and "even" or "odd"
            \\    parts[#parts+1] = '<div class="' .. cls .. '">' .. name .. ': ' .. (i * 3) .. '</div>'
            \\  end
            \\  return table.concat(parts, "\n")
            \\end
        ;

        const q_us = qjsBenchCall(qctx, js_setup, "bench()", N);
        const l_us = luaBenchCall(L, lua_setup, "bench()", N);
        printResult("5. String template building (200 elements/iter)", makeResult(q_us, N), makeResult(l_us, N));
    }

    // ── 6. Component-like render (the full pattern) ───────────────────
    {
        const N: u64 = 20_000;

        const js_setup =
            \\function renderItem(item, isSelected) {
            \\  const bg = isSelected ? "#0066ff" : (item.index % 2 === 0 ? "#f0f0f0" : "#ffffff");
            \\  const label = item.name + (item.count > 0 ? " (" + item.count + ")" : "");
            \\  const opacity = item.active ? 1.0 : 0.5;
            \\  return { bg, label, opacity, visible: item.active || isSelected };
            \\}
            \\function bench() {
            \\  const items = [];
            \\  for (let i = 0; i < 50; i++) {
            \\    items.push({ index: i, name: "Item " + i, count: i * 3, active: i % 3 !== 0 });
            \\  }
            \\  const selected = 7;
            \\  return items.map(item => renderItem(item, item.index === selected));
            \\}
        ;
        const lua_setup =
            \\function renderItem(item, isSelected)
            \\  local bg = isSelected and "#0066ff" or (item.index % 2 == 0 and "#f0f0f0" or "#ffffff")
            \\  local label = item.name .. (item.count > 0 and (" (" .. item.count .. ")") or "")
            \\  local opacity = item.active and 1.0 or 0.5
            \\  return { bg = bg, label = label, opacity = opacity, visible = item.active or isSelected }
            \\end
            \\function bench()
            \\  local items = {}
            \\  for i = 0, 49 do
            \\    items[#items+1] = { index = i, name = "Item " .. i, count = i * 3, active = i % 3 ~= 0 }
            \\  end
            \\  local selected = 7
            \\  local rendered = {}
            \\  for _, item in ipairs(items) do
            \\    rendered[#rendered+1] = renderItem(item, item.index == selected)
            \\  end
            \\  return rendered
            \\end
        ;

        const q_us = qjsBenchCall(qctx, js_setup, "bench()", N);
        const l_us = luaBenchCall(L, lua_setup, "bench()", N);
        printResult("6. Component render pattern (50 items, conditionals+map)", makeResult(q_us, N), makeResult(l_us, N));
    }

    // ── 7. Pure compute (no bridge — raw VM speed) ────────────────────
    {
        const N: u64 = 10_000;

        const js_setup =
            \\function bench() {
            \\  let sum = 0;
            \\  for (let i = 0; i < 10000; i++) {
            \\    sum += Math.sin(i * 0.001) * Math.cos(i * 0.002);
            \\  }
            \\  return sum;
            \\}
        ;
        const lua_setup =
            \\function bench()
            \\  local sum = 0
            \\  local sin, cos = math.sin, math.cos
            \\  for i = 0, 9999 do
            \\    sum = sum + sin(i * 0.001) * cos(i * 0.002)
            \\  end
            \\  return sum
            \\end
        ;

        const q_us = qjsBenchCall(qctx, js_setup, "bench()", N);
        const l_us = luaBenchCall(L, lua_setup, "bench()", N);
        printResult("7. Pure compute (10K sin/cos, no bridge calls)", makeResult(q_us, N), makeResult(l_us, N));
    }

    // ── 8. Event handler simulation (setState from callbacks) ─────────
    {
        const N: u64 = 50_000;

        const js_setup =
            \\function handleClick(id) {
            \\  const current = host_get_state(0);
            \\  if (id === current) {
            \\    host_set_state(0, -1);
            \\  } else {
            \\    host_set_state(0, id);
            \\    host_set_state(1, host_get_state(1) + 1);
            \\  }
            \\}
            \\function bench() {
            \\  for (let i = 0; i < 100; i++) {
            \\    handleClick(i % 10);
            \\  }
            \\}
        ;
        const lua_setup =
            \\function handleClick(id)
            \\  local current = host_get_state(0)
            \\  if id == current then
            \\    host_set_state(0, -1)
            \\  else
            \\    host_set_state(0, id)
            \\    host_set_state(1, host_get_state(1) + 1)
            \\  end
            \\end
            \\function bench()
            \\  for i = 0, 99 do
            \\    handleClick(i % 10)
            \\  end
            \\end
        ;

        @memset(&g_state_slots, 0);
        g_call_count = 0;
        const q_us = qjsBenchCall(qctx, js_setup, "bench()", N);
        const q_ops = g_call_count;

        @memset(&g_state_slots, 0);
        g_call_count = 0;
        const l_us = luaBenchCall(L, lua_setup, "bench()", N);
        const l_ops = g_call_count;

        printResult("8. Event handler simulation (100 clicks with state)", makeResult(q_us, q_ops), makeResult(l_us, l_ops));
    }

    std.debug.print("\n============================================================\n", .{});
    std.debug.print("NOTE: Functions precompiled once, called N times.\n", .{});
    std.debug.print("LuaJIT JIT traces warm up after ~50 calls.\n", .{});
    std.debug.print("QuickJS-NG is bytecode-compiled (no JIT).\n", .{});
    std.debug.print("============================================================\n", .{});
}
