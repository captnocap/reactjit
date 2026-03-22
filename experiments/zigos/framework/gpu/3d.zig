//! scene3d.zig — 3D rendering pipeline for wgpu
//!
//! Renders 3D meshes to an offscreen texture with depth buffer, then composites
//! into the 2D layout tree via images.queueQuad(). Same pattern as effects.
//!
//! Phase 1: Hardcoded rotating cube with Blinn-Phong lighting.
//! Phase 2: Scene3D/Camera3D/Mesh3D/Light3D .tsz elements.

const std = @import("std");
const wgpu = @import("wgpu");
const shaders = @import("shaders.zig");
const core = @import("gpu.zig");
const images = @import("images.zig");
const math = @import("../math.zig");

const page_alloc = std.heap.page_allocator;

// ════════════════════════════════════════════════════════════════════════
// Vertex format: position(3) + normal(3) + uv(2) = 8 floats = 32 bytes
// ════════════════════════════════════════════════════════════════════════

const Vertex = extern struct {
    px: f32, py: f32, pz: f32,
    nx: f32, ny: f32, nz: f32,
    u: f32, v: f32,
};

// ════════════════════════════════════════════════════════════════════════
// Uniform buffer layout — matches SceneUniforms in WGSL
// ════════════════════════════════════════════════════════════════════════

const SceneUniforms = extern struct {
    mvp: [16]f32,
    model: [16]f32,
    light_dir: [3]f32,
    specular_power: f32,
    light_color: [3]f32,
    _pad1: f32 = 0,
    ambient_color: [3]f32,
    _pad2: f32 = 0,
    camera_pos: [3]f32,
    _pad3: f32 = 0,
    color: [4]f32,
};

// ════════════════════════════════════════════════════════════════════════
// Procedural geometry — unit box (36 verts, no index buffer)
// ════════════════════════════════════════════════════════════════════════

fn generateBox() [36]Vertex {
    var verts: [36]Vertex = undefined;
    var idx: usize = 0;

    const S = struct {
        fn face(out: *[36]Vertex, i: *usize,
            v1: [3]f32, v2: [3]f32, v3: [3]f32, v4: [3]f32, n: [3]f32) void
        {
            const corners = [4][3]f32{ v1, v2, v3, v4 };
            const uvs = [4][2]f32{ .{0,0}, .{1,0}, .{1,1}, .{0,1} };
            const tri_idx = [6]u8{ 0, 1, 2, 0, 2, 3 };
            for (tri_idx) |ti| {
                out[i.*] = .{
                    .px = corners[ti][0], .py = corners[ti][1], .pz = corners[ti][2],
                    .nx = n[0], .ny = n[1], .nz = n[2],
                    .u = uvs[ti][0], .v = uvs[ti][1],
                };
                i.* += 1;
            }
        }
    };

    const h: f32 = 0.5; // half-size
    // Front (+Z)
    S.face(&verts, &idx, .{-h,-h, h}, .{ h,-h, h}, .{ h, h, h}, .{-h, h, h}, .{0,0,1});
    // Back (-Z)
    S.face(&verts, &idx, .{ h,-h,-h}, .{-h,-h,-h}, .{-h, h,-h}, .{ h, h,-h}, .{0,0,-1});
    // Right (+X)
    S.face(&verts, &idx, .{ h,-h, h}, .{ h,-h,-h}, .{ h, h,-h}, .{ h, h, h}, .{1,0,0});
    // Left (-X)
    S.face(&verts, &idx, .{-h,-h,-h}, .{-h,-h, h}, .{-h, h, h}, .{-h, h,-h}, .{-1,0,0});
    // Top (+Y)
    S.face(&verts, &idx, .{-h, h, h}, .{ h, h, h}, .{ h, h,-h}, .{-h, h,-h}, .{0,1,0});
    // Bottom (-Y)
    S.face(&verts, &idx, .{-h,-h,-h}, .{ h,-h,-h}, .{ h,-h, h}, .{-h,-h, h}, .{0,-1,0});

    return verts;
}

// ════════════════════════════════════════════════════════════════════════
// Pipeline state
// ════════════════════════════════════════════════════════════════════════

var g_pipeline: ?*wgpu.RenderPipeline = null;
var g_vertex_buffer: ?*wgpu.Buffer = null;
var g_uniform_buffer: ?*wgpu.Buffer = null;
var g_bind_group: ?*wgpu.BindGroup = null;
var g_bind_group_layout: ?*wgpu.BindGroupLayout = null;
var g_initialized: bool = false;

