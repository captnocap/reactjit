//! V8 host bindings for filesystem, process, window, canvas, and theme helpers.
//!
//! Mirrors the QJS-era bindings without changing the existing Zig impls.

const std = @import("std");
const v8 = @import("v8");
const v8_runtime = @import("v8_runtime.zig");

const engine = @import("engine.zig");
const qjs_runtime = @import("qjs_runtime.zig");
const canvas = @import("canvas.zig");
const process_mod = @import("process.zig");
const svg_path = @import("svg_path.zig");
const theme = @import("theme.zig");
const windows = @import("windows.zig");
const log = @import("log.zig");

extern fn getpid() c_int;
extern fn popen(command: [*:0]const u8, mode: [*:0]const u8) ?*anyopaque;
extern fn pclose(stream: *anyopaque) c_int;
extern fn fread(ptr: [*]u8, size: usize, nmemb: usize, stream: *anyopaque) usize;
extern fn setenv(name: [*:0]const u8, value: [*:0]const u8, overwrite: c_int) c_int;
extern fn exit(code: c_int) noreturn;

var g_app_dir_buf: [4096]u8 = undefined;
var g_app_dir_len: usize = 0;
var g_app_dir_resolved: bool = false;

fn currentContext(info: v8.FunctionCallbackInfo) v8.Context {
    return info.getIsolate().getCurrentContext();
}

fn argStringAlloc(alloc: std.mem.Allocator, info: v8.FunctionCallbackInfo, idx: u32) ?[]u8 {
    if (info.length() <= idx) return null;
    const iso = info.getIsolate();
    const ctx = iso.getCurrentContext();
    const str = info.getArg(idx).toString(ctx) catch return null;
    const len = str.lenUtf8(iso);
    const buf = alloc.alloc(u8, len) catch return null;
    _ = str.writeUtf8(iso, buf);
    return buf;
}

fn setValue(info: v8.FunctionCallbackInfo, value: anytype) void {
    info.getReturnValue().set(value);
}

fn setUndefined(info: v8.FunctionCallbackInfo) void {
    setValue(info, v8.initUndefined(info.getIsolate()).toValue());
}

fn setNull(info: v8.FunctionCallbackInfo) void {
    setValue(info, v8.initNull(info.getIsolate()).toValue());
}

fn setBool(info: v8.FunctionCallbackInfo, value: bool) void {
    setValue(info, v8.Boolean.init(info.getIsolate(), value));
}

fn setNumber(info: v8.FunctionCallbackInfo, value: anytype) void {
    const num: f64 = switch (@typeInfo(@TypeOf(value))) {
        .float => @floatCast(value),
        .int, .comptime_int => @floatFromInt(value),
        else => @compileError("setNumber only supports ints and floats"),
    };
    setValue(info, v8.Number.init(info.getIsolate(), num));
}

fn setString(info: v8.FunctionCallbackInfo, value: []const u8) void {
    const iso = info.getIsolate();
    setValue(info, v8.String.initUtf8(iso, value));
}

fn appendJsonEscaped(out: *std.ArrayList(u8), alloc: std.mem.Allocator, s: []const u8) !void {
    try out.append(alloc, '"');
    for (s) |ch| {
        switch (ch) {
            '"' => try out.appendSlice(alloc, "\\\""),
            '\\' => try out.appendSlice(alloc, "\\\\"),
            '\n' => try out.appendSlice(alloc, "\\n"),
            '\r' => try out.appendSlice(alloc, "\\r"),
            '\t' => try out.appendSlice(alloc, "\\t"),
            0...8, 11, 12, 14...31 => try out.writer(alloc).print("\\u{x:0>4}", .{ch}),
            else => try out.append(alloc, ch),
        }
    }
    try out.append(alloc, '"');
}

fn resolveAppDir() usize {
    if (g_app_dir_resolved) return g_app_dir_len;
    g_app_dir_resolved = true;

    const exe_path = std.posix.readlink("/proc/self/exe", &g_app_dir_buf) catch return 0;
    var dir_end: usize = exe_path.len;
    while (dir_end > 0 and g_app_dir_buf[dir_end - 1] != '/') dir_end -= 1;
    if (dir_end == 0) return 0;

    if (dir_end >= 4 and std.mem.eql(u8, g_app_dir_buf[dir_end - 4 .. dir_end], "lib/")) {
        dir_end -= 4;
        if (dir_end == 0 or g_app_dir_buf[dir_end - 1] != '/') {
            while (dir_end > 0 and g_app_dir_buf[dir_end - 1] != '/') dir_end -= 1;
        }
    }

    g_app_dir_len = dir_end;
    return dir_end;
}

