//! Hot-reload development shell for tsz apps.
//!
//! Loads a compiled .tsz app from a shared library (.so), runs the engine,
//! and hot-reloads when the .so is recompiled. The window stays open, GPU
//! context is preserved, and only the app code (node tree, state, handlers)
//! is swapped.
//!
//! Usage: tsz-dev <path-to-app.so>

const std = @import("std");
const layout = @import("layout.zig");
const engine = @import("engine.zig");
const Node = layout.Node;

// ── Function pointer types matching the C ABI exports from generated code ──

const GetRootFn = *const fn () callconv(.c) *Node;
const GetInitFn = *const fn () callconv(.c) ?*const fn () void;
const GetTickFn = *const fn () callconv(.c) ?*const fn (u32) void;
const GetTitleFn = *const fn () callconv(.c) [*:0]const u8;
const GetJsLogicFn = *const fn () callconv(.c) [*]const u8;
const GetJsLogicLenFn = *const fn () callconv(.c) usize;

// State preservation function types
const StateCountFn = *const fn () callconv(.c) usize;
const SlotTypeFn = *const fn (usize) callconv(.c) u8;
const GetIntFn = *const fn (usize) callconv(.c) i64;
const SetIntFn = *const fn (usize, i64) callconv(.c) void;
const GetFloatFn = *const fn (usize) callconv(.c) f64;
const SetFloatFn = *const fn (usize, f64) callconv(.c) void;
const GetBoolFn = *const fn (usize) callconv(.c) u8;
const SetBoolFn = *const fn (usize, u8) callconv(.c) void;
const GetStrPtrFn = *const fn (usize) callconv(.c) [*]const u8;
const GetStrLenFn = *const fn (usize) callconv(.c) usize;
const SetStrFn = *const fn (usize, [*]const u8, usize) callconv(.c) void;
const MarkDirtyFn = *const fn () callconv(.c) void;

// ── Module-level state for the hot-reload mechanism ──

var g_lib: ?std.DynLib = null;
var g_lib_path: []const u8 = "";
var g_last_mtime: i128 = 0;
var g_shadow_counter: u32 = 0;
var g_shadow_buf: [256]u8 = undefined;

// ── Entry point ──

pub fn main() !void {
    var arena = std.heap.ArenaAllocator.init(std.heap.page_allocator);
    defer arena.deinit();
    const alloc = arena.allocator();

    const args = try std.process.argsAlloc(alloc);
    if (args.len < 2) {
        std.debug.print("Usage: tsz-dev <path-to-app.so>\n", .{});
        std.debug.print("\nHot-reload development shell. Loads a .tsz app from a shared library\n", .{});
        std.debug.print("and automatically reloads when the .so is recompiled.\n", .{});
        std.debug.print("\nBuild the .so with: zig build app-lib\n", .{});
        return;
    }

    g_lib_path = args[1];

    // Initial load
    loadLibrary() catch |err| {
        std.debug.print("[dev-shell] Failed to load {s}: {}\n", .{ g_lib_path, err });
        return;
    };

    // Record initial mtime
    if (std.fs.cwd().statFile(g_lib_path)) |stat| {
        g_last_mtime = stat.mtime;
    } else |_| {}

    // Build AppConfig from .so symbols
    var config = buildConfig() catch |err| {
        std.debug.print("[dev-shell] Symbol lookup failed: {}\n", .{err});
        return;
    };
    config.check_reload = &checkReload;
    config.post_reload = &restoreState;

    std.debug.print("[dev-shell] Loaded {s}\n", .{g_lib_path});
    std.debug.print("[dev-shell] Watching for changes... (rebuild .so to hot-reload)\n", .{});

    try engine.run(config);
}

// ── Library loading ──

