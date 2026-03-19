//! wgpu-native GPU backend for tsz
//!
//! Replaces SDL_Renderer with wgpu for GPU-accelerated rendering.
//! SDL2 is still used for windowing and events — wgpu gets the
//! native window handle from SDL to create its surface.

const std = @import("std");
const wgpu = @import("wgpu");
const c = @import("c.zig").imports;
const shaders = @import("gpu/shaders.zig");

// ════════════════════════════════════════════════════════════════════════
// Types
// ════════════════════════════════════════════════════════════════════════

/// Per-instance rect data — matches the WGSL struct layout.
/// 9 x f32 = 36 bytes, padded to 64 bytes (16-float aligned for GPU).
pub const RectInstance = extern struct {
    // Position (top-left, screen pixels)
    pos_x: f32,
    pos_y: f32,
    // Size (width, height in pixels)
    size_w: f32,
    size_h: f32,
    // Background color RGBA [0..1]
    color_r: f32,
    color_g: f32,
    color_b: f32,
    color_a: f32,
    // Border color RGBA [0..1]
    border_color_r: f32,
    border_color_g: f32,
    border_color_b: f32,
    border_color_a: f32,
    // Border radius per corner: tl, tr, br, bl
    radius_tl: f32,
    radius_tr: f32,
    radius_br: f32,
    radius_bl: f32,
    // Border width
    border_width: f32,
    // Padding to 20 floats (80 bytes, aligned to 16)
    _pad0: f32 = 0,
    _pad1: f32 = 0,
    _pad2: f32 = 0,
};

const MAX_RECTS = 4096;

/// Per-instance glyph data — matches the text WGSL struct layout.
pub const GlyphInstance = extern struct {
    pos_x: f32,
    pos_y: f32,
    size_w: f32,
    size_h: f32,
    uv_x: f32,
    uv_y: f32,
    uv_w: f32,
    uv_h: f32,
    color_r: f32,
    color_g: f32,
    color_b: f32,
    color_a: f32,
};

const MAX_GLYPHS = 8192;

// Atlas dimensions
const ATLAS_SIZE = 2048;

// Glyph atlas cache entry
const AtlasGlyphKey = struct {
    codepoint: u32,
    size_px: u16,
};

const AtlasGlyphInfo = struct {
    // Atlas UV coords (normalized 0..1)
    uv_x: f32,
    uv_y: f32,
    uv_w: f32,
    uv_h: f32,
    // Glyph metrics (pixels)
    bearing_x: i32,
    bearing_y: i32,
    advance: i32,
    width: i32,
    height: i32,
};

const MAX_ATLAS_GLYPHS = 2048;

// ════════════════════════════════════════════════════════════════════════
// State
// ════════════════════════════════════════════════════════════════════════

var g_instance: ?*wgpu.Instance = null;
var g_surface: ?*wgpu.Surface = null;
var g_adapter: ?*wgpu.Adapter = null;
var g_device: ?*wgpu.Device = null;
var g_queue: ?*wgpu.Queue = null;
var g_format: wgpu.TextureFormat = .bgra8_unorm;
var g_width: u32 = 0;
var g_height: u32 = 0;

// Canvas transform — applied in vertex shader to all rects + glyphs.
// Identity: origin=(0,0), offset=(0,0), scale=1.0
var g_transform_ox: f32 = 0;  // origin X (scale around this point)
var g_transform_oy: f32 = 0;  // origin Y
var g_transform_tx: f32 = 0;  // translate X (after scale)
var g_transform_ty: f32 = 0;  // translate Y
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

// Rect pipeline
var g_rect_pipeline: ?*wgpu.RenderPipeline = null;
var g_rect_buffer: ?*wgpu.Buffer = null;
var g_globals_buffer: ?*wgpu.Buffer = null;
var g_bind_group: ?*wgpu.BindGroup = null;
var g_bind_group_layout: ?*wgpu.BindGroupLayout = null; // persisted for drain

// CPU-side rect batch
var g_rects: [MAX_RECTS]RectInstance = undefined;
var g_rect_count: usize = 0;

// Text pipeline
var g_text_pipeline: ?*wgpu.RenderPipeline = null;
var g_text_buffer: ?*wgpu.Buffer = null;
var g_text_bind_group: ?*wgpu.BindGroup = null;
var g_text_bind_group_layout: ?*wgpu.BindGroupLayout = null; // persisted for drain
var g_atlas_texture: ?*wgpu.Texture = null;
var g_atlas_view: ?*wgpu.TextureView = null;
var g_atlas_sampler: ?*wgpu.Sampler = null;

// CPU-side glyph batch
var g_glyphs: [MAX_GLYPHS]GlyphInstance = undefined;
var g_glyph_count: usize = 0;

// Last-frame counts (captured before reset, for crash diagnostics)
var g_last_rect_count: usize = 0;
var g_last_glyph_count: usize = 0;

// Dirty tracking — skip redundant writeBuffer when draw data is unchanged.
// Each writeBuffer creates staging buffers in wgpu-native; over millions
// of frames, Vulkan's sub-allocator fragments (~399MB/11h at 60fps).
var g_prev_frame_hash: u64 = 0;
var g_prev_dims: [2]u32 = .{ 0, 0 };

// Memory drain — periodically recreate GPU buffers to reclaim fragmented
// staging allocator pools. Every DRAIN_INTERVAL frames, destroy and rebuild
// the rect/glyph/globals buffers + their bind groups. This forces wgpu to
// release the old allocator pools and start fresh. Cost: one frame of buffer
// recreation every ~10 minutes. Prevents the ~0.6MB/min RSS growth.
const DRAIN_INTERVAL: u64 = 36000; // ~10 minutes at 60fps
var g_frame_counter: u64 = 0;

// ════════════════════════════════════════════════════════════════════════
// Scissor rect segments — for overflow clipping
// ════════════════════════════════════════════════════════════════════════

const ScissorSegment = struct {
    x: u32,
    y: u32,
    w: u32,
    h: u32,
    rect_start: u32,
    glyph_start: u32,
};

const MAX_SCISSOR_SEGMENTS = 64;
var g_scissor_segments: [MAX_SCISSOR_SEGMENTS]ScissorSegment = undefined;
var g_scissor_count: usize = 0;

// Scissor stack for nested clips
const MAX_SCISSOR_STACK = 16;
var g_scissor_stack: [MAX_SCISSOR_STACK]ScissorSegment = undefined;
var g_scissor_depth: usize = 0;

pub fn pushScissor(x: f32, y: f32, w: f32, h: f32) void {
    // Clamp to positive values and convert to u32
    var sx: u32 = if (x > 0) @intFromFloat(x) else 0;
    var sy: u32 = if (y > 0) @intFromFloat(y) else 0;
    var sw: u32 = if (w > 0) @intFromFloat(@ceil(w)) else 0;
    var sh: u32 = if (h > 0) @intFromFloat(@ceil(h)) else 0;

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
    if (g_scissor_count < MAX_SCISSOR_SEGMENTS) {
        g_scissor_segments[g_scissor_count] = .{
            .x = sx, .y = sy, .w = sw, .h = sh,
            .rect_start = @intCast(g_rect_count),
            .glyph_start = @intCast(g_glyph_count),
        };
        g_scissor_count += 1;
    }

    // Push to stack
    if (g_scissor_depth < MAX_SCISSOR_STACK) {
        g_scissor_stack[g_scissor_depth] = .{
            .x = sx, .y = sy, .w = sw, .h = sh,
            .rect_start = 0, .glyph_start = 0,
        };
        g_scissor_depth += 1;
    }
}

