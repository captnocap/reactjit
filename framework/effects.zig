//! Effects — Composable pixel-buffer effect system.
//!
//! Two paths:
//!   1. Registry path (legacy): named EffectModule with create/update/draw/destroy.
//!      Used by <Spirograph />, <Rings />, etc. Kept for backward compat.
//!   2. Custom render path (new): <Effect onRender={fn}> with user-compiled callbacks.
//!      The framework provides pixel buffer + timing; user code does the math.
//!
//! Both paths share the same Instance lifecycle: CPU pixel buffer → wgpu texture → quad.
//!
//! Usage in .tsz:
//!   <Effect onRender={(e) => {
//!     for (let y = 0; y < e.height; y++)
//!       for (let x = 0; x < e.width; x++)
//!         e.setPixel(x, y, e.sin(x * 0.1 + e.time) * 0.5 + 0.5, 0, 0, 1);
//!   }} width={400} height={300} />

const std = @import("std");
const builtin = @import("builtin");
const wgpu = @import("wgpu");
const gpu_core = @import("gpu/gpu.zig");
const images = @import("gpu/images.zig");
const log = @import("log.zig");
const layout = @import("layout.zig");
const effect_ctx = @import("effect_ctx.zig");
const effect_shader = @import("effect_shader.zig");

pub const EffectContext = effect_ctx.EffectContext;
pub const RenderFn = effect_ctx.RenderFn;
pub const GpuShaderDesc = effect_shader.GpuShaderDesc;

const Node = layout.Node;
const page_alloc = std.heap.page_allocator;

// ════════════════════════════════════════════════════════════════════════
// Legacy registry interface (kept for backward compat)
// ════════════════════════════════════════════════════════════════════════

const EffectState = *anyopaque;

pub const MouseInfo = struct {
    x: f32 = 0,
    y: f32 = 0,
    dx: f32 = 0,
    dy: f32 = 0,
    speed: f32 = 0,
    inside: bool = false,
    idle: f32 = 0,
};

pub const EffectModule = struct {
    create: *const fn (w: u32, h: u32) EffectState,
    update: *const fn (state: EffectState, dt: f32, w: u32, h: u32, mouse: MouseInfo) void,
    draw: *const fn (state: EffectState, buf: []u8, w: u32, h: u32) void,
    destroy: *const fn (state: EffectState) void,
};

const MAX_EFFECT_TYPES = 32;

const RegistryEntry = struct {
    name: []const u8 = "",
    module: EffectModule = undefined,
};

var registry: [MAX_EFFECT_TYPES]RegistryEntry = [_]RegistryEntry{.{}} ** MAX_EFFECT_TYPES;
var registry_count: usize = 0;

pub fn register(name: []const u8, module: EffectModule) void {
    if (registry_count >= MAX_EFFECT_TYPES) return;
    registry[registry_count] = .{ .name = name, .module = module };
    registry_count += 1;
    log.info(.render, "Effect registered: {s}", .{name});
}

fn findModule(name: []const u8) ?*const EffectModule {
    for (registry[0..registry_count]) |*entry| {
        if (std.mem.eql(u8, entry.name, name)) return &entry.module;
    }
    return null;
}

pub fn isEffect(name: []const u8) bool {
    return findModule(name) != null;
}

// ════════════════════════════════════════════════════════════════════════
// Safety budgets — prevent runaway effects from crashing the GPU
// ════════════════════════════════════════════════════════════════════════

const MAX_EFFECT_PIXELS: u32 = 2_000_000; // ~1920x1040 total per frame
const MAX_EFFECT_DIM: u32 = 2048; // no single dimension > 2048
const MAX_UPLOAD_BYTES: u32 = 8 * 1024 * 1024; // 8MB texture uploads per frame
var g_frame_effect_pixels: u32 = 0;
var g_frame_upload_bytes: u32 = 0;
var g_effect_budget_logged: bool = false;
var g_effect_debug_logged: bool = false;
var g_effect_gpu_result_logged: bool = false;
var g_effect_cpu_result_logged: bool = false;
var g_effect_queue_logged: bool = false;

// ════════════════════════════════════════════════════════════════════════
// Instances — shared between registry and custom render paths
// ════════════════════════════════════════════════════════════════════════

const MAX_INSTANCES = 32;

const BackendPref = enum { auto, cpu, gpu };
const InstanceBackend = enum { cpu, gpu };

const GpuUniforms = extern struct {
    size_w: f32,
    size_h: f32,
    time: f32,
    dt: f32,
    frame: f32,
    mouse_x: f32,
    mouse_y: f32,
    mouse_inside: f32,
};

var g_paisley_debug_enabled: ?bool = null;

fn paisleyDebugEnabled() bool {
    if (g_paisley_debug_enabled == null) {
        g_paisley_debug_enabled = std.posix.getenv("ZIGOS_PAISLEY_DEBUG") != null;
    }
    return g_paisley_debug_enabled.?;
}

