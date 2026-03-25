// physics3d_shim.h — C API wrapping Bullet Physics 3.25 for Zig @cImport
//
// Mirrors physics_shim.h (Box2D 2D) but for 3D rigid body dynamics.
// Provides: world create/destroy/step, rigid body create/destroy,
// collision shape create, body transform read/write, force/impulse apply.
// All pointers are opaque void* to avoid C++ types in the header.

#ifndef PHYSICS3D_SHIM_H
#define PHYSICS3D_SHIM_H

#ifdef __cplusplus
extern "C" {
#endif

// ── World ──────────────────────────────────────────────────────
typedef void* Phys3DWorld;

Phys3DWorld phys3d_world_create(float gravity_x, float gravity_y, float gravity_z);
void phys3d_world_destroy(Phys3DWorld world);
void phys3d_world_step(Phys3DWorld world, float dt, int max_substeps);

// ── Collision Shapes ───────────────────────────────────────────
typedef void* Phys3DShape;

Phys3DShape phys3d_shape_box(float half_x, float half_y, float half_z);
Phys3DShape phys3d_shape_sphere(float radius);
Phys3DShape phys3d_shape_cylinder(float half_x, float half_y, float half_z);
Phys3DShape phys3d_shape_capsule(float radius, float height);
Phys3DShape phys3d_shape_cone(float radius, float height);
Phys3DShape phys3d_shape_plane(float nx, float ny, float nz, float offset);
// Heightfield from float array — for terrain colliders
Phys3DShape phys3d_shape_heightfield(int width, int depth, const float* data,
                                      float min_height, float max_height);
void phys3d_shape_destroy(Phys3DShape shape);

// ── Rigid Body ─────────────────────────────────────────────────
typedef void* Phys3DBody;

// body_type: 0=static (mass=0), 1=kinematic, 2=dynamic
Phys3DBody phys3d_body_create(Phys3DWorld world, Phys3DShape shape, int body_type,
                               float mass, float x, float y, float z);
void phys3d_body_destroy(Phys3DWorld world, Phys3DBody body);

// ── Transform read ─────────────────────────────────────────────
float phys3d_body_get_x(Phys3DBody body);
float phys3d_body_get_y(Phys3DBody body);
float phys3d_body_get_z(Phys3DBody body);
// Quaternion rotation
void phys3d_body_get_rotation(Phys3DBody body, float* qx, float* qy, float* qz, float* qw);
// Euler angles (degrees) — convenience
void phys3d_body_get_euler(Phys3DBody body, float* rx, float* ry, float* rz);

// ── Transform write ────────────────────────────────────────────
void phys3d_body_set_position(Phys3DBody body, float x, float y, float z);
void phys3d_body_set_rotation(Phys3DBody body, float qx, float qy, float qz, float qw);
void phys3d_body_set_rotation_euler(Phys3DBody body, float rx, float ry, float rz);

// ── Dynamics ───────────────────────────────────────────────────
void phys3d_body_apply_force(Phys3DBody body, float fx, float fy, float fz);
void phys3d_body_apply_impulse(Phys3DBody body, float ix, float iy, float iz);
void phys3d_body_apply_torque(Phys3DBody body, float tx, float ty, float tz);
void phys3d_body_apply_torque_impulse(Phys3DBody body, float tx, float ty, float tz);

void phys3d_body_set_linear_velocity(Phys3DBody body, float vx, float vy, float vz);
void phys3d_body_get_linear_velocity(Phys3DBody body, float* vx, float* vy, float* vz);
void phys3d_body_set_angular_velocity(Phys3DBody body, float vx, float vy, float vz);

// ── Properties ─────────────────────────────────────────────────
void phys3d_body_set_friction(Phys3DBody body, float friction);
void phys3d_body_set_restitution(Phys3DBody body, float restitution);
void phys3d_body_set_damping(Phys3DBody body, float linear, float angular);
void phys3d_body_set_gravity(Phys3DBody body, float gx, float gy, float gz);
void phys3d_body_set_kinematic(Phys3DBody body);
void phys3d_body_set_activation_state(Phys3DBody body, int state);

// ── Raycast ────────────────────────────────────────────────────
// Returns 1 if hit, 0 if miss. Writes hit position and normal.
int phys3d_raycast(Phys3DWorld world,
                   float from_x, float from_y, float from_z,
                   float to_x, float to_y, float to_z,
                   float* hit_x, float* hit_y, float* hit_z,
                   float* normal_x, float* normal_y, float* normal_z);

#ifdef __cplusplus
}
#endif

#endif // PHYSICS3D_SHIM_H