fn fsRead(info_c: ?*const v8.c.FunctionCallbackInfo) callconv(.c) void {
    const info = v8.FunctionCallbackInfo.initFromV8(info_c);
    const path_alloc = std.heap.page_allocator;
    const path_buf = argStringAlloc(path_alloc, info, 0) orelse {
        setNull(info);
        return;
    };
    defer path_alloc.free(path_buf);

    const data = std.fs.cwd().readFileAlloc(path_alloc, path_buf, 16 * 1024 * 1024) catch {
        setNull(info);
        return;
    };
    defer path_alloc.free(data);
    setString(info, data);
}

fn fsWrite(info_c: ?*const v8.c.FunctionCallbackInfo) callconv(.c) void {
    const info = v8.FunctionCallbackInfo.initFromV8(info_c);
    const alloc = std.heap.page_allocator;
    const path_buf = argStringAlloc(alloc, info, 0) orelse {
        setBool(info, false);
        return;
    };
    defer alloc.free(path_buf);
    const content_buf = argStringAlloc(alloc, info, 1) orelse {
        setBool(info, false);
        return;
    };
    defer alloc.free(content_buf);

    if (std.mem.lastIndexOfScalar(u8, path_buf, '/')) |idx| {
        std.fs.cwd().makePath(path_buf[0..idx]) catch {};
    }
    const file = std.fs.cwd().createFile(path_buf, .{ .truncate = true }) catch {
        setBool(info, false);
        return;
    };
    defer file.close();
    file.writeAll(content_buf) catch {
        setBool(info, false);
        return;
    };
    setBool(info, true);
}

fn fsExists(info_c: ?*const v8.c.FunctionCallbackInfo) callconv(.c) void {
    const info = v8.FunctionCallbackInfo.initFromV8(info_c);
    const alloc = std.heap.page_allocator;
    const path_buf = argStringAlloc(alloc, info, 0) orelse {
        setBool(info, false);
        return;
    };
    defer alloc.free(path_buf);
    _ = std.fs.cwd().statFile(path_buf) catch {
        setBool(info, false);
        return;
    };
    setBool(info, true);
}

fn fsListJson(info_c: ?*const v8.c.FunctionCallbackInfo) callconv(.c) void {
    const info = v8.FunctionCallbackInfo.initFromV8(info_c);
    const alloc = std.heap.page_allocator;
    const path_buf = argStringAlloc(alloc, info, 0) orelse {
        setString(info, "[]");
        return;
    };
    defer alloc.free(path_buf);

    var out: std.ArrayList(u8) = .{};
    defer out.deinit(alloc);
    out.append(alloc, '[') catch {
        setString(info, "[]");
        return;
    };

    var dir = std.fs.cwd().openDir(path_buf, .{ .iterate = true }) catch {
        out.append(alloc, ']') catch {};
        setString(info, out.items);
        return;
    };
    defer dir.close();

    var first = true;
    var iter = dir.iterate();
    while (iter.next() catch null) |entry| {
        if (!first) out.append(alloc, ',') catch break;
        first = false;
        appendJsonEscaped(&out, alloc, entry.name) catch break;
    }
    out.append(alloc, ']') catch {
        setString(info, "[]");
        return;
    };
    setString(info, out.items);
}

fn fsMkdir(info_c: ?*const v8.c.FunctionCallbackInfo) callconv(.c) void {
    const info = v8.FunctionCallbackInfo.initFromV8(info_c);
    const alloc = std.heap.page_allocator;
    const path_buf = argStringAlloc(alloc, info, 0) orelse {
        setBool(info, false);
        return;
    };
    defer alloc.free(path_buf);
    std.fs.cwd().makePath(path_buf) catch {
        setBool(info, false);
        return;
    };
    setBool(info, true);
}

