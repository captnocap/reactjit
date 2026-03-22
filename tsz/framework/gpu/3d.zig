//! 3d.zig — 3D rendering pipeline for wgpu
//!
//! Renders 3D.Mesh children to an offscreen texture with depth buffer,
//! composited into the 2D layout tree via images.queueQuad().
//! Reads camera/light/mesh props from the 3D.View node's children.

const std = @import("std");
const wgpu = @import("wgpu");
const shaders = @import("shaders.zig");
const core = @import("gpu.zig");
const images = @import("images.zig");
const math = @import("../math.zig");
const layout = @import("../layout.zig");
const Node = layout.Node;

// ════════════════════════════════════════════════════════════════════════
// Vertex format: position(3) + normal(3) + uv(2) = 32 bytes
// ════════════════════════════════════════════════════════════════════════

const Vertex = extern struct {
    px: f32, py: f32, pz: f32,
    nx: f32, ny: f32, nz: f32,
    u: f32, v: f32,
};

// ════════════════════════════════════════════════════════════════════════
// Uniform buffer — matches SceneUniforms in WGSL
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
// Procedural geometry
// ════════════════════════════════════════════════════════════════════════

const MAX_VERTS = 4096;
var g_geo_buf: [MAX_VERTS]Vertex = undefined;

fn addFace(buf: []Vertex, idx: *usize, v1: [3]f32, v2: [3]f32, v3: [3]f32, v4: [3]f32, n: [3]f32) void {
    const corners = [4][3]f32{ v1, v2, v3, v4 };
    const uvs = [4][2]f32{ .{ 0, 0 }, .{ 1, 0 }, .{ 1, 1 }, .{ 0, 1 } };
    const tri = [6]u8{ 0, 1, 2, 0, 2, 3 };
    for (tri) |ti| {
        buf[idx.*] = .{
            .px = corners[ti][0], .py = corners[ti][1], .pz = corners[ti][2],
            .nx = n[0], .ny = n[1], .nz = n[2],
            .u = uvs[ti][0], .v = uvs[ti][1],
        };
        idx.* += 1;
    }
}

fn generateBox(sx: f32, sy: f32, sz: f32) struct { count: u32 } {
    const hx = sx * 0.5;
    const hy = sy * 0.5;
    const hz = sz * 0.5;
    var idx: usize = 0;
    addFace(&g_geo_buf, &idx, .{ -hx, -hy, hz }, .{ hx, -hy, hz }, .{ hx, hy, hz }, .{ -hx, hy, hz }, .{ 0, 0, 1 }); // front
    addFace(&g_geo_buf, &idx, .{ hx, -hy, -hz }, .{ -hx, -hy, -hz }, .{ -hx, hy, -hz }, .{ hx, hy, -hz }, .{ 0, 0, -1 }); // back
    addFace(&g_geo_buf, &idx, .{ hx, -hy, hz }, .{ hx, -hy, -hz }, .{ hx, hy, -hz }, .{ hx, hy, hz }, .{ 1, 0, 0 }); // right
    addFace(&g_geo_buf, &idx, .{ -hx, -hy, -hz }, .{ -hx, -hy, hz }, .{ -hx, hy, hz }, .{ -hx, hy, -hz }, .{ -1, 0, 0 }); // left
    addFace(&g_geo_buf, &idx, .{ -hx, hy, hz }, .{ hx, hy, hz }, .{ hx, hy, -hz }, .{ -hx, hy, -hz }, .{ 0, 1, 0 }); // top
    addFace(&g_geo_buf, &idx, .{ -hx, -hy, -hz }, .{ hx, -hy, -hz }, .{ hx, -hy, hz }, .{ -hx, -hy, hz }, .{ 0, -1, 0 }); // bottom
    return .{ .count = @intCast(idx) };
}