pub fn popScissor() void {
    if (g_scissor_depth > 0) g_scissor_depth -= 1;

    // Record segment boundary for parent scissor (or full viewport)
    if (g_scissor_count < MAX_SCISSOR_SEGMENTS) {
        if (g_scissor_depth > 0) {
            const parent = g_scissor_stack[g_scissor_depth - 1];
            g_scissor_segments[g_scissor_count] = .{
                .x = parent.x, .y = parent.y, .w = parent.w, .h = parent.h,
                .rect_start = @intCast(g_rect_count),
                .glyph_start = @intCast(g_glyph_count),
            };
        } else {
            g_scissor_segments[g_scissor_count] = .{
                .x = 0, .y = 0, .w = g_width, .h = g_height,
                .rect_start = @intCast(g_rect_count),
                .glyph_start = @intCast(g_glyph_count),
            };
        }
        g_scissor_count += 1;
    }
}

// Atlas packer state
var g_atlas_row_x: u32 = 0;
var g_atlas_row_y: u32 = 0;
var g_atlas_row_h: u32 = 0;

// Atlas glyph cache
var g_atlas_keys: [MAX_ATLAS_GLYPHS]AtlasGlyphKey = undefined;
var g_atlas_vals: [MAX_ATLAS_GLYPHS]AtlasGlyphInfo = undefined;
var g_atlas_count: usize = 0;

// FreeType handles (set by initText)
var g_ft_library: c.FT_Library = null;
var g_ft_face: c.FT_Face = null;
var g_ft_fallbacks: [8]c.FT_Face = undefined;
var g_ft_fallback_count: usize = 0;
var g_ft_current_size: u16 = 0;

// ════════════════════════════════════════════════════════════════════════
// Public API
// ════════════════════════════════════════════════════════════════════════