fn isPaisleyName(name: []const u8) bool {
    return std.mem.startsWith(u8, name, "paisley-");
}

fn samplePixelAlpha(buf: []const u8, width: u32, height: u32, x: u32, y: u32) u8 {
    if (width == 0 or height == 0) return 0;
    const sx = @min(width - 1, x);
    const sy = @min(height - 1, y);
    const idx: usize = @as(usize, sy) * @as(usize, width) * 4 + @as(usize, sx) * 4;
    if (idx + 3 >= buf.len) return 0;
    return buf[idx + 3];
}

fn flipRowsInPlace(buf: []u8, row_bytes: u32, h: u32) void {
    if (row_bytes == 0 or h <= 1 or row_bytes > 8192) return;

    var tmp: [8192]u8 = undefined;
    const tmp_row = tmp[0..row_bytes];
    var top: usize = 0;
    var bot: usize = h - 1;
    while (top < bot) {
        const top_ptr = buf[top * row_bytes ..][0..row_bytes];
        const bot_ptr = buf[bot * row_bytes ..][0..row_bytes];
        @memcpy(tmp_row, top_ptr);
        @memcpy(top_ptr, bot_ptr);
        @memcpy(bot_ptr, tmp_row);
        top += 1;
        bot -= 1;
    }
}

const Instance = struct {
    active: bool = false,

    // Identity — one of these is set, not both
    effect_type: []const u8 = "", // registry path
    render_fn: ?RenderFn = null, // custom render path
    shader_desc: ?GpuShaderDesc = null, // optional GPU path for custom effects
    node_key: usize = 0, // stable identity for custom effects
    name: ?[]const u8 = null, // user-assigned name for referencing as fill source

    // Registry path state
    state: ?EffectState = null,
    module: ?*const EffectModule = null,

    // Pixel buffer + wgpu resources
    pixel_buf: ?[]u8 = null,
    width: u32 = 0,
    height: u32 = 0,
    texture: ?*wgpu.Texture = null,
    texture_view: ?*wgpu.TextureView = null,
    sampler: ?*wgpu.Sampler = null,
    bind_group: ?*wgpu.BindGroup = null,
    dirty: bool = false,
    backend: InstanceBackend = .cpu,
    gpu_failed: bool = false,
    gpu_pipeline: ?*wgpu.RenderPipeline = null,
    gpu_uniform_buffer: ?*wgpu.Buffer = null,
    gpu_bind_group: ?*wgpu.BindGroup = null,

    // Timing (for custom render path)
    time: f32 = 0,
    frame_count: u32 = 0,

    // Position (for mouse hit testing)
    screen_x: f32 = 0,
    screen_y: f32 = 0,
    display_width: f32 = 0,
    display_height: f32 = 0,

    fn deinit(self: *Instance) void {
        if (self.state) |s| {
            if (self.module) |m| m.destroy(s);
        }
        self.state = null;
        if (self.bind_group) |bg| bg.release();
        if (self.sampler) |s| s.release();
        if (self.texture_view) |tv| tv.release();
        if (self.texture) |t| t.destroy();
        if (self.gpu_bind_group) |bg| bg.release();
        if (self.gpu_uniform_buffer) |buf| buf.release();
        if (self.gpu_pipeline) |pipe| pipe.release();
        self.bind_group = null;
        self.sampler = null;
        self.texture_view = null;
        self.texture = null;
        self.gpu_bind_group = null;
        self.gpu_uniform_buffer = null;
        self.gpu_pipeline = null;
        if (self.pixel_buf) |buf| page_alloc.free(buf);
        self.pixel_buf = null;
        self.active = false;
    }

    fn releaseTarget(self: *Instance) void {
        if (self.bind_group) |bg| bg.release();
        if (self.sampler) |s| s.release();
        if (self.texture_view) |tv| tv.release();
        if (self.texture) |t| t.destroy();
        self.bind_group = null;
        self.sampler = null;
        self.texture_view = null;
        self.texture = null;
    }

    fn setDisplaySize(self: *Instance, w: f32, h: f32) void {
        self.display_width = @max(1.0, w);
        self.display_height = @max(1.0, h);
    }

    fn ensureCpuSize(self: *Instance, w: u32, h: u32) void {
        if (w == 0 or h == 0) return;
        if (self.width == w and self.height == h) return;

        if (self.pixel_buf) |buf| page_alloc.free(buf);
        self.pixel_buf = page_alloc.alloc(u8, @as(usize, w) * @as(usize, h) * 4) catch return;
        @memset(self.pixel_buf.?, 0);
        self.width = w;
        self.height = h;

        self.releaseTarget();

        // Re-create registry effect state at new size
        if (self.module) |m| {
            if (self.state) |s| m.destroy(s);
            self.state = m.create(w, h);
        }
    }

    fn ensureTarget(self: *Instance, render_attachment: bool) bool {
        if (self.bind_group != null) return true;
        const device = gpu_core.getDevice() orelse return false;
        if (self.width == 0 or self.height == 0) return false;

        const tex = device.createTexture(&.{
            .label = wgpu.StringView.fromSlice("effect"),
            .size = .{ .width = self.width, .height = self.height, .depth_or_array_layers = 1 },
            .mip_level_count = 1,
            .sample_count = 1,
            .dimension = .@"2d",
            .format = .rgba8_unorm,
            .usage = if (render_attachment)
                (wgpu.TextureUsages.texture_binding | wgpu.TextureUsages.render_attachment)
            else
                (wgpu.TextureUsages.texture_binding | wgpu.TextureUsages.copy_dst),
        }) orelse return false;

        const view = tex.createView(&.{
            .format = .rgba8_unorm,
            .dimension = .@"2d",
            .base_mip_level = 0,
            .mip_level_count = 1,
            .base_array_layer = 0,
            .array_layer_count = 1,
            .aspect = .all,
        }) orelse {
            tex.destroy();
            return false;
        };

        const sampler = device.createSampler(&.{
            .address_mode_u = .clamp_to_edge,
            .address_mode_v = .clamp_to_edge,
            .mag_filter = .linear,
            .min_filter = .linear,
        }) orelse {
            view.release();
            tex.destroy();
            return false;
        };

        const bg = images.createBindGroup(view, sampler) orelse {
            sampler.release();
            view.release();
            tex.destroy();
            return false;
        };

        self.texture = tex;
        self.texture_view = view;
        self.sampler = sampler;
        self.bind_group = bg;
        return true;
    }

    fn upload(self: *Instance) void {
        if (!self.dirty) return;
        self.dirty = false;
        const tex = self.texture orelse return;
        const buf = self.pixel_buf orelse return;
        const queue = gpu_core.getQueue() orelse return;
        const w = self.width;
        const h = self.height;
        const upload_size = @as(u32, w) * @as(u32, h) * 4;
        if (g_frame_upload_bytes + upload_size > MAX_UPLOAD_BYTES) {
            if (!g_effect_budget_logged) {
                g_effect_budget_logged = true;
                std.debug.print("[BUDGET] Texture upload budget exceeded {d} bytes/frame — skipping upload\n", .{MAX_UPLOAD_BYTES});
            }
            return;
        }
        g_frame_upload_bytes += upload_size;
        const row_bytes = w * 4;

        // Flip rows for the shared image shader, then restore the CPU buffer so
        // CPU-side consumers like fillEffect sampling keep a stable top-down view.
        const should_flip = row_bytes <= 8192 and h > 1;
        if (should_flip) flipRowsInPlace(buf, row_bytes, h);

        queue.writeTexture(
            &.{ .texture = tex, .mip_level = 0, .origin = .{ .x = 0, .y = 0, .z = 0 }, .aspect = .all },
            @ptrCast(buf.ptr),
            @as(usize, w) * @as(usize, h) * 4,
            &.{ .offset = 0, .bytes_per_row = w * 4, .rows_per_image = h },
            &.{ .width = w, .height = h, .depth_or_array_layers = 1 },
        );

        if (should_flip) flipRowsInPlace(buf, row_bytes, h);
    }
};