fn fsRemove(info_c: ?*const v8.c.FunctionCallbackInfo) callconv(.c) void {
    const info = v8.FunctionCallbackInfo.initFromV8(info_c);
    const alloc = std.heap.page_allocator;
    const path_buf = argStringAlloc(alloc, info, 0) orelse {
        setBool(info, false);
        return;
    };
    defer alloc.free(path_buf);

    const stat = std.fs.cwd().statFile(path_buf) catch {
        setBool(info, false);
        return;
    };
    switch (stat.kind) {
        .directory => std.fs.cwd().deleteDir(path_buf) catch {
            setBool(info, false);
            return;
        },
        else => std.fs.cwd().deleteFile(path_buf) catch {
            setBool(info, false);
            return;
        },
    }
    setBool(info, true);
}

fn fsStatJson(info_c: ?*const v8.c.FunctionCallbackInfo) callconv(.c) void {
    const info = v8.FunctionCallbackInfo.initFromV8(info_c);
    const alloc = std.heap.page_allocator;
    const path_buf = argStringAlloc(alloc, info, 0) orelse {
        setNull(info);
        return;
    };
    defer alloc.free(path_buf);

    const st = std.fs.cwd().statFile(path_buf) catch {
        setNull(info);
        return;
    };
    const mtime_ms: i64 = @intCast(@divTrunc(st.mtime, std.time.ns_per_ms));
    const is_dir = st.kind == .directory;

    var buf: [256]u8 = undefined;
    const s = std.fmt.bufPrint(
        &buf,
        "{{\"size\":{d},\"mtimeMs\":{d},\"isDir\":{s}}}",
        .{ st.size, mtime_ms, if (is_dir) "true" else "false" },
    ) catch {
        setNull(info);
        return;
    };
    setString(info, s);
}

fn fsReadfile(info_c: ?*const v8.c.FunctionCallbackInfo) callconv(.c) void {
    const info = v8.FunctionCallbackInfo.initFromV8(info_c);
    const alloc = std.heap.page_allocator;
    const path_buf = argStringAlloc(alloc, info, 0) orelse {
        setString(info, "");
        return;
    };
    defer alloc.free(path_buf);

    const data = std.fs.cwd().readFileAlloc(alloc, path_buf, 16 * 1024 * 1024) catch {
        setString(info, "");
        return;
    };
    defer alloc.free(data);
    setString(info, data);
}

fn fsWritefile(info_c: ?*const v8.c.FunctionCallbackInfo) callconv(.c) void {
    const info = v8.FunctionCallbackInfo.initFromV8(info_c);
    const alloc = std.heap.page_allocator;
    const path_buf = argStringAlloc(alloc, info, 0) orelse {
        setNumber(info, -1);
        return;
    };
    defer alloc.free(path_buf);
    const content_buf = argStringAlloc(alloc, info, 1) orelse {
        setNumber(info, -1);
        return;
    };
    defer alloc.free(content_buf);

    if (std.mem.lastIndexOfScalar(u8, path_buf, '/')) |idx| {
        std.fs.cwd().makePath(path_buf[0..idx]) catch {};
    }
    const file = std.fs.cwd().createFile(path_buf, .{}) catch {
        setNumber(info, -1);
        return;
    };
    defer file.close();
    file.writeAll(content_buf) catch {
        setNumber(info, -1);
        return;
    };
    setNumber(info, 0);
}

fn fsDeletefile(info_c: ?*const v8.c.FunctionCallbackInfo) callconv(.c) void {
    const info = v8.FunctionCallbackInfo.initFromV8(info_c);
    const alloc = std.heap.page_allocator;
    const path_buf = argStringAlloc(alloc, info, 0) orelse {
        setNumber(info, -1);
        return;
    };
    defer alloc.free(path_buf);
    std.fs.cwd().deleteFile(path_buf) catch {
        setNumber(info, -1);
        return;
    };
    setNumber(info, 0);
}

fn fsScandir(info_c: ?*const v8.c.FunctionCallbackInfo) callconv(.c) void {
    const info = v8.FunctionCallbackInfo.initFromV8(info_c);
    const alloc = std.heap.page_allocator;
    const iso = info.getIsolate();
    const ctx = iso.getCurrentContext();
    const path_buf = argStringAlloc(alloc, info, 0) orelse {
        const arr = v8.Array.init(iso, 0);
        setValue(info, arr.castTo(v8.Object).toValue());
        return;
    };
    defer alloc.free(path_buf);

    var dir = std.fs.cwd().openDir(path_buf, .{ .iterate = true }) catch {
        const arr = v8.Array.init(iso, 0);
        setValue(info, arr.castTo(v8.Object).toValue());
        return;
    };
    defer dir.close();

    const arr = v8.Array.init(iso, 0);
    const obj = arr.castTo(v8.Object);
    var iter = dir.iterate();
    var i: u32 = 0;
    while (iter.next() catch null) |entry| {
        const name = v8.String.initUtf8(iso, entry.name);
        _ = obj.setValueAtIndex(ctx, i, name.toValue());
        i += 1;
    }
    setValue(info, arr.castTo(v8.Object).toValue());
}

