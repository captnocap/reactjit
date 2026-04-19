// physics3d_shim.cpp — Bullet Physics 3.25 C wrapper
//
// Mirrors physics_shim.cpp (Box2D 2D) pattern.
// Compile: g++ -c -O2 physics3d_shim.cpp -o physics3d_shim.o -I<bullet-include>
// Or via Zig build system as a C++ source file.

#include "physics3d_shim.h"
#include <btBulletDynamicsCommon.h>
#include <BulletCollision/CollisionShapes/btHeightfieldTerrainShape.h>
#include <cmath>

// ── World ──────────────────────────────────────────────────────

struct Phys3DWorldData {
    btDefaultCollisionConfiguration* config;
    btCollisionDispatcher* dispatcher;
    btBroadphaseInterface* broadphase;
    btSequentialImpulseConstraintSolver* solver;
    btDiscreteDynamicsWorld* world;
};

extern "C" Phys3DWorld phys3d_world_create(float gravity_x, float gravity_y, float gravity_z) {
    auto* data = new Phys3DWorldData;
    data->config = new btDefaultCollisionConfiguration();
    data->dispatcher = new btCollisionDispatcher(data->config);
    data->broadphase = new btDbvtBroadphase();
    data->solver = new btSequentialImpulseConstraintSolver();
    data->world = new btDiscreteDynamicsWorld(
        data->dispatcher, data->broadphase, data->solver, data->config);
    data->world->setGravity(btVector3(gravity_x, gravity_y, gravity_z));
    return static_cast<void*>(data);
}

extern "C" void phys3d_world_destroy(Phys3DWorld world) {
    auto* data = static_cast<Phys3DWorldData*>(world);
    // Remove all bodies
    for (int i = data->world->getNumCollisionObjects() - 1; i >= 0; i--) {
        btCollisionObject* obj = data->world->getCollisionObjectArray()[i];
        btRigidBody* body = btRigidBody::upcast(obj);
        if (body && body->getMotionState()) {
            delete body->getMotionState();
        }
        data->world->removeCollisionObject(obj);
        delete obj;
    }
    delete data->world;
    delete data->solver;
    delete data->broadphase;
    delete data->dispatcher;
    delete data->config;
    delete data;
}

extern "C" void phys3d_world_step(Phys3DWorld world, float dt, int max_substeps) {
    auto* data = static_cast<Phys3DWorldData*>(world);
    data->world->stepSimulation(dt, max_substeps, 1.0f / 60.0f);
}

// ── Collision Shapes ───────────────────────────────────────────

extern "C" Phys3DShape phys3d_shape_box(float half_x, float half_y, float half_z) {
    return static_cast<void*>(new btBoxShape(btVector3(half_x, half_y, half_z)));
}

extern "C" Phys3DShape phys3d_shape_sphere(float radius) {
    return static_cast<void*>(new btSphereShape(radius));
}

extern "C" Phys3DShape phys3d_shape_cylinder(float half_x, float half_y, float half_z) {
    return static_cast<void*>(new btCylinderShape(btVector3(half_x, half_y, half_z)));
}

extern "C" Phys3DShape phys3d_shape_capsule(float radius, float height) {
    return static_cast<void*>(new btCapsuleShape(radius, height));
}

extern "C" Phys3DShape phys3d_shape_cone(float radius, float height) {
    return static_cast<void*>(new btConeShape(radius, height));
}

extern "C" Phys3DShape phys3d_shape_plane(float nx, float ny, float nz, float offset) {
    return static_cast<void*>(new btStaticPlaneShape(btVector3(nx, ny, nz), offset));
}

extern "C" Phys3DShape phys3d_shape_heightfield(int width, int depth, const float* data,
                                                  float min_height, float max_height) {
    // Bullet owns a pointer to the data — caller must keep it alive
    auto* shape = new btHeightfieldTerrainShape(
        width, depth, data, 1.0f, min_height, max_height, 1, PHY_FLOAT, false);
    shape->setUseDiamondSubdivision(true);
    return static_cast<void*>(shape);
}

extern "C" void phys3d_shape_destroy(Phys3DShape shape) {
    delete static_cast<btCollisionShape*>(shape);
}

// ── Rigid Body ─────────────────────────────────────────────────