// Offscreen render target
var g_color_texture: ?*wgpu.Texture = null;
var g_color_view: ?*wgpu.TextureView = null;
var g_depth_texture: ?*wgpu.Texture = null;
var g_depth_view: ?*wgpu.TextureView = null;
var g_sampler: ?*wgpu.Sampler = null;
var g_composite_bind_group: ?*wgpu.BindGroup = null;
var g_rt_width: u32 = 0;
var g_rt_height: u32 = 0;

// Timing
var g_time: f32 = 0;

// ════════════════════════════════════════════════════════════════════════
// Initialization
// ════════════════════════════════════════════════════════════════════════

pub fn init() void {
    const device = core.getDevice() orelse return;

    // Shader
    const shader_desc = wgpu.shaderModuleWGSLDescriptor(.{
        .label = "scene3d_shader",
        .code = shaders.scene3d_wgsl,
    });
    const shader_module = device.createShaderModule(&shader_desc) orelse {
        std.debug.print("[scene3d] Failed to create shader module\n", .{});
        return;
    };
    defer shader_module.release();

    // Vertex buffer (unit cube)
    const box_verts = generateBox();
    g_vertex_buffer = device.createBuffer(&.{
        .label = wgpu.StringView.fromSlice("scene3d_verts"),
        .size = @sizeOf(@TypeOf(box_verts)),
        .usage = wgpu.BufferUsages.vertex | wgpu.BufferUsages.copy_dst,
        .mapped_at_creation = 0,
    });
    if (g_vertex_buffer) |vb| {
        if (core.getQueue()) |queue| {
            queue.writeBuffer(vb, 0, @ptrCast(&box_verts), @sizeOf(@TypeOf(box_verts)));
        }
    }

    // Uniform buffer
    g_uniform_buffer = device.createBuffer(&.{
        .label = wgpu.StringView.fromSlice("scene3d_uniforms"),
        .size = @sizeOf(SceneUniforms),
        .usage = wgpu.BufferUsages.uniform | wgpu.BufferUsages.copy_dst,
        .mapped_at_creation = 0,
    });

    // Bind group layout
    g_bind_group_layout = device.createBindGroupLayout(&.{
        .entry_count = 1,
        .entries = @ptrCast(&wgpu.BindGroupLayoutEntry{
            .binding = 0,
            .visibility = wgpu.ShaderStages.vertex | wgpu.ShaderStages.fragment,
            .buffer = .{
                .@"type" = .uniform,
                .has_dynamic_offset = 0,
                .min_binding_size = @sizeOf(SceneUniforms),
            },
        }),
    }) orelse return;

    // Bind group
    g_bind_group = device.createBindGroup(&.{
        .layout = g_bind_group_layout.?,
        .entry_count = 1,
        .entries = @ptrCast(&wgpu.BindGroupEntry{
            .binding = 0,
            .buffer = g_uniform_buffer.?,
            .offset = 0,
            .size = @sizeOf(SceneUniforms),
        }),
    });

    // Pipeline layout
    const pipeline_layout = device.createPipelineLayout(&.{
        .bind_group_layout_count = 1,
        .bind_group_layouts = @ptrCast(&g_bind_group_layout.?),
    }) orelse return;
    defer pipeline_layout.release();

    // Vertex attributes: position(3f), normal(3f), uv(2f)
    const vert_attrs = [_]wgpu.VertexAttribute{
        .{ .format = .float32x3, .offset = 0, .shader_location = 0 },  // position
        .{ .format = .float32x3, .offset = 12, .shader_location = 1 }, // normal
        .{ .format = .float32x2, .offset = 24, .shader_location = 2 }, // uv
    };

    const vert_buffer_layout = wgpu.VertexBufferLayout{
        .step_mode = .vertex,
        .array_stride = @sizeOf(Vertex),
        .attribute_count = vert_attrs.len,
        .attributes = &vert_attrs,
    };

    const color_target = wgpu.ColorTargetState{
        .format = .rgba8_unorm, // offscreen texture format
        .blend = &wgpu.BlendState.premultiplied_alpha_blending,
        .write_mask = wgpu.ColorWriteMasks.all,
    };

    const fragment_state = wgpu.FragmentState{
        .module = shader_module,
        .entry_point = wgpu.StringView.fromSlice("fs_main"),
        .target_count = 1,
        .targets = @ptrCast(&color_target),
    };

    const depth_stencil = wgpu.DepthStencilState{
        .format = .depth24_plus,
        .depth_write_enabled = .true,
        .depth_compare = .less,
        .stencil_front = .{},
        .stencil_back = .{},
    };

    g_pipeline = device.createRenderPipeline(&.{
        .layout = pipeline_layout,
        .vertex = .{
            .module = shader_module,
            .entry_point = wgpu.StringView.fromSlice("vs_main"),
            .buffer_count = 1,
            .buffers = @ptrCast(&vert_buffer_layout),
        },
        .primitive = .{
            .topology = .triangle_list,
            .cull_mode = .back,
            .front_face = .ccw,
        },
        .depth_stencil = &depth_stencil,
        .multisample = .{},
        .fragment = &fragment_state,
    });

    if (g_pipeline == null) {
        std.debug.print("[scene3d] Failed to create render pipeline\n", .{});
        return;
    }

    // Sampler for compositing
    g_sampler = device.createSampler(&.{
        .address_mode_u = .clamp_to_edge,
        .address_mode_v = .clamp_to_edge,
        .mag_filter = .linear,
        .min_filter = .linear,
    });

    g_initialized = true;
}

