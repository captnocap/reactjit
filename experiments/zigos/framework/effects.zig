//! Effects — Generative canvas effect registry and lifecycle manager.
//!
//! Port of love2d/lua/effects.lua. Manages off-screen pixel buffers for
//! procedural visual effects that render standalone (filling their own layout box)
//! or as a background texture behind a parent element's children.
//!
//! Architecture (matching Lua):
//!   1. Registry: effect type name → create/update/draw function pointers
//!   2. Per-instance state: pixel buffer, wgpu texture, dimensions, animation state
//!   3. Lifecycle: syncWithTree → updateAll(dt) → engine paint composites
//!   4. Two modes: standalone (own node) and background (behind parent's children)
//!
//! Effects render to CPU pixel buffers (RGBA), then upload to wgpu textures.
//! This matches how render_surfaces and videos work — same images.queueQuad() pipeline.
//!
//! Usage in .tsz:
//!   <Spirograph />                           — standalone, fills own box
//!   <Spirograph background />                — behind parent's children
//!   <Spirograph speed={1.5} decay={0.02} />  — with props

const std = @import("std");
const wgpu = @import("wgpu");
const gpu_core = @import("gpu/gpu.zig");
const images = @import("gpu/images.zig");
const log = @import("log.zig");
const layout = @import("layout.zig");

const Node = layout.Node;
const page_alloc = std.heap.page_allocator;

// ════════════════════════════════════════════════════════════════════════
// Effect module interface
// ════════════════════════════════════════════════════════════════════════

/// Opaque effect state — each effect type defines its own struct.
/// Stored as a pointer to heap-allocated state.
const EffectState = *anyopaque;

/// Mouse state passed to update/draw (local coordinates relative to effect bounds).
pub const MouseInfo = struct {
    x: f32 = 0,
    y: f32 = 0,
    dx: f32 = 0,
    dy: f32 = 0,
    speed: f32 = 0,
    inside: bool = false,
    idle: f32 = 0,
};

/// Effect module — the interface each effect type implements.
/// Matches Lua's { create, update, draw } pattern.
pub const EffectModule = struct {
    /// Create initial state for a new instance.
    create: *const fn (w: u32, h: u32) EffectState,
    /// Update animation state (called every frame).
    update: *const fn (state: EffectState, dt: f32, w: u32, h: u32, mouse: MouseInfo) void,
    /// Draw to pixel buffer (RGBA, w*h*4 bytes). Effect owns the drawing — no clear by default
    /// (allows trails/accumulation). Effect should clear if it wants a fresh frame.
    draw: *const fn (state: EffectState, buf: []u8, w: u32, h: u32) void,
    /// Destroy state (free heap allocations).
    destroy: *const fn (state: EffectState) void,
};

// ════════════════════════════════════════════════════════════════════════
// Registry
// ════════════════════════════════════════════════════════════════════════

const MAX_EFFECT_TYPES = 32;

const RegistryEntry = struct {
    name: []const u8 = "",
    module: EffectModule = undefined,
};

var registry: [MAX_EFFECT_TYPES]RegistryEntry = [_]RegistryEntry{.{}} ** MAX_EFFECT_TYPES;
var registry_count: usize = 0;

/// Register an effect type by name.
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

/// Check if a name is a registered effect type.
pub fn isEffect(name: []const u8) bool {
    return findModule(name) != null;
}

// ════════════════════════════════════════════════════════════════════════
// Instances
// ════════════════════════════════════════════════════════════════════════

const MAX_INSTANCES = 16;