extern "C" Phys3DBody phys3d_body_create(Phys3DWorld world, Phys3DShape shape, int body_type,
                                          float mass, float x, float y, float z) {
    auto* data = static_cast<Phys3DWorldData*>(world);
    auto* col_shape = static_cast<btCollisionShape*>(shape);

    btTransform transform;
    transform.setIdentity();
    transform.setOrigin(btVector3(x, y, z));

    btScalar actual_mass = (body_type == 0) ? 0.0f : mass; // static = 0 mass
    btVector3 local_inertia(0, 0, 0);
    if (actual_mass > 0.0f) {
        col_shape->calculateLocalInertia(actual_mass, local_inertia);
    }

    auto* motion_state = new btDefaultMotionState(transform);
    btRigidBody::btRigidBodyConstructionInfo info(actual_mass, motion_state, col_shape, local_inertia);
    auto* body = new btRigidBody(info);

    if (body_type == 1) { // kinematic
        body->setCollisionFlags(body->getCollisionFlags() | btCollisionObject::CF_KINEMATIC_OBJECT);
        body->setActivationState(DISABLE_DEACTIVATION);
    }

    data->world->addRigidBody(body);
    return static_cast<void*>(body);
}

extern "C" void phys3d_body_destroy(Phys3DWorld world, Phys3DBody body) {
    auto* data = static_cast<Phys3DWorldData*>(world);
    auto* rb = static_cast<btRigidBody*>(body);
    if (rb->getMotionState()) {
        delete rb->getMotionState();
    }
    data->world->removeRigidBody(rb);
    delete rb;
}

// ── Transform read ─────────────────────────────────────────────

static btTransform getBodyTransform(Phys3DBody body) {
    auto* rb = static_cast<btRigidBody*>(body);
    btTransform trans;
    if (rb->getMotionState()) {
        rb->getMotionState()->getWorldTransform(trans);
    } else {
        trans = rb->getWorldTransform();
    }
    return trans;
}

extern "C" float phys3d_body_get_x(Phys3DBody body) {
    return getBodyTransform(body).getOrigin().getX();
}

extern "C" float phys3d_body_get_y(Phys3DBody body) {
    return getBodyTransform(body).getOrigin().getY();
}

extern "C" float phys3d_body_get_z(Phys3DBody body) {
    return getBodyTransform(body).getOrigin().getZ();
}

extern "C" void phys3d_body_get_rotation(Phys3DBody body, float* qx, float* qy, float* qz, float* qw) {
    btQuaternion q = getBodyTransform(body).getRotation();
    *qx = q.getX();
    *qy = q.getY();
    *qz = q.getZ();
    *qw = q.getW();
}

extern "C" void phys3d_body_get_euler(Phys3DBody body, float* rx, float* ry, float* rz) {
    btTransform trans = getBodyTransform(body);
    btScalar yaw, pitch, roll;
    trans.getBasis().getEulerYPR(yaw, pitch, roll);
    *rx = roll * 180.0f / SIMD_PI;
    *ry = yaw * 180.0f / SIMD_PI;
    *rz = pitch * 180.0f / SIMD_PI;
}

// ── Transform write ────────────────────────────────────────────

extern "C" void phys3d_body_set_position(Phys3DBody body, float x, float y, float z) {
    auto* rb = static_cast<btRigidBody*>(body);
    btTransform trans = rb->getWorldTransform();
    trans.setOrigin(btVector3(x, y, z));
    rb->setWorldTransform(trans);
    if (rb->getMotionState()) {
        rb->getMotionState()->setWorldTransform(trans);
    }
}

extern "C" void phys3d_body_set_rotation(Phys3DBody body, float qx, float qy, float qz, float qw) {
    auto* rb = static_cast<btRigidBody*>(body);
    btTransform trans = rb->getWorldTransform();
    trans.setRotation(btQuaternion(qx, qy, qz, qw));
    rb->setWorldTransform(trans);
    if (rb->getMotionState()) {
        rb->getMotionState()->setWorldTransform(trans);
    }
}

extern "C" void phys3d_body_set_rotation_euler(Phys3DBody body, float rx, float ry, float rz) {
    btQuaternion q;
    q.setEulerZYX(rz * SIMD_PI / 180.0f, ry * SIMD_PI / 180.0f, rx * SIMD_PI / 180.0f);
    phys3d_body_set_rotation(body, q.getX(), q.getY(), q.getZ(), q.getW());
}