pub fn deinit() void {
    if (g_composite_bind_group) |bg| bg.release();
    if (g_sampler) |s| s.release();
    if (g_depth_view) |dv| dv.release();
    if (g_depth_texture) |dt| dt.destroy();
    if (g_color_view) |cv| cv.release();
    if (g_color_texture) |ct| ct.destroy();
    if (g_bind_group) |bg| bg.release();
    if (g_bind_group_layout) |bgl| bgl.release();
    if (g_uniform_buffer) |ub| ub.release();
    if (g_vertex_buffer) |vb| vb.release();
    if (g_pipeline) |p| p.release();
    g_initialized = false;
}

// ════════════════════════════════════════════════════════════════════════
// Offscreen render target management
// ════════════════════════════════════════════════════════════════════════

fn ensureRenderTarget(w: u32, h: u32) bool {
    if (w == 0 or h == 0) return false;
    if (g_rt_width == w and g_rt_height == h and g_color_view != null) return true;

    const device = core.getDevice() orelse return false;

    // Release old
    if (g_composite_bind_group) |bg| bg.release();
    if (g_color_view) |cv| cv.release();
    if (g_color_texture) |ct| ct.destroy();
    if (g_depth_view) |dv| dv.release();
    if (g_depth_texture) |dt| dt.destroy();
    g_composite_bind_group = null;

    // Color texture
    g_color_texture = device.createTexture(&.{
        .label = wgpu.StringView.fromSlice("scene3d_color"),
        .size = .{ .width = w, .height = h, .depth_or_array_layers = 1 },
        .mip_level_count = 1,
        .sample_count = 1,
        .dimension = .@"2d",
        .format = .rgba8_unorm,
        .usage = wgpu.TextureUsages.render_attachment | wgpu.TextureUsages.texture_binding,
    }) orelse return false;

    g_color_view = g_color_texture.?.createView(&.{
        .format = .rgba8_unorm,
        .dimension = .@"2d",
        .base_mip_level = 0, .mip_level_count = 1,
        .base_array_layer = 0, .array_layer_count = 1,
        .aspect = .all,
    }) orelse return false;

    // Depth texture
    g_depth_texture = device.createTexture(&.{
        .label = wgpu.StringView.fromSlice("scene3d_depth"),
        .size = .{ .width = w, .height = h, .depth_or_array_layers = 1 },
        .mip_level_count = 1,
        .sample_count = 1,
        .dimension = .@"2d",
        .format = .depth24_plus,
        .usage = wgpu.TextureUsages.render_attachment,
    }) orelse return false;

    g_depth_view = g_depth_texture.?.createView(&.{
        .format = .depth24_plus,
        .dimension = .@"2d",
        .base_mip_level = 0, .mip_level_count = 1,
        .base_array_layer = 0, .array_layer_count = 1,
        .aspect = .all,
    }) orelse return false;

    // Composite bind group (for images.queueQuad)
    if (g_sampler) |sampler| {
        g_composite_bind_group = images.createBindGroup(g_color_view.?, sampler);
    }

    g_rt_width = w;
    g_rt_height = h;
    return true;
}