const EffectSize = struct {
    width: u32,
    height: u32,
    pixels: u32,
    scaled: bool,
};

const InstanceMouseCoords = struct {
    effect_x: f32,
    effect_y: f32,
    inside: bool,
};

fn remainingEffectPixels() u32 {
    return if (g_frame_effect_pixels >= MAX_EFFECT_PIXELS) 0 else MAX_EFFECT_PIXELS - g_frame_effect_pixels;
}

fn remainingCpuEffectPixels() u32 {
    const remaining_upload_bytes = if (g_frame_upload_bytes >= MAX_UPLOAD_BYTES) 0 else MAX_UPLOAD_BYTES - g_frame_upload_bytes;
    return @min(remainingEffectPixels(), remaining_upload_bytes / 4);
}

fn resolveEffectSize(request_w: f32, request_h: f32, pixel_budget: u32) ?EffectSize {
    if (pixel_budget == 0) return null;

    const safe_w: f32 = @max(1.0, request_w);
    const safe_h: f32 = @max(1.0, request_h);
    const requested_w: u32 = @as(u32, @intFromFloat(safe_w));
    const requested_h: u32 = @as(u32, @intFromFloat(safe_h));
    const dim_limit: f32 = @floatFromInt(MAX_EFFECT_DIM);
    const pixel_budget_f: f32 = @floatFromInt(pixel_budget);

    var scale: f32 = 1.0;
    if (safe_w > dim_limit) scale = @min(scale, dim_limit / safe_w);
    if (safe_h > dim_limit) scale = @min(scale, dim_limit / safe_h);

    const requested_pixels = safe_w * safe_h;
    if (requested_pixels > pixel_budget_f and requested_pixels > 0) {
        scale = @min(scale, @sqrt(pixel_budget_f / requested_pixels));
    }

    var width: u32 = @min(MAX_EFFECT_DIM, @as(u32, @intFromFloat(@max(1.0, safe_w * scale))));
    var height: u32 = @min(MAX_EFFECT_DIM, @as(u32, @intFromFloat(@max(1.0, safe_h * scale))));
    while (@as(u64, width) * @as(u64, height) > pixel_budget) {
        if (width >= height and width > 1) {
            width -= 1;
        } else if (height > 1) {
            height -= 1;
        } else {
            break;
        }
    }

    return .{
        .width = width,
        .height = height,
        .pixels = width * height,
        .scaled = width != requested_w or height != requested_h,
    };
}

