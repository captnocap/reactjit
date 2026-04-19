//! wgpu-native GPU backend for tsz — core orchestrator.
//!
//! Owns the wgpu instance, adapter, device, queue, surface, and globals
//! uniform buffer. Coordinates the rect, text, and curve pipelines.
//! SDL2 is still used for windowing and events — wgpu gets the
//! native window handle from SDL to create its surface.

const std = @import("std");
const builtin = @import("builtin");
const wgpu = @import("wgpu");

const is_web = builtin.cpu.arch == .wasm32;

// SDL only needed on native for window handle + surface creation
const c = if (!is_web) @import("../c.zig").imports else struct {};
const rects = @import("rects.zig");
const text = @import("text.zig");
const curves = @import("curves.zig");
const polys = @import("polys.zig");
pub const images = @import("images.zig");
const scene3d = @import("3d.zig");
const log = @import("../log.zig");

// ════════════════════════════════════════════════════════════════════════
// Re-exports — callers use gpu.drawRect(), gpu.RectInstance, etc.
// ════════════════════════════════════════════════════════════════════════

pub const drawRect = rects.drawRect;
pub const drawRectCorners = rects.drawRectCorners;
pub const drawRectCornersTransformed = rects.drawRectCornersTransformed;
pub const drawRectTransformed = rects.drawRectTransformed;
pub const drawRectShadow = rects.drawRectShadow;
pub const drawRectGradient = rects.drawRectGradient;
pub const drawTextLine = text.drawTextLine;
pub const drawTextWrapped = text.drawTextWrapped;
pub const drawSelectionRects = text.drawSelectionRects;
pub const drawCurve = curves.drawCurve;
pub const drawCubicCurve = curves.drawCubicCurve;
pub const drawTri = polys.drawTri;
pub const drawTriColored = polys.drawTriColored;
pub const initText = text.initText;
pub const getCharAdvance = text.getCharAdvance;
pub const getCharWidth = text.getCharWidth;
pub const drawGlyphAt = text.drawGlyphAt;
pub const getLineHeight = text.getLineHeight;
const layout_types = @import("../layout.zig");
pub const resetInlineSlots = text.resetInlineSlots;
pub const setTextEffect = text.setTextEffect;
pub const clearTextEffect = text.clearTextEffect;
pub fn getInlineSlotCount() u8 { return text.g_inline_slot_count; }
pub fn getInlineSlots() *const [text.MAX_RECORDED_SLOTS]layout_types.InlineSlot { return &text.g_inline_slots; }

// Type re-exports
pub const RectInstance = rects.RectInstance;
pub const GlyphInstance = text.GlyphInstance;
pub const CurveInstance = curves.CurveInstance;

// ════════════════════════════════════════════════════════════════════════
// GPU operations budget — cross-pipeline per-frame safety limit
// ═══════════════════════════════════════════════════════════��════════════

pub const GPU_OPS_BUDGET: u32 = 100_000;
pub var g_gpu_ops: u32 = 0;

// ════════════════════════════════════════════════════════════════════════
// Core GPU state
// ════════════════════════════════════════════════════════════════════════

var g_instance: ?*wgpu.Instance = null;
var g_surface: ?*wgpu.Surface = null;
var g_adapter: ?*wgpu.Adapter = null;
var g_device: ?*wgpu.Device = null;
var g_queue: ?*wgpu.Queue = null;
var g_format: wgpu.TextureFormat = .bgra8_unorm;
var g_width: u32 = 0;
var g_height: u32 = 0;

// Globals uniform buffer (screen_size) — shared by all pipelines
var g_globals_buffer: ?*wgpu.Buffer = null;

// ════════════════════════════════════════════════════════════════════════
// Canvas transform state
// ════════════════════════════════════════════════════════════════════════

pub const Transform = struct {
    ox: f32,
    oy: f32,
    tx: f32,
    ty: f32,
    scale: f32,
    active: bool,
};

var g_transform_ox: f32 = 0;
var g_transform_oy: f32 = 0;
var g_transform_tx: f32 = 0;
var g_transform_ty: f32 = 0;
var g_transform_scale: f32 = 1.0;
var g_transform_active: bool = false;

/// Set canvas transform. All subsequent draw calls are transformed.
pub fn setTransform(ox: f32, oy: f32, tx: f32, ty: f32, scale: f32) void {
    g_transform_ox = ox;
    g_transform_oy = oy;
    g_transform_tx = tx;
    g_transform_ty = ty;
    g_transform_scale = scale;
    g_transform_active = true;
}