fn generateSphere(radius: f32, segments: u32, rings: u32) struct { count: u32 } {
    var idx: usize = 0;
    const pi = std.math.pi;
    var i: u32 = 0;
    while (i < rings) : (i += 1) {
        const t1 = pi * @as(f32, @floatFromInt(i)) / @as(f32, @floatFromInt(rings));
        const t2 = pi * @as(f32, @floatFromInt(i + 1)) / @as(f32, @floatFromInt(rings));
        var j: u32 = 0;
        while (j < segments) : (j += 1) {
            const p1 = 2 * pi * @as(f32, @floatFromInt(j)) / @as(f32, @floatFromInt(segments));
            const p2 = 2 * pi * @as(f32, @floatFromInt(j + 1)) / @as(f32, @floatFromInt(segments));
            const pt = struct {
                fn f(r: f32, theta: f32, phi: f32) [3]f32 {
                    const st = @sin(theta);
                    return .{ r * st * @cos(phi), r * @cos(theta), r * st * @sin(phi) };
                }
                fn n(theta: f32, phi: f32) [3]f32 {
                    const st = @sin(theta);
                    return .{ st * @cos(phi), @cos(theta), st * @sin(phi) };
                }
            };
            const a = pt.f(radius, t1, p1);
            const b = pt.f(radius, t1, p2);
            const c = pt.f(radius, t2, p2);
            const d = pt.f(radius, t2, p1);
            const na = pt.n(t1, p1);
            const nb = pt.n(t1, p2);
            const nc = pt.n(t2, p2);
            const nd = pt.n(t2, p1);
            if (idx + 6 > MAX_VERTS) return .{ .count = @intCast(idx) };
            // Triangle 1: a, d, c
            g_geo_buf[idx] = .{ .px = a[0], .py = a[1], .pz = a[2], .nx = na[0], .ny = na[1], .nz = na[2], .u = 0, .v = 0 };
            idx += 1;
            g_geo_buf[idx] = .{ .px = d[0], .py = d[1], .pz = d[2], .nx = nd[0], .ny = nd[1], .nz = nd[2], .u = 0, .v = 1 };
            idx += 1;
            g_geo_buf[idx] = .{ .px = c[0], .py = c[1], .pz = c[2], .nx = nc[0], .ny = nc[1], .nz = nc[2], .u = 1, .v = 1 };
            idx += 1;
            // Triangle 2: a, c, b
            g_geo_buf[idx] = .{ .px = a[0], .py = a[1], .pz = a[2], .nx = na[0], .ny = na[1], .nz = na[2], .u = 0, .v = 0 };
            idx += 1;
            g_geo_buf[idx] = .{ .px = c[0], .py = c[1], .pz = c[2], .nx = nc[0], .ny = nc[1], .nz = nc[2], .u = 1, .v = 1 };
            idx += 1;
            g_geo_buf[idx] = .{ .px = b[0], .py = b[1], .pz = b[2], .nx = nb[0], .ny = nb[1], .nz = nb[2], .u = 1, .v = 0 };
            idx += 1;
        }
    }
    return .{ .count = @intCast(idx) };
}

fn generatePlane(sx: f32, sz: f32) struct { count: u32 } {
    const hx = sx * 0.5;
    const hz = sz * 0.5;
    var idx: usize = 0;
    addFace(&g_geo_buf, &idx, .{ -hx, 0, -hz }, .{ hx, 0, -hz }, .{ hx, 0, hz }, .{ -hx, 0, hz }, .{ 0, 1, 0 });
    return .{ .count = @intCast(idx) };
}