fn instanceMouseCoords(inst: *const Instance) InstanceMouseCoords {
    const draw_x = g_mouse_x - inst.screen_x;
    const draw_y = g_mouse_y - inst.screen_y;
    const draw_w = if (inst.display_width > 0) inst.display_width else @as(f32, @floatFromInt(inst.width));
    const draw_h = if (inst.display_height > 0) inst.display_height else @as(f32, @floatFromInt(inst.height));
    const inside = draw_x >= 0 and draw_x <= draw_w and draw_y >= 0 and draw_y <= draw_h;
    const scale_x = if (draw_w > 0) @as(f32, @floatFromInt(inst.width)) / draw_w else 1.0;
    const scale_y = if (draw_h > 0) @as(f32, @floatFromInt(inst.height)) / draw_h else 1.0;
    return .{
        .effect_x = draw_x * scale_x,
        .effect_y = draw_y * scale_y,
        .inside = inside,
    };
}

var instances: [MAX_INSTANCES]Instance = [_]Instance{.{}} ** MAX_INSTANCES;
var instance_count: usize = 0;
var g_backend_pref: BackendPref = .auto;
var g_gpu_bind_group_layout: ?*wgpu.BindGroupLayout = null;

// ════════════════════════════════════════════════════════════════════════
// Mouse state (polled once per frame)
// ════════════════════════════════════════════════════════════════════════

var g_mouse_x: f32 = 0;
var g_mouse_y: f32 = 0;
var g_mouse_dx: f32 = 0;
var g_mouse_dy: f32 = 0;
var g_mouse_speed: f32 = 0;
var g_mouse_idle: f32 = 0;

pub fn pollMouse(mx: f32, my: f32, dt: f32) void {
    g_mouse_dx = mx - g_mouse_x;
    g_mouse_dy = my - g_mouse_y;
    g_mouse_speed = @sqrt(g_mouse_dx * g_mouse_dx + g_mouse_dy * g_mouse_dy) / @max(dt, 0.001);
    if (@abs(g_mouse_dx) > 0.5 or @abs(g_mouse_dy) > 0.5) {
        g_mouse_idle = 0;
    } else {
        g_mouse_idle += dt;
    }
    g_mouse_x = mx;
    g_mouse_y = my;
}

fn instanceMouse(inst: *const Instance) MouseInfo {
    const mouse = instanceMouseCoords(inst);
    return .{
        .x = mouse.effect_x,
        .y = mouse.effect_y,
        .dx = g_mouse_dx,
        .dy = g_mouse_dy,
        .speed = g_mouse_speed,
        .inside = mouse.inside,
        .idle = g_mouse_idle,
    };
}

// ════════════════════════════════════════════════════════════════════════
// Frame timing (stored during update, used by paint)
// ════════════════════════════════════════════════════════════════════════

var g_dt: f32 = 0;

// ════════════════════════════════════════════════════════════════════════
// Public API
// ════════════════════════════════════════════════════════════════════════

fn parseBackendPref() BackendPref {
    if (builtin.cpu.arch == .wasm32) return .cpu;
    const env = std.posix.getenv("ZIGOS_EFFECTS_BACKEND") orelse return .auto;
    if (std.mem.eql(u8, env, "cpu")) return .cpu;
    if (std.mem.eql(u8, env, "gpu")) return .gpu;
    return .auto;
}

fn shouldTryGpu(node: *const Node) bool {
    if (g_backend_pref == .cpu) return false;
    if (node.effect_shader == null) return false;
    if (node.effect_name != null) return false; // fillEffect still samples CPU pixels
    if (node.effect_mask) return false; // mask pipeline still CPU-only
    return true;
}

fn ensureGpuBindGroupLayout(device: *wgpu.Device) ?*wgpu.BindGroupLayout {
    if (g_gpu_bind_group_layout) |layout_ref| return layout_ref;
    const layout_ref = device.createBindGroupLayout(&.{
        .entry_count = 1,
        .entries = @ptrCast(&wgpu.BindGroupLayoutEntry{
            .binding = 0,
            .visibility = wgpu.ShaderStages.fragment,
            .buffer = .{
                .@"type" = .uniform,
                .has_dynamic_offset = 0,
                .min_binding_size = @sizeOf(GpuUniforms),
            },
        }),
    }) orelse return null;
    g_gpu_bind_group_layout = layout_ref;
    return layout_ref;
}