pub fn init(window: *c.SDL_Window) !void {
    // Create wgpu instance with Vulkan backend only
    // (the GL/EGL probe panics when SDL already has the display)
    var extras = wgpu.InstanceExtras{
        .backends = wgpu.InstanceBackends.vulkan,
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

    // Get native window handle from SDL2
    var wm_info: c.SDL_SysWMinfo = std.mem.zeroes(c.SDL_SysWMinfo);
    wm_info.version.major = c.SDL_MAJOR_VERSION;
    wm_info.version.minor = c.SDL_MINOR_VERSION;
    wm_info.version.patch = c.SDL_PATCHLEVEL;
    if (c.SDL_GetWindowWMInfo(window, &wm_info) != c.SDL_TRUE) {
        std.debug.print("SDL_GetWindowWMInfo failed: {s}\n", .{c.SDL_GetError()});
        return error.WindowInfoFailed;
    }

    // Create surface from native window handle
    g_surface = createSurfaceFromSDL(instance, &wm_info) orelse return error.SurfaceCreateFailed;
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
    c.SDL_GetWindowSize(window, &w, &h);
    g_width = @intCast(w);
    g_height = @intCast(h);

    configureSurface(g_width, g_height);

    // Create rect pipeline
    initRectPipeline(device);

    std.debug.print("wgpu initialized: {d}x{d}\n", .{ g_width, g_height });
}

pub fn deinit() void {
    if (g_text_bind_group) |bg| bg.release();
    if (g_text_bind_group_layout) |l| l.release();
    if (g_text_buffer) |b| b.release();
    if (g_text_pipeline) |p| p.release();
    if (g_atlas_sampler) |s| s.release();
    if (g_atlas_view) |v| v.release();
    if (g_atlas_texture) |t| t.destroy();
    if (g_bind_group) |bg| bg.release();
    if (g_bind_group_layout) |l| l.release();
    if (g_globals_buffer) |b| b.release();
    if (g_rect_buffer) |b| b.release();
    if (g_rect_pipeline) |p| p.release();
    if (g_queue) |q| q.release();
    if (g_device) |d| d.release();
    if (g_adapter) |a| a.release();
    if (g_surface) |s| s.release();
    if (g_instance) |i| i.release();
    g_bind_group = null;
    g_globals_buffer = null;
    g_rect_buffer = null;
    g_rect_pipeline = null;
    g_queue = null;
    g_device = null;
    g_adapter = null;
    g_surface = null;
    g_instance = null;
}

/// Drain fragmented GPU memory by recreating buffers + bind groups.
/// Called automatically every DRAIN_INTERVAL frames from frame().
fn drainMemory() void {
    const device = g_device orelse return;

    // Destroy old buffers
    if (g_bind_group) |bg| bg.release();
    if (g_globals_buffer) |b| b.release();
    if (g_rect_buffer) |b| b.release();
    if (g_text_bind_group) |bg| bg.release();
    if (g_text_buffer) |b| b.release();

    // Blocking poll to reclaim all pending resources
    _ = device.poll(true, null);

    // Recreate globals buffer
    g_globals_buffer = device.createBuffer(&.{
        .label = wgpu.StringView.fromSlice("globals"),
        .size = 16,
        .usage = wgpu.BufferUsages.uniform | wgpu.BufferUsages.copy_dst,
        .mapped_at_creation = 0,
    });

    // Recreate rect buffer
    g_rect_buffer = device.createBuffer(&.{
        .label = wgpu.StringView.fromSlice("rect_instances"),
        .size = MAX_RECTS * @sizeOf(RectInstance),
        .usage = wgpu.BufferUsages.vertex | wgpu.BufferUsages.copy_dst,
        .mapped_at_creation = 0,
    });

    // Recreate text/glyph buffer
    g_text_buffer = device.createBuffer(&.{
        .label = wgpu.StringView.fromSlice("glyph_instances"),
        .size = MAX_GLYPHS * @sizeOf(GlyphInstance),
        .usage = wgpu.BufferUsages.vertex | wgpu.BufferUsages.copy_dst,
        .mapped_at_creation = 0,
    });

    // Recreate bind groups (they reference the new buffers)
    if (g_bind_group_layout) |layout| {
        g_bind_group = device.createBindGroup(&.{
            .layout = layout,
            .entry_count = 1,
            .entries = @ptrCast(&wgpu.BindGroupEntry{
                .binding = 0,
                .buffer = g_globals_buffer,
                .offset = 0,
                .size = 16,
            }),
        });
    }
    if (g_text_bind_group_layout) |layout| {
        const bind_entries = [_]wgpu.BindGroupEntry{
            .{ .binding = 0, .buffer = g_globals_buffer, .offset = 0, .size = 8 },
            .{ .binding = 1, .texture_view = g_atlas_view },
            .{ .binding = 2, .sampler = g_atlas_sampler },
        };
        g_text_bind_group = device.createBindGroup(&.{
            .layout = layout,
            .entry_count = bind_entries.len,
            .entries = &bind_entries,
        });
    }

    // Force full redraw on next frame
    g_prev_frame_hash = 0;
    g_prev_dims = .{ 0, 0 };

    std.debug.print("[gpu] Memory drain: buffers recreated at frame {d}\n", .{g_frame_counter});
}

pub fn resize(width: u32, height: u32) void {
    if (width == 0 or height == 0) return;
    g_width = width;
    g_height = height;
    configureSurface(width, height);
}

/// Queue a rectangle for drawing this frame.
pub fn drawRect(
    x: f32,
    y: f32,
    w: f32,
    h: f32,
    r: f32,
    g: f32,
    b: f32,
    a: f32,
    border_radius: f32,
    border_width: f32,
    br: f32,
    bg: f32,
    bb: f32,
    ba: f32,
) void {
    if (g_rect_count >= MAX_RECTS) return;
    // Apply canvas transform if active
    const tx = if (g_transform_active) (x - g_transform_ox) * g_transform_scale + g_transform_ox + g_transform_tx else x;
    const ty = if (g_transform_active) (y - g_transform_oy) * g_transform_scale + g_transform_oy + g_transform_ty else y;
    const tw = if (g_transform_active) w * g_transform_scale else w;
    const th = if (g_transform_active) h * g_transform_scale else h;
    g_rects[g_rect_count] = .{
        .pos_x = tx,
        .pos_y = ty,
        .size_w = tw,
        .size_h = th,
        .color_r = r,
        .color_g = g,
        .color_b = b,
        .color_a = a,
        .border_color_r = br,
        .border_color_g = bg,
        .border_color_b = bb,
        .border_color_a = ba,
        .radius_tl = border_radius,
        .radius_tr = border_radius,
        .radius_br = border_radius,
        .radius_bl = border_radius,
        .border_width = border_width,
    };
    g_rect_count += 1;
}

/// Initialize text rendering. Call after init() and after TextEngine is created.
pub fn initText(library: c.FT_Library, face: c.FT_Face, fallbacks: anytype, fallback_count: usize) void {
    g_ft_library = library;
    g_ft_face = face;
    g_ft_fallback_count = @min(fallback_count, 8);
    for (0..g_ft_fallback_count) |i| {
        g_ft_fallbacks[i] = fallbacks[i];
    }
    g_ft_current_size = 0;

    const device = g_device orelse return;

    // Create atlas texture (RGBA8, 2048x2048)
    g_atlas_texture = device.createTexture(&.{
        .label = wgpu.StringView.fromSlice("glyph_atlas"),
        .size = .{ .width = ATLAS_SIZE, .height = ATLAS_SIZE, .depth_or_array_layers = 1 },
        .mip_level_count = 1,
        .sample_count = 1,
        .dimension = .@"2d",
        .format = .rgba8_unorm,
        .usage = wgpu.TextureUsages.texture_binding | wgpu.TextureUsages.copy_dst,
    });

    if (g_atlas_texture) |tex| {
        g_atlas_view = tex.createView(null);
    }

    g_atlas_sampler = device.createSampler(&.{
        .address_mode_u = .clamp_to_edge,
        .address_mode_v = .clamp_to_edge,
        .mag_filter = .linear,
        .min_filter = .linear,
    });

    // Create text instance buffer
    g_text_buffer = device.createBuffer(&.{
        .label = wgpu.StringView.fromSlice("glyph_instances"),
        .size = MAX_GLYPHS * @sizeOf(GlyphInstance),
        .usage = wgpu.BufferUsages.vertex | wgpu.BufferUsages.copy_dst,
        .mapped_at_creation = 0,
    });

    initTextPipeline(device);
}

/// Draw a single line of text at (x, y) with the given font size and color.
pub fn drawTextLine(text: []const u8, x: f32, y: f32, size_px: u16, cr: f32, cg: f32, cb: f32, ca: f32) void {
    if (g_ft_face == null) return;

    const s = g_transform_scale;
    const has_transform = g_transform_active;

    // When canvas transform is active, rasterize at scaled size for crisp text.
    // The glyph is rendered at the final screen size — no texture stretching.
    const render_size: u16 = if (has_transform)
        @intFromFloat(@max(4, @min(200, @round(@as(f32, @floatFromInt(size_px)) * s))))
    else
        size_px;

    if (g_ft_current_size != render_size) {
        _ = c.FT_Set_Pixel_Sizes(g_ft_face, 0, render_size);
        g_ft_current_size = render_size;
    }

    const face = g_ft_face;
    const ascent: f32 = @as(f32, @floatFromInt(face.*.size.*.metrics.ascender)) / 64.0;

    // Pen position: transform the starting point, then advance in screen space
    var pen_x: f32 = if (has_transform) (x - g_transform_ox) * s + g_transform_ox + g_transform_tx else x;
    const start_y: f32 = if (has_transform) (y - g_transform_oy) * s + g_transform_oy + g_transform_ty else y;
    const baseline_y = start_y + ascent;

    var i: usize = 0;
    while (i < text.len) {
        const ch = decodeUtf8(text[i..]);
        if (ch.codepoint == '\n') {
            i += ch.len;
            continue;
        }

        if (cacheGlyph(ch.codepoint, render_size)) |glyph| {
            if (glyph.width > 0 and glyph.height > 0) {
                if (g_glyph_count < MAX_GLYPHS) {
                    const gx = pen_x + @as(f32, @floatFromInt(glyph.bearing_x));
                    const gy = baseline_y - @as(f32, @floatFromInt(glyph.bearing_y));
                    // Glyph is already at final screen size — no scaling needed
                    g_glyphs[g_glyph_count] = .{
                        .pos_x = gx,
                        .pos_y = gy,
                        .size_w = @floatFromInt(glyph.width),
                        .size_h = @floatFromInt(glyph.height),
                        .uv_x = glyph.uv_x,
                        .uv_y = glyph.uv_y,
                        .uv_w = glyph.uv_w,
                        .uv_h = glyph.uv_h,
                        .color_r = cr,
                        .color_g = cg,
                        .color_b = cb,
                        .color_a = ca,
                    };
                    g_glyph_count += 1;
                }
            }
            pen_x += @floatFromInt(glyph.advance);
        }
        i += ch.len;
    }
}

/// Draw text with word-wrapping at max_width. Returns total height drawn.
pub fn drawTextWrapped(text: []const u8, x: f32, y: f32, size_px: u16, max_width: f32, cr: f32, cg: f32, cb: f32, ca: f32) f32 {
    if (g_ft_face == null) return 0;
    if (max_width <= 0) {
        drawTextLine(text, x, y, size_px, cr, cg, cb, ca);
        return @as(f32, @floatFromInt(size_px));
    }

    if (g_ft_current_size != size_px) {
        _ = c.FT_Set_Pixel_Sizes(g_ft_face, 0, size_px);
        g_ft_current_size = size_px;
    }

    const face = g_ft_face;
    const line_h: f32 = @as(f32, @floatFromInt(face.*.size.*.metrics.height)) / 64.0;

    var pen_x: f32 = 0;
    var pen_y: f32 = y;
    var line_start: usize = 0;
    var last_break: usize = 0;
    var last_break_pen_x: f32 = 0;
    var i: usize = 0;

    while (i < text.len) {
        const ch = decodeUtf8(text[i..]);

        // Explicit newline
        if (ch.codepoint == '\n') {
            drawTextLine(text[line_start..i], x, pen_y, size_px, cr, cg, cb, ca);
            pen_y += line_h;
            i += ch.len;
            line_start = i;
            last_break = i;
            pen_x = 0;
            last_break_pen_x = 0;
            continue;
        }

        // Track word boundaries
        if (ch.codepoint == ' ') {
            last_break = i;
            last_break_pen_x = pen_x;
        }

        // Measure this glyph
        var advance: f32 = 0;
        if (cacheGlyph(ch.codepoint, size_px)) |glyph| {
            advance = @floatFromInt(glyph.advance);
        }

        if (pen_x + advance > max_width and pen_x > 0) {
            // Wrap at last word boundary if possible
            if (last_break > line_start) {
                drawTextLine(text[line_start..last_break], x, pen_y, size_px, cr, cg, cb, ca);
                pen_y += line_h;
                // Skip the space
                line_start = last_break + 1;
                pen_x = pen_x - last_break_pen_x - advance;
                // Re-measure from line_start to current position
                pen_x = 0;
                var j: usize = line_start;
                while (j < i) {
                    const jch = decodeUtf8(text[j..]);
                    if (cacheGlyph(jch.codepoint, size_px)) |g| {
                        pen_x += @floatFromInt(g.advance);
                    }
                    j += jch.len;
                }
                last_break = line_start;
                last_break_pen_x = 0;
            } else {
                // No break point — force break at current position
                drawTextLine(text[line_start..i], x, pen_y, size_px, cr, cg, cb, ca);
                pen_y += line_h;
                line_start = i;
                last_break = i;
                pen_x = 0;
                last_break_pen_x = 0;
            }
        }

        pen_x += advance;
        i += ch.len;
    }

    // Draw remaining text
    if (line_start < text.len) {
        drawTextLine(text[line_start..], x, pen_y, size_px, cr, cg, cb, ca);
        pen_y += line_h;
    }

    return pen_y - y;
}

/// Draw selection highlight rectangles for a byte range within wrapped text.
pub fn drawSelectionRects(text: []const u8, x: f32, y: f32, size_px: u16, max_width: f32, sel_start: usize, sel_end: usize) void {
    if (g_ft_face == null or sel_start >= sel_end) return;

    if (g_ft_current_size != size_px) {
        _ = c.FT_Set_Pixel_Sizes(g_ft_face, 0, size_px);
        g_ft_current_size = size_px;
    }

    const face = g_ft_face;
    const line_h: f32 = @as(f32, @floatFromInt(face.*.size.*.metrics.height)) / 64.0;

    // Walk text with same wrapping logic as drawTextWrapped, tracking line positions
    var pen_x: f32 = 0;
    var line_start: usize = 0;
    var last_break: usize = 0;
    var last_break_pen_x: f32 = 0;

    // Selection highlight color: blue with alpha
    const sel_r: f32 = 0.2;
    const sel_g: f32 = 0.4;
    const sel_b: f32 = 0.8;
    const sel_a: f32 = 0.4;

    // Simple approach: walk through text char by char, track x positions,
    // emit a rect for each line segment that overlaps [sel_start, sel_end)
    var cur_line_y: f32 = y;
    var cur_x: f32 = 0;
    var sel_line_start_x: f32 = -1;
    var in_selection: bool = false;
    var i: usize = 0;
    line_start = 0;
    pen_x = 0;

    while (i < text.len) {
        const ch = decodeUtf8(text[i..]);

        if (ch.codepoint == '\n') {
            // End of line — flush selection rect if active
            if (in_selection and sel_line_start_x >= 0) {
                drawRect(x + sel_line_start_x, cur_line_y, cur_x - sel_line_start_x, line_h, sel_r, sel_g, sel_b, sel_a, 0, 0, 0, 0, 0, 0);
            }
            cur_line_y += line_h;
            i += ch.len;
            line_start = i;
            last_break = i;
            pen_x = 0;
            cur_x = 0;
            last_break_pen_x = 0;
            if (in_selection) sel_line_start_x = 0;
            continue;
        }

        if (ch.codepoint == ' ') {
            last_break = i;
            last_break_pen_x = pen_x;
        }

        var advance: f32 = 0;
        if (cacheGlyph(ch.codepoint, size_px)) |glyph| {
            advance = @floatFromInt(glyph.advance);
        }

        // Check for word wrap
        if (max_width > 0 and pen_x + advance > max_width and pen_x > 0) {
            // Flush selection rect for this line
            if (in_selection and sel_line_start_x >= 0) {
                drawRect(x + sel_line_start_x, cur_line_y, cur_x - sel_line_start_x, line_h, sel_r, sel_g, sel_b, sel_a, 0, 0, 0, 0, 0, 0);
            }
            cur_line_y += line_h;

            if (last_break > line_start) {
                // Re-measure from line_start to current
                pen_x = 0;
                var j: usize = last_break + 1;
                while (j < i) {
                    const jch = decodeUtf8(text[j..]);
                    if (cacheGlyph(jch.codepoint, size_px)) |g| {
                        pen_x += @floatFromInt(g.advance);
                    }
                    j += jch.len;
                }
                cur_x = pen_x;
                line_start = last_break + 1;
            } else {
                line_start = i;
                pen_x = 0;
                cur_x = 0;
            }
            last_break = line_start;
            last_break_pen_x = 0;
            if (in_selection) sel_line_start_x = 0;
        }

        cur_x = pen_x;

        // Check selection transitions
        if (!in_selection and i >= sel_start and i < sel_end) {
            in_selection = true;
            sel_line_start_x = cur_x;
        }
        if (in_selection and i >= sel_end) {
            // End selection
            drawRect(x + sel_line_start_x, cur_line_y, cur_x - sel_line_start_x, line_h, sel_r, sel_g, sel_b, sel_a, 0, 0, 0, 0, 0, 0);
            in_selection = false;
        }

        pen_x += advance;
        cur_x = pen_x;
        i += ch.len;
    }

    // Flush final selection rect
    if (in_selection and sel_line_start_x >= 0) {
        drawRect(x + sel_line_start_x, cur_line_y, cur_x - sel_line_start_x, line_h, sel_r, sel_g, sel_b, sel_a, 0, 0, 0, 0, 0, 0);
    }
}

// ════════════════════════════════════════════════════════════════════════
// Batch draw helpers for scissor-segmented rendering
// ════════════════════════════════════════════════════════════════════════

fn drawRectBatch(render_pass: *wgpu.RenderPassEncoder, start: u32, end: u32) void {
    if (end <= start) return;
    if (g_rect_pipeline) |pipeline| {
        render_pass.setPipeline(pipeline);
        if (g_bind_group) |bg| render_pass.setBindGroup(0, bg, 0, null);
        if (g_rect_buffer) |buf| {
            render_pass.setVertexBuffer(0, buf, 0, g_rect_count * @sizeOf(RectInstance));
        }
        render_pass.draw(6, end - start, 0, start);
    }
}

fn drawGlyphBatch(render_pass: *wgpu.RenderPassEncoder, start: u32, end: u32) void {
    if (end <= start) return;
    if (g_text_pipeline) |pipeline| {
        render_pass.setPipeline(pipeline);
        if (g_text_bind_group) |bg| render_pass.setBindGroup(0, bg, 0, null);
        if (g_text_buffer) |buf| {
            render_pass.setVertexBuffer(0, buf, 0, g_glyph_count * @sizeOf(GlyphInstance));
        }
        render_pass.draw(6, end - start, 0, start);
    }
}

/// Render all queued primitives and present.
pub fn frame(bg_r: f64, bg_g: f64, bg_b: f64) void {
    const surface = g_surface orelse return;
    const device = g_device orelse return;
    const queue = g_queue orelse return;

    // Periodic memory drain — recreate buffers to reclaim fragmented pools
    g_frame_counter += 1;
    if (g_frame_counter % DRAIN_INTERVAL == 0) drainMemory();

    // Get current surface texture
    var surface_texture: wgpu.SurfaceTexture = undefined;
    surface.getCurrentTexture(&surface_texture);
    if (surface_texture.status != .success_optimal and surface_texture.status != .success_suboptimal) {
        if (surface_texture.texture) |t| t.release();
        if (g_width > 0 and g_height > 0) configureSurface(g_width, g_height);
        g_last_rect_count = g_rect_count;
        g_last_glyph_count = g_glyph_count;
        g_rect_count = 0;
        return;
    }

    const texture = surface_texture.texture orelse return;
    defer texture.release();
    const view = texture.createView(null) orelse return;
    defer view.release();

    // Dirty check: skip ENTIRE render pass if draw data hasn't changed.
    // This eliminates all per-frame wgpu object creation (CommandEncoder,
    // RenderPass, staging buffers) on static scenes — preventing the
    // Vulkan sub-allocator fragmentation that causes RSS growth (~90 bytes/frame)
    // over millions of cycles. Over 11 hours this adds up to ~400MB.
    const data_changed = blk: {
        const hash = frameDataHash(g_rect_count, g_glyph_count);
        const changed = (g_width != g_prev_dims[0] or g_height != g_prev_dims[1] or hash != g_prev_frame_hash);
        if (changed) g_prev_frame_hash = hash;
        break :blk changed;
    };

    // Note: we CANNOT skip the render pass on static frames because each
    // getCurrentTexture() returns a new swapchain image that must be drawn
    // into. Presenting without rendering shows garbage/flickering.
    // The writeBuffer skip below is the safe optimization — it avoids
    // staging buffer creation while still drawing into the new surface.

    if (data_changed) {
        g_prev_dims = .{ g_width, g_height };

        // Update globals uniform (screen size)
        const globals = [2]f32{ @floatFromInt(g_width), @floatFromInt(g_height) };
        if (g_globals_buffer) |buf| {
            queue.writeBuffer(buf, 0, @ptrCast(&globals), @sizeOf(@TypeOf(globals)));
        }

        // Upload rect instance data
        if (g_rect_count > 0) {
            if (g_rect_buffer) |buf| {
                const byte_size = g_rect_count * @sizeOf(RectInstance);
                queue.writeBuffer(buf, 0, @ptrCast(&g_rects), byte_size);
            }
        }

        // Upload glyph instance data
        if (g_glyph_count > 0) {
            if (g_text_buffer) |buf| {
                const byte_size = g_glyph_count * @sizeOf(GlyphInstance);
                queue.writeBuffer(buf, 0, @ptrCast(&g_glyphs), byte_size);
            }
        }
    }

    const encoder = device.createCommandEncoder(&.{}) orelse return;

    // Render pass
    const color_attachment = wgpu.ColorAttachment{
        .view = view,
        .load_op = .clear,
        .store_op = .store,
        .clear_value = .{ .r = bg_r, .g = bg_g, .b = bg_b, .a = 1.0 },
    };

    const render_pass = encoder.beginRenderPass(&.{
        .color_attachment_count = 1,
        .color_attachments = @ptrCast(&color_attachment),
    }) orelse return;

    if (g_scissor_count == 0) {
        // Fast path — no clip rects, single draw for all rects + glyphs
        render_pass.setScissorRect(0, 0, g_width, g_height);
        drawRectBatch(render_pass, 0, @intCast(g_rect_count));
        drawGlyphBatch(render_pass, 0, @intCast(g_glyph_count));
    } else {
        // Add a final sentinel segment covering everything after the last segment
        var segments: [MAX_SCISSOR_SEGMENTS + 1]ScissorSegment = undefined;
        const seg_count = g_scissor_count;
        @memcpy(segments[0..seg_count], g_scissor_segments[0..seg_count]);

        // Process segments: each segment says "from here, use this scissor"
        // We need to draw [prev_segment_start .. this_segment_start) with prev scissor,
        // then switch to this segment's scissor.

        // Start with full viewport for anything before the first segment
        var prev_rect: u32 = 0;
        var prev_glyph: u32 = 0;
        var prev_sx: u32 = 0;
        var prev_sy: u32 = 0;
        var prev_sw: u32 = g_width;
        var prev_sh: u32 = g_height;

        for (0..seg_count) |si| {
            const seg = segments[si];
            const rect_end = seg.rect_start;
            const glyph_end = seg.glyph_start;

            // Draw everything between prev and this segment boundary with prev scissor
            if (rect_end > prev_rect or glyph_end > prev_glyph) {
                render_pass.setScissorRect(prev_sx, prev_sy, prev_sw, prev_sh);
                if (rect_end > prev_rect) drawRectBatch(render_pass, prev_rect, rect_end);
                if (glyph_end > prev_glyph) drawGlyphBatch(render_pass, prev_glyph, glyph_end);
            }

            prev_rect = rect_end;
            prev_glyph = glyph_end;
            prev_sx = seg.x;
            prev_sy = seg.y;
            prev_sw = seg.w;
            prev_sh = seg.h;
        }

        // Draw remaining after last segment
        const total_rects: u32 = @intCast(g_rect_count);
        const total_glyphs: u32 = @intCast(g_glyph_count);
        if (total_rects > prev_rect or total_glyphs > prev_glyph) {
            render_pass.setScissorRect(prev_sx, prev_sy, prev_sw, prev_sh);
            if (total_rects > prev_rect) drawRectBatch(render_pass, prev_rect, total_rects);
            if (total_glyphs > prev_glyph) drawGlyphBatch(render_pass, prev_glyph, total_glyphs);
        }
    }

    render_pass.end();
    render_pass.release();

    const command = encoder.finish(null) orelse return;
    encoder.release();

    queue.submit(&.{command});
    command.release();

    _ = surface.present();

    // Blocking poll — reclaim all staging buffers and completed command
    // buffers.  Non-blocking poll(false) left ~2% of staging unreclaimable
    // per frame; combined with the dirty-check above (which skips writeBuffer
    // entirely on static frames), this eliminates the RSS growth.
    _ = device.poll(true, null);

    // Save counts for diagnostics, then reset for next frame
    g_last_rect_count = g_rect_count;
    g_last_glyph_count = g_glyph_count;
    g_rect_count = 0;
    g_glyph_count = 0;
    g_scissor_count = 0;
    g_scissor_depth = 0;
}

/// Diagnostic stats for crash reporting.
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
        .rect_count = g_last_rect_count,
        .glyph_count = g_last_glyph_count,
        .atlas_count = g_atlas_count,
        .atlas_max = MAX_ATLAS_GLYPHS,
        .rect_max = MAX_RECTS,
        .glyph_max = MAX_GLYPHS,
        .atlas_row_y = g_atlas_row_y,
        .atlas_size = ATLAS_SIZE,
    };
}

