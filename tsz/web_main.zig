//! Web entry point — Emscripten + WebGPU.
//!
//! Build: zig build web
//!
//! This is the wasm32-emscripten entry point for the full tsz runtime.
//! Emscripten provides the WebGPU device (via emdawnwebgpu) and the
//! requestAnimationFrame loop. The same GPU pipelines, layout engine,
//! and QuickJS runtime run here as on native — just with a different
//! init path and main loop.

const std = @import("std");
const builtin = @import("builtin");
const layout = @import("framework/layout.zig");
const gpu = @import("framework/gpu/gpu.zig");
const wgpu = @import("wgpu");

// ── Emscripten C API ────────────────────────────────────────────────

const em = @cImport({
    @cInclude("emscripten.h");
    @cInclude("emscripten/html5.h");
    // emscripten_webgpu_get_device() is declared in webgpu.h (emdawnwebgpu)
    @cInclude("webgpu/webgpu.h");
});

// ── State ───────────────────────────────────────────────────────────

var g_initialized: bool = false;
var g_width: u32 = 800;
var g_height: u32 = 600;

// Frame loop is driven from JS (requestAnimationFrame → web_frame export)

// ── Exports for JS to call ──────────────────────────────────────────

// Logging to browser console via emscripten
extern "env" fn emscripten_console_log(msg: [*:0]const u8) void;
fn webLog(comptime fmt: []const u8, args: anytype) void {
    var buf: [512]u8 = undefined;
    const msg = std.fmt.bufPrint(&buf, fmt ++ "\x00", args) catch return;
    emscripten_console_log(@ptrCast(msg.ptr));
}

/// Called from JS after WebGPU device is acquired.
export fn web_init(width: u32, height: u32) void {
    webLog("web_init({}, {})", .{ width, height });

    // Get WebGPU device from Emscripten's JS-side acquisition
    const raw_device = em.emscripten_webgpu_get_device();
    webLog("emscripten_webgpu_get_device() = {}", .{@intFromPtr(raw_device)});
    const device: *wgpu.Device = @ptrCast(raw_device orelse {
        webLog("ERROR: emscripten_webgpu_get_device returned null", .{});
        return;
    });
    webLog("getting queue...", .{});
    const queue = device.getQueue() orelse {
        webLog("ERROR: device.getQueue() returned null", .{});
        return;
    };
    webLog("queue ok, calling gpu.initWeb...", .{});

    gpu.initWeb(device, queue, width, height) catch |err| {
        webLog("ERROR: gpu.initWeb failed: {s}", .{@errorName(err)});
        return;
    };
    webLog("gpu.initWeb succeeded", .{});

    g_width = width;
    g_height = height;
    g_initialized = true;
    webLog("web_init complete, ready for frames", .{});
    // rAF loop is driven from JS, not C — see index.html
}

/// Called from JS each frame via requestAnimationFrame.
export fn web_frame() void {
    if (!g_initialized) return;

    // Draw test rects
    const w_f: f32 = @floatFromInt(g_width);
    const h_f: f32 = @floatFromInt(g_height);
    gpu.drawRect(w_f * 0.1, h_f * 0.1, w_f * 0.8, h_f * 0.8, 0.12, 0.14, 0.18, 1.0, 12, 1, 0.34, 0.40, 0.49, 1.0);
    gpu.drawRect(w_f * 0.1, h_f * 0.1, w_f * 0.8, 4, 0.34, 0.65, 1.0, 1.0, 12, 0, 0, 0, 0, 0);
    var i: u32 = 0;
    while (i < 3) : (i += 1) {
        const fi: f32 = @floatFromInt(i);
        gpu.drawRect(w_f * 0.15 + fi * (w_f * 0.22), h_f * 0.3, w_f * 0.18, h_f * 0.4, 0.16 + fi * 0.04, 0.18, 0.22, 1.0, 8, 1, 0.25, 0.28, 0.33, 1.0);
    }
    gpu.frame(0.05, 0.07, 0.09);
}

/// Called from JS on canvas resize.
export fn web_resize(width: u32, height: u32) void {
    g_width = width;
    g_height = height;
    gpu.resize(width, height);
}

// ── Emscripten main (required, can be empty) ────────────────────────

pub fn main() void {
    // Emscripten main returns immediately. Rendering is driven by
    // requestAnimationFrame via web_init().
}
