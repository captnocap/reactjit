//! physics3d.zig — 3D physics engine integration (Bullet Physics 3.25)
//!
//! Mirrors physics2d.zig but for 3D rigid body dynamics.
//! Manages a Bullet world and maps physics bodies to 3D.Mesh layout nodes.
//! Each frame: step the world, then write body transforms back to node scene3d fields.
//!
//! Architecture:
//!   - Fixed-size body pool (MAX_BODIES), zero allocations
//!   - Bodies are registered with a pointer to their Node
//!   - tick(dt) steps the world and syncs positions/rotations to nodes
//!   - Works in world units (1 unit = 1 unit, no pixel conversion like 2D)

const std = @import("std");
const layout = @import("layout.zig");
const Node = layout.Node;

// ── Bullet C shim ──────────────────────────────────────────────
const c = @cImport({
    @cInclude("physics3d_shim.h");
});

// ── Constants ──────────────────────────────────────────────────

pub const MAX_BODIES: usize = 256;
const MAX_SUBSTEPS: c_int = 10;

// ── Body types ─────────────────────────────────────────────────

pub const BodyType = enum(u8) {
    static_body = 0,
    kinematic = 1,
    dynamic = 2,
};

pub const ColliderShape = enum {
    box,
    sphere,
    cylinder,
    capsule,
    cone,
    plane,
    heightfield,
};

// ── Body registration ──────────────────────────────────────────

pub const Body = struct {
    active: bool = false,
    handle: c.Phys3DBody = null,
    shape: c.Phys3DShape = null,
    node: ?*Node = null,
};

// ── State ──────────────────────────────────────────────────────

var world: c.Phys3DWorld = null;
var bodies: [MAX_BODIES]Body = [_]Body{.{}} ** MAX_BODIES;
var body_count: u32 = 0;
var initialized: bool = false;

// ── Init / Deinit ──────────────────────────────────────────────

pub fn init(gravity_x: f32, gravity_y: f32, gravity_z: f32) void {
    if (initialized) return;
    world = c.phys3d_world_create(gravity_x, gravity_y, gravity_z);
    if (world == null) return;
    initialized = true;
    body_count = 0;
    for (&bodies) |*b| b.* = .{};
}

pub fn deinit() void {
    if (!initialized) return;
    // Destroy all bodies
    for (&bodies) |*b| {
        if (b.active and b.handle != null) {
            c.phys3d_body_destroy(world, b.handle);
            if (b.shape != null) c.phys3d_shape_destroy(b.shape);
        }
        b.* = .{};
    }
    body_count = 0;
    c.phys3d_world_destroy(world);
    world = null;
    initialized = false;
}

pub fn isInitialized() bool {
    return initialized;
}

// ── Body creation ──────────────────────────────────────────────

pub fn createBody(
    body_type: BodyType,
    shape_type: ColliderShape,
    x: f32, y: f32, z: f32,
    mass: f32,
    size_x: f32, size_y: f32, size_z: f32,
    radius: f32,
    target: *Node,
) ?u32 {
    if (!initialized) return null;
    // Find free slot
    var idx: u32 = 0;
    while (idx < MAX_BODIES) : (idx += 1) {
        if (!bodies[idx].active) break;
    }
    if (idx >= MAX_BODIES) return null;

    // Create collision shape
    const shape: c.Phys3DShape = switch (shape_type) {
        .box => c.phys3d_shape_box(size_x * 0.5, size_y * 0.5, size_z * 0.5),
        .sphere => c.phys3d_shape_sphere(radius),
        .cylinder => c.phys3d_shape_cylinder(size_x * 0.5, size_y * 0.5, size_z * 0.5),
        .capsule => c.phys3d_shape_capsule(radius, size_y),
        .cone => c.phys3d_shape_cone(radius, size_y),
        .plane => c.phys3d_shape_plane(0, 1, 0, 0),
        .heightfield => return null, // requires separate heightfield data
    };
    if (shape == null) return null;

    // Create rigid body
    const bt: c_int = @intFromEnum(body_type);
    const body = c.phys3d_body_create(world, shape, bt, mass, x, y, z);
    if (body == null) {
        c.phys3d_shape_destroy(shape);
        return null;
    }

    bodies[idx] = .{
        .active = true,
        .handle = body,
        .shape = shape,
        .node = target,
    };
    body_count += 1;
    return idx;
}