fn ensureGpuPipeline(self: *Instance) bool {
    if (self.gpu_pipeline != null and self.gpu_bind_group != null and self.gpu_uniform_buffer != null) return true;
    const shader_desc = self.shader_desc orelse return false;
    const device = gpu_core.getDevice() orelse return false;
    const bgl = ensureGpuBindGroupLayout(device) orelse return false;

    const uniform_buf = device.createBuffer(&.{
        .label = wgpu.StringView.fromSlice("effect_gpu_uniforms"),
        .size = @sizeOf(GpuUniforms),
        .usage = wgpu.BufferUsages.uniform | wgpu.BufferUsages.copy_dst,
        .mapped_at_creation = 0,
    }) orelse return false;

    const effect_bg = device.createBindGroup(&.{
        .layout = bgl,
        .entry_count = 1,
        .entries = @ptrCast(&wgpu.BindGroupEntry{
            .binding = 0,
            .buffer = uniform_buf,
            .offset = 0,
            .size = @sizeOf(GpuUniforms),
        }),
    }) orelse {
        uniform_buf.release();
        return false;
    };

    const module_desc = wgpu.shaderModuleWGSLDescriptor(.{
        .label = "effect_gpu_shader",
        .code = shader_desc.wgsl,
    });
    const shader_module = device.createShaderModule(&module_desc) orelse {
        effect_bg.release();
        uniform_buf.release();
        return false;
    };
    defer shader_module.release();

    const pipeline_layout = device.createPipelineLayout(&.{
        .bind_group_layout_count = 1,
        .bind_group_layouts = @ptrCast(&bgl),
    }) orelse {
        effect_bg.release();
        uniform_buf.release();
        return false;
    };
    defer pipeline_layout.release();

    const color_target = wgpu.ColorTargetState{
        .format = .rgba8_unorm,
        .blend = null,
        .write_mask = wgpu.ColorWriteMasks.all,
    };

    const fragment_state = wgpu.FragmentState{
        .module = shader_module,
        .entry_point = wgpu.StringView.fromSlice("fs_main"),
        .target_count = 1,
        .targets = @ptrCast(&color_target),
    };

    const pipeline = device.createRenderPipeline(&.{
        .layout = pipeline_layout,
        .vertex = .{
            .module = shader_module,
            .entry_point = wgpu.StringView.fromSlice("vs_main"),
            .buffer_count = 0,
            .buffers = &[0]wgpu.VertexBufferLayout{},
        },
        .primitive = .{ .topology = .triangle_list },
        .multisample = .{},
        .fragment = &fragment_state,
    }) orelse {
        effect_bg.release();
        uniform_buf.release();
        return false;
    };

    self.gpu_uniform_buffer = uniform_buf;
    self.gpu_bind_group = effect_bg;
    self.gpu_pipeline = pipeline;
    return true;
}

fn ensureGpuSize(self: *Instance, w: u32, h: u32) bool {
    if (w == 0 or h == 0) return false;
    if (self.width != w or self.height != h) {
        self.width = w;
        self.height = h;
        self.releaseTarget();
    }
    return self.ensureTarget(true);
}

fn renderGpu(self: *Instance) bool {
    const device = gpu_core.getDevice() orelse return false;
    const queue = gpu_core.getQueue() orelse return false;
    const pipeline = self.gpu_pipeline orelse return false;
    const effect_bg = self.gpu_bind_group orelse return false;
    const uniform_buf = self.gpu_uniform_buffer orelse return false;
    const target_view = self.texture_view orelse return false;

    const mouse = instanceMouseCoords(self);
    const uniforms = GpuUniforms{
        .size_w = @floatFromInt(self.width),
        .size_h = @floatFromInt(self.height),
        .time = self.time,
        .dt = g_dt,
        .frame = @floatFromInt(self.frame_count),
        .mouse_x = mouse.effect_x,
        .mouse_y = mouse.effect_y,
        .mouse_inside = if (mouse.inside) 1.0 else 0.0,
    };
    queue.writeBuffer(uniform_buf, 0, @ptrCast(&uniforms), @sizeOf(GpuUniforms));

    const encoder = device.createCommandEncoder(&.{ .label = wgpu.StringView.fromSlice("effect_gpu") }) orelse return false;
    const pass = encoder.beginRenderPass(&.{
        .color_attachment_count = 1,
        .color_attachments = @ptrCast(&wgpu.ColorAttachment{
            .view = target_view,
            .load_op = .clear,
            .store_op = .store,
            .clear_value = .{ .r = 0, .g = 0, .b = 0, .a = 0 },
        }),
    }) orelse {
        encoder.release();
        return false;
    };
    pass.setPipeline(pipeline);
    pass.setBindGroup(0, effect_bg, 0, null);
    pass.draw(6, 1, 0, 0);
    pass.end();
    pass.release();

    const command = encoder.finish(&.{ .label = wgpu.StringView.fromSlice("effect_gpu_cmd") }) orelse {
        encoder.release();
        return false;
    };
    encoder.release();
    queue.submit(&.{command});
    command.release();
    return true;
}