// ════════════════════════════════════════════════════════════════════════
// Dirty-check hash — detect unchanged draw data between frames
// ════════════════════════════════════════════════════════════════════════

/// Fast non-crypto hash over rect + glyph arrays. Both struct sizes are
/// multiples of 8, so the loop covers all bytes with no remainder.
fn frameDataHash(rect_count: usize, glyph_count: usize) u64 {
    var h: u64 = rect_count *% 0x9e3779b97f4a7c15;
    h ^= glyph_count *% 0x517cc1b727220a95;

    if (rect_count > 0) {
        const len = rect_count * @sizeOf(RectInstance);
        const bytes: [*]const u8 = @ptrCast(&g_rects);
        var i: usize = 0;
        while (i + 8 <= len) : (i += 8) {
            h ^= std.mem.readInt(u64, bytes[i..][0..8], .little);
            h = h *% 0x2127599bf4325c37 +% 0x880355f21e6d1965;
        }
    }

    if (glyph_count > 0) {
        const len = glyph_count * @sizeOf(GlyphInstance);
        const bytes: [*]const u8 = @ptrCast(&g_glyphs);
        var i: usize = 0;
        while (i + 8 <= len) : (i += 8) {
            h ^= std.mem.readInt(u64, bytes[i..][0..8], .little);
            h = h *% 0x2127599bf4325c37 +% 0x880355f21e6d1965;
        }
    }

    return h;
}

