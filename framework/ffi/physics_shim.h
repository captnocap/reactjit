// physics_shim.h — C API wrapping Box2D 2.4.1 for Zig @cImport
//
// Provides: world create/destroy/step, body create/destroy, fixture (collider) create,
// body position/angle read, force/impulse apply.
// All pointers are opaque void* to avoid C++ types in the header.

#ifndef PHYSICS_SHIM_H
#define PHYSICS_SHIM_H

#ifdef __cplusplus
extern "C" {
#endif

// ── World ──────────────────────────────────────────────────────
typedef void* PhysWorld;

PhysWorld phys_world_create(float gravity_x, float gravity_y);
void phys_world_destroy(PhysWorld world);
void phys_world_step(PhysWorld world, float dt, int velocity_iters, int position_iters);

// ── Body ───────────────────────────────────────────────────────
typedef void* PhysBody;

// body_type: 0=static, 1=kinematic, 2=dynamic
PhysBody phys_body_create(PhysWorld world, int body_type, float x, float y, float angle);
void phys_body_destroy(PhysWorld world, PhysBody body);

float phys_body_get_x(PhysBody body);
float phys_body_get_y(PhysBody body);
float phys_body_get_angle(PhysBody body);

void phys_body_set_position(PhysBody body, float x, float y);
void phys_body_set_angle(PhysBody body, float angle);

void phys_body_set_linear_damping(PhysBody body, float damping);
void phys_body_set_angular_damping(PhysBody body, float damping);
void phys_body_set_fixed_rotation(PhysBody body, int fixed);
void phys_body_set_bullet(PhysBody body, int bullet);
void phys_body_set_gravity_scale(PhysBody body, float scale);

void phys_body_apply_force(PhysBody body, float fx, float fy);
void phys_body_apply_impulse(PhysBody body, float ix, float iy);
void phys_body_apply_torque(PhysBody body, float torque);

void phys_body_set_linear_velocity(PhysBody body, float vx, float vy);
float phys_body_get_linear_velocity_x(PhysBody body);
float phys_body_get_linear_velocity_y(PhysBody body);

// ── Collider (Fixture) ─────────────────────────────────────────
typedef void* PhysFixture;

PhysFixture phys_collider_box(PhysBody body, float half_w, float half_h,
                              float density, float friction, float restitution);
PhysFixture phys_collider_circle(PhysBody body, float radius,
                                 float density, float friction, float restitution);
void phys_collider_set_sensor(PhysFixture fixture, int is_sensor);

// ── Mouse Joint (drag interaction) ──────────────────────────────
typedef void* PhysJoint;

PhysJoint phys_mouse_joint_create(PhysWorld world, PhysBody body,
                                   float target_x, float target_y, float max_force);
void phys_mouse_joint_set_target(PhysJoint joint, float x, float y);
void phys_mouse_joint_destroy(PhysJoint joint);

// ── Query ───────────────────────────────────────────────────────
// Point query: returns the first dynamic body at (x, y), or NULL.
PhysBody phys_query_point(PhysWorld world, float x, float y);

#ifdef __cplusplus
}
#endif

#endif // PHYSICS_SHIM_H