pub fn destroyBody(idx: u32) void {
    if (idx >= MAX_BODIES or !bodies[idx].active) return;
    if (bodies[idx].handle != null) {
        c.phys3d_body_destroy(world, bodies[idx].handle);
    }
    if (bodies[idx].shape != null) {
        c.phys3d_shape_destroy(bodies[idx].shape);
    }
    bodies[idx] = .{};
    if (body_count > 0) body_count -= 1;
}

// ── Properties ─────────────────────────────────────────────────

pub fn setFriction(idx: u32, friction: f32) void {
    if (idx >= MAX_BODIES or !bodies[idx].active) return;
    c.phys3d_body_set_friction(bodies[idx].handle, friction);
}

pub fn setRestitution(idx: u32, restitution: f32) void {
    if (idx >= MAX_BODIES or !bodies[idx].active) return;
    c.phys3d_body_set_restitution(bodies[idx].handle, restitution);
}

pub fn setDamping(idx: u32, linear: f32, angular: f32) void {
    if (idx >= MAX_BODIES or !bodies[idx].active) return;
    c.phys3d_body_set_damping(bodies[idx].handle, linear, angular);
}

// ── Forces ─────────────────────────────────────────────────────

pub fn applyForce(idx: u32, fx: f32, fy: f32, fz: f32) void {
    if (idx >= MAX_BODIES or !bodies[idx].active) return;
    c.phys3d_body_apply_force(bodies[idx].handle, fx, fy, fz);
}

pub fn applyImpulse(idx: u32, ix: f32, iy: f32, iz: f32) void {
    if (idx >= MAX_BODIES or !bodies[idx].active) return;
    c.phys3d_body_apply_impulse(bodies[idx].handle, ix, iy, iz);
}

pub fn setLinearVelocity(idx: u32, vx: f32, vy: f32, vz: f32) void {
    if (idx >= MAX_BODIES or !bodies[idx].active) return;
    c.phys3d_body_set_linear_velocity(bodies[idx].handle, vx, vy, vz);
}

// ── Raycast ────────────────────────────────────────────────────

pub const RayHit = struct {
    x: f32,
    y: f32,
    z: f32,
    normal_x: f32,
    normal_y: f32,
    normal_z: f32,
};

pub fn raycast(from_x: f32, from_y: f32, from_z: f32, to_x: f32, to_y: f32, to_z: f32) ?RayHit {
    if (!initialized) return null;
    var hit: RayHit = undefined;
    const result = c.phys3d_raycast(world, from_x, from_y, from_z, to_x, to_y, to_z,
        &hit.x, &hit.y, &hit.z, &hit.normal_x, &hit.normal_y, &hit.normal_z);
    return if (result == 1) hit else null;
}

// ── Tick — step world and sync transforms to nodes ─────────────

pub fn tick(dt: f32) void {
    if (!initialized) return;
    c.phys3d_world_step(world, dt, MAX_SUBSTEPS);

    // Sync body transforms back to layout nodes
    for (&bodies) |*b| {
        if (!b.active or b.handle == null) continue;
        const node = b.node orelse continue;

        // Position
        node.scene3d_pos_x = c.phys3d_body_get_x(b.handle);
        node.scene3d_pos_y = c.phys3d_body_get_y(b.handle);
        node.scene3d_pos_z = c.phys3d_body_get_z(b.handle);

        // Rotation (Euler degrees)
        var rx: f32 = 0;
        var ry: f32 = 0;
        var rz: f32 = 0;
        c.phys3d_body_get_euler(b.handle, &rx, &ry, &rz);
        node.scene3d_rot_x = rx;
        node.scene3d_rot_y = ry;
        node.scene3d_rot_z = rz;
    }
}