fn execCmd(info_c: ?*const v8.c.FunctionCallbackInfo) callconv(.c) void {
    const info = v8.FunctionCallbackInfo.initFromV8(info_c);
    const alloc = std.heap.page_allocator;
    const cmd_buf = argStringAlloc(alloc, info, 0) orelse {
        setString(info, "");
        return;
    };
    defer alloc.free(cmd_buf);

    const cmd_z = alloc.alloc(u8, cmd_buf.len + 1) catch {
        setString(info, "");
        return;
    };
    defer alloc.free(cmd_z);
    @memcpy(cmd_z[0..cmd_buf.len], cmd_buf);
    cmd_z[cmd_buf.len] = 0;
    const cmd_ptr: [*:0]const u8 = @ptrCast(cmd_z.ptr);

    const stream = popen(cmd_ptr, "r") orelse {
        setString(info, "");
        return;
    };
    var buf: [65536]u8 = undefined;
    var total: usize = 0;
    while (total < buf.len) {
        const n = fread(buf[total..].ptr, 1, buf.len - total, stream);
        if (n == 0) break;
        total += n;
    }
    _ = pclose(stream);
    if (total == 0) {
        setString(info, "");
        return;
    }
    setString(info, buf[0..total]);
}

fn getPid(info_c: ?*const v8.c.FunctionCallbackInfo) callconv(.c) void {
    const info = v8.FunctionCallbackInfo.initFromV8(info_c);
    setNumber(info, @as(i64, getpid()));
}

fn getEnv(info_c: ?*const v8.c.FunctionCallbackInfo) callconv(.c) void {
    const info = v8.FunctionCallbackInfo.initFromV8(info_c);
    const alloc = std.heap.page_allocator;
    const name_buf = argStringAlloc(alloc, info, 0) orelse {
        setString(info, "");
        return;
    };
    defer alloc.free(name_buf);
    const val = std.posix.getenv(name_buf) orelse {
        setString(info, "");
        return;
    };
    setString(info, val);
}

fn envGet(info_c: ?*const v8.c.FunctionCallbackInfo) callconv(.c) void {
    const info = v8.FunctionCallbackInfo.initFromV8(info_c);
    const alloc = std.heap.page_allocator;
    const name_buf = argStringAlloc(alloc, info, 0) orelse {
        setNull(info);
        return;
    };
    defer alloc.free(name_buf);
    const val = std.posix.getenv(name_buf) orelse {
        setNull(info);
        return;
    };
    setString(info, val);
}

fn envSet(info_c: ?*const v8.c.FunctionCallbackInfo) callconv(.c) void {
    const info = v8.FunctionCallbackInfo.initFromV8(info_c);
    const alloc = std.heap.page_allocator;
    const name_buf = argStringAlloc(alloc, info, 0) orelse {
        setUndefined(info);
        return;
    };
    defer alloc.free(name_buf);
    const value_buf = argStringAlloc(alloc, info, 1) orelse {
        setUndefined(info);
        return;
    };
    defer alloc.free(value_buf);

    const name_z = alloc.alloc(u8, name_buf.len + 1) catch {
        setUndefined(info);
        return;
    };
    defer alloc.free(name_z);
    @memcpy(name_z[0..name_buf.len], name_buf);
    name_z[name_buf.len] = 0;
    const value_z = alloc.alloc(u8, value_buf.len + 1) catch {
        setUndefined(info);
        return;
    };
    defer alloc.free(value_z);
    @memcpy(value_z[0..value_buf.len], value_buf);
    value_z[value_buf.len] = 0;

    _ = setenv(@ptrCast(name_z.ptr), @ptrCast(value_z.ptr), 1);
    setUndefined(info);
}

