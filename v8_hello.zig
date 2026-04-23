//! Smoke test for framework/v8_runtime.zig.
//! Builds standalone — no SDL, no framework. Proves the V8 link+init works.

const std = @import("std");
const v8rt = @import("framework/v8_runtime.zig");
const v8 = @import("v8");

comptime {
    _ = @import("framework/v8_bindings_fs.zig");
}

fn hostLog(info_c: ?*const v8.c.FunctionCallbackInfo) callconv(.c) void {
    const info = v8.FunctionCallbackInfo.initFromV8(info_c);
    const iso = info.getIsolate();
    var hs: v8.HandleScope = undefined;
    hs.init(iso);
    defer hs.deinit();
    const ctx = iso.getCurrentContext();
    var out = std.ArrayList(u8){};
    defer out.deinit(std.heap.c_allocator);
    var i: u32 = 0;
    while (i < info.length()) : (i += 1) {
        const arg = info.getArg(i);
        const s = arg.toString(ctx) catch continue;
        const n = s.lenUtf8(iso);
        const buf = std.heap.c_allocator.alloc(u8, n) catch continue;
        defer std.heap.c_allocator.free(buf);
        _ = s.writeUtf8(iso, buf);
        if (i > 0) out.append(std.heap.c_allocator, ' ') catch {};
        out.appendSlice(std.heap.c_allocator, buf) catch {};
    }
    std.debug.print("[js] {s}\n", .{out.items});
}

pub fn main() !void {
    v8rt.initVM();
    defer v8rt.teardownVM();

    v8rt.registerHostFn("hostLog", hostLog);

    v8rt.evalScript(
        \\hostLog('hello from v8', 1 + 2, 'pi=' + Math.PI);
        \\globalThis.__tick = function(n) { hostLog('tick', n); };
    );

    v8rt.callGlobalInt("__tick", 42);

    std.debug.print("v8_hello: ok\n", .{});
}