fn renderCpuNow(self: *Instance) bool {
    const render = self.render_fn orelse return false;
    const buf = self.pixel_buf orelse return false;
    if (self.width == 0 or self.height == 0) return false;
    if (buf.len < @as(usize, self.width) * @as(usize, self.height) * 4) return false;
    const mouse = instanceMouseCoords(self);
    var ctx = EffectContext{
        .buf = buf.ptr,
        .width = self.width,
        .height = self.height,
        .stride = self.width * 4,
        .time = self.time,
        .dt = g_dt,
        .mouse_x = mouse.effect_x,
        .mouse_y = mouse.effect_y,
        .mouse_inside = mouse.inside,
        .frame = self.frame_count,
    };
    render(&ctx);
    self.dirty = true;
    if (self.ensureTarget(false)) {
        self.upload();
        return self.bind_group != null;
    }
    return false;
}

pub fn init() void {
    g_backend_pref = parseBackendPref();
}

pub fn deinit() void {
    for (instances[0..instance_count]) |*inst| inst.deinit();
    instance_count = 0;
    if (g_gpu_bind_group_layout) |layout_ref| layout_ref.release();
    g_gpu_bind_group_layout = null;
}

/// Called every frame: update registry-based effect instances and store dt.
pub fn update(dt: f32) void {
    g_dt = dt;
    g_frame_effect_pixels = 0;
    g_frame_upload_bytes = 0;
    g_effect_budget_logged = false;

    for (instances[0..instance_count]) |*inst| {
        if (!inst.active) continue;

        // Accumulate time for all instances
        inst.time += dt;
        inst.frame_count +%= 1;

        // Registry path: call module update+draw
        if (inst.module) |m| {
            const s = inst.state orelse continue;
            if (inst.width == 0 or inst.height == 0) continue;

            const mouse = instanceMouse(inst);
            m.update(s, dt, inst.width, inst.height, mouse);

            if (inst.pixel_buf) |buf| {
                m.draw(s, buf, inst.width, inst.height);
                inst.dirty = true;
            }
        }

        // Custom render path: skip here — rendering + upload happens in
        // paintCustomEffect → renderCpuNow during the paint phase.
        // Doing it here too causes a use-after-destroy: update() writes to
        // the texture, then paintCustomEffect() destroys it on resize,
        // and the buffered writeTexture hits a dead texture at queue.submit().
        if (inst.render_fn != null) continue;

        // Upload to GPU (registry path only)
        if (inst.dirty) {
            if (inst.ensureTarget(false)) inst.upload();
        }
    }
}

/// Paint a registry-based effect (node has effect_type string).
pub fn paintEffect(effect_type: []const u8, x: f32, y: f32, w: f32, h: f32, opacity: f32) bool {
    var inst = findInstanceByType(effect_type);
    if (inst == null) {
        inst = createRegistryInstance(effect_type);
    }
    const i = inst orelse return false;
    i.active = true;
    i.screen_x = x;
    i.screen_y = y;
    i.setDisplaySize(w, h);
    i.backend = .cpu;

    const resolved = resolveEffectSize(w, h, remainingCpuEffectPixels()) orelse {
        if (!g_effect_budget_logged) {
            g_effect_budget_logged = true;
            std.debug.print("[BUDGET] Effect budget exhausted — skipping effect\n", .{});
        }
        return false;
    };
    g_frame_effect_pixels += resolved.pixels;
    i.ensureCpuSize(resolved.width, resolved.height);

    const bg = i.bind_group orelse return false;
    if (i.width == 0 or i.height == 0) return false;

    log.info(.render, "effect cpu type={s} rect=({d:.0},{d:.0},{d:.0},{d:.0}) tex={d}x{d}", .{
        effect_type, x, y, w, h, i.width, i.height,
    });
    images.queueQuad(x, y, w, h, opacity, bg);
    return true;
}