/// Reset transform to identity.
pub fn resetTransform() void {
    g_transform_ox = 0;
    g_transform_oy = 0;
    g_transform_tx = 0;
    g_transform_ty = 0;
    g_transform_scale = 1.0;
    g_transform_active = false;
}

/// Get current transform state (used by sub-pipelines).
pub fn getTransform() Transform {
    return .{
        .ox = g_transform_ox,
        .oy = g_transform_oy,
        .tx = g_transform_tx,
        .ty = g_transform_ty,
        .scale = g_transform_scale,
        .active = g_transform_active,
    };
}

// ════════════════════════════════════════════════════════════════════════
// Accessors for sub-pipelines
// ════════════════════════════════════════════════════════════════════════

pub fn getDevice() ?*wgpu.Device {
    return g_device;
}

pub fn getQueue() ?*wgpu.Queue {
    return g_queue;
}

pub fn getWidth() u32 {
    return g_width;
}

pub fn getHeight() u32 {
    return g_height;
}

pub fn getFormat() wgpu.TextureFormat {
    return g_format;
}

// ════════════════════════════════════════════════════════════════════════
// Frame capture — wgpu equivalent of love.graphics.captureScreenshot()
// ════════════════════════════════════════════════════════════════════════

/// Callback receives: pixel data (BGRA8), width, height, stride.
/// The pixel data is only valid for the duration of the callback.
pub const CaptureCallback = *const fn (pixels: [*]const u8, w: u32, h: u32, stride: u32) void;
var g_capture_cb: ?CaptureCallback = null;
var g_capture_requested: bool = false;

/// Request a single-frame capture. The callback fires during the next frame().
/// Matches the Love2D pattern: captureScreenshot(callback).
pub fn captureScreenshot(cb: CaptureCallback) void {
    g_capture_cb = cb;
    g_capture_requested = true;
}

/// Request continuous capture (recording). Callback fires every frame.
pub fn startCapture(cb: CaptureCallback) void {
    g_capture_cb = cb;
    g_capture_requested = true;
}

pub fn stopCapture() void {
    g_capture_cb = null;
    g_capture_requested = false;
}

pub fn isCapturing() bool {
    return g_capture_requested;
}

/// Perform the actual readback. Called inside frame() after queue.submit(),
/// before surface.present(). Uses a second encoder to copy texture→buffer,
/// maps synchronously, and delivers pixels to the callback.
fn performCapture(device: *wgpu.Device, q: *wgpu.Queue, texture: *wgpu.Texture) void {
    const cb = g_capture_cb orelse return;
    const w = g_width;
    const h = g_height;
    if (w == 0 or h == 0) return;

    // bytes_per_row must be aligned to 256 for wgpu copyTextureToBuffer
    const unaligned_bpr = w * 4;
    const bytes_per_row = (unaligned_bpr + 255) & ~@as(u32, 255);
    const buf_size: u64 = @as(u64, bytes_per_row) * @as(u64, h);

    // Create staging buffer (map_read + copy_dst)
    const staging = device.createBuffer(&.{
        .label = wgpu.StringView.fromSlice("capture_staging"),
        .size = buf_size,
        .usage = wgpu.BufferUsages.copy_dst | wgpu.BufferUsages.map_read,
        .mapped_at_creation = 0,
    }) orelse return;
    defer staging.release();

    // Copy surface texture → staging buffer
    const enc = device.createCommandEncoder(&.{}) orelse return;
    enc.copyTextureToBuffer(
        &.{ .texture = texture, .mip_level = 0, .origin = .{ .x = 0, .y = 0, .z = 0 }, .aspect = .all },
        &.{ .layout = .{ .offset = 0, .bytes_per_row = bytes_per_row, .rows_per_image = h }, .buffer = staging },
        &.{ .width = w, .height = h, .depth_or_array_layers = 1 },
    );
    const cmd = enc.finish(null) orelse return;
    enc.release();
    q.submit(&.{cmd});
    cmd.release();

    // Map synchronously — blocking poll until map completes
    _ = staging.mapAsync(wgpu.MapModes.read, 0, @intCast(buf_size), .{
        .mode = .allow_process_events,
        .callback = &captureMapCallback,
    });
    _ = device.poll(true, null);

    // Read mapped data
    const mapped_ptr = staging.getConstMappedRange(0, @intCast(buf_size)) orelse return;
    const mapped: [*]const u8 = @ptrCast(mapped_ptr);

    // Deliver to callback (pixels are BGRA8, may have row padding)
    cb(mapped, w, h, bytes_per_row);

    staging.unmap();

    // Single-shot: clear after delivery
    if (g_capture_cb != null and !g_capture_requested) {
        // continuous mode — keep callback
    }
}

