//! Web entry point — renders generated_app.zig node tree through GPU pipeline.
//!
//! tsz build --web app.tsz → compiles .tsz → generated_app.zig → this entry point
//! Same layout engine + GPU pipeline as native. No hand-painted Zig UI.

const std = @import("std");
const builtin = @import("builtin");
const layout = @import("framework/layout.zig");
const gpu = @import("framework/gpu/gpu.zig");
const text_pipeline = @import("framework/gpu/text.zig");
const wgpu = @import("wgpu");
const Node = layout.Node;

// ── Generated app (compiled .tsz → generated_app.zig) ───────────────
// The generated app exports C ABI functions. We reference them via extern.

extern fn app_get_root() *Node;
extern fn app_get_init() ?*const fn () void;
extern fn app_get_tick() ?*const fn (u32) void;
extern fn app_get_title() [*:0]const u8;

// Force the generated app to be linked (it has the export symbols)
comptime {
    _ = @import("generated_app.zig");
}

// ── Emscripten C API ────────────────────────────────────────────────

const em = @cImport({
    @cInclude("emscripten.h");
    @cInclude("emscripten/html5.h");
    @cInclude("webgpu/webgpu.h");
});

// ── FreeType (shared with framework) ────────────────────────────────

const c = @import("framework/c.zig").imports;

// ── Logging ─────────────────────────────────────────────────────────

extern "env" fn emscripten_console_log(msg: [*:0]const u8) void;
fn webLog(comptime fmt_str: []const u8, args: anytype) void {
    var buf: [512]u8 = undefined;
    const msg = std.fmt.bufPrint(&buf, fmt_str ++ "\x00", args) catch return;
    emscripten_console_log(@ptrCast(msg.ptr));
}

// ── State ───────────────────────────────────────────────────────────

var g_initialized: bool = false;
var g_width: u32 = 800;
var g_height: u32 = 600;
var g_frame_count: u32 = 0;

// ── Layout + render ─────────────────────────────────────────────────

fn renderNode(node: *Node) void {
    if (node.style.display == .none) return;

    const r = node.computed;
    if (r.w <= 0 or r.h <= 0) return;

    // Background rect
    if (node.style.background_color) |bg| {
        if (bg.a > 0) {
            const bc = node.style.border_color orelse layout.Color.rgb(0, 0, 0);
            gpu.drawRect(
                r.x, r.y, r.w, r.h,
                @as(f32, @floatFromInt(bg.r)) / 255.0, @as(f32, @floatFromInt(bg.g)) / 255.0,
                @as(f32, @floatFromInt(bg.b)) / 255.0, @as(f32, @floatFromInt(bg.a)) / 255.0,
                node.style.border_radius, node.style.brdTop(),
                @as(f32, @floatFromInt(bc.r)) / 255.0, @as(f32, @floatFromInt(bc.g)) / 255.0,
                @as(f32, @floatFromInt(bc.b)) / 255.0, @as(f32, @floatFromInt(bc.a)) / 255.0,
            );
        }
    }

    // Text
    if (node.text) |txt| {
        const fs: u16 = if (node.font_size > 0) node.font_size else 14;
        const tc = node.text_color orelse layout.Color.rgb(255, 255, 255);
        gpu.drawTextLine(
            txt, r.x, r.y, fs,
            @as(f32, @floatFromInt(tc.r)) / 255.0, @as(f32, @floatFromInt(tc.g)) / 255.0,
            @as(f32, @floatFromInt(tc.b)) / 255.0, @as(f32, @floatFromInt(tc.a)) / 255.0,
        );
    }

    // Children
    for (node.children) |*child| {
        renderNode(child);
    }
}

// ── Exports ─────────────────────────────────────────────────────────

export fn web_init(width: u32, height: u32) void {
    webLog("web_init({}, {})", .{ width, height });

    const raw_device = em.emscripten_webgpu_get_device();
    const device: *wgpu.Device = @ptrCast(raw_device orelse {
        webLog("ERROR: no WebGPU device", .{});
        return;
    });
    const queue = device.getQueue() orelse {
        webLog("ERROR: no queue", .{});
        return;
    };

    gpu.initWeb(device, queue, width, height) catch |err| {
        webLog("ERROR: gpu.initWeb: {s}", .{@errorName(err)});
        return;
    };

    // Init FreeType
    var library: c.FT_Library = null;
    if (c.FT_Init_FreeType(&library) != 0) {
        webLog("ERROR: FT_Init_FreeType", .{});
        return;
    }
    var face: c.FT_Face = null;
    if (c.FT_New_Face(library, "/font.ttf", 0, &face) != 0) {
        webLog("ERROR: FT_New_Face", .{});
        return;
    }
    text_pipeline.initText(library, face, @as([*]const c.FT_Face, &.{}), 0);
    webLog("text pipeline ok", .{});

    // Init the generated app
    if (app_get_init()) |init_fn| init_fn();

    g_width = width;
    g_height = height;
    g_initialized = true;
    webLog("web_init complete: {s}", .{app_get_title()});
}

export fn web_frame() void {
    if (!g_initialized) return;
    g_frame_count += 1;

    const w_f: f32 = @floatFromInt(g_width);
    const h_f: f32 = @floatFromInt(g_height);

    // Tick the app
    if (app_get_tick()) |tick_fn| tick_fn(g_frame_count);

    // Get root node and compute layout
    const root = app_get_root();
    if (root.style.width == null or root.style.width.? < 0) {
        root.style.width = @floatFromInt(g_width);
        layout.markLayoutDirty();
    }
    if (root.style.height == null or root.style.height.? < 0) {
        root.style.height = @floatFromInt(g_height);
        layout.markLayoutDirty();
    }

    if (layout.isLayoutDirty()) {
        layout.layout(root, 0, 0, w_f, h_f);
        layout.clearLayoutDirty();
    }

    // Render the node tree through GPU
    renderNode(root);

    // Present
    gpu.frame(0.05, 0.07, 0.09);
}

export fn web_resize(width: u32, height: u32) void {
    g_width = width;
    g_height = height;
    gpu.resize(width, height);
    layout.markLayoutDirty();
}

export fn web_serial_char(byte: u32) void {
    _ = byte; // TODO: pipe to a terminal component
}

export fn web_click(x: f32, y: f32) void {
    _ = x;
    _ = y; // TODO: hit testing
}

pub fn main() void {}