fn generateCylinder(radius: f32, height: f32, segments: u32) struct { count: u32 } {
    var idx: usize = 0;
    const pi = std.math.pi;
    const hy = height * 0.5;
    var j: u32 = 0;
    while (j < segments) : (j += 1) {
        const a1 = 2 * pi * @as(f32, @floatFromInt(j)) / @as(f32, @floatFromInt(segments));
        const a2 = 2 * pi * @as(f32, @floatFromInt(j + 1)) / @as(f32, @floatFromInt(segments));
        const c1 = @cos(a1);
        const s1 = @sin(a1);
        const c2 = @cos(a2);
        const s2 = @sin(a2);
        if (idx + 6 > MAX_VERTS) break;
        // Side quad
        addFace(&g_geo_buf, &idx,
            .{ radius * c1, -hy, radius * s1 }, .{ radius * c2, -hy, radius * s2 },
            .{ radius * c2, hy, radius * s2 }, .{ radius * c1, hy, radius * s1 },
            .{ c1, 0, s1 });
    }
    return .{ .count = @intCast(idx) };
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

var g_color_texture: ?*wgpu.Texture = null;
var g_color_view: ?*wgpu.TextureView = null;
var g_depth_texture: ?*wgpu.Texture = null;
var g_depth_view: ?*wgpu.TextureView = null;
var g_sampler: ?*wgpu.Sampler = null;
var g_composite_bind_group: ?*wgpu.BindGroup = null;
var g_rt_width: u32 = 0;
var g_rt_height: u32 = 0;

// Deferred cleanup — old render target resources must stay alive until after images.drawAll,
// because their bind groups may still be queued in the images pipeline from earlier 3D views
// rendered this frame. Released at frame end via frameCleanup().
const MAX_DEFERRED_RT = 4;
var g_deferred_bg: [MAX_DEFERRED_RT]?*wgpu.BindGroup = .{null} ** MAX_DEFERRED_RT;
var g_deferred_view: [MAX_DEFERRED_RT]?*wgpu.TextureView = .{null} ** MAX_DEFERRED_RT;
var g_deferred_tex: [MAX_DEFERRED_RT]?*wgpu.Texture = .{null} ** MAX_DEFERRED_RT;
var g_deferred_count: usize = 0;

// ════════════════════════════════════════════════════════════════════════
// Init / deinit (same as before — pipeline, bind groups, sampler)
// ════════════════════════════════════════════════════════════════════════

pub fn init() void {
    const device = core.getDevice() orelse return;
    const shader_desc = wgpu.shaderModuleWGSLDescriptor(.{ .label = "render3d_shader", .code = shaders.scene3d_wgsl });
    const shader_module = device.createShaderModule(&shader_desc) orelse return;
    defer shader_module.release();

    g_vertex_buffer = device.createBuffer(&.{
        .label = wgpu.StringView.fromSlice("render3d_verts"),
        .size = MAX_VERTS * @sizeOf(Vertex),
        .usage = wgpu.BufferUsages.vertex | wgpu.BufferUsages.copy_dst,
        .mapped_at_creation = 0,
    });
    g_uniform_buffer = device.createBuffer(&.{
        .label = wgpu.StringView.fromSlice("render3d_uniforms"),
        .size = @sizeOf(SceneUniforms),
        .usage = wgpu.BufferUsages.uniform | wgpu.BufferUsages.copy_dst,
        .mapped_at_creation = 0,
    });
    g_bind_group_layout = device.createBindGroupLayout(&.{
        .entry_count = 1,
        .entries = @ptrCast(&wgpu.BindGroupLayoutEntry{
            .binding = 0,
            .visibility = wgpu.ShaderStages.vertex | wgpu.ShaderStages.fragment,
            .buffer = .{ .@"type" = .uniform, .has_dynamic_offset = 0, .min_binding_size = @sizeOf(SceneUniforms) },
        }),
    }) orelse return;
    g_bind_group = device.createBindGroup(&.{
        .layout = g_bind_group_layout.?,
        .entry_count = 1,
        .entries = @ptrCast(&wgpu.BindGroupEntry{
            .binding = 0, .buffer = g_uniform_buffer.?, .offset = 0, .size = @sizeOf(SceneUniforms),
        }),
    });
    const pipeline_layout = device.createPipelineLayout(&.{
        .bind_group_layout_count = 1,
        .bind_group_layouts = @ptrCast(&g_bind_group_layout.?),
    }) orelse return;
    defer pipeline_layout.release();
    const vert_attrs = [_]wgpu.VertexAttribute{
        .{ .format = .float32x3, .offset = 0, .shader_location = 0 },
        .{ .format = .float32x3, .offset = 12, .shader_location = 1 },
        .{ .format = .float32x2, .offset = 24, .shader_location = 2 },
    };
    const vert_layout = wgpu.VertexBufferLayout{
        .step_mode = .vertex, .array_stride = @sizeOf(Vertex),
        .attribute_count = vert_attrs.len, .attributes = &vert_attrs,
    };
    const color_target = wgpu.ColorTargetState{
        .format = .rgba8_unorm, .blend = &wgpu.BlendState.premultiplied_alpha_blending,
        .write_mask = wgpu.ColorWriteMasks.all,
    };
    const frag = wgpu.FragmentState{
        .module = shader_module, .entry_point = wgpu.StringView.fromSlice("fs_main"),
        .target_count = 1, .targets = @ptrCast(&color_target),
    };
    const depth_stencil = wgpu.DepthStencilState{
        .format = .depth24_plus, .depth_write_enabled = .true, .depth_compare = .less,
        .stencil_front = .{}, .stencil_back = .{},
    };
    g_pipeline = device.createRenderPipeline(&.{
        .layout = pipeline_layout,
        .vertex = .{ .module = shader_module, .entry_point = wgpu.StringView.fromSlice("vs_main"),
            .buffer_count = 1, .buffers = @ptrCast(&vert_layout) },
        .primitive = .{ .topology = .triangle_list, .cull_mode = .back, .front_face = .ccw },
        .depth_stencil = &depth_stencil, .multisample = .{}, .fragment = &frag,
    });
    g_sampler = device.createSampler(&.{
        .address_mode_u = .clamp_to_edge, .address_mode_v = .clamp_to_edge,
        .mag_filter = .linear, .min_filter = .linear,
    });
    g_initialized = g_pipeline != null;
}

pub fn deinit() void {
    frameCleanup();
    if (g_composite_bind_group) |bg| bg.release();
    if (g_sampler) |s| s.release();
    if (g_depth_view) |v| v.release();
    if (g_depth_texture) |t| t.destroy();
    if (g_color_view) |v| v.release();
    if (g_color_texture) |t| t.destroy();
    if (g_bind_group) |bg| bg.release();
    if (g_bind_group_layout) |l| l.release();
    if (g_uniform_buffer) |b| b.release();
    if (g_vertex_buffer) |b| b.release();
    if (g_pipeline) |p| p.release();
    g_initialized = false;
}

/// Release deferred render target resources from earlier 3D views this frame.
/// Must be called AFTER images.drawAll() — typically at frame end in gpu.zig.
pub fn frameCleanup() void {
    for (0..g_deferred_count) |i| {
        if (g_deferred_bg[i]) |bg| bg.release();
        if (g_deferred_view[i]) |v| v.release();
        if (g_deferred_tex[i]) |t| t.destroy();
        g_deferred_bg[i] = null;
        g_deferred_view[i] = null;
        g_deferred_tex[i] = null;
    }
    g_deferred_count = 0;
}

fn ensureRenderTarget(w: u32, h: u32) bool {
    if (w == 0 or h == 0) return false;
    if (g_rt_width == w and g_rt_height == h and g_color_view != null) return true;
    const device = core.getDevice() orelse return false;
    // Defer old render target cleanup — bind group may still be queued in images
    if (g_composite_bind_group != null or g_color_view != null or g_color_texture != null) {
        if (g_deferred_count < MAX_DEFERRED_RT) {
            g_deferred_bg[g_deferred_count] = g_composite_bind_group;
            g_deferred_view[g_deferred_count] = g_color_view;
            g_deferred_tex[g_deferred_count] = g_color_texture;
            g_deferred_count += 1;
        } else {
            // Overflow — release immediately (rare: >4 3D resizes per frame)
            if (g_composite_bind_group) |bg| bg.release();
            if (g_color_view) |v| v.release();
            if (g_color_texture) |t| t.destroy();
        }
    }
    // Depth buffer is not referenced by bind groups — safe to destroy immediately
    if (g_depth_view) |v| v.release();
    if (g_depth_texture) |t| t.destroy();
    g_composite_bind_group = null;
    g_color_view = null;
    g_color_texture = null;
    g_color_texture = device.createTexture(&.{
        .label = wgpu.StringView.fromSlice("r3d_color"),
        .size = .{ .width = w, .height = h, .depth_or_array_layers = 1 },
        .mip_level_count = 1, .sample_count = 1, .dimension = .@"2d", .format = .rgba8_unorm,
        .usage = wgpu.TextureUsages.render_attachment | wgpu.TextureUsages.texture_binding,
    }) orelse return false;
    g_color_view = g_color_texture.?.createView(&.{
        .format = .rgba8_unorm, .dimension = .@"2d",
        .base_mip_level = 0, .mip_level_count = 1, .base_array_layer = 0, .array_layer_count = 1, .aspect = .all,
    }) orelse return false;
    g_depth_texture = device.createTexture(&.{
        .label = wgpu.StringView.fromSlice("r3d_depth"),
        .size = .{ .width = w, .height = h, .depth_or_array_layers = 1 },
        .mip_level_count = 1, .sample_count = 1, .dimension = .@"2d", .format = .depth24_plus,
        .usage = wgpu.TextureUsages.render_attachment,
    }) orelse return false;
    g_depth_view = g_depth_texture.?.createView(&.{
        .format = .depth24_plus, .dimension = .@"2d",
        .base_mip_level = 0, .mip_level_count = 1, .base_array_layer = 0, .array_layer_count = 1, .aspect = .all,
    }) orelse return false;
    if (g_sampler) |sampler| g_composite_bind_group = images.createBindGroup(g_color_view.?, sampler);
    g_rt_width = w;
    g_rt_height = h;
    return true;
}

// ════════════════════════════════════════════════════════════════════════
// Public API
// ════════════════════════════════════════════════════════════════════════

pub fn update(_: f32) void {}

/// Render a 3D.View node: walk children for 3D.Camera/Light/Mesh, draw to offscreen, composite.
pub fn render(node: *Node, x: f32, y: f32, w: f32, h: f32, opacity: f32) bool {
    if (!g_initialized) init();
    if (!g_initialized) return false;
    const iw: u32 = @intFromFloat(@max(1, w));
    const ih: u32 = @intFromFloat(@max(1, h));
    if (!ensureRenderTarget(iw, ih)) return false;
    const queue = core.getQueue() orelse return false;
    const device = core.getDevice() orelse return false;

    // ── Extract camera, lights, meshes from children ──
    var cam_pos = math.Vec3{ .x = 0, .y = 5, .z = 10 };
    var cam_look = math.Vec3{ .x = 0, .y = 0, .z = 0 };
    var cam_fov: f32 = 60;
    var ambient_color: [3]f32 = .{ 0.15, 0.15, 0.2 };
    var light_dir: [3]f32 = .{ 0.577, 0.577, 0.577 };
    var light_color: [3]f32 = .{ 1.0, 0.95, 0.9 };

    for (node.children) |*child| {
        if (child.scene3d_camera) {
            cam_pos = .{ .x = child.scene3d_pos_x, .y = child.scene3d_pos_y, .z = child.scene3d_pos_z };
            cam_look = .{ .x = child.scene3d_look_x, .y = child.scene3d_look_y, .z = child.scene3d_look_z };
            cam_fov = child.scene3d_fov;
        }
        if (child.scene3d_light) {
            if (child.scene3d_light_type) |lt| {
                const i = child.scene3d_intensity;
                if (std.mem.eql(u8, lt, "ambient")) {
                    ambient_color = .{ child.scene3d_color_r * i, child.scene3d_color_g * i, child.scene3d_color_b * i };
                } else if (std.mem.eql(u8, lt, "directional")) {
                    const dx = child.scene3d_dir_x;
                    const dy = child.scene3d_dir_y;
                    const dz = child.scene3d_dir_z;
                    const len = @sqrt(dx * dx + dy * dy + dz * dz);
                    if (len > 0.001) {
                        light_dir = .{ dx / len, dy / len, dz / len };
                    }
                    light_color = .{ child.scene3d_color_r * i, child.scene3d_color_g * i, child.scene3d_color_b * i };
                }
            }
        }
    }

    // ── Build view + projection ──
    const aspect = w / @max(h, 1);
    const fov_rad = cam_fov * std.math.pi / 180.0;
    const projection = math.m4perspective(fov_rad, aspect, 0.1, 1000.0);
    const view = math.m4lookAt(cam_pos, cam_look, .{ .x = 0, .y = 1, .z = 0 });
    const vp = math.m4multiply(projection, view);

    // ── Begin render pass ──
    const color_view = g_color_view orelse return false;
    const depth_view = g_depth_view orelse return false;
    const encoder = device.createCommandEncoder(&.{ .label = wgpu.StringView.fromSlice("r3d") }) orelse return false;
    const pass = encoder.beginRenderPass(&.{
        .color_attachment_count = 1,
        .color_attachments = @ptrCast(&wgpu.ColorAttachment{
            .view = color_view, .load_op = .clear, .store_op = .store,
            .clear_value = .{ .r = 0.05, .g = 0.05, .b = 0.08, .a = 1.0 },
        }),
        .depth_stencil_attachment = &wgpu.DepthStencilAttachment{
            .view = depth_view, .depth_load_op = .clear, .depth_store_op = .store,
            .depth_clear_value = 1.0, .stencil_load_op = .clear, .stencil_store_op = .store,
            .stencil_clear_value = 0,
        },
    }) orelse { encoder.release(); return false; };

    pass.setPipeline(g_pipeline.?);
    pass.setBindGroup(0, g_bind_group.?, 0, null);

    // ── Draw each mesh ──
    for (node.children) |*child| {
        if (!child.scene3d_mesh) continue;

        // Generate geometry
        const geo_name = child.scene3d_geometry orelse "box";
        var vert_count: u32 = 0;
        if (std.mem.eql(u8, geo_name, "sphere")) {
            vert_count = generateSphere(child.scene3d_radius, 24, 16).count;
        } else if (std.mem.eql(u8, geo_name, "plane")) {
            vert_count = generatePlane(child.scene3d_size_x, child.scene3d_size_z).count;
        } else if (std.mem.eql(u8, geo_name, "cylinder")) {
            vert_count = generateCylinder(child.scene3d_radius, child.scene3d_size_y, 24).count;
        } else {
            vert_count = generateBox(child.scene3d_size_x, child.scene3d_size_y, child.scene3d_size_z).count;
        }

        if (vert_count == 0) continue;

        // Upload vertices
        queue.writeBuffer(g_vertex_buffer.?, 0, @ptrCast(&g_geo_buf), vert_count * @sizeOf(Vertex));

        // Build model matrix: T * Ry * Rx * Rz * S
        const deg2rad = std.math.pi / 180.0;
        var model = math.m4scale(math.m4identity(), .{ .x = child.scene3d_scale_x, .y = child.scene3d_scale_y, .z = child.scene3d_scale_z });
        model = math.m4multiply(math.m4rotateZ(math.m4identity(), child.scene3d_rot_z * deg2rad), model);
        model = math.m4multiply(math.m4rotateX(math.m4identity(), child.scene3d_rot_x * deg2rad), model);
        model = math.m4multiply(math.m4rotateY(math.m4identity(), child.scene3d_rot_y * deg2rad), model);
        model = math.m4multiply(math.m4translate(math.m4identity(), .{ .x = child.scene3d_pos_x, .y = child.scene3d_pos_y, .z = child.scene3d_pos_z }), model);

        const mvp = math.m4multiply(vp, model);

        // Write uniforms
        const uniforms = SceneUniforms{
            .mvp = math.m4transpose(mvp),
            .model = math.m4transpose(model),
            .light_dir = light_dir,
            .specular_power = 64.0,
            .light_color = light_color,
            .ambient_color = ambient_color,
            .camera_pos = .{ cam_pos.x, cam_pos.y, cam_pos.z },
            .color = .{ child.scene3d_color_r, child.scene3d_color_g, child.scene3d_color_b, 1.0 },
        };
        queue.writeBuffer(g_uniform_buffer.?, 0, @ptrCast(&uniforms), @sizeOf(SceneUniforms));

        pass.setVertexBuffer(0, g_vertex_buffer.?, 0, vert_count * @sizeOf(Vertex));
        pass.draw(vert_count, 1, 0, 0);
    }

    pass.end();
    pass.release();
    const command = encoder.finish(&.{ .label = wgpu.StringView.fromSlice("r3d_cmd") }) orelse { encoder.release(); return false; };
    encoder.release();
    queue.submit(&.{command});
    command.release();

    if (g_composite_bind_group) |bg| {
        images.queueQuad(x, y, w, h, opacity, bg);
        return true;
    }
    return false;
}