fn captureMapCallback(_: wgpu.MapAsyncStatus, _: wgpu.StringView, _: ?*anyopaque, _: ?*anyopaque) callconv(.c) void {
    // Nothing to do — we use blocking poll
}

pub fn getGlobalsBuffer() ?*wgpu.Buffer {
    return g_globals_buffer;
}

// ════════════════════════════════════════════════════════════════════════
// Draw boundaries — scissor transitions + image/effect z-order breaks
// ════════════════════════════════════════════════════════════════════════

const ScissorSegment = struct {
    x: u32,
    y: u32,
    w: u32,
    h: u32,
    rect_start: u32,
    glyph_start: u32,
    curve_start: u32,
    poly_start: u32,
    image_start: u32,
};

const MAX_SCISSOR_SEGMENTS = 768;
var g_scissor_segments: [MAX_SCISSOR_SEGMENTS]ScissorSegment = undefined;
var g_scissor_count: usize = 0;

// Scissor stack for nested clips
const MAX_SCISSOR_STACK = 16;
var g_scissor_stack: [MAX_SCISSOR_STACK]ScissorSegment = undefined;
var g_scissor_depth: usize = 0;

fn sameBoundary(a: ScissorSegment, b: ScissorSegment) bool {
    return a.x == b.x and a.y == b.y and a.w == b.w and a.h == b.h and
        a.rect_start == b.rect_start and a.glyph_start == b.glyph_start and
        a.curve_start == b.curve_start and a.poly_start == b.poly_start and
        a.image_start == b.image_start;
}

fn recordBoundary(x: u32, y: u32, w: u32, h: u32, image_start: u32) void {
    if (g_scissor_count >= MAX_SCISSOR_SEGMENTS) return;

    const seg = ScissorSegment{
        .x = x,
        .y = y,
        .w = w,
        .h = h,
        .rect_start = @intCast(rects.count()),
        .glyph_start = @intCast(text.count()),
        .curve_start = @intCast(curves.count()),
        .poly_start = @intCast(polys.count()),
        .image_start = image_start,
    };

    if (g_scissor_count > 0 and sameBoundary(g_scissor_segments[g_scissor_count - 1], seg)) return;
    g_scissor_segments[g_scissor_count] = seg;
    g_scissor_count += 1;
}

pub fn recordImageBoundary(image_start: u32) void {
    if (g_scissor_depth > 0) {
        const clip = g_scissor_stack[g_scissor_depth - 1];
        recordBoundary(clip.x, clip.y, clip.w, clip.h, image_start);
    } else {
        recordBoundary(0, 0, g_width, g_height, image_start);
    }
}

pub fn pushScissor(x: f32, y: f32, w: f32, h: f32) void {
    // Floor position, ceil the far edge, so the scissor fully contains the
    // fractional rect.  Without this, canvas zoom scales produce fractional
    // coordinates where truncating y can place the scissor 1px below the
    // first glyph scanline — clipping the top or bottom of text depending
    // on which direction the rounding error falls.
    const fx = if (x > 0) @floor(x) else 0;
    const fy = if (y > 0) @floor(y) else 0;
    var sx: u32 = @intFromFloat(fx);
    var sy: u32 = @intFromFloat(fy);
    var sw: u32 = if (w > 0) @intFromFloat(@ceil(x - fx + w)) else 0;
    var sh: u32 = if (h > 0) @intFromFloat(@ceil(y - fy + h)) else 0;

    // Intersect with parent scissor
    if (g_scissor_depth > 0) {
        const parent = g_scissor_stack[g_scissor_depth - 1];
        const px2 = parent.x + parent.w;
        const py2 = parent.y + parent.h;
        const nx = @max(sx, parent.x);
        const ny = @max(sy, parent.y);
        const nx2 = @min(sx + sw, px2);
        const ny2 = @min(sy + sh, py2);
        sx = nx;
        sy = ny;
        sw = if (nx2 > nx) nx2 - nx else 0;
        sh = if (ny2 > ny) ny2 - ny else 0;
    }

    // Clamp to surface dimensions — wgpu requires x+w <= width AND y+h <= height
    if (sx >= g_width) { sx = 0; sw = 0; }
    if (sy >= g_height) { sy = 0; sh = 0; }
    if (sx + sw > g_width) sw = g_width - sx;
    if (sy + sh > g_height) sh = g_height - sy;

    // Record segment boundary
    recordBoundary(sx, sy, sw, sh, @intCast(images.count()));

    // Push to stack
    if (g_scissor_depth < MAX_SCISSOR_STACK) {
        g_scissor_stack[g_scissor_depth] = .{
            .x = sx, .y = sy, .w = sw, .h = sh,
            .rect_start = 0, .glyph_start = 0, .curve_start = 0, .poly_start = 0, .image_start = 0,
        };
        g_scissor_depth += 1;
    }
}