fn exitHost(info_c: ?*const v8.c.FunctionCallbackInfo) callconv(.c) void {
    const info = v8.FunctionCallbackInfo.initFromV8(info_c);
    const code = if (info.length() > 0) info.getArg(0).toI32(currentContext(info)) catch 0 else 0;
    exit(code);
}

fn beginTerminalDockResize(info_c: ?*const v8.c.FunctionCallbackInfo) callconv(.c) void {
    const info = v8.FunctionCallbackInfo.initFromV8(info_c);
    if (info.length() < 2) {
        setUndefined(info);
        return;
    }
    const ctx = currentContext(info);
    const start_y = info.getArg(0).toF64(ctx) catch 0;
    const start_height = info.getArg(1).toF64(ctx) catch 0;
    qjs_runtime.beginTerminalDockResize(@floatCast(start_y), @floatCast(start_height));
    setUndefined(info);
}

fn endTerminalDockResize(info_c: ?*const v8.c.FunctionCallbackInfo) callconv(.c) void {
    const info = v8.FunctionCallbackInfo.initFromV8(info_c);
    qjs_runtime.endTerminalDockResize();
    setUndefined(info);
}

fn getTerminalDockResizeState(info_c: ?*const v8.c.FunctionCallbackInfo) callconv(.c) void {
    const info = v8.FunctionCallbackInfo.initFromV8(info_c);
    const iso = info.getIsolate();
    const ctx = iso.getCurrentContext();
    const obj = v8.Object.init(iso);
    _ = obj.setValue(ctx, v8.String.initUtf8(iso, "active"), v8.Number.init(iso, if (qjs_runtime.terminalDockResizeActive()) 1 else 0).toValue());
    _ = obj.setValue(ctx, v8.String.initUtf8(iso, "startY"), v8.Number.init(iso, qjs_runtime.terminalDockResizeStartY()));
    _ = obj.setValue(ctx, v8.String.initUtf8(iso, "startHeight"), v8.Number.init(iso, qjs_runtime.terminalDockResizeStartHeight()));
    setValue(info, obj.toValue());
}

fn getActiveNode(info_c: ?*const v8.c.FunctionCallbackInfo) callconv(.c) void {
    const info = v8.FunctionCallbackInfo.initFromV8(info_c);
    if (canvas.getActiveNode()) |idx| {
        setNumber(info, @as(i64, idx));
    } else {
        setNumber(info, -1);
    }
}

fn getSelectedNode(info_c: ?*const v8.c.FunctionCallbackInfo) callconv(.c) void {
    const info = v8.FunctionCallbackInfo.initFromV8(info_c);
    if (canvas.getSelectedNode()) |idx| {
        setNumber(info, @as(i64, idx));
    } else {
        setNumber(info, -1);
    }
}

fn setFlowEnabled(info_c: ?*const v8.c.FunctionCallbackInfo) callconv(.c) void {
    const info = v8.FunctionCallbackInfo.initFromV8(info_c);
    if (info.length() < 1) {
        setUndefined(info);
        return;
    }
    const mode_raw = info.getArg(0).toI32(currentContext(info)) catch 2;
    svg_path.setFlowMode(@intCast(@max(0, @min(2, mode_raw))));
    setUndefined(info);
}

fn setVariant(info_c: ?*const v8.c.FunctionCallbackInfo) callconv(.c) void {
    const info = v8.FunctionCallbackInfo.initFromV8(info_c);
    if (info.length() < 1) {
        setUndefined(info);
        return;
    }
    const raw = info.getArg(0).toI32(currentContext(info)) catch 0;
    theme.setVariant(@intCast(@max(0, @min(255, raw))));
    setUndefined(info);
}

fn setNodeDim(info_c: ?*const v8.c.FunctionCallbackInfo) callconv(.c) void {
    const info = v8.FunctionCallbackInfo.initFromV8(info_c);
    if (info.length() < 2) {
        setUndefined(info);
        return;
    }
    const ctx = currentContext(info);
    const idx = info.getArg(0).toI32(ctx) catch 0;
    const opacity = info.getArg(1).toF64(ctx) catch 1.0;
    canvas.setNodeDim(@intCast(@max(0, idx)), @floatCast(opacity));
    setUndefined(info);
}

fn resetNodeDim(info_c: ?*const v8.c.FunctionCallbackInfo) callconv(.c) void {
    const info = v8.FunctionCallbackInfo.initFromV8(info_c);
    canvas.resetNodeDim();
    setUndefined(info);
}