// ════════════════════════════════════════════════════════════════════════
// Pipeline setup
// ════════════════════════════════════════════════════════════════════════

fn initRectPipeline(device: *wgpu.Device) void {
    // Create shader module
    const shader_desc = wgpu.shaderModuleWGSLDescriptor(.{
        .label = "rect_shader",
        .code = shaders.rect_wgsl,
    });
    const shader_module = device.createShaderModule(&shader_desc) orelse {
        std.debug.print("Failed to create rect shader module\n", .{});
        return;
    };
    defer shader_module.release();

    // Globals uniform buffer: screen_size(8) + transform_offset(8) + transform_scale(4) + pad(12) = 32
    g_globals_buffer = device.createBuffer(&.{
        .label = wgpu.StringView.fromSlice("globals"),
        .size = 16,
        .usage = wgpu.BufferUsages.uniform | wgpu.BufferUsages.copy_dst,
        .mapped_at_creation = 0,
    });

    // Rect instance buffer
    g_rect_buffer = device.createBuffer(&.{
        .label = wgpu.StringView.fromSlice("rect_instances"),
        .size = MAX_RECTS * @sizeOf(RectInstance),
        .usage = wgpu.BufferUsages.vertex | wgpu.BufferUsages.copy_dst,
        .mapped_at_creation = 0,
    });

    // Bind group layout (group 0: globals uniform)
    const bind_group_layout = device.createBindGroupLayout(&.{
        .entry_count = 1,
        .entries = @ptrCast(&wgpu.BindGroupLayoutEntry{
            .binding = 0,
            .visibility = wgpu.ShaderStages.vertex | wgpu.ShaderStages.fragment,
            .buffer = .{
                .@"type" = .uniform,
                .has_dynamic_offset = 0,
                .min_binding_size = 8,
            },
        }),
    }) orelse return;
    g_bind_group_layout = bind_group_layout; // persist for drain

    // Bind group
    g_bind_group = device.createBindGroup(&.{
        .layout = bind_group_layout,
        .entry_count = 1,
        .entries = @ptrCast(&wgpu.BindGroupEntry{
            .binding = 0,
            .buffer = g_globals_buffer,
            .offset = 0,
            .size = 16,
        }),
    });

    // Pipeline layout
    const pipeline_layout = device.createPipelineLayout(&.{
        .bind_group_layout_count = 1,
        .bind_group_layouts = @ptrCast(&bind_group_layout),
    }) orelse return;
    defer pipeline_layout.release();

    // Instance vertex attributes (9 locations for 20 floats)
    const instance_attrs = [_]wgpu.VertexAttribute{
        .{ .format = .float32x2, .offset = 0, .shader_location = 0 }, // pos
        .{ .format = .float32x2, .offset = 8, .shader_location = 1 }, // size
        .{ .format = .float32x4, .offset = 16, .shader_location = 2 }, // color
        .{ .format = .float32x4, .offset = 32, .shader_location = 3 }, // border_color
        .{ .format = .float32x4, .offset = 48, .shader_location = 4 }, // radii
        .{ .format = .float32, .offset = 64, .shader_location = 5 }, // border_width
        .{ .format = .float32, .offset = 68, .shader_location = 6 }, // _pad0
        .{ .format = .float32, .offset = 72, .shader_location = 7 }, // _pad1
        .{ .format = .float32, .offset = 76, .shader_location = 8 }, // _pad2
    };

    const instance_buffer_layout = wgpu.VertexBufferLayout{
        .step_mode = .instance,
        .array_stride = @sizeOf(RectInstance),
        .attribute_count = instance_attrs.len,
        .attributes = &instance_attrs,
    };

    // Blend state: premultiplied alpha
    const blend_state = wgpu.BlendState.premultiplied_alpha_blending;

    const color_target = wgpu.ColorTargetState{
        .format = g_format,
        .blend = &blend_state,
        .write_mask = wgpu.ColorWriteMasks.all,
    };

    const fragment_state = wgpu.FragmentState{
        .module = shader_module,
        .entry_point = wgpu.StringView.fromSlice("fs_main"),
        .target_count = 1,
        .targets = @ptrCast(&color_target),
    };

    g_rect_pipeline = device.createRenderPipeline(&.{
        .layout = pipeline_layout,
        .vertex = .{
            .module = shader_module,
            .entry_point = wgpu.StringView.fromSlice("vs_main"),
            .buffer_count = 1,
            .buffers = @ptrCast(&instance_buffer_layout),
        },
        .primitive = .{
            .topology = .triangle_list,
        },
        .multisample = .{},
        .fragment = &fragment_state,
    });

    if (g_rect_pipeline == null) {
        std.debug.print("Failed to create rect render pipeline\n", .{});
    }
}