pub fn popScissor() void {
    if (g_scissor_depth > 0) g_scissor_depth -= 1;

    // Record segment boundary for parent scissor (or full viewport)
    if (g_scissor_depth > 0) {
        const parent = g_scissor_stack[g_scissor_depth - 1];
        recordBoundary(parent.x, parent.y, parent.w, parent.h, @intCast(images.count()));
    } else {
        recordBoundary(0, 0, g_width, g_height, @intCast(images.count()));
    }
}

// ════════════════════════════════════════════════════════════════════════
// Dirty tracking & memory drain
// ════════════════════════════════════════════════════════════════════════

var g_prev_frame_hash: u64 = 0;
var g_prev_dims: [2]u32 = .{ 0, 0 };

const DRAIN_INTERVAL: u64 = 36000; // ~10 minutes at 60fps
var g_frame_counter: u64 = 0;

/// Combined hash from all pipelines for dirty checking.
fn frameDataHash() u64 {
    var h = rects.hashData();
    h ^= text.hashData();
    h ^= curves.hashData();
    h ^= polys.hashData();
    return h;
}

/// Drain fragmented GPU memory by recreating buffers + bind groups.
fn drainMemory() void {
    const device = g_device orelse return;

    // Destroy old globals buffer
    if (g_globals_buffer) |b| b.release();

    // Blocking poll to reclaim all pending resources (not available on web)
    if (!is_web) _ = device.poll(true, null);

    // Recreate globals buffer
    g_globals_buffer = device.createBuffer(&.{
        .label = wgpu.StringView.fromSlice("globals"),
        .size = 16,
        .usage = wgpu.BufferUsages.uniform | wgpu.BufferUsages.copy_dst,
        .mapped_at_creation = 0,
    });

    const globals_buffer = g_globals_buffer orelse return;

    // Drain each pipeline
    rects.drain(device, globals_buffer);
    text.drain(device, globals_buffer);
    curves.drain(device, globals_buffer);
    polys.drain(device, globals_buffer);
    images.drain(device, globals_buffer);

    // Force full redraw on next frame
    g_prev_frame_hash = 0;
    g_prev_dims = .{ 0, 0 };

    std.debug.print("[gpu] Memory drain: buffers recreated at frame {d}\n", .{g_frame_counter});
}

// ════════════════════════════════════════════════════════════════════════
// Public API
// ════════════════════════════════════════════════════════════════════════

/// Web init — device provided by emscripten, surface from canvas.
/// Uses the C webgpu.h API directly for surface creation (emscripten-specific).
pub fn initWeb(device: *wgpu.Device, queue: *wgpu.Queue, width: u32, height: u32) !void {
    std.debug.print("[gpu.initWeb] start w={} h={}\n", .{ width, height });
    g_device = device;
    g_queue = queue;
    g_width = width;
    g_height = height;

    // Create instance + surface from HTML canvas (web only)
    if (is_web) {
        std.debug.print("[gpu.initWeb] creating instance...\n", .{});
        g_instance = wgpu.Instance.create(null) orelse return error.WGPUInstanceFailed;
        std.debug.print("[gpu.initWeb] creating canvas surface...\n", .{});
        const instance = g_instance.?;
        g_surface = createCanvasSurface(instance) orelse return error.SurfaceCreateFailed;
        std.debug.print("[gpu.initWeb] surface created\n", .{});
    }

    // Configure surface (same as native path)
    std.debug.print("[gpu.initWeb] configuring surface...\n", .{});
    configureSurface(width, height);

    std.debug.print("[gpu.initWeb] creating globals buffer...\n", .{});
    g_globals_buffer = device.createBuffer(&.{
        .label = wgpu.StringView.fromSlice("globals"),
        .size = 16,
        .usage = wgpu.BufferUsages.uniform | wgpu.BufferUsages.copy_dst,
        .mapped_at_creation = 0,
    });

    const globals_buffer = g_globals_buffer orelse return error.BufferCreateFailed;

    std.debug.print("[gpu.initWeb] init rects pipeline...\n", .{});
    rects.initPipeline(device, globals_buffer);
    std.debug.print("[gpu.initWeb] init curves pipeline...\n", .{});
    curves.initPipeline(device, globals_buffer);
    std.debug.print("[gpu.initWeb] init polys pipeline...\n", .{});
    polys.initPipeline(device, globals_buffer);
    std.debug.print("[gpu.initWeb] init images pipeline...\n", .{});
    images.initPipeline(device, globals_buffer);
    std.debug.print("[gpu.initWeb] done\n", .{});
}