fn setPathFlow(info_c: ?*const v8.c.FunctionCallbackInfo) callconv(.c) void {
    const info = v8.FunctionCallbackInfo.initFromV8(info_c);
    if (info.length() < 2) {
        setUndefined(info);
        return;
    }
    const ctx = currentContext(info);
    const idx = info.getArg(0).toI32(ctx) catch 0;
    const enabled = info.getArg(1).toI32(ctx) catch 1;
    canvas.setFlowOverride(@intCast(@max(0, idx)), enabled != 0);
    setUndefined(info);
}

fn resetPathFlow(info_c: ?*const v8.c.FunctionCallbackInfo) callconv(.c) void {
    const info = v8.FunctionCallbackInfo.initFromV8(info_c);
    canvas.resetFlowOverride();
    setUndefined(info);
}

fn windowClose(info_c: ?*const v8.c.FunctionCallbackInfo) callconv(.c) void {
    const info = v8.FunctionCallbackInfo.initFromV8(info_c);
    engine.windowClose();
    setUndefined(info);
}

fn windowMinimize(info_c: ?*const v8.c.FunctionCallbackInfo) callconv(.c) void {
    const info = v8.FunctionCallbackInfo.initFromV8(info_c);
    engine.windowMinimize();
    setUndefined(info);
}

fn windowMaximize(info_c: ?*const v8.c.FunctionCallbackInfo) callconv(.c) void {
    const info = v8.FunctionCallbackInfo.initFromV8(info_c);
    engine.windowMaximize();
    setUndefined(info);
}

fn windowIsMaximized(info_c: ?*const v8.c.FunctionCallbackInfo) callconv(.c) void {
    const info = v8.FunctionCallbackInfo.initFromV8(info_c);
    setBool(info, engine.windowIsMaximized());
}

fn openWindow(info_c: ?*const v8.c.FunctionCallbackInfo) callconv(.c) void {
    const info = v8.FunctionCallbackInfo.initFromV8(info_c);
    const alloc = std.heap.page_allocator;
    const title_buf = argStringAlloc(alloc, info, 0) orelse {
        setUndefined(info);
        return;
    };
    defer alloc.free(title_buf);
    if (info.length() < 3) {
        setUndefined(info);
        return;
    }

    const ctx = currentContext(info);
    var w: i32 = 400;
    var h: i32 = 400;
    w = info.getArg(1).toI32(ctx) catch w;
    h = info.getArg(2).toI32(ctx) catch h;

    const width: c_int = @intCast(w);
    const height: c_int = @intCast(h);
    var title_buf_z: [256:0]u8 = undefined;
    const copy_len = @min(title_buf.len, 255);
    @memcpy(title_buf_z[0..copy_len], title_buf[0..copy_len]);
    title_buf_z[copy_len] = 0;
    _ = windows.open(.{
        .title = &title_buf_z,
        .width = width,
        .height = height,
        .kind = .in_process,
    });
    setUndefined(info);
}

fn spawnSelf(info_c: ?*const v8.c.FunctionCallbackInfo) callconv(.c) void {
    const info = v8.FunctionCallbackInfo.initFromV8(info_c);
    const dir_len = resolveAppDir();
    if (dir_len == 0) {
        log.info(.engine, "spawn_self: failed to resolve app directory", .{});
        setNumber(info, -1);
        return;
    }

    const run_suffix = "run";
    if (dir_len + run_suffix.len >= g_app_dir_buf.len) {
        setNumber(info, -1);
        return;
    }

    var run_buf: [4096]u8 = undefined;
    @memcpy(run_buf[0..dir_len], g_app_dir_buf[0..dir_len]);
    @memcpy(run_buf[dir_len .. dir_len + run_suffix.len], run_suffix);
    run_buf[dir_len + run_suffix.len] = 0;
    const run_z: [*:0]const u8 = @ptrCast(run_buf[0 .. dir_len + run_suffix.len :0]);

    log.info(.engine, "spawn_self: run_path={s}", .{run_z});
    const child = process_mod.spawn(.{
        .exe = run_z,
        .env = &.{.{ .key = "TSZ_DEBUG", .value = "1" }},
        .new_session = false,
    }) catch |err| {
        log.info(.engine, "spawn_self: spawn failed: {s}", .{@errorName(err)});
        setNumber(info, -1);
        return;
    };
    log.info(.engine, "spawn_self: child pid={d}", .{child.pid});
    setNumber(info, @as(i64, child.pid));
}