// ════════════════════════════════════════════════════════════════════════
// Text pipeline setup
// ════════════════════════════════════════════════════════════════════════

fn initTextPipeline(device: *wgpu.Device) void {
    const shader_desc = wgpu.shaderModuleWGSLDescriptor(.{
        .label = "text_shader",
        .code = shaders.text_wgsl,
    });
    const shader_module = device.createShaderModule(&shader_desc) orelse {
        std.debug.print("Failed to create text shader module\n", .{});
        return;
    };
    defer shader_module.release();

    const atlas_view = g_atlas_view orelse return;
    const atlas_sampler = g_atlas_sampler orelse return;

    // Bind group layout: globals uniform + atlas texture + sampler
    const layout_entries = [_]wgpu.BindGroupLayoutEntry{
        .{ // binding 0: globals uniform
            .binding = 0,
            .visibility = wgpu.ShaderStages.vertex,
            .buffer = .{ .@"type" = .uniform, .has_dynamic_offset = 0, .min_binding_size = 8 },
        },
        .{ // binding 1: atlas texture
            .binding = 1,
            .visibility = wgpu.ShaderStages.fragment,
            .texture = .{
                .sample_type = .float,
                .view_dimension = .@"2d",
                .multisampled = 0,
            },
        },
        .{ // binding 2: sampler
            .binding = 2,
            .visibility = wgpu.ShaderStages.fragment,
            .sampler = .{ .@"type" = .filtering },
        },
    };

    const bind_group_layout = device.createBindGroupLayout(&.{
        .entry_count = layout_entries.len,
        .entries = &layout_entries,
    }) orelse return;
    g_text_bind_group_layout = bind_group_layout; // persist for drain

    // Bind group with actual resources
    const bind_entries = [_]wgpu.BindGroupEntry{
        .{ .binding = 0, .buffer = g_globals_buffer, .offset = 0, .size = 8 },
        .{ .binding = 1, .texture_view = atlas_view },
        .{ .binding = 2, .sampler = atlas_sampler },
    };

    g_text_bind_group = device.createBindGroup(&.{
        .layout = bind_group_layout,
        .entry_count = bind_entries.len,
        .entries = &bind_entries,
    });

    const pipeline_layout = device.createPipelineLayout(&.{
        .bind_group_layout_count = 1,
        .bind_group_layouts = @ptrCast(&bind_group_layout),
    }) orelse return;
    defer pipeline_layout.release();

    // Glyph instance vertex attributes
    const glyph_attrs = [_]wgpu.VertexAttribute{
        .{ .format = .float32x2, .offset = 0, .shader_location = 0 }, // pos
        .{ .format = .float32x2, .offset = 8, .shader_location = 1 }, // size
        .{ .format = .float32x2, .offset = 16, .shader_location = 2 }, // uv_pos
        .{ .format = .float32x2, .offset = 24, .shader_location = 3 }, // uv_size
        .{ .format = .float32x4, .offset = 32, .shader_location = 4 }, // color
    };

    const glyph_buffer_layout = wgpu.VertexBufferLayout{
        .step_mode = .instance,
        .array_stride = @sizeOf(GlyphInstance),
        .attribute_count = glyph_attrs.len,
        .attributes = &glyph_attrs,
    };

    const blend_state = wgpu.BlendState.premultiplied_alpha_blending;
    const color_target = wgpu.ColorTargetState{
        .format = g_format,
        .blend = &blend_state,
        .write_mask = wgpu.ColorWriteMasks.all,
    };

    const fragment_state = wgpu.FragmentState{
        .module = shader_module,
        .entry_point = wgpu.StringView.fromSlice("fs_main"),
        .target_count = 1,
        .targets = @ptrCast(&color_target),
    };

    g_text_pipeline = device.createRenderPipeline(&.{
        .layout = pipeline_layout,
        .vertex = .{
            .module = shader_module,
            .entry_point = wgpu.StringView.fromSlice("vs_main"),
            .buffer_count = 1,
            .buffers = @ptrCast(&glyph_buffer_layout),
        },
        .primitive = .{ .topology = .triangle_list },
        .multisample = .{},
        .fragment = &fragment_state,
    });

    if (g_text_pipeline == null) {
        std.debug.print("Failed to create text render pipeline\n", .{});
    }
}