// ── Web-specific surface creation (uses wgpu_web module's C types) ──

fn createCanvasSurface(instance: *wgpu.Instance) ?*wgpu.Surface {
    if (!is_web) return null;
    const wc = wgpu.c; // emdawnwebgpu C types
    const canvas_source = wc.WGPUEmscriptenSurfaceSourceCanvasHTMLSelector{
        .chain = .{
            .next = null,
            .sType = wc.WGPUSType_EmscriptenSurfaceSourceCanvasHTMLSelector,
        },
        .selector = .{ .data = "#canvas", .length = 7 },
    };
    const surface_desc = wc.WGPUSurfaceDescriptor{
        .nextInChain = @ptrCast(@constCast(&canvas_source.chain)),
        .label = .{ .data = "web-canvas", .length = 10 },
    };
    return @ptrCast(wc.wgpuInstanceCreateSurface(@ptrCast(instance), &surface_desc));
}

pub fn init(window: if (is_web) *anyopaque else *c.SDL_Window) !void {
    if (is_web) @compileError("Use initWeb() on wasm32 targets");

    // Create wgpu instance — Metal on macOS, Vulkan on Linux
    const backend = if (comptime @import("builtin").os.tag == .macos) wgpu.InstanceBackends.metal else wgpu.InstanceBackends.vulkan;
    var extras = wgpu.InstanceExtras{
        .backends = backend,
        .flags = wgpu.InstanceFlags.default,
        .dx12_shader_compiler = .@"undefined",
        .gles3_minor_version = .automatic,
        .gl_fence_behavior = .gl_fence_behaviour_normal,
        .dxc_max_shader_model = .dxc_max_shader_model_v6_0,
    };
    var desc = wgpu.InstanceDescriptor{
        .features = .{ .timed_wait_any_enable = 0, .timed_wait_any_max_count = 0 },
    };
    desc = desc.withNativeExtras(&extras);
    g_instance = wgpu.Instance.create(&desc) orelse return error.WGPUInstanceFailed;
    const instance = g_instance.?;

    // Create surface from native window handle (SDL3 properties API)
    g_surface = createSurfaceFromSDL(instance, window) orelse return error.SurfaceCreateFailed;
    const surface = g_surface.?;

    // Request adapter
    const adapter_response = instance.requestAdapterSync(&.{
        .compatible_surface = surface,
        .power_preference = .high_performance,
    }, 200_000_000);
    if (adapter_response.status != .success) {
        std.debug.print("wgpu adapter request failed\n", .{});
        return error.AdapterRequestFailed;
    }
    g_adapter = adapter_response.adapter;
    const adapter = g_adapter.?;
    {
        var info: @import("../gpu/gpu.zig").wgpu.AdapterInfo = undefined;
        _ = adapter.getInfo(&info);
        std.debug.print("[gpu] adapter: {s} (device=0x{x})\n", .{
            info.description.toSlice() orelse "(unknown)",
            info.device_id,
        });
    }

    // Request device
    const device_response = adapter.requestDeviceSync(instance, null, 200_000_000);
    if (device_response.status != .success) {
        std.debug.print("wgpu device request failed\n", .{});
        return error.DeviceRequestFailed;
    }
    g_device = device_response.device;
    const device = g_device.?;
    g_queue = device.getQueue();

    // Get window size and configure surface
    var w: c_int = 0;
    var h: c_int = 0;
    _ = c.SDL_GetWindowSize(window, &w, &h);
    g_width = @intCast(w);
    g_height = @intCast(h);

    configureSurface(g_width, g_height);

    // Create globals uniform buffer
    g_globals_buffer = device.createBuffer(&.{
        .label = wgpu.StringView.fromSlice("globals"),
        .size = 16,
        .usage = wgpu.BufferUsages.uniform | wgpu.BufferUsages.copy_dst,
        .mapped_at_creation = 0,
    });

    const globals_buffer = g_globals_buffer orelse return error.BufferCreateFailed;

    // Initialize pipelines
    rects.initPipeline(device, globals_buffer);
    curves.initPipeline(device, globals_buffer);
    polys.initPipeline(device, globals_buffer);
    images.initPipeline(device, globals_buffer);

    std.debug.print("wgpu initialized: {d}x{d}\n", .{ g_width, g_height });
}