const Instance = struct {
    active: bool = false,
    effect_type: []const u8 = "",
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

    // Mode
    is_background: bool = false,
    // Bounding rect (for mouse hit testing)
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

        // Resize pixel buffer
        if (self.pixel_buf) |buf| page_alloc.free(buf);
        self.pixel_buf = page_alloc.alloc(u8, @as(usize, w) * @as(usize, h) * 4) catch return;
        // Clear to black
        @memset(self.pixel_buf.?, 0);
        self.width = w;
        self.height = h;

        // Invalidate wgpu resources (will be recreated)
        if (self.bind_group) |bg| bg.release();
        if (self.sampler) |s| s.release();
        if (self.texture_view) |tv| tv.release();
        if (self.texture) |t| t.destroy();
        self.bind_group = null;
        self.sampler = null;
        self.texture_view = null;
        self.texture = null;

        // Re-create effect state at new size
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
// Public API (called from engine.zig)
// ════════════════════════════════════════════════════════════════════════

pub fn init() void {
    // Register built-in effects
    registerBuiltins();
}

pub fn deinit() void {
    for (instances[0..instance_count]) |*inst| inst.deinit();
    instance_count = 0;
}

/// Called every frame: update all effect animation states and render to pixel buffers.
pub fn update(dt: f32) void {
    for (instances[0..instance_count]) |*inst| {
        if (!inst.active) continue;
        const m = inst.module orelse continue;
        const s = inst.state orelse continue;
        if (inst.width == 0 or inst.height == 0) continue;

        const mouse = instanceMouse(inst);
        m.update(s, dt, inst.width, inst.height, mouse);

        // Draw to pixel buffer
        if (inst.pixel_buf) |buf| {
            m.draw(s, buf, inst.width, inst.height);
            inst.dirty = true;
        }

        // Upload to GPU
        if (inst.dirty) {
            if (inst.ensureTexture()) inst.upload();
        }
    }
}

/// Paint a standalone effect (called from engine.paintNode when node has effect_type).
/// Returns true if an effect quad was queued.
pub fn paintEffect(effect_type: []const u8, x: f32, y: f32, w: f32, h: f32, opacity: f32) bool {
    // Find or create instance
    var inst = findInstance(effect_type);
    if (inst == null) {
        inst = createInstance(effect_type, false);
    }
    const i = inst orelse return false;
    i.active = true;
    i.screen_x = x;
    i.screen_y = y;

    // Ensure dimensions match
    const iw: u32 = @intFromFloat(@max(1, w));
    const ih: u32 = @intFromFloat(@max(1, h));
    i.ensureSize(iw, ih);

    const bg = i.bind_group orelse return false;
    if (i.width == 0 or i.height == 0) return false;

    images.queueQuad(x, y, w, h, opacity, bg);
    return true;
}

/// Paint a background effect for a parent node.
/// Called from engine.paintNode after the parent's background but before children.
pub fn paintBackground(effect_type: []const u8, parent_x: f32, parent_y: f32, parent_w: f32, parent_h: f32, opacity: f32) bool {
    var inst = findInstance(effect_type);
    if (inst == null) {
        inst = createInstance(effect_type, true);
    }
    const i = inst orelse return false;
    i.active = true;
    i.is_background = true;
    i.screen_x = parent_x;
    i.screen_y = parent_y;

    const iw: u32 = @intFromFloat(@max(1, parent_w));
    const ih: u32 = @intFromFloat(@max(1, parent_h));
    i.ensureSize(iw, ih);

    const bg = i.bind_group orelse return false;
    if (i.width == 0 or i.height == 0) return false;

    images.queueQuad(parent_x, parent_y, parent_w, parent_h, opacity, bg);
    return true;
}

// ════════════════════════════════════════════════════════════════════════
// Instance management
// ════════════════════════════════════════════════════════════════════════

fn findInstance(effect_type: []const u8) ?*Instance {
    for (instances[0..instance_count]) |*inst| {
        if (std.mem.eql(u8, inst.effect_type, effect_type) and inst.active) return inst;
    }
    return null;
}

fn createInstance(effect_type: []const u8, is_background: bool) ?*Instance {
    if (instance_count >= MAX_INSTANCES) return null;
    const m = findModule(effect_type) orelse return null;

    const inst = &instances[instance_count];
    inst.* = .{
        .active = true,
        .effect_type = effect_type,
        .module = m,
        .is_background = is_background,
    };
    instance_count += 1;
    return inst;
}

// ════════════════════════════════════════════════════════════════════════
// Built-in effects (ported from lua/effects/)
// ════════════════════════════════════════════════════════════════════════

fn registerBuiltins() void {
    register("Spirograph", spirograph_module);
    register("Rings", rings_module);
}

// ── Spirograph ──────────────────────────────────────────────────────────
// Port of lua/effects/spirograph.lua — parametric hypotrochoid curves

const SpiroState = struct {
    time: f32 = 0,
    angle: f32 = 0,
    cx: f32 = 0,
    cy: f32 = 0,
    scale: f32 = 0,
    R1: f32 = 0,
    R2: f32 = 0,
    d: f32 = 0,
    hue: f32 = 0,
    prev_x: f32 = 0,
    prev_y: f32 = 0,
    has_prev: bool = false,
};

fn spiroCreate(w: u32, h: u32) EffectState {
    const s = page_alloc.create(SpiroState) catch return undefined;
    const fw: f32 = @floatFromInt(w);
    const fh: f32 = @floatFromInt(h);
    const scale = @min(fw, fh) * 0.35;
    s.* = .{
        .cx = fw / 2,
        .cy = fh / 2,
        .scale = scale,
        .R1 = scale * 0.8,
        .R2 = scale * 0.35,
        .d = scale * 0.45,
        .hue = @as(f32, @floatFromInt(@as(u32, @truncate(@as(u64, @truncate(@as(u128, @bitCast(std.time.nanoTimestamp())))))))) / 4294967296.0,
    };
    return @ptrCast(s);
}

fn spiroUpdate(state: EffectState, dt: f32, w: u32, h: u32, mouse: MouseInfo) void {
    _ = w;
    _ = h;
    _ = mouse;
    const s: *SpiroState = @ptrCast(@alignCast(state));
    s.time += dt;
}

fn spiroDraw(state: EffectState, buf: []u8, w: u32, h: u32) void {
    const s: *SpiroState = @ptrCast(@alignCast(state));
    const t = s.time;

    // Fade existing content (trail effect)
    const buf_size = @as(usize, w) * @as(usize, h) * 4;
    var i: usize = 0;
    while (i < buf_size) : (i += 4) {
        // Reduce alpha slightly for trail decay
        if (buf[i + 3] > 2) {
            buf[i + 3] -= 2;
        } else {
            buf[i] = 0;
            buf[i + 1] = 0;
            buf[i + 2] = 0;
            buf[i + 3] = 0;
        }
    }

    // Draw spirograph points
    const steps: u32 = 200;
    var step: u32 = 0;
    while (step < steps) : (step += 1) {
        const angle = t * 2.0 + @as(f32, @floatFromInt(step)) * 0.02;
        const R1 = s.R1;
        const R2 = s.R2 + @sin(t * 0.3) * s.scale * 0.1;
        const d = s.d + @cos(t * 0.7) * s.scale * 0.05;

        const px = (R1 - R2) * @cos(angle) + d * @cos(angle * (R1 - R2) / R2);
        const py = (R1 - R2) * @sin(angle) - d * @sin(angle * (R1 - R2) / R2);

        const x: i32 = @intFromFloat(s.cx + px);
        const y: i32 = @intFromFloat(s.cy + py);

        if (x >= 0 and x < @as(i32, @intCast(w)) and y >= 0 and y < @as(i32, @intCast(h))) {
            const idx = (@as(usize, @intCast(y)) * @as(usize, w) + @as(usize, @intCast(x))) * 4;
            // HSV to RGB (hue rotates with time)
            const hue = s.hue + t * 0.1 + @as(f32, @floatFromInt(step)) * 0.002;
            const r_f = @abs(@mod(hue * 6.0, 6.0) - 3.0) - 1.0;
            const g_f = 2.0 - @abs(@mod(hue * 6.0 - 2.0, 6.0) - 3.0);
            const b_f = 2.0 - @abs(@mod(hue * 6.0 - 4.0, 6.0) - 3.0);
            buf[idx] = @intFromFloat(std.math.clamp(r_f, 0, 1) * 255);
            buf[idx + 1] = @intFromFloat(std.math.clamp(g_f, 0, 1) * 255);
            buf[idx + 2] = @intFromFloat(std.math.clamp(b_f, 0, 1) * 255);
            buf[idx + 3] = 255;

            // Draw a small 3x3 dot for visibility
            const offsets = [_]i32{ -1, 0, 1 };
            for (offsets) |ox| {
                for (offsets) |oy| {
                    if (ox == 0 and oy == 0) continue;
                    const nx = x + ox;
                    const ny = y + oy;
                    if (nx >= 0 and nx < @as(i32, @intCast(w)) and ny >= 0 and ny < @as(i32, @intCast(h))) {
                        const nidx = (@as(usize, @intCast(ny)) * @as(usize, w) + @as(usize, @intCast(nx))) * 4;
                        buf[nidx] = @intFromFloat(std.math.clamp(r_f, 0, 1) * 200);
                        buf[nidx + 1] = @intFromFloat(std.math.clamp(g_f, 0, 1) * 200);
                        buf[nidx + 2] = @intFromFloat(std.math.clamp(b_f, 0, 1) * 200);
                        buf[nidx + 3] = 180;
                    }
                }
            }
        }
    }

    s.hue += 0.001;
}

fn spiroDestroy(state: EffectState) void {
    const s: *SpiroState = @ptrCast(@alignCast(state));
    page_alloc.destroy(s);
}

const spirograph_module = EffectModule{
    .create = spiroCreate,
    .update = spiroUpdate,
    .draw = spiroDraw,
    .destroy = spiroDestroy,
};

// ── Rings ───────────────────────────────────────────────────────────────
// Concentric expanding rings with color cycling

const RingsState = struct {
    time: f32 = 0,
    cx: f32 = 0,
    cy: f32 = 0,
};

fn ringsCreate(w: u32, h: u32) EffectState {
    const s = page_alloc.create(RingsState) catch return undefined;
    s.* = .{
        .cx = @as(f32, @floatFromInt(w)) / 2,
        .cy = @as(f32, @floatFromInt(h)) / 2,
    };
    return @ptrCast(s);
}

fn ringsUpdate(state: EffectState, dt: f32, w: u32, h: u32, mouse: MouseInfo) void {
    _ = w;
    _ = h;
    _ = mouse;
    const s: *RingsState = @ptrCast(@alignCast(state));
    s.time += dt;
}

fn ringsDraw(state: EffectState, buf: []u8, w: u32, h: u32) void {
    const s: *RingsState = @ptrCast(@alignCast(state));
    const t = s.time;
    const cx = s.cx;
    const cy = s.cy;

    var y: u32 = 0;
    while (y < h) : (y += 1) {
        var x: u32 = 0;
        while (x < w) : (x += 1) {
            const fx: f32 = @floatFromInt(x);
            const fy: f32 = @floatFromInt(y);
            const dx = fx - cx;
            const dy = fy - cy;
            const dist = @sqrt(dx * dx + dy * dy);

            // Concentric rings expanding outward
            const ring = @sin(dist * 0.05 - t * 3.0) * 0.5 + 0.5;
            const hue = dist * 0.01 + t * 0.2;

            const r_f = @abs(@mod(hue * 6.0, 6.0) - 3.0) - 1.0;
            const g_f = 2.0 - @abs(@mod(hue * 6.0 - 2.0, 6.0) - 3.0);
            const b_f = 2.0 - @abs(@mod(hue * 6.0 - 4.0, 6.0) - 3.0);

            const idx = (@as(usize, y) * @as(usize, w) + @as(usize, x)) * 4;
            buf[idx] = @intFromFloat(std.math.clamp(r_f, 0, 1) * ring * 255);
            buf[idx + 1] = @intFromFloat(std.math.clamp(g_f, 0, 1) * ring * 255);
            buf[idx + 2] = @intFromFloat(std.math.clamp(b_f, 0, 1) * ring * 255);
            buf[idx + 3] = @intFromFloat(ring * 255);
        }
    }
}

fn ringsDestroy(state: EffectState) void {
    const s: *RingsState = @ptrCast(@alignCast(state));
    page_alloc.destroy(s);
}

const rings_module = EffectModule{
    .create = ringsCreate,
    .update = ringsUpdate,
    .draw = ringsDraw,
    .destroy = ringsDestroy,
};