// ════════════════════════════════════════════════════════════════════════
// Glyph atlas — FreeType rasterization → wgpu texture
// ════════════════════════════════════════════════════════════════════════

/// Get the advance width of a character at a given font size (for monospace grid).
pub fn getCharAdvance(codepoint: u32, size_px: u16) f32 {
    if (cacheGlyph(codepoint, size_px)) |glyph| {
        return @floatFromInt(glyph.advance);
    }
    return @floatFromInt(size_px / 2); // fallback
}

/// Get the line height (ascent + descent) for a given font size.
pub fn getLineHeight(size_px: u16) f32 {
    const face = g_ft_face orelse return @floatFromInt(size_px);
    if (g_ft_current_size != size_px) {
        _ = c.FT_Set_Pixel_Sizes(face, 0, size_px);
        g_ft_current_size = size_px;
    }
    const ascender: f32 = @as(f32, @floatFromInt(face.*.size.*.metrics.ascender)) / 64.0;
    const descender: f32 = @as(f32, @floatFromInt(face.*.size.*.metrics.descender)) / 64.0;
    return ascender - descender + 2.0; // +2 for line spacing
}

fn cacheGlyph(codepoint: u32, size_px: u16) ?*const AtlasGlyphInfo {
    // Check cache
    for (0..g_atlas_count) |i| {
        if (g_atlas_keys[i].codepoint == codepoint and g_atlas_keys[i].size_px == size_px) {
            return &g_atlas_vals[i];
        }
    }
    if (g_atlas_count >= MAX_ATLAS_GLYPHS) return null;

    const face = g_ft_face orelse return null;

    // Set size
    if (g_ft_current_size != size_px) {
        _ = c.FT_Set_Pixel_Sizes(face, 0, size_px);
        g_ft_current_size = size_px;
    }

    // Load glyph — try primary face, then fallbacks
    var use_face = face;
    if (c.FT_Get_Char_Index(face, codepoint) == 0) {
        for (0..g_ft_fallback_count) |fi| {
            const fb = g_ft_fallbacks[fi];
            if (c.FT_Get_Char_Index(fb, codepoint) != 0) {
                _ = c.FT_Set_Pixel_Sizes(fb, 0, size_px);
                use_face = fb;
                break;
            }
        }
    }

    if (c.FT_Load_Char(use_face, codepoint, c.FT_LOAD_RENDER) != 0) {
        return null;
    }

    const glyph = use_face.*.glyph;
    const bitmap = glyph.*.bitmap;
    const bw: u32 = @intCast(bitmap.width);
    const bh: u32 = @intCast(bitmap.rows);

    // Pack into atlas (row-based)
    var atlas_x: u32 = 0;
    var atlas_y: u32 = 0;

    if (bw > 0 and bh > 0) {
        // Check if glyph fits in current row
        if (g_atlas_row_x + bw + 1 > ATLAS_SIZE) {
            // Start new row
            g_atlas_row_y += g_atlas_row_h + 1;
            g_atlas_row_x = 0;
            g_atlas_row_h = 0;
        }
        if (g_atlas_row_y + bh > ATLAS_SIZE) {
            // Atlas full
            return null;
        }

        atlas_x = g_atlas_row_x;
        atlas_y = g_atlas_row_y;
        g_atlas_row_x += bw + 1;
        if (bh > g_atlas_row_h) g_atlas_row_h = bh;

        // Upload glyph bitmap to atlas texture
        uploadGlyphToAtlas(bitmap, atlas_x, atlas_y, bw, bh);
    }

    const idx = g_atlas_count;
    g_atlas_keys[idx] = .{ .codepoint = codepoint, .size_px = size_px };
    g_atlas_vals[idx] = .{
        .uv_x = @as(f32, @floatFromInt(atlas_x)) / @as(f32, ATLAS_SIZE),
        .uv_y = @as(f32, @floatFromInt(atlas_y)) / @as(f32, ATLAS_SIZE),
        .uv_w = @as(f32, @floatFromInt(bw)) / @as(f32, ATLAS_SIZE),
        .uv_h = @as(f32, @floatFromInt(bh)) / @as(f32, ATLAS_SIZE),
        .bearing_x = glyph.*.bitmap_left,
        .bearing_y = glyph.*.bitmap_top,
        .advance = @intCast(glyph.*.advance.x >> 6),
        .width = @intCast(bw),
        .height = @intCast(bh),
    };
    g_atlas_count += 1;

    return &g_atlas_vals[idx];
}