pub fn deinit() void {
    images.deinit();
    polys.deinit();
    curves.deinit();
    text.deinit();
    rects.deinit();
    if (g_globals_buffer) |b| b.release();
    if (g_queue) |q| q.release();
    if (g_device) |d| d.release();
    if (g_adapter) |a| a.release();
    if (g_surface) |s| s.release();
    if (g_instance) |i| i.release();
    g_globals_buffer = null;
    g_queue = null;
    g_device = null;
    g_adapter = null;
    g_surface = null;
    g_instance = null;
}

pub fn resize(width: u32, height: u32) void {
    if (width == 0 or height == 0) return;
    g_width = width;
    g_height = height;
    configureSurface(width, height);
}

/// Render all queued primitives and present.
pub fn frame(bg_r: f64, bg_g: f64, bg_b: f64) void {
    const surface = g_surface orelse return;
    const device = g_device orelse return;
    const queue = g_queue orelse return;

    // Periodic memory drain
    g_frame_counter += 1;
    if (g_frame_counter % DRAIN_INTERVAL == 0) drainMemory();

    // Get current surface texture
    var surface_texture: wgpu.SurfaceTexture = undefined;
    surface.getCurrentTexture(&surface_texture);
    if (surface_texture.status != .success_optimal and surface_texture.status != .success_suboptimal) {
        if (surface_texture.texture) |t| t.release();
        if (g_width > 0 and g_height > 0) configureSurface(g_width, g_height);
        rects.reset();
        text.reset();
        curves.reset();
        polys.reset();
        images.reset();
        g_scissor_count = 0;
        g_scissor_depth = 0;
        return;
    }

    const texture_obj = surface_texture.texture orelse return;
    defer texture_obj.release();
    const view = texture_obj.createView(null) orelse return;
    defer view.release();

    // Dirty check
    const data_changed = blk: {
        const hash = frameDataHash();
        const changed = (g_width != g_prev_dims[0] or g_height != g_prev_dims[1] or hash != g_prev_frame_hash);
        if (changed) g_prev_frame_hash = hash;
        break :blk changed;
    };

    if (data_changed) {
        g_prev_dims = .{ g_width, g_height };

        // Update globals uniform (screen size)
        const globals = [2]f32{ @floatFromInt(g_width), @floatFromInt(g_height) };
        if (g_globals_buffer) |buf| {
            queue.writeBuffer(buf, 0, @ptrCast(&globals), @sizeOf(@TypeOf(globals)));
        }

        // Upload pipeline data
        rects.upload(queue);
        text.upload(queue);
        curves.upload(queue);
        polys.upload(queue);
    }

    // Image quads always upload (video frames change independently of UI dirty state)
    if (images.count() > 0) images.upload(queue);

    const encoder = device.createCommandEncoder(&.{}) orelse return;

    // Render pass
    const color_attachment = wgpu.ColorAttachment{
        .view = view,
        .load_op = .clear,
        .store_op = .store,
        .clear_value = .{ .r = bg_r, .g = bg_g, .b = bg_b, .a = 1.0 },
    };

    const rp_desc = wgpu.RenderPassDescriptor{
        .color_attachment_count = 1,
        .color_attachments = @ptrCast(&color_attachment),
    };
    const render_pass = encoder.beginRenderPass(&rp_desc) orelse return;

    const total_rects: u32 = @intCast(rects.count());
    const total_glyphs: u32 = @intCast(text.count());
    const total_curves: u32 = @intCast(curves.count());
    const total_polys: u32 = @intCast(polys.count());
    const total_images: u32 = @intCast(images.count());
    log.info(.gpu, "frame dims={d}x{d} rects={d} glyphs={d} curves={d} polys={d} images={d} boundaries={d}", .{
        g_width, g_height, total_rects, total_glyphs, total_curves, total_polys, total_images, g_scissor_count,
    });

    if (g_scissor_count == 0) {
        // Fast path — no clip or ordering boundaries, single draw for all primitives
        render_pass.setScissorRect(0, 0, g_width, g_height);
        rects.drawBatch(render_pass, 0, total_rects);
        text.drawBatch(render_pass, 0, total_glyphs);
        curves.drawBatch(render_pass, 0, total_curves);
        polys.drawBatch(render_pass, 0, total_polys);
        images.drawBatch(render_pass, 0, total_images);
    } else {
        // Boundary-segmented rendering
        var segments: [MAX_SCISSOR_SEGMENTS + 1]ScissorSegment = undefined;
        const seg_count = g_scissor_count;
        @memcpy(segments[0..seg_count], g_scissor_segments[0..seg_count]);

        var prev_rect: u32 = 0;
        var prev_glyph: u32 = 0;
        var prev_curve: u32 = 0;
        var prev_poly: u32 = 0;
        var prev_image: u32 = 0;
        var prev_sx: u32 = 0;
        var prev_sy: u32 = 0;
        var prev_sw: u32 = g_width;
        var prev_sh: u32 = g_height;

        for (0..seg_count) |si| {
            const seg = segments[si];
            const rect_end = seg.rect_start;
            const glyph_end = seg.glyph_start;
            const curve_end = seg.curve_start;
            const poly_end = seg.poly_start;
            const image_end = seg.image_start;

            if (rect_end > prev_rect or glyph_end > prev_glyph or curve_end > prev_curve or poly_end > prev_poly or image_end > prev_image) {
                render_pass.setScissorRect(prev_sx, prev_sy, prev_sw, prev_sh);
                if (rect_end > prev_rect) rects.drawBatch(render_pass, prev_rect, rect_end);
                if (glyph_end > prev_glyph) text.drawBatch(render_pass, prev_glyph, glyph_end);
                if (curve_end > prev_curve) curves.drawBatch(render_pass, prev_curve, curve_end);
                if (poly_end > prev_poly) polys.drawBatch(render_pass, prev_poly, poly_end);
                if (image_end > prev_image) images.drawBatch(render_pass, prev_image, image_end);
            }

            prev_rect = rect_end;
            prev_glyph = glyph_end;
            prev_curve = curve_end;
            prev_poly = poly_end;
            prev_image = image_end;
            prev_sx = seg.x;
            prev_sy = seg.y;
            prev_sw = seg.w;
            prev_sh = seg.h;
        }

        // Draw remaining after last segment
        if (total_rects > prev_rect or total_glyphs > prev_glyph or total_curves > prev_curve or total_polys > prev_poly or total_images > prev_image) {
            render_pass.setScissorRect(prev_sx, prev_sy, prev_sw, prev_sh);
            if (total_rects > prev_rect) rects.drawBatch(render_pass, prev_rect, total_rects);
            if (total_glyphs > prev_glyph) text.drawBatch(render_pass, prev_glyph, total_glyphs);
            if (total_curves > prev_curve) curves.drawBatch(render_pass, prev_curve, total_curves);
            if (total_polys > prev_poly) polys.drawBatch(render_pass, prev_poly, total_polys);
            if (total_images > prev_image) images.drawBatch(render_pass, prev_image, total_images);
        }
    }

    render_pass.end();
    render_pass.release();

    const command = encoder.finish(null) orelse return;
    encoder.release();

    queue.submit(&.{command});
    command.release();

    // Capture hook — readback the rendered frame before present (like Love2D's captureScreenshot)
    // Sync readback requires device.poll() — not available on web.
    if (!is_web and g_capture_requested) {
        performCapture(device, queue, texture_obj);
    }

    if (!is_web) {
        _ = surface.present();
    }

    // Release deferred 3D render targets after image compositing, before reset
    scene3d.frameCleanup();

    // Reset for next frame
    rects.reset();
    text.reset();
    curves.reset();
    polys.reset();
    images.reset();
    g_scissor_count = 0;
    g_scissor_depth = 0;
    if (g_gpu_ops >= GPU_OPS_BUDGET) {
        @import("std").debug.print("[BUDGET] GPU ops hit {d}/{d} this frame\n", .{ g_gpu_ops, GPU_OPS_BUDGET });
    }
    g_gpu_ops = 0;
}

