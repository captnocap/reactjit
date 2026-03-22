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
const wgpu = @import("wgpu");
const gpu_core = @import("gpu/gpu.zig");
const images = @import("gpu/images.zig");
const log = @import("log.zig");
const layout = @import("layout.zig");
const effect_ctx = @import("effect_ctx.zig");

pub const EffectContext = effect_ctx.EffectContext;
pub const RenderFn = effect_ctx.RenderFn;

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
// Instances — shared between registry and custom render paths
// ════════════════════════════════════════════════════════════════════════

const MAX_INSTANCES = 32;

const Instance = struct {
    active: bool = false,

    // Identity — one of these is set, not both
    effect_type: []const u8 = "", // registry path
    render_fn: ?RenderFn = null, // custom render path

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

    // Timing (for custom render path)
    time: f32 = 0,
    frame_count: u32 = 0,

    // Position (for mouse hit testing)
    screen_x: f32 = 0,
    screen_y: f32 = 0,

    fn deinit(self: *Instance) void {
        if (self.state) |s| {
            if (self.module) |m| m.destroy(s);
        }
        self.state = null;
        if (self.bind_group) |bg| bg.release();
        if (self.sampler) |s| s.release();
        if (self.texture_view) |tv| tv.release();
        if (self.texture) |t| t.destroy();
        self.bind_group = null;
        self.sampler = null;
        self.texture_view = null;
        self.texture = null;
        if (self.pixel_buf) |buf| page_alloc.free(buf);
        self.pixel_buf = null;
        self.active = false;
    }

    fn ensureSize(self: *Instance, w: u32, h: u32) void {
        if (w == 0 or h == 0) return;
        if (self.width == w and self.height == h) return;

        if (self.pixel_buf) |buf| page_alloc.free(buf);
        self.pixel_buf = page_alloc.alloc(u8, @as(usize, w) * @as(usize, h) * 4) catch return;
        @memset(self.pixel_buf.?, 0);
        self.width = w;
        self.height = h;

        // Invalidate wgpu resources
        if (self.bind_group) |bg| bg.release();
        if (self.sampler) |s| s.release();
        if (self.texture_view) |tv| tv.release();
        if (self.texture) |t| t.destroy();
        self.bind_group = null;
        self.sampler = null;
        self.texture_view = null;
        self.texture = null;

        // Re-create registry effect state at new size
        if (self.module) |m| {
            if (self.state) |s| m.destroy(s);
            self.state = m.create(w, h);
        }
    }

    fn ensureTexture(self: *Instance) bool {
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
            .usage = wgpu.TextureUsages.texture_binding | wgpu.TextureUsages.copy_dst,
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
        const row_bytes = w * 4;

        // Flip rows for the shared image shader (1.0 - corner.y UV flip)
        if (row_bytes <= 8192) {
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

        queue.writeTexture(
            &.{ .texture = tex, .mip_level = 0, .origin = .{ .x = 0, .y = 0, .z = 0 }, .aspect = .all },
            @ptrCast(buf.ptr),
            @as(usize, w) * @as(usize, h) * 4,
            &.{ .offset = 0, .bytes_per_row = w * 4, .rows_per_image = h },
            &.{ .width = w, .height = h, .depth_or_array_layers = 1 },
        );
    }
};

var instances: [MAX_INSTANCES]Instance = [_]Instance{.{}} ** MAX_INSTANCES;
var instance_count: usize = 0;

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
    const local_x = g_mouse_x - inst.screen_x;
    const local_y = g_mouse_y - inst.screen_y;
    const w: f32 = @floatFromInt(inst.width);
    const h: f32 = @floatFromInt(inst.height);
    return .{
        .x = local_x,
        .y = local_y,
        .dx = g_mouse_dx,
        .dy = g_mouse_dy,
        .speed = g_mouse_speed,
        .inside = local_x >= 0 and local_x <= w and local_y >= 0 and local_y <= h,
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

pub fn init() void {
    // No built-in effects — users compose their own via <Effect onRender>
}

pub fn deinit() void {
    for (instances[0..instance_count]) |*inst| inst.deinit();
    instance_count = 0;
}

/// Called every frame: update registry-based effect instances and store dt.
pub fn update(dt: f32) void {
    g_dt = dt;

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

        // Custom render path: call user function with EffectContext
        if (inst.render_fn) |render| {
            if (inst.width == 0 or inst.height == 0) continue;
            const buf = inst.pixel_buf orelse continue;

            var ctx = EffectContext{
                .buf = buf.ptr,
                .width = inst.width,
                .height = inst.height,
                .stride = inst.width * 4,
                .time = inst.time,
                .dt = dt,
                .mouse_x = g_mouse_x - inst.screen_x,
                .mouse_y = g_mouse_y - inst.screen_y,
                .mouse_inside = (g_mouse_x - inst.screen_x) >= 0 and
                    (g_mouse_x - inst.screen_x) <= @as(f32, @floatFromInt(inst.width)) and
                    (g_mouse_y - inst.screen_y) >= 0 and
                    (g_mouse_y - inst.screen_y) <= @as(f32, @floatFromInt(inst.height)),
                .frame = inst.frame_count,
            };
            render(&ctx);
            inst.dirty = true;
        }

        // Upload to GPU
        if (inst.dirty) {
            if (inst.ensureTexture()) inst.upload();
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

    const iw: u32 = @intFromFloat(@max(1, w));
    const ih: u32 = @intFromFloat(@max(1, h));
    i.ensureSize(iw, ih);

    const bg = i.bind_group orelse return false;
    if (i.width == 0 or i.height == 0) return false;

    images.queueQuad(x, y, w, h, opacity, bg);
    return true;
}

/// Paint a custom effect (node has effect_render function pointer).
/// Called from engine.paintNode when node.effect_render is set.
pub fn paintCustomEffect(render_fn: RenderFn, x: f32, y: f32, w: f32, h: f32, opacity: f32) bool {
    var inst = findInstanceByFn(render_fn);
    if (inst == null) {
        inst = createCustomInstance(render_fn);
    }
    const i = inst orelse return false;
    i.active = true;
    i.screen_x = x;
    i.screen_y = y;

    const iw: u32 = @intFromFloat(@max(1, w));
    const ih: u32 = @intFromFloat(@max(1, h));
    i.ensureSize(iw, ih);

    const bg = i.bind_group orelse return false;
    if (i.width == 0 or i.height == 0) return false;

    images.queueQuad(x, y, w, h, opacity, bg);
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

    const iw: u32 = @intFromFloat(@max(1, pw));
    const ih: u32 = @intFromFloat(@max(1, ph));
    i.ensureSize(iw, ih);

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

fn findInstanceByFn(render_fn: RenderFn) ?*Instance {
    for (instances[0..instance_count]) |*inst| {
        if (inst.active and inst.render_fn != null and inst.render_fn.? == render_fn)
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

fn createCustomInstance(render_fn: RenderFn) ?*Instance {
    if (instance_count >= MAX_INSTANCES) return null;

    const inst = &instances[instance_count];
    inst.* = .{
        .active = true,
        .render_fn = render_fn,
    };
    instance_count += 1;
    return inst;
}
