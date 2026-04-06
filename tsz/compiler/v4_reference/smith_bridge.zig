//! Smith Bridge — minimal QuickJS integration for the compiler.
//!
//! Forge lexes .tsz tokens in Zig, then hands them to Smith (JS) via this bridge.
//! Smith does all codegen and returns a .zig source string.
//! This module is the only QuickJS dependency in the compiler.

const std = @import("std");

const qjs = @cImport({
    @cDefine("_GNU_SOURCE", "1");
    @cDefine("QUICKJS_NG_BUILD", "1");
    @cInclude("quickjs.h");
});

var g_rt: ?*qjs.JSRuntime = null;
var g_ctx: ?*qjs.JSContext = null;

pub fn init() void {
    g_rt = qjs.JS_NewRuntime();
    if (g_rt) |rt| {
        qjs.JS_SetMaxStackSize(rt, 8 * 1024 * 1024); // 8MB JS stack
        g_ctx = qjs.JS_NewContext(rt);
    }
}

pub fn deinit() void {
    if (g_ctx) |ctx| qjs.JS_FreeContext(ctx);
    if (g_rt) |rt| qjs.JS_FreeRuntime(rt);
    g_ctx = null;
    g_rt = null;
}

/// Load and evaluate a JS source string (Smith's code).
pub fn loadModule(code: []const u8, filename: []const u8) bool {
    const ctx = g_ctx orelse return false;
    // Need null-terminated filename for QuickJS
    var fname_buf: [512]u8 = undefined;
    const fname_len = @min(filename.len, fname_buf.len - 1);
    @memcpy(fname_buf[0..fname_len], filename[0..fname_len]);
    fname_buf[fname_len] = 0;

    const val = qjs.JS_Eval(ctx, code.ptr, code.len, &fname_buf, qjs.JS_EVAL_TYPE_GLOBAL);
    if (qjs.JS_IsException(val)) {
        dumpException(ctx);
        return false;
    }
    qjs.JS_FreeValue(ctx, val);
    return true;
}

/// Set a global string variable in the JS context.
pub fn setGlobalString(name: [*:0]const u8, value: []const u8) void {
    const ctx = g_ctx orelse return;
    const global = qjs.JS_GetGlobalObject(ctx);
    defer qjs.JS_FreeValue(ctx, global);
    const js_str = qjs.JS_NewStringLen(ctx, value.ptr, value.len);
    _ = qjs.JS_SetPropertyStr(ctx, global, name, js_str);
}


/// Set a global integer variable in the JS context.
pub fn setGlobalInt(name: [*:0]const u8, value: i64) void {
    const ctx = g_ctx orelse return;
    const global = qjs.JS_GetGlobalObject(ctx);
    defer qjs.JS_FreeValue(ctx, global);
    _ = qjs.JS_SetPropertyStr(ctx, global, name, qjs.JS_NewInt64(ctx, value));
}

/// Set token data as a global JS string (flat format: "kind,start,end\nkind,start,end\n...").
/// JS parses this into arrays. Simple, no typed array FFI needed for Phase 1.
pub fn setTokenData(kinds: []const u8, starts: []const u32, ends: []const u32, count: u32) void {
    const ctx = g_ctx orelse return;
    // Build a flat string: "kind start end\nkind start end\n..."
    // JS splits on \n and parses each line. Simple, fast enough for now.
    var buf: std.ArrayListUnmanaged(u8) = .{};
    const alloc = std.heap.page_allocator;
    for (0..count) |i| {
        const line = std.fmt.allocPrint(alloc,
            "{d} {d} {d}\n", .{ kinds[i], starts[i], ends[i] }) catch continue;
        buf.appendSlice(alloc, line) catch continue;
    }
    const global = qjs.JS_GetGlobalObject(ctx);
    defer qjs.JS_FreeValue(ctx, global);
    const js_str = qjs.JS_NewStringLen(ctx, buf.items.ptr, buf.items.len);
    _ = qjs.JS_SetPropertyStr(ctx, global, "__tokens", js_str);
}

/// Call the global compile() function and return the result string.
/// Returns null on error.
pub fn callCompile(alloc: std.mem.Allocator) ?[]const u8 {
    const ctx = g_ctx orelse return null;

    // eval: compile()
    const code = "compile()";
    const val = qjs.JS_Eval(ctx, code.ptr, code.len, "<forge>", qjs.JS_EVAL_TYPE_GLOBAL);
    if (qjs.JS_IsException(val)) {
        dumpException(ctx);
        return null;
    }
    defer qjs.JS_FreeValue(ctx, val);

    // Extract string result
    var len: usize = 0;
    const ptr = qjs.JS_ToCStringLen(ctx, &len, val);
    if (ptr == null) return null;
    defer qjs.JS_FreeCString(ctx, ptr);

    // Copy to Zig-managed memory
    const result = alloc.alloc(u8, len) catch return null;
    @memcpy(result, ptr[0..len]);
    return result;
}

fn dumpException(ctx: *qjs.JSContext) void {
    const ex = qjs.JS_GetException(ctx);
    defer qjs.JS_FreeValue(ctx, ex);
    const str = qjs.JS_ToCString(ctx, ex);
    if (str != null) {
        std.debug.print("[forge] Smith error: {s}\n", .{str});
        qjs.JS_FreeCString(ctx, str);
    }
    // Also print stack trace if available
    if (qjs.JS_IsObject(ex)) {
        const stack = qjs.JS_GetPropertyStr(ctx, ex, "stack");
        if (qjs.JS_IsString(stack)) {
            const stack_str = qjs.JS_ToCString(ctx, stack);
            if (stack_str != null) {
                std.debug.print("{s}\n", .{stack_str});
                qjs.JS_FreeCString(ctx, stack_str);
            }
        }
        qjs.JS_FreeValue(ctx, stack);
    }
}
