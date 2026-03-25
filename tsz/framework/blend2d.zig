//! Blend2D integration — 2D vector graphics via CPU rasterization + GPU texture upload.
//!
//! Provides filled path rendering (SVG paths, circles, rounded rects, gradients)
//! by rasterizing to a pixel buffer with Blend2D, then uploading as a wgpu texture
//! displayed via the images pipeline.
//!
//! The surface is created once and reused each frame. Pixel format is PRGB32
//! (premultiplied ARGB), which maps directly to BGRA8 on little-endian.

const std = @import("std");
const gpu = @import("gpu/gpu.zig");
const wgpu = @import("wgpu");

// ── C FFI declarations (from ffi/blend2d_shim.h) ──────────────────────

const B2DSurface = opaque {};

extern "c" fn b2d_create(width: c_int, height: c_int) ?*B2DSurface;
extern "c" fn b2d_destroy(s: *B2DSurface) void;
extern "c" fn b2d_clear(s: *B2DSurface) void;
extern "c" fn b2d_set_fill_rgba32(s: *B2DSurface, rgba32: u32) void;
extern "c" fn b2d_set_stroke_rgba32(s: *B2DSurface, rgba32: u32) void;
extern "c" fn b2d_set_stroke_width(s: *B2DSurface, width: f64) void;
extern "c" fn b2d_set_comp_op(s: *B2DSurface, op: c_int) void;
extern "c" fn b2d_set_global_alpha(s: *B2DSurface, alpha: f64) void;
extern "c" fn b2d_path_reset(s: *B2DSurface) void;
extern "c" fn b2d_path_from_svg(s: *B2DSurface, svg_d: [*]const u8, len: usize) void;
extern "c" fn b2d_fill_path(s: *B2DSurface) void;
extern "c" fn b2d_stroke_path(s: *B2DSurface) void;
extern "c" fn b2d_reset_transform(s: *B2DSurface) void;
extern "c" fn b2d_translate(s: *B2DSurface, tx: f64, ty: f64) void;
extern "c" fn b2d_scale(s: *B2DSurface, sx: f64, sy: f64) void;
extern "c" fn b2d_get_pixels(s: *B2DSurface) ?[*]const u8;

// ── Shared surface for Graph.Path fill rendering ──────────────────────

var g_surface: ?*B2DSurface = null;
var g_surface_w: u32 = 0;
var g_surface_h: u32 = 0;

// GPU texture for uploading blend2d output
var g_texture: ?*wgpu.Texture = null;
var g_texture_view: ?*wgpu.TextureView = null;
var g_sampler: ?*wgpu.Sampler = null;
var g_bind_group: ?*wgpu.BindGroup = null;

fn ensureSurface(w: u32, h: u32) ?*B2DSurface {
    if (g_surface != null and g_surface_w == w and g_surface_h == h) {
        return g_surface;
    }
    // Destroy old
    if (g_surface) |s| b2d_destroy(s);
    if (g_texture_view) |v| v.release();
    if (g_texture) |t| t.release();
    if (g_bind_group) |bg| bg.release();
    g_texture = null;
    g_texture_view = null;
    g_bind_group = null;

    g_surface = b2d_create(@intCast(w), @intCast(h));
    if (g_surface == null) return null;
    g_surface_w = w;
    g_surface_h = h;

    // Create GPU texture
    const device = gpu.getDevice() orelse return g_surface;
    g_texture = device.createTexture(&.{
        .label = wgpu.StringView.fromSlice("blend2d_surface"),
        .size = .{ .width = w, .height = h, .depth_or_array_layers = 1 },
        .mip_level_count = 1,
        .sample_count = 1,
        .dimension = .@"2d",
        .format = gpu.getFormat(),
        .usage = wgpu.TextureUsages.texture_binding | wgpu.TextureUsages.copy_dst,
    }) orelse return g_surface;
    g_texture_view = g_texture.?.createView(null);

    // Sampler
    if (g_sampler == null) {
        g_sampler = device.createSampler(&.{
            .address_mode_u = .clamp_to_edge,
            .address_mode_v = .clamp_to_edge,
            .mag_filter = .linear,
            .min_filter = .linear,
        });
    }

    // Bind group for images pipeline
    if (g_texture_view) |tv| {
        if (g_sampler) |samp| {
            g_bind_group = gpu.images.createBindGroup(tv, samp);
        }
    }

    return g_surface;
}