fn loadLibrary() !void {
    // Close existing library
    if (g_lib) |*lib| lib.close();

    // Shadow copy to a temp file — avoids file lock conflicts during rebuild.
    // Each reload gets a new temp path so dlopen sees a fresh library.
    const shadow_path = std.fmt.bufPrint(&g_shadow_buf, "/tmp/tsz_hot_{d}.so", .{g_shadow_counter}) catch
        return error.FileNotFound;
    g_shadow_counter += 1;

    // Copy the .so to the shadow path
    const src = std.fs.cwd().openFile(g_lib_path, .{}) catch return error.FileNotFound;
    defer src.close();

    const dst_path_abs = shadow_path;
    const dst = std.fs.createFileAbsolute(dst_path_abs, .{}) catch return error.FileNotFound;
    defer dst.close();

    // Read and write in chunks
    var buf: [65536]u8 = undefined;
    while (true) {
        const n = src.read(&buf) catch return error.FileNotFound;
        if (n == 0) break;
        dst.writeAll(buf[0..n]) catch return error.FileNotFound;
    }

    // Open the shadow copy as a dynamic library
    g_lib = std.DynLib.open(dst_path_abs) catch |err| {
        std.debug.print("[dev-shell] dlopen failed for {s}: {}\n", .{ dst_path_abs, err });
        return error.FileNotFound;
    };
}

// ── Symbol lookup ──

fn buildConfig() !engine.AppConfig {
    var lib = g_lib orelse return error.FileNotFound;

    const get_root = lib.lookup(GetRootFn, "app_get_root") orelse {
        std.debug.print("[dev-shell] Missing symbol: app_get_root\n", .{});
        return error.FileNotFound;
    };
    const get_init = lib.lookup(GetInitFn, "app_get_init") orelse {
        std.debug.print("[dev-shell] Missing symbol: app_get_init\n", .{});
        return error.FileNotFound;
    };
    const get_tick = lib.lookup(GetTickFn, "app_get_tick") orelse {
        std.debug.print("[dev-shell] Missing symbol: app_get_tick\n", .{});
        return error.FileNotFound;
    };
    const get_title = lib.lookup(GetTitleFn, "app_get_title") orelse {
        std.debug.print("[dev-shell] Missing symbol: app_get_title\n", .{});
        return error.FileNotFound;
    };

    var config = engine.AppConfig{
        .title = get_title(),
        .root = get_root(),
        .init = get_init(),
        .tick = get_tick(),
    };

    // JS logic (optional — may not be present in all apps)
    const maybe_js = lib.lookup(GetJsLogicFn, "app_get_js_logic");
    const maybe_js_len = lib.lookup(GetJsLogicLenFn, "app_get_js_logic_len");
    if (maybe_js) |get_js| {
        if (maybe_js_len) |get_len| {
            const ptr = get_js();
            const len = get_len();
            if (len > 0) {
                config.js_logic = ptr[0..len];
            }
        }
    }

    // Update the stored lib handle (we may have used a local copy)
    g_lib = lib;

    return config;
}

// ── State snapshot for preservation across reloads ──

const MAX_SNAP_SLOTS = 256;
const MAX_SNAP_STR = 512;

const SlotSnapshot = struct {
    slot_type: u8, // 0=int, 1=float, 2=bool, 3=string
    int_val: i64 = 0,
    float_val: f64 = 0,
    bool_val: u8 = 0,
    str_buf: [MAX_SNAP_STR]u8 = undefined,
    str_len: usize = 0,
};

var g_snapshot: [MAX_SNAP_SLOTS]SlotSnapshot = undefined;
var g_snapshot_count: usize = 0;