/// Paint a custom effect (node has effect_render and optional effect_shader).
/// GPU is used when a shader-safe lowering exists; otherwise this falls back to CPU.
pub fn paintCustomEffect(node: *const Node, x: f32, y: f32, w: f32, h: f32, opacity: f32) bool {
    std.debug.print("[PCE ENTER] node={x} xy=({d:.0},{d:.0}) wh=({d:.0},{d:.0})\n", .{ @intFromPtr(node), x, y, w, h });
    var inst = findInstanceByNode(@intFromPtr(node));
    if (inst == null) {
        inst = createCustomInstance(node);
    }
    const i = inst orelse return false;
    i.active = true;
    i.screen_x = x;
    i.screen_y = y;
    i.setDisplaySize(w, h);
    const node_name = node.debug_name orelse "?";
    log.info(.render, "custom effect node={s} ptr=0x{x} rect=({d:.0},{d:.0},{d:.0},{d:.0}) gpu_try={} gpu_failed={} shader={} background={}", .{
        node_name, @intFromPtr(node), x, y, w, h, shouldTryGpu(node), i.gpu_failed, node.effect_shader != null, node.effect_background,
    });

    if (!g_effect_debug_logged) {
        g_effect_debug_logged = true;
        std.debug.print("[effect-paint] node={x} rect=({d:.0},{d:.0},{d:.0},{d:.0}) shouldTryGpu={} shader_set={}\n", .{ @intFromPtr(node), x, y, w, h, shouldTryGpu(node), node.effect_shader != null });
    }
    if (shouldTryGpu(node) and !i.gpu_failed) {
        const resolved = resolveEffectSize(w, h, remainingEffectPixels()) orelse {
            if (!g_effect_budget_logged) {
                g_effect_budget_logged = true;
                std.debug.print("[BUDGET] Effect pixel budget exhausted — skipping effect\n", .{});
            }
            return false;
        };
        g_frame_effect_pixels += resolved.pixels;
        i.backend = .gpu;
        const size_ok = ensureGpuSize(i, resolved.width, resolved.height);
        const pipe_ok = size_ok and ensureGpuPipeline(i);
        const render_ok = pipe_ok and renderGpu(i);
        if (!g_effect_gpu_result_logged) {
            g_effect_gpu_result_logged = true;
            std.debug.print("[effect-gpu] size_ok={} pipe_ok={} render_ok={}\n", .{ size_ok, pipe_ok, render_ok });
        }
        log.info(.render, "custom effect gpu node={s} size_ok={} pipe_ok={} render_ok={} tex={d}x{d} bind_group={} target={} pipeline={}", .{
            node_name,
            size_ok,
            pipe_ok,
            render_ok,
            i.width,
            i.height,
            i.bind_group != null,
            i.texture_view != null,
            i.gpu_pipeline != null,
        });
        if (size_ok and pipe_ok and render_ok) {
            const bg = i.bind_group orelse return false;
            images.queueQuad(x, y, w, h, opacity, bg);
            log.info(.render, "custom effect gpu queued node={s}", .{node_name});
            return true;
        }
        g_frame_effect_pixels -= resolved.pixels;
        log.warn(.render, "custom effect gpu failed node={s} -> cpu fallback", .{node_name});
        i.gpu_failed = true;
    }

    const resolved = resolveEffectSize(w, h, remainingCpuEffectPixels()) orelse {
        if (!g_effect_budget_logged) {
            g_effect_budget_logged = true;
            std.debug.print("[BUDGET] Effect budget exhausted — skipping effect\n", .{});
        }
        return false;
    };
    g_frame_effect_pixels += resolved.pixels;
    i.backend = .cpu;
    i.ensureCpuSize(resolved.width, resolved.height);
    if (i.width == 0 or i.height == 0) {
        log.warn(.render, "custom effect cpu zero-sized node={s}", .{node_name});
        return false;
    }
    const cpu_ok = renderCpuNow(i);
    if (!g_effect_cpu_result_logged) {
        g_effect_cpu_result_logged = true;
        std.debug.print("[effect-cpu] render_ok={} tex={d}x{d} bind_group={} pixel_buf={}\n", .{ cpu_ok, i.width, i.height, i.bind_group != null, i.pixel_buf != null });
    }
    if (!cpu_ok) {
        return false;
    }
    const bg = i.bind_group orelse return false;

    images.queueQuad(x, y, w, h, opacity, bg);
    if (!g_effect_queue_logged) {
        g_effect_queue_logged = true;
        std.debug.print("[effect-queued] backend={s} tex={d}x{d}\n", .{ @tagName(i.backend), i.width, i.height });
    }
    return true;
}

/// Paint a background effect for a parent node (registry path).
pub fn paintBackground(effect_type: []const u8, px: f32, py: f32, pw: f32, ph: f32, opacity: f32) bool {
    var inst = findInstanceByType(effect_type);
    if (inst == null) {
        inst = createRegistryInstance(effect_type);
    }
    const i = inst orelse return false;
    i.active = true;
    i.screen_x = px;
    i.screen_y = py;
    i.setDisplaySize(pw, ph);
    i.backend = .cpu;

    const resolved = resolveEffectSize(pw, ph, remainingCpuEffectPixels()) orelse {
        if (!g_effect_budget_logged) {
            g_effect_budget_logged = true;
            std.debug.print("[BUDGET] Effect budget exhausted — skipping background effect\n", .{});
        }
        return false;
    };
    g_frame_effect_pixels += resolved.pixels;
    i.ensureCpuSize(resolved.width, resolved.height);

    const bg = i.bind_group orelse return false;
    if (i.width == 0 or i.height == 0) return false;

    images.queueQuad(px, py, pw, ph, opacity, bg);
    return true;
}

// ════════════════════════════════════════════════════════════════════════
// Instance management
// ════════════════════════════════════════════════════════════════════════