fn getAppDir(info_c: ?*const v8.c.FunctionCallbackInfo) callconv(.c) void {
    const info = v8.FunctionCallbackInfo.initFromV8(info_c);
    const dir_len = resolveAppDir();
    if (dir_len == 0) {
        setString(info, "");
        return;
    }
    setString(info, g_app_dir_buf[0..dir_len]);
}

fn getRunPath(info_c: ?*const v8.c.FunctionCallbackInfo) callconv(.c) void {
    const info = v8.FunctionCallbackInfo.initFromV8(info_c);
    const dir_len = resolveAppDir();
    if (dir_len == 0) {
        setString(info, "");
        return;
    }
    const run_suffix = "run";
    if (dir_len + run_suffix.len >= g_app_dir_buf.len) {
        setString(info, "");
        return;
    }
    var buf: [4096]u8 = undefined;
    @memcpy(buf[0..dir_len], g_app_dir_buf[0..dir_len]);
    @memcpy(buf[dir_len .. dir_len + run_suffix.len], run_suffix);
    setString(info, buf[0 .. dir_len + run_suffix.len]);
}

pub fn registerFs(vm: anytype) void {
    _ = vm;
    v8_runtime.registerHostFn("__fs_read", fsRead);
    v8_runtime.registerHostFn("__fs_write", fsWrite);
    v8_runtime.registerHostFn("__fs_scandir", fsScandir);
    v8_runtime.registerHostFn("__fs_deletefile", fsDeletefile);
    v8_runtime.registerHostFn("__fs_readfile", fsReadfile);
    v8_runtime.registerHostFn("__fs_writefile", fsWritefile);
    v8_runtime.registerHostFn("__fs_exists", fsExists);
    v8_runtime.registerHostFn("__fs_list_json", fsListJson);
    v8_runtime.registerHostFn("__fs_stat_json", fsStatJson);
    v8_runtime.registerHostFn("__fs_mkdir", fsMkdir);
    v8_runtime.registerHostFn("__fs_remove", fsRemove);

    v8_runtime.registerHostFn("__window_close", windowClose);
    v8_runtime.registerHostFn("__windowClose", windowClose);
    v8_runtime.registerHostFn("__window_minimize", windowMinimize);
    v8_runtime.registerHostFn("__windowMinimize", windowMinimize);
    v8_runtime.registerHostFn("__window_maximize", windowMaximize);
    v8_runtime.registerHostFn("__windowMaximize", windowMaximize);
    v8_runtime.registerHostFn("__window_is_maximized", windowIsMaximized);
    v8_runtime.registerHostFn("__openWindow", openWindow);

    v8_runtime.registerHostFn("__getenv", getEnv);
    v8_runtime.registerHostFn("__env_get", envGet);
    v8_runtime.registerHostFn("__env_set", envSet);
    v8_runtime.registerHostFn("__getpid", getPid);
    v8_runtime.registerHostFn("__exec", execCmd);
    v8_runtime.registerHostFn("__exit", exitHost);
    v8_runtime.registerHostFn("__spawn_self", spawnSelf);
    v8_runtime.registerHostFn("__get_app_dir", getAppDir);
    v8_runtime.registerHostFn("__get_run_path", getRunPath);

    v8_runtime.registerHostFn("__beginTerminalDockResize", beginTerminalDockResize);
    v8_runtime.registerHostFn("__endTerminalDockResize", endTerminalDockResize);
    v8_runtime.registerHostFn("__getTerminalDockResizeState", getTerminalDockResizeState);

    v8_runtime.registerHostFn("getActiveNode", getActiveNode);
    v8_runtime.registerHostFn("getSelectedNode", getSelectedNode);
    v8_runtime.registerHostFn("setFlowEnabled", setFlowEnabled);
    v8_runtime.registerHostFn("setVariant", setVariant);
    v8_runtime.registerHostFn("setNodeDim", setNodeDim);
    v8_runtime.registerHostFn("resetNodeDim", resetNodeDim);
    v8_runtime.registerHostFn("setPathFlow", setPathFlow);
    v8_runtime.registerHostFn("resetPathFlow", resetPathFlow);
}