fn uploadGlyphToAtlas(bitmap: anytype, atlas_x: u32, atlas_y: u32, bw: u32, bh: u32) void {
    const queue = g_queue orelse return;
    const atlas = g_atlas_texture orelse return;

    // Convert grayscale bitmap to RGBA
    const pixel_count = bw * bh;
    if (pixel_count == 0) return;

    // Stack buffer for small glyphs, otherwise skip (most glyphs are small)
    var rgba_buf: [256 * 256 * 4]u8 = undefined;
    if (pixel_count * 4 > rgba_buf.len) return;

    const src_pitch: usize = @intCast(bitmap.pitch);
    for (0..bh) |row| {
        for (0..bw) |col| {
            const alpha = bitmap.buffer[row * src_pitch + col];
            const dst = (row * bw + col) * 4;
            rgba_buf[dst + 0] = 255; // R
            rgba_buf[dst + 1] = 255; // G
            rgba_buf[dst + 2] = 255; // B
            rgba_buf[dst + 3] = alpha; // A
        }
    }

    // Upload to atlas via queue.writeTexture
    queue.writeTexture(
        &.{
            .texture = atlas,
            .mip_level = 0,
            .origin = .{ .x = atlas_x, .y = atlas_y, .z = 0 },
            .aspect = .all,
        },
        @ptrCast(&rgba_buf),
        bw * bh * 4,
        &.{
            .offset = 0,
            .bytes_per_row = bw * 4,
            .rows_per_image = bh,
        },
        &.{ .width = bw, .height = bh, .depth_or_array_layers = 1 },
    );
}

// ════════════════════════════════════════════════════════════════════════
// UTF-8 decoding (shared with text.zig, duplicated for independence)
// ════════════════════════════════════════════════════════════════════════

const Utf8Char = struct {
    codepoint: u32,
    len: u3,
};

fn decodeUtf8(bytes: []const u8) Utf8Char {
    if (bytes.len == 0) return .{ .codepoint = 0xFFFD, .len = 1 };
    const b0 = bytes[0];
    if (b0 < 0x80) return .{ .codepoint = b0, .len = 1 };
    if (b0 < 0xC0) return .{ .codepoint = 0xFFFD, .len = 1 };
    if (b0 < 0xE0) {
        if (bytes.len < 2) return .{ .codepoint = 0xFFFD, .len = 1 };
        return .{ .codepoint = (@as(u32, b0 & 0x1F) << 6) | @as(u32, bytes[1] & 0x3F), .len = 2 };
    }
    if (b0 < 0xF0) {
        if (bytes.len < 3) return .{ .codepoint = 0xFFFD, .len = 1 };
        return .{ .codepoint = (@as(u32, b0 & 0x0F) << 12) | (@as(u32, bytes[1] & 0x3F) << 6) | @as(u32, bytes[2] & 0x3F), .len = 3 };
    }
    if (bytes.len < 4) return .{ .codepoint = 0xFFFD, .len = 1 };
    return .{ .codepoint = (@as(u32, b0 & 0x07) << 18) | (@as(u32, bytes[1] & 0x3F) << 12) | (@as(u32, bytes[2] & 0x3F) << 6) | @as(u32, bytes[3] & 0x3F), .len = 4 };
}

// ════════════════════════════════════════════════════════════════════════
// Surface / platform helpers
// ════════════════════════════════════════════════════════════════════════

fn configureSurface(width: u32, height: u32) void {
    const surface = g_surface orelse return;
    const device = g_device orelse return;
    const adapter = g_adapter orelse return;

    var caps: wgpu.SurfaceCapabilities = undefined;
    _ = surface.getCapabilities(adapter, &caps);

    // Prefer non-sRGB format to avoid double gamma correction.
    // Our colors are already in sRGB space (CSS hex values like #1e1e2a).
    // An sRGB surface format would apply gamma encoding again → washed out.
    g_format = .bgra8_unorm; // safe default
    if (caps.format_count > 0) {
        g_format = caps.formats[0]; // fallback to first supported
        for (caps.formats[0..caps.format_count]) |fmt| {
            if (fmt == .bgra8_unorm or fmt == .rgba8_unorm) {
                g_format = fmt;
                break;
            }
        }
    }

    const config = wgpu.SurfaceConfiguration{
        .device = device,
        .format = g_format,
        .width = width,
        .height = height,
        .present_mode = .fifo,
        .alpha_mode = .auto,
    };
    surface.configure(&config);
}

fn createSurfaceFromSDL(instance: *wgpu.Instance, wm_info: *const c.SDL_SysWMinfo) ?*wgpu.Surface {
    const subsystem = wm_info.subsystem;

    if (subsystem == c.SDL_SYSWM_X11) {
        const d = wgpu.surfaceDescriptorFromXlibWindow(.{
            .display = @ptrCast(wm_info.info.x11.display),
            .window = @intCast(wm_info.info.x11.window),
        });
        return instance.createSurface(&d);
    }

    if (subsystem == c.SDL_SYSWM_WAYLAND) {
        const d = wgpu.surfaceDescriptorFromWaylandSurface(.{
            .display = @ptrCast(wm_info.info.wl.display),
            .surface = @ptrCast(wm_info.info.wl.surface),
        });
        return instance.createSurface(&d);
    }

    std.debug.print("Unsupported windowing subsystem: {d}\n", .{subsystem});
    return null;
}

// ════════════════════════════════════════════════════════════════════════
// Telemetry getters
// ════════════════════════════════════════════════════════════════════════

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
        .rect_count = @intCast(g_last_rect_count),
        .glyph_count = @intCast(g_last_glyph_count),
        .rect_capacity = MAX_RECTS,
        .glyph_capacity = MAX_GLYPHS,
        .atlas_glyph_count = @intCast(g_atlas_count),
        .atlas_capacity = MAX_ATLAS_GLYPHS,
        .atlas_row_x = g_atlas_row_x,
        .atlas_row_y = g_atlas_row_y,
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