// ── Dynamics ───────────────────────────────────────────────────

extern "C" void phys3d_body_apply_force(Phys3DBody body, float fx, float fy, float fz) {
    auto* rb = static_cast<btRigidBody*>(body);
    rb->activate(true);
    rb->applyCentralForce(btVector3(fx, fy, fz));
}

extern "C" void phys3d_body_apply_impulse(Phys3DBody body, float ix, float iy, float iz) {
    auto* rb = static_cast<btRigidBody*>(body);
    rb->activate(true);
    rb->applyCentralImpulse(btVector3(ix, iy, iz));
}

extern "C" void phys3d_body_apply_torque(Phys3DBody body, float tx, float ty, float tz) {
    auto* rb = static_cast<btRigidBody*>(body);
    rb->activate(true);
    rb->applyTorque(btVector3(tx, ty, tz));
}

extern "C" void phys3d_body_apply_torque_impulse(Phys3DBody body, float tx, float ty, float tz) {
    auto* rb = static_cast<btRigidBody*>(body);
    rb->activate(true);
    rb->applyTorqueImpulse(btVector3(tx, ty, tz));
}

extern "C" void phys3d_body_set_linear_velocity(Phys3DBody body, float vx, float vy, float vz) {
    auto* rb = static_cast<btRigidBody*>(body);
    rb->activate(true);
    rb->setLinearVelocity(btVector3(vx, vy, vz));
}

extern "C" void phys3d_body_get_linear_velocity(Phys3DBody body, float* vx, float* vy, float* vz) {
    auto* rb = static_cast<btRigidBody*>(body);
    const btVector3& v = rb->getLinearVelocity();
    *vx = v.getX();
    *vy = v.getY();
    *vz = v.getZ();
}

extern "C" void phys3d_body_set_angular_velocity(Phys3DBody body, float vx, float vy, float vz) {
    auto* rb = static_cast<btRigidBody*>(body);
    rb->activate(true);
    rb->setAngularVelocity(btVector3(vx, vy, vz));
}

// ── Properties ─────────────────────────────────────────────────

extern "C" void phys3d_body_set_friction(Phys3DBody body, float friction) {
    static_cast<btRigidBody*>(body)->setFriction(friction);
}

extern "C" void phys3d_body_set_restitution(Phys3DBody body, float restitution) {
    static_cast<btRigidBody*>(body)->setRestitution(restitution);
}

extern "C" void phys3d_body_set_damping(Phys3DBody body, float linear, float angular) {
    static_cast<btRigidBody*>(body)->setDamping(linear, angular);
}

extern "C" void phys3d_body_set_gravity(Phys3DBody body, float gx, float gy, float gz) {
    static_cast<btRigidBody*>(body)->setGravity(btVector3(gx, gy, gz));
}

extern "C" void phys3d_body_set_kinematic(Phys3DBody body) {
    auto* rb = static_cast<btRigidBody*>(body);
    rb->setCollisionFlags(rb->getCollisionFlags() | btCollisionObject::CF_KINEMATIC_OBJECT);
    rb->setActivationState(DISABLE_DEACTIVATION);
}

extern "C" void phys3d_body_set_activation_state(Phys3DBody body, int state) {
    static_cast<btRigidBody*>(body)->setActivationState(state);
}

// ── Raycast ────────────────────────────────────────────────────

extern "C" int phys3d_raycast(Phys3DWorld world,
                               float from_x, float from_y, float from_z,
                               float to_x, float to_y, float to_z,
                               float* hit_x, float* hit_y, float* hit_z,
                               float* normal_x, float* normal_y, float* normal_z) {
    auto* data = static_cast<Phys3DWorldData*>(world);
    btVector3 from(from_x, from_y, from_z);
    btVector3 to(to_x, to_y, to_z);
    btCollisionWorld::ClosestRayResultCallback result(from, to);
    data->world->rayTest(from, to, result);
    if (result.hasHit()) {
        *hit_x = result.m_hitPointWorld.getX();
        *hit_y = result.m_hitPointWorld.getY();
        *hit_z = result.m_hitPointWorld.getZ();
        *normal_x = result.m_hitNormalWorld.getX();
        *normal_y = result.m_hitNormalWorld.getY();
        *normal_z = result.m_hitNormalWorld.getZ();
        return 1;
    }
    return 0;
}