// ════════════════════════════════════════════════════════════════════════
// Telemetry & diagnostics
// ════════════════════════════════════════════════════════════════════════

pub const Stats = struct {
    rect_count: usize,
    glyph_count: usize,
    atlas_count: usize,
    atlas_max: usize,
    rect_max: usize,
    glyph_max: usize,
    atlas_row_y: u32,
    atlas_size: u32,
};

pub fn getStats() Stats {
    return .{
        .rect_count = rects.lastCount(),
        .glyph_count = text.lastCount(),
        .atlas_count = text.atlasCount(),
        .atlas_max = text.atlasCapacity(),
        .rect_max = rects.MAX_RECTS,
        .glyph_max = text.MAX_GLYPHS,
        .atlas_row_y = text.atlasRowY(),
        .atlas_size = text.atlasSize(),
    };
}

pub const TelemetryStats = struct {
    rect_count: u32,
    glyph_count: u32,
    rect_capacity: u32,
    glyph_capacity: u32,
    atlas_glyph_count: u32,
    atlas_capacity: u32,
    atlas_row_x: u32,
    atlas_row_y: u32,
    scissor_depth: u32,
    scissor_segment_count: u32,
    surface_w: u32,
    surface_h: u32,
    frame_hash: u64,
    frames_since_drain: u64,
};