fn snapshotState() void {
    var lib = g_lib orelse return;
    const count_fn = lib.lookup(StateCountFn, "app_state_count") orelse return;
    const type_fn = lib.lookup(SlotTypeFn, "app_state_slot_type") orelse return;
    const count = count_fn();
    if (count > MAX_SNAP_SLOTS) return;

    const get_int = lib.lookup(GetIntFn, "app_state_get_int");
    const get_float = lib.lookup(GetFloatFn, "app_state_get_float");
    const get_bool = lib.lookup(GetBoolFn, "app_state_get_bool");
    const get_str_ptr = lib.lookup(GetStrPtrFn, "app_state_get_string_ptr");
    const get_str_len = lib.lookup(GetStrLenFn, "app_state_get_string_len");

    for (0..count) |i| {
        const t = type_fn(i);
        g_snapshot[i] = .{ .slot_type = t };
        switch (t) {
            0 => { // int
                if (get_int) |f| g_snapshot[i].int_val = f(i);
            },
            1 => { // float
                if (get_float) |f| g_snapshot[i].float_val = f(i);
            },
            2 => { // bool
                if (get_bool) |f| g_snapshot[i].bool_val = f(i);
            },
            3 => { // string
                if (get_str_ptr) |fp| {
                    if (get_str_len) |fl| {
                        const len = fl(i);
                        const ptr = fp(i);
                        const copy_len = @min(len, MAX_SNAP_STR);
                        @memcpy(g_snapshot[i].str_buf[0..copy_len], ptr[0..copy_len]);
                        g_snapshot[i].str_len = copy_len;
                    }
                }
            },
            else => {}, // array/string_array — skip for now
        }
    }
    g_snapshot_count = count;
    std.debug.print("[hot-reload] Saved {d} state slots\n", .{count});
}

fn restoreState() void {
    var lib = g_lib orelse return;
    if (g_snapshot_count == 0) return;

    const count_fn = lib.lookup(StateCountFn, "app_state_count") orelse return;
    const new_count = count_fn();
    const restore_count = @min(g_snapshot_count, new_count);

    const set_int = lib.lookup(SetIntFn, "app_state_set_int");
    const set_float = lib.lookup(SetFloatFn, "app_state_set_float");
    const set_bool = lib.lookup(SetBoolFn, "app_state_set_bool");
    const set_str = lib.lookup(SetStrFn, "app_state_set_string");
    const mark_dirty = lib.lookup(MarkDirtyFn, "app_state_mark_dirty");

    var restored: usize = 0;
    for (0..restore_count) |i| {
        const snap = g_snapshot[i];
        switch (snap.slot_type) {
            0 => { if (set_int) |f| { f(i, snap.int_val); restored += 1; } },
            1 => { if (set_float) |f| { f(i, snap.float_val); restored += 1; } },
            2 => { if (set_bool) |f| { f(i, snap.bool_val); restored += 1; } },
            3 => {
                if (set_str) |f| {
                    f(i, &snap.str_buf, snap.str_len);
                    restored += 1;
                }
            },
            else => {},
        }
    }
    // Mark dirty so the app rebuilds dynamic texts
    if (mark_dirty) |f| f();

    std.debug.print("[hot-reload] Restored {d}/{d} state slots\n", .{ restored, restore_count });
}

// ── Hot-reload check (called every frame by the engine) ──

fn checkReload(config: *engine.AppConfig) bool {
    // Poll the .so file's modification time
    const stat = std.fs.cwd().statFile(g_lib_path) catch return false;
    if (stat.mtime == g_last_mtime) return false;

    // Modification detected — wait briefly for the file to be fully written
    std.Thread.sleep(100 * std.time.ns_per_ms);

    // Re-check mtime (in case it changed again during the wait)
    const stat2 = std.fs.cwd().statFile(g_lib_path) catch return false;
    g_last_mtime = stat2.mtime;

    // Snapshot state from the OLD .so before unloading
    snapshotState();

    // Load the new library
    loadLibrary() catch |err| {
        std.debug.print("[hot-reload] Load failed: {}\n", .{err});
        return false;
    };

    // Look up new symbols and update the config
    const new_config = buildConfig() catch |err| {
        std.debug.print("[hot-reload] Symbol lookup failed: {}\n", .{err});
        return false;
    };

    config.root = new_config.root;
    config.init = new_config.init;
    config.tick = new_config.tick;
    // post_reload is already set — engine calls it after init, before tick

    return true;
}