fn uploadToGPU(w: u32, h: u32) void {
    const s = g_surface orelse return;
    const pixels = b2d_get_pixels(s) orelse return;
    const queue = gpu.getQueue() orelse return;
    const texture = g_texture orelse return;

    // PRGB32 on little-endian is already BGRA byte order — direct upload
    const byte_size = w * h * 4;
    queue.writeTexture(
        &.{ .texture = texture, .mip_level = 0, .origin = .{ .x = 0, .y = 0, .z = 0 }, .aspect = .all },
        pixels,
        byte_size,
        &.{ .offset = 0, .bytes_per_row = w * 4, .rows_per_image = h },
        &.{ .width = w, .height = h, .depth_or_array_layers = 1 },
    );
}

// ── Public API ────────────────────────────────────────────────────────

/// Fill an SVG path. The path is in graph-space coordinates.
/// The image quad is positioned in graph-space at the path bounding box,
/// so the active GPU canvas transform maps it to screen.
///
/// `bb_*` = path bounding box in graph-space (computed by caller).
/// `pixels_per_unit` = how many pixels to rasterize per graph-space unit (quality).
pub fn fillSVGPath(
    d: []const u8,
    fill_r: f32,
    fill_g: f32,
    fill_b: f32,
    fill_a: f32,
    bb_min_x: f32,
    bb_min_y: f32,
    bb_w: f32,
    bb_h: f32,
    pixels_per_unit: f32,
) void {
    if (bb_w <= 0 or bb_h <= 0) return;

    // Determine pixel dimensions (quality controlled by pixels_per_unit)
    const ppu: f32 = @max(0.5, pixels_per_unit);
    const pw: u32 = @intFromFloat(@max(1, @min(2048, @ceil(bb_w * ppu))));
    const ph: u32 = @intFromFloat(@max(1, @min(2048, @ceil(bb_h * ppu))));

    const s = ensureSurface(pw, ph) orelse return;

    // Clear to transparent
    b2d_clear(s);

    // Transform: map graph-space bbox → pixel buffer
    b2d_reset_transform(s);
    const pw_f: f64 = @floatFromInt(pw);
    const ph_f: f64 = @floatFromInt(ph);
    const sx: f64 = pw_f / @as(f64, @floatCast(bb_w));
    const sy: f64 = ph_f / @as(f64, @floatCast(bb_h));
    b2d_scale(s, sx, sy);
    b2d_translate(s, -@as(f64, @floatCast(bb_min_x)), -@as(f64, @floatCast(bb_min_y)));

    // Set fill color (0xAARRGGBB)
    const a_byte: u32 = @intFromFloat(@max(0, @min(255, fill_a * 255.0)));
    const r_byte: u32 = @intFromFloat(@max(0, @min(255, fill_r * 255.0)));
    const g_byte: u32 = @intFromFloat(@max(0, @min(255, fill_g * 255.0)));
    const b_byte: u32 = @intFromFloat(@max(0, @min(255, fill_b * 255.0)));
    const rgba32 = (a_byte << 24) | (r_byte << 16) | (g_byte << 8) | b_byte;
    b2d_set_fill_rgba32(s, rgba32);

    // Parse SVG path and fill
    b2d_path_reset(s);
    b2d_path_from_svg(s, d.ptr, d.len);
    b2d_fill_path(s);

    // Upload to GPU and draw as image quad positioned in graph-space.
    // The active GPU canvas transform will map this to screen.
    uploadToGPU(pw, ph);
    if (g_bind_group) |bg| {
        gpu.images.queueQuad(bb_min_x, bb_min_y, bb_w, bb_h, 1.0, bg);
    }
}

/// Clean up all blend2d resources.
pub fn deinit() void {
    if (g_bind_group) |bg| bg.release();
    if (g_texture_view) |v| v.release();
    if (g_texture) |t| t.release();
    if (g_sampler) |s| s.release();
    if (g_surface) |s| b2d_destroy(s);
    g_bind_group = null;
    g_texture_view = null;
    g_texture = null;
    g_sampler = null;
    g_surface = null;
    g_surface_w = 0;
    g_surface_h = 0;
}