// ════════════════════════════════════════════════════════════════════════
// Render
// ════════════════════════════════════════════════════════════════════════

/// Update time accumulator.
pub fn update(dt: f32) void {
    g_time += dt;
}

/// Render a 3D scene to an offscreen texture and composite at (x, y, w, h).
/// Phase 1: hardcoded rotating cube with directional light.
pub fn render(x: f32, y: f32, w: f32, h: f32, opacity: f32) bool {
    if (!g_initialized) init();
    if (!g_initialized) return false;

    const iw: u32 = @intFromFloat(@max(1, w));
    const ih: u32 = @intFromFloat(@max(1, h));
    if (!ensureRenderTarget(iw, ih)) return false;

    const device = core.getDevice() orelse return false;
    const queue = core.getQueue() orelse return false;
    const color_view = g_color_view orelse return false;
    const depth_view = g_depth_view orelse return false;

    // ── Build MVP (row-major math, transposed for WGSL column-major) ──
    const aspect = w / @max(h, 1);
    const projection = math.m4perspective(std.math.pi / 3.0, aspect, 0.1, 100.0);
    const view = math.m4lookAt(
        .{ .x = 0, .y = 3, .z = 5 },   // camera position
        .{ .x = 0, .y = 0, .z = 0 },   // look at origin
        .{ .x = 0, .y = 1, .z = 0 },   // up
    );
    const model = math.m4multiply(
        math.m4rotateY(math.m4identity(), g_time * 0.8),
        math.m4rotateX(math.m4identity(), g_time * 0.3),
    );
    // MVP = Projection * View * Model (standard order)
    const mvp = math.m4multiply(math.m4multiply(projection, view), model);

    // ── Write uniforms (transpose for WGSL column-major) ──
    const uniforms = SceneUniforms{
        .mvp = math.m4transpose(mvp),
        .model = math.m4transpose(model),
        .light_dir = .{ 0.577, 0.577, 0.577 }, // normalized (1,1,1)
        .specular_power = 64.0,
        .light_color = .{ 1.0, 0.95, 0.9 },
        .ambient_color = .{ 0.15, 0.15, 0.2 },
        .camera_pos = .{ 0, 3, 5 },
        .color = .{ 0.9, 0.3, 0.2, 1.0 }, // red-orange
    };
    queue.writeBuffer(g_uniform_buffer.?, 0, @ptrCast(&uniforms), @sizeOf(SceneUniforms));

    // ── Offscreen render pass ──
    const color_attachment = wgpu.ColorAttachment{
        .view = color_view,
        .load_op = .clear,
        .store_op = .store,
        .clear_value = .{ .r = 0.05, .g = 0.05, .b = 0.08, .a = 1.0 },
    };

    const depth_attachment = wgpu.DepthStencilAttachment{
        .view = depth_view,
        .depth_load_op = .clear,
        .depth_store_op = .store,
        .depth_clear_value = 1.0,
        .stencil_load_op = .clear,
        .stencil_store_op = .store,
        .stencil_clear_value = 0,
    };

    const encoder = device.createCommandEncoder(&.{
        .label = wgpu.StringView.fromSlice("scene3d"),
    }) orelse return false;

    const pass = encoder.beginRenderPass(&.{
        .color_attachment_count = 1,
        .color_attachments = @ptrCast(&color_attachment),
        .depth_stencil_attachment = &depth_attachment,
    }) orelse {
        encoder.release();
        return false;
    };

    pass.setPipeline(g_pipeline.?);
    pass.setBindGroup(0, g_bind_group.?, 0, null);
    pass.setVertexBuffer(0, g_vertex_buffer.?, 0, 36 * @sizeOf(Vertex));
    pass.draw(36, 1, 0, 0);
    pass.end();
    pass.release();

    const command = encoder.finish(&.{ .label = wgpu.StringView.fromSlice("scene3d_cmd") }) orelse {
        encoder.release();
        return false;
    };
    encoder.release();

    queue.submit(&.{command});
    command.release();

    // ── Composite into 2D layout ──
    if (g_composite_bind_group) |bg| {
        images.queueQuad(x, y, w, h, opacity, bg);
        return true;
    }
    return false;
}