fn findInstanceByType(effect_type: []const u8) ?*Instance {
    for (instances[0..instance_count]) |*inst| {
        if (inst.active and inst.module != null and std.mem.eql(u8, inst.effect_type, effect_type))
            return inst;
    }
    return null;
}

fn findInstanceByNode(node_key: usize) ?*Instance {
    for (instances[0..instance_count]) |*inst| {
        if (inst.active and inst.node_key == node_key and inst.render_fn != null)
            return inst;
    }
    return null;
}

fn createRegistryInstance(effect_type: []const u8) ?*Instance {
    if (instance_count >= MAX_INSTANCES) return null;
    const m = findModule(effect_type) orelse return null;

    const inst = &instances[instance_count];
    inst.* = .{
        .active = true,
        .effect_type = effect_type,
        .module = m,
    };
    instance_count += 1;
    return inst;
}

fn createCustomInstance(node: *const Node) ?*Instance {
    if (instance_count >= MAX_INSTANCES) return null;
    const render_fn = node.effect_render orelse return null;

    const inst = &instances[instance_count];
    inst.* = .{
        .active = true,
        .render_fn = render_fn,
        .shader_desc = node.effect_shader,
        .node_key = @intFromPtr(node),
    };
    instance_count += 1;
    return inst;
}

fn findInstanceByName(effect_name: []const u8) ?*Instance {
    for (instances[0..instance_count]) |*inst| {
        if (inst.active and inst.name != null and std.mem.eql(u8, inst.name.?, effect_name))
            return inst;
    }
    return null;
}

/// Named effect info for use as polygon fill source.
pub const EffectFillInfo = struct {
    bind_group: *wgpu.BindGroup,
    pixel_buf: [*]const u8,
    width: u32,
    height: u32,
    screen_x: f32,
    screen_y: f32,
};

/// Look up a named effect for use as a fill texture source.
pub fn getEffectFill(effect_name: []const u8) ?EffectFillInfo {
    const inst = findInstanceByName(effect_name) orelse return null;
    const bg = inst.bind_group orelse return null;
    const buf = inst.pixel_buf orelse return null;
    if (inst.width == 0 or inst.height == 0) return null;
    if (paisleyDebugEnabled() and isPaisleyName(effect_name)) {
        const cx = if (inst.width > 0) inst.width / 2 else 0;
        const cy = if (inst.height > 0) inst.height / 2 else 0;
        const center_a = samplePixelAlpha(buf, inst.width, inst.height, cx, cy);
        std.debug.print(
            "[paisley] getEffectFill name={s} size={d}x{d} center_a={d} screen=({d:.1},{d:.1})\n",
            .{ effect_name, inst.width, inst.height, center_a, inst.screen_x, inst.screen_y },
        );
    }
    return .{
        .bind_group = bg,
        .pixel_buf = buf.ptr,
        .width = inst.width,
        .height = inst.height,
        .screen_x = inst.screen_x,
        .screen_y = inst.screen_y,
    };
}

/// Paint a named custom effect — same as paintCustomEffect but stores the name
/// for later lookup by Graph.Path fillEffect references. Does NOT draw an image
/// quad — the effect is invisible until referenced by a fill.
pub fn paintNamedEffect(node: *const Node, effect_name: []const u8, x: f32, y: f32, w: f32, h: f32) bool {
    var inst = findInstanceByNode(@intFromPtr(node));
    if (inst == null) {
        inst = createCustomInstance(node);
    }
    const i = inst orelse return false;
    i.active = true;
    i.backend = .cpu;
    i.name = effect_name;
    i.screen_x = x;
    i.screen_y = y;
    i.setDisplaySize(w, h);

    const resolved = resolveEffectSize(w, h, remainingCpuEffectPixels()) orelse {
        if (!g_effect_budget_logged) {
            g_effect_budget_logged = true;
            std.debug.print("[BUDGET] Effect budget exhausted — skipping named effect\n", .{});
        }
        return false;
    };
    g_frame_effect_pixels += resolved.pixels;
    i.ensureCpuSize(resolved.width, resolved.height);

    if (i.width == 0 or i.height == 0) return false;
    const ok = renderCpuNow(i);
    if (paisleyDebugEnabled() and isPaisleyName(effect_name)) {
        var center_a: u8 = 0;
        var quarter_a: u8 = 0;
        if (i.pixel_buf) |buf| {
            center_a = samplePixelAlpha(buf, i.width, i.height, i.width / 2, i.height / 2);
            quarter_a = samplePixelAlpha(buf, i.width, i.height, i.width / 4, i.height / 4);
        }
        std.debug.print(
            "[paisley] paintNamedEffect name={s} node={x} box=({d:.1},{d:.1},{d:.1},{d:.1}) tex={d}x{d} ok={} center_a={d} quarter_a={d}\n",
            .{ effect_name, @intFromPtr(node), x, y, w, h, i.width, i.height, ok, center_a, quarter_a },
        );
    }
    if (!ok) return false;
    // Don't draw — the effect is only drawn when referenced by a polygon fill
    return true;
}