pub fn telemetryStats() TelemetryStats {
    return .{
        .rect_count = @intCast(rects.lastCount()),
        .glyph_count = @intCast(text.lastCount()),
        .rect_capacity = rects.MAX_RECTS,
        .glyph_capacity = text.MAX_GLYPHS,
        .atlas_glyph_count = @intCast(text.atlasCount()),
        .atlas_capacity = @intCast(text.atlasCapacity()),
        .atlas_row_x = 0, // internal to text pipeline now
        .atlas_row_y = text.atlasRowY(),
        .scissor_depth = @intCast(g_scissor_depth),
        .scissor_segment_count = @intCast(g_scissor_count),
        .surface_w = g_width,
        .surface_h = g_height,
        .frame_hash = g_prev_frame_hash,
        .frames_since_drain = g_frame_counter % DRAIN_INTERVAL,
    };
}

pub fn telemetryFrameCounter() u64 {
    return g_frame_counter;
}

// ════════════════════════════════════════════════════════════════════════
// Surface / platform helpers
// ════════════════════════════════════════════════════════════════════════

fn configureSurface(width: u32, height: u32) void {
    if (is_web) return; // Browser manages the canvas swapchain
    const surface = g_surface orelse return;
    const device = g_device orelse return;
    const adapter = g_adapter orelse return;

    var caps: wgpu.SurfaceCapabilities = undefined;
    _ = surface.getCapabilities(adapter, &caps);

    // Prefer non-sRGB format to avoid double gamma correction.
    g_format = .bgra8_unorm;
    if (caps.format_count > 0) {
        g_format = caps.formats[0];
        for (caps.formats[0..caps.format_count]) |fmt| {
            if (fmt == .bgra8_unorm or fmt == .rgba8_unorm) {
                g_format = fmt;
                break;
            }
        }
    }

    const vsync_off = if (is_web) false else if (std.posix.getenv("ZIGOS_VSYNC")) |v| std.mem.eql(u8, v, "0") else false;
    const config = wgpu.SurfaceConfiguration{
        .device = device,
        .format = g_format,
        .usage = wgpu.TextureUsages.render_attachment | wgpu.TextureUsages.copy_src,
        .width = width,
        .height = height,
        .present_mode = if (vsync_off) .immediate else .fifo,
        .alpha_mode = .auto,
    };
    surface.configure(&config);
}

fn createSurfaceFromSDL(instance: *wgpu.Instance, window: *c.SDL_Window) ?*wgpu.Surface {
    const props = c.SDL_GetWindowProperties(window);

    // Try X11 first
    const x11_display = c.SDL_GetPointerProperty(props, c.SDL_PROP_WINDOW_X11_DISPLAY_POINTER, null);
    const x11_window = c.SDL_GetNumberProperty(props, c.SDL_PROP_WINDOW_X11_WINDOW_NUMBER, 0);
    if (x11_display != null and x11_window != 0) {
        const d = wgpu.surfaceDescriptorFromXlibWindow(.{
            .display = @ptrCast(x11_display),
            .window = @intCast(x11_window),
        });
        return instance.createSurface(&d);
    }

    // Try Wayland
    const wl_display = c.SDL_GetPointerProperty(props, c.SDL_PROP_WINDOW_WAYLAND_DISPLAY_POINTER, null);
    const wl_surface = c.SDL_GetPointerProperty(props, c.SDL_PROP_WINDOW_WAYLAND_SURFACE_POINTER, null);
    if (wl_display != null and wl_surface != null) {
        const d = wgpu.surfaceDescriptorFromWaylandSurface(.{
            .display = @ptrCast(wl_display),
            .surface = @ptrCast(wl_surface),
        });
        return instance.createSurface(&d);
    }

    // Try Metal (macOS / iOS)
    const metal_view = c.SDL_Metal_CreateView(window);
    if (metal_view) |view| {
        if (c.SDL_Metal_GetLayer(view)) |layer| {
            const d = wgpu.surfaceDescriptorFromMetalLayer(.{
                .layer = layer,
            });
            return instance.createSurface(&d);
        }
    }

    std.debug.print("No supported windowing subsystem found (tried X11, Wayland, Metal)\n", .{});
    return null;
}
