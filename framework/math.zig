//! math.zig — Complete math library for the tsz framework
//!
//! Full port of love2d/lua/math_utils.lua. All 10 modules:
//! vec2, vec3, vec4, mat4, quat, bbox, geo, interp, noise, bezier
//!
//! Zero allocations. All value types. Pure math.

const std = @import("std");

pub const EPSILON: f32 = 1e-6;
const pi: f32 = std.math.pi;

// ============================================================================
// Vec2
// ============================================================================

pub const Vec2 = struct {
    x: f32 = 0,
    y: f32 = 0,
};

pub fn v2(x: f32, y: f32) Vec2 {
    return .{ .x = x, .y = y };
}

pub fn v2zero() Vec2 {
    return .{ .x = 0, .y = 0 };
}

pub fn v2one() Vec2 {
    return .{ .x = 1, .y = 1 };
}

pub fn v2add(a: Vec2, b: Vec2) Vec2 {
    return .{ .x = a.x + b.x, .y = a.y + b.y };
}

pub fn v2sub(a: Vec2, b: Vec2) Vec2 {
    return .{ .x = a.x - b.x, .y = a.y - b.y };
}

pub fn v2mul(a: Vec2, b: Vec2) Vec2 {
    return .{ .x = a.x * b.x, .y = a.y * b.y };
}

pub fn v2div(a: Vec2, b: Vec2) Vec2 {
    return .{ .x = a.x / b.x, .y = a.y / b.y };
}

pub fn v2scale(v: Vec2, s: f32) Vec2 {
    return .{ .x = v.x * s, .y = v.y * s };
}

pub fn v2negate(v: Vec2) Vec2 {
    return .{ .x = -v.x, .y = -v.y };
}

pub fn v2dot(a: Vec2, b: Vec2) f32 {
    return a.x * b.x + a.y * b.y;
}

pub fn v2cross(a: Vec2, b: Vec2) f32 {
    return a.x * b.y - a.y * b.x;
}

pub fn v2length(v: Vec2) f32 {
    return @sqrt(v.x * v.x + v.y * v.y);
}

pub fn v2lengthSq(v: Vec2) f32 {
    return v.x * v.x + v.y * v.y;
}

pub fn v2distance(a: Vec2, b: Vec2) f32 {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return @sqrt(dx * dx + dy * dy);
}

pub fn v2distanceSq(a: Vec2, b: Vec2) f32 {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return dx * dx + dy * dy;
}

pub fn v2normalize(v: Vec2) Vec2 {
    const len = @sqrt(v.x * v.x + v.y * v.y);
    if (len > EPSILON) return .{ .x = v.x / len, .y = v.y / len };
    return .{ .x = 0, .y = 0 };
}

pub fn v2abs(v: Vec2) Vec2 {
    return .{ .x = @abs(v.x), .y = @abs(v.y) };
}

pub fn v2floor(v: Vec2) Vec2 {
    return .{ .x = @floor(v.x), .y = @floor(v.y) };
}

pub fn v2ceil(v: Vec2) Vec2 {
    return .{ .x = @ceil(v.x), .y = @ceil(v.y) };
}

pub fn v2round(v: Vec2) Vec2 {
    return .{ .x = @round(v.x), .y = @round(v.y) };
}

pub fn v2min(a: Vec2, b: Vec2) Vec2 {
    return .{ .x = @min(a.x, b.x), .y = @min(a.y, b.y) };
}

pub fn v2max(a: Vec2, b: Vec2) Vec2 {
    return .{ .x = @max(a.x, b.x), .y = @max(a.y, b.y) };
}

pub fn v2clamp(v: Vec2, lo: Vec2, hi: Vec2) Vec2 {
    return .{
        .x = std.math.clamp(v.x, lo.x, hi.x),
        .y = std.math.clamp(v.y, lo.y, hi.y),
    };
}

pub fn v2lerp(a: Vec2, b: Vec2, t: f32) Vec2 {
    return .{
        .x = a.x + (b.x - a.x) * t,
        .y = a.y + (b.y - a.y) * t,
    };
}

pub fn v2smoothstep(a: Vec2, b: Vec2, t: f32) Vec2 {
    const s = t * t * (3 - 2 * t);
    return .{
        .x = a.x + (b.x - a.x) * s,
        .y = a.y + (b.y - a.y) * s,
    };
}

pub fn v2angle(v: Vec2) f32 {
    return std.math.atan2(v.y, v.x);
}

pub fn v2fromAngle(radians: f32) Vec2 {
    return .{ .x = @cos(radians), .y = @sin(radians) };
}

pub fn v2rotate(v: Vec2, radians: f32) Vec2 {
    const c = @cos(radians);
    const s = @sin(radians);
    return .{ .x = v.x * c - v.y * s, .y = v.x * s + v.y * c };
}

pub fn v2equals(a: Vec2, b: Vec2) bool {
    return a.x == b.x and a.y == b.y;
}

pub fn v2almostEquals(a: Vec2, b: Vec2, eps: f32) bool {
    return @abs(a.x - b.x) < eps and @abs(a.y - b.y) < eps;
}

// ============================================================================
// Vec3
// ============================================================================

pub const Vec3 = struct {
    x: f32 = 0,
    y: f32 = 0,
    z: f32 = 0,
};

pub fn v3(x: f32, y: f32, z: f32) Vec3 {
    return .{ .x = x, .y = y, .z = z };
}

pub fn v3zero() Vec3 {
    return .{ .x = 0, .y = 0, .z = 0 };
}

pub fn v3one() Vec3 {
    return .{ .x = 1, .y = 1, .z = 1 };
}

pub fn v3up() Vec3 {
    return .{ .x = 0, .y = 1, .z = 0 };
}

pub fn v3forward() Vec3 {
    return .{ .x = 0, .y = 0, .z = -1 };
}

pub fn v3right() Vec3 {
    return .{ .x = 1, .y = 0, .z = 0 };
}

pub fn v3add(a: Vec3, b: Vec3) Vec3 {
    return .{ .x = a.x + b.x, .y = a.y + b.y, .z = a.z + b.z };
}

pub fn v3sub(a: Vec3, b: Vec3) Vec3 {
    return .{ .x = a.x - b.x, .y = a.y - b.y, .z = a.z - b.z };
}

pub fn v3mul(a: Vec3, b: Vec3) Vec3 {
    return .{ .x = a.x * b.x, .y = a.y * b.y, .z = a.z * b.z };
}

pub fn v3div(a: Vec3, b: Vec3) Vec3 {
    return .{ .x = a.x / b.x, .y = a.y / b.y, .z = a.z / b.z };
}

pub fn v3scale(v: Vec3, s: f32) Vec3 {
    return .{ .x = v.x * s, .y = v.y * s, .z = v.z * s };
}

pub fn v3negate(v: Vec3) Vec3 {
    return .{ .x = -v.x, .y = -v.y, .z = -v.z };
}

pub fn v3dot(a: Vec3, b: Vec3) f32 {
    return a.x * b.x + a.y * b.y + a.z * b.z;
}

pub fn v3cross(a: Vec3, b: Vec3) Vec3 {
    return .{
        .x = a.y * b.z - a.z * b.y,
        .y = a.z * b.x - a.x * b.z,
        .z = a.x * b.y - a.y * b.x,
    };
}

pub fn v3length(v: Vec3) f32 {
    return @sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
}

pub fn v3lengthSq(v: Vec3) f32 {
    return v.x * v.x + v.y * v.y + v.z * v.z;
}

pub fn v3distance(a: Vec3, b: Vec3) f32 {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    const dz = a.z - b.z;
    return @sqrt(dx * dx + dy * dy + dz * dz);
}

pub fn v3distanceSq(a: Vec3, b: Vec3) f32 {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    const dz = a.z - b.z;
    return dx * dx + dy * dy + dz * dz;
}

pub fn v3normalize(v: Vec3) Vec3 {
    const len = @sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
    if (len > EPSILON) return .{ .x = v.x / len, .y = v.y / len, .z = v.z / len };
    return .{ .x = 0, .y = 0, .z = 0 };
}

pub fn v3abs(v: Vec3) Vec3 {
    return .{ .x = @abs(v.x), .y = @abs(v.y), .z = @abs(v.z) };
}

pub fn v3floor(v: Vec3) Vec3 {
    return .{ .x = @floor(v.x), .y = @floor(v.y), .z = @floor(v.z) };
}

pub fn v3ceil(v: Vec3) Vec3 {
    return .{ .x = @ceil(v.x), .y = @ceil(v.y), .z = @ceil(v.z) };
}

pub fn v3round(v: Vec3) Vec3 {
    return .{ .x = @round(v.x), .y = @round(v.y), .z = @round(v.z) };
}

pub fn v3min(a: Vec3, b: Vec3) Vec3 {
    return .{ .x = @min(a.x, b.x), .y = @min(a.y, b.y), .z = @min(a.z, b.z) };
}

pub fn v3max(a: Vec3, b: Vec3) Vec3 {
    return .{ .x = @max(a.x, b.x), .y = @max(a.y, b.y), .z = @max(a.z, b.z) };
}

pub fn v3clamp(v: Vec3, lo: Vec3, hi: Vec3) Vec3 {
    return .{
        .x = std.math.clamp(v.x, lo.x, hi.x),
        .y = std.math.clamp(v.y, lo.y, hi.y),
        .z = std.math.clamp(v.z, lo.z, hi.z),
    };
}

pub fn v3lerp(a: Vec3, b: Vec3, t: f32) Vec3 {
    return .{
        .x = a.x + (b.x - a.x) * t,
        .y = a.y + (b.y - a.y) * t,
        .z = a.z + (b.z - a.z) * t,
    };
}

pub fn v3smoothstep(a: Vec3, b: Vec3, t: f32) Vec3 {
    const s = t * t * (3 - 2 * t);
    return .{
        .x = a.x + (b.x - a.x) * s,
        .y = a.y + (b.y - a.y) * s,
        .z = a.z + (b.z - a.z) * s,
    };
}

pub fn v3reflect(v: Vec3, normal: Vec3) Vec3 {
    const d = 2 * v3dot(v, normal);
    return .{
        .x = v.x - d * normal.x,
        .y = v.y - d * normal.y,
        .z = v.z - d * normal.z,
    };
}

pub fn v3slerp(a: Vec3, b: Vec3, t: f32) Vec3 {
    var d = v3dot(a, b);
    d = @max(-1.0, @min(1.0, d));
    const theta = std.math.acos(d) * t;
    const rel = v3normalize(v3sub(b, v3scale(a, d)));
    return v3add(v3scale(a, @cos(theta)), v3scale(rel, @sin(theta)));
}

pub fn v3equals(a: Vec3, b: Vec3) bool {
    return a.x == b.x and a.y == b.y and a.z == b.z;
}

pub fn v3almostEquals(a: Vec3, b: Vec3, eps: f32) bool {
    return @abs(a.x - b.x) < eps and @abs(a.y - b.y) < eps and @abs(a.z - b.z) < eps;
}

// ============================================================================
// Vec4
// ============================================================================

pub const Vec4 = struct {
    x: f32 = 0,
    y: f32 = 0,
    z: f32 = 0,
    w: f32 = 0,
};

pub fn v4(x: f32, y: f32, z: f32, w: f32) Vec4 {
    return .{ .x = x, .y = y, .z = z, .w = w };
}

pub fn v4zero() Vec4 {
    return .{ .x = 0, .y = 0, .z = 0, .w = 0 };
}

pub fn v4one() Vec4 {
    return .{ .x = 1, .y = 1, .z = 1, .w = 1 };
}

pub fn v4add(a: Vec4, b: Vec4) Vec4 {
    return .{ .x = a.x + b.x, .y = a.y + b.y, .z = a.z + b.z, .w = a.w + b.w };
}

pub fn v4sub(a: Vec4, b: Vec4) Vec4 {
    return .{ .x = a.x - b.x, .y = a.y - b.y, .z = a.z - b.z, .w = a.w - b.w };
}

pub fn v4mul(a: Vec4, b: Vec4) Vec4 {
    return .{ .x = a.x * b.x, .y = a.y * b.y, .z = a.z * b.z, .w = a.w * b.w };
}

pub fn v4div(a: Vec4, b: Vec4) Vec4 {
    return .{ .x = a.x / b.x, .y = a.y / b.y, .z = a.z / b.z, .w = a.w / b.w };
}

pub fn v4scale(v: Vec4, s: f32) Vec4 {
    return .{ .x = v.x * s, .y = v.y * s, .z = v.z * s, .w = v.w * s };
}

pub fn v4negate(v: Vec4) Vec4 {
    return .{ .x = -v.x, .y = -v.y, .z = -v.z, .w = -v.w };
}

pub fn v4dot(a: Vec4, b: Vec4) f32 {
    return a.x * b.x + a.y * b.y + a.z * b.z + a.w * b.w;
}

pub fn v4length(v: Vec4) f32 {
    return @sqrt(v.x * v.x + v.y * v.y + v.z * v.z + v.w * v.w);
}

pub fn v4lengthSq(v: Vec4) f32 {
    return v.x * v.x + v.y * v.y + v.z * v.z + v.w * v.w;
}

pub fn v4normalize(v: Vec4) Vec4 {
    const len = @sqrt(v.x * v.x + v.y * v.y + v.z * v.z + v.w * v.w);
    if (len > EPSILON) return .{ .x = v.x / len, .y = v.y / len, .z = v.z / len, .w = v.w / len };
    return .{ .x = 0, .y = 0, .z = 0, .w = 0 };
}

pub fn v4lerp(a: Vec4, b: Vec4, t: f32) Vec4 {
    return .{
        .x = a.x + (b.x - a.x) * t,
        .y = a.y + (b.y - a.y) * t,
        .z = a.z + (b.z - a.z) * t,
        .w = a.w + (b.w - a.w) * t,
    };
}

pub fn v4min(a: Vec4, b: Vec4) Vec4 {
    return .{ .x = @min(a.x, b.x), .y = @min(a.y, b.y), .z = @min(a.z, b.z), .w = @min(a.w, b.w) };
}

pub fn v4max(a: Vec4, b: Vec4) Vec4 {
    return .{ .x = @max(a.x, b.x), .y = @max(a.y, b.y), .z = @max(a.z, b.z), .w = @max(a.w, b.w) };
}

pub fn v4clamp(v: Vec4, lo: Vec4, hi: Vec4) Vec4 {
    return .{
        .x = std.math.clamp(v.x, lo.x, hi.x),
        .y = std.math.clamp(v.y, lo.y, hi.y),
        .z = std.math.clamp(v.z, lo.z, hi.z),
        .w = std.math.clamp(v.w, lo.w, hi.w),
    };
}

pub fn v4equals(a: Vec4, b: Vec4) bool {
    return a.x == b.x and a.y == b.y and a.z == b.z and a.w == b.w;
}

pub fn v4almostEquals(a: Vec4, b: Vec4, eps: f32) bool {
    return @abs(a.x - b.x) < eps and @abs(a.y - b.y) < eps and @abs(a.z - b.z) < eps and @abs(a.w - b.w) < eps;
}

// ============================================================================
// Mat4 (column-major [16]f32, 0-indexed)
// ============================================================================
//
// Layout (column-major, matching the Lua source):
//   [0]  [1]  [2]  [3]     <- row 0
//   [4]  [5]  [6]  [7]     <- row 1
//   [8]  [9]  [10] [11]    <- row 2
//   [12] [13] [14] [15]    <- row 3

pub const Mat4 = [16]f32;

pub const Decomposed = struct {
    translation: Vec3 = .{},
    rotation: Quat = .{},
    scale: Vec3 = .{},
};

pub fn m4identity() Mat4 {
    return .{ 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1 };
}

pub fn m4multiply(a: Mat4, b: Mat4) Mat4 {
    // Lua uses 1-indexed: a[1]→a[0], a[5]→a[4], etc.
    return .{
        a[0] * b[0] + a[1] * b[4] + a[2] * b[8] + a[3] * b[12],
        a[0] * b[1] + a[1] * b[5] + a[2] * b[9] + a[3] * b[13],
        a[0] * b[2] + a[1] * b[6] + a[2] * b[10] + a[3] * b[14],
        a[0] * b[3] + a[1] * b[7] + a[2] * b[11] + a[3] * b[15],
        a[4] * b[0] + a[5] * b[4] + a[6] * b[8] + a[7] * b[12],
        a[4] * b[1] + a[5] * b[5] + a[6] * b[9] + a[7] * b[13],
        a[4] * b[2] + a[5] * b[6] + a[6] * b[10] + a[7] * b[14],
        a[4] * b[3] + a[5] * b[7] + a[6] * b[11] + a[7] * b[15],
        a[8] * b[0] + a[9] * b[4] + a[10] * b[8] + a[11] * b[12],
        a[8] * b[1] + a[9] * b[5] + a[10] * b[9] + a[11] * b[13],
        a[8] * b[2] + a[9] * b[6] + a[10] * b[10] + a[11] * b[14],
        a[8] * b[3] + a[9] * b[7] + a[10] * b[11] + a[11] * b[15],
        a[12] * b[0] + a[13] * b[4] + a[14] * b[8] + a[15] * b[12],
        a[12] * b[1] + a[13] * b[5] + a[14] * b[9] + a[15] * b[13],
        a[12] * b[2] + a[13] * b[6] + a[14] * b[10] + a[15] * b[14],
        a[12] * b[3] + a[13] * b[7] + a[14] * b[11] + a[15] * b[15],
    };
}

pub fn m4transpose(m: Mat4) Mat4 {
    return .{
        m[0], m[4], m[8],  m[12],
        m[1], m[5], m[9],  m[13],
        m[2], m[6], m[10], m[14],
        m[3], m[7], m[11], m[15],
    };
}

pub fn m4determinant(m: Mat4) f32 {
    const b0 = m[0] * m[5] - m[1] * m[4];
    const b1 = m[0] * m[6] - m[2] * m[4];
    const b2 = m[0] * m[7] - m[3] * m[4];
    const b3 = m[1] * m[6] - m[2] * m[5];
    const b4 = m[1] * m[7] - m[3] * m[5];
    const b5 = m[2] * m[7] - m[3] * m[6];
    const b6 = m[8] * m[13] - m[9] * m[12];
    const b7 = m[8] * m[14] - m[10] * m[12];
    const b8 = m[8] * m[15] - m[11] * m[12];
    const b9 = m[9] * m[14] - m[10] * m[13];
    const b10 = m[9] * m[15] - m[11] * m[13];
    const b11 = m[10] * m[15] - m[11] * m[14];
    return b0 * b11 - b1 * b10 + b2 * b9 + b3 * b8 - b4 * b7 + b5 * b6;
}

pub fn m4invert(m: Mat4) ?Mat4 {
    const a0 = m[0];
    const a1 = m[1];
    const a2 = m[2];
    const a3 = m[3];
    const a4 = m[4];
    const a5 = m[5];
    const a6 = m[6];
    const a7 = m[7];
    const a8 = m[8];
    const a9 = m[9];
    const a10 = m[10];
    const a11 = m[11];
    const a12 = m[12];
    const a13 = m[13];
    const a14 = m[14];
    const a15 = m[15];

    const b0 = a0 * a5 - a1 * a4;
    const b1 = a0 * a6 - a2 * a4;
    const b2 = a0 * a7 - a3 * a4;
    const b3 = a1 * a6 - a2 * a5;
    const b4 = a1 * a7 - a3 * a5;
    const b5 = a2 * a7 - a3 * a6;
    const b6 = a8 * a13 - a9 * a12;
    const b7 = a8 * a14 - a10 * a12;
    const b8 = a8 * a15 - a11 * a12;
    const b9 = a9 * a14 - a10 * a13;
    const b10 = a9 * a15 - a11 * a13;
    const b11 = a10 * a15 - a11 * a14;

    const det = b0 * b11 - b1 * b10 + b2 * b9 + b3 * b8 - b4 * b7 + b5 * b6;
    if (@abs(det) < EPSILON) return null;
    const inv = 1.0 / det;

    return .{
        (a5 * b11 - a6 * b10 + a7 * b9) * inv,
        (-a1 * b11 + a2 * b10 - a3 * b9) * inv,
        (a13 * b5 - a14 * b4 + a15 * b3) * inv,
        (-a9 * b5 + a10 * b4 - a11 * b3) * inv,
        (-a4 * b11 + a6 * b8 - a7 * b7) * inv,
        (a0 * b11 - a2 * b8 + a3 * b7) * inv,
        (-a12 * b5 + a14 * b2 - a15 * b1) * inv,
        (a8 * b5 - a10 * b2 + a11 * b1) * inv,
        (a4 * b10 - a5 * b8 + a7 * b6) * inv,
        (-a0 * b10 + a1 * b8 - a3 * b6) * inv,
        (a12 * b4 - a13 * b2 + a15 * b0) * inv,
        (-a8 * b4 + a9 * b2 - a11 * b0) * inv,
        (-a4 * b9 + a5 * b7 - a6 * b6) * inv,
        (a0 * b9 - a1 * b7 + a2 * b6) * inv,
        (-a12 * b3 + a13 * b1 - a14 * b0) * inv,
        (a8 * b3 - a9 * b1 + a10 * b0) * inv,
    };
}

pub fn m4translate(m: Mat4, v: Vec3) Mat4 {
    const x = v.x;
    const y = v.y;
    const z = v.z;
    var out = m;
    out[3] = m[0] * x + m[1] * y + m[2] * z + m[3];
    out[7] = m[4] * x + m[5] * y + m[6] * z + m[7];
    out[11] = m[8] * x + m[9] * y + m[10] * z + m[11];
    out[15] = m[12] * x + m[13] * y + m[14] * z + m[15];
    return out;
}

pub fn m4scale(m: Mat4, v: Vec3) Mat4 {
    const sx = v.x;
    const sy = v.y;
    const sz = v.z;
    return .{
        m[0] * sx,  m[1] * sy,  m[2] * sz,  m[3],
        m[4] * sx,  m[5] * sy,  m[6] * sz,  m[7],
        m[8] * sx,  m[9] * sy,  m[10] * sz, m[11],
        m[12] * sx, m[13] * sy, m[14] * sz, m[15],
    };
}

pub fn m4rotateX(m: Mat4, radians: f32) Mat4 {
    const c = @cos(radians);
    const s = @sin(radians);
    const rot = Mat4{ 1, 0, 0, 0, 0, c, -s, 0, 0, s, c, 0, 0, 0, 0, 1 };
    return m4multiply(m, rot);
}

pub fn m4rotateY(m: Mat4, radians: f32) Mat4 {
    const c = @cos(radians);
    const s = @sin(radians);
    const rot = Mat4{ c, 0, s, 0, 0, 1, 0, 0, -s, 0, c, 0, 0, 0, 0, 1 };
    return m4multiply(m, rot);
}

pub fn m4rotateZ(m: Mat4, radians: f32) Mat4 {
    const c = @cos(radians);
    const s = @sin(radians);
    const rot = Mat4{ c, -s, 0, 0, s, c, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1 };
    return m4multiply(m, rot);
}

pub fn m4lookAt(eye: Vec3, target: Vec3, up: Vec3) Mat4 {
    var fx = eye.x - target.x;
    var fy = eye.y - target.y;
    var fz = eye.z - target.z;
    var len = @sqrt(fx * fx + fy * fy + fz * fz);
    if (len > EPSILON) {
        fx /= len;
        fy /= len;
        fz /= len;
    }
    var sx = up.y * fz - up.z * fy;
    var sy = up.z * fx - up.x * fz;
    var sz = up.x * fy - up.y * fx;
    len = @sqrt(sx * sx + sy * sy + sz * sz);
    if (len > EPSILON) {
        sx /= len;
        sy /= len;
        sz /= len;
    }
    const ux = fy * sz - fz * sy;
    const uy = fz * sx - fx * sz;
    const uz = fx * sy - fy * sx;
    return .{
        sx, sy, sz, -(sx * eye.x + sy * eye.y + sz * eye.z),
        ux, uy, uz, -(ux * eye.x + uy * eye.y + uz * eye.z),
        fx, fy, fz, -(fx * eye.x + fy * eye.y + fz * eye.z),
        0,  0,  0,  1,
    };
}

pub fn m4perspective(fovRadians: f32, aspect: f32, near: f32, far: f32) Mat4 {
    const f = 1.0 / @tan(fovRadians / 2.0);
    const ri = 1.0 / (near - far);
    return .{
        f / aspect, 0, 0,                0,
        0,          f, 0,                0,
        0,          0, (near + far) * ri, 2 * near * far * ri,
        0,          0, -1,               0,
    };
}

pub fn m4ortho(left: f32, right: f32, bottom: f32, top: f32, near: f32, far: f32) Mat4 {
    const rl = 1.0 / (right - left);
    const tb = 1.0 / (top - bottom);
    const nf = 1.0 / (near - far);
    return .{
        2 * rl, 0,      0,      -(right + left) * rl,
        0,      2 * tb, 0,      -(top + bottom) * tb,
        0,      0,      2 * nf, (far + near) * nf,
        0,      0,      0,      1,
    };
}

pub fn m4transformPoint(m: Mat4, v: Vec3) Vec3 {
    const w = m[12] * v.x + m[13] * v.y + m[14] * v.z + m[15];
    const invW = if (@abs(w) > EPSILON) 1.0 / w else 1.0;
    return .{
        .x = (m[0] * v.x + m[1] * v.y + m[2] * v.z + m[3]) * invW,
        .y = (m[4] * v.x + m[5] * v.y + m[6] * v.z + m[7]) * invW,
        .z = (m[8] * v.x + m[9] * v.y + m[10] * v.z + m[11]) * invW,
    };
}

pub fn m4transformDir(m: Mat4, v: Vec3) Vec3 {
    return .{
        .x = m[0] * v.x + m[1] * v.y + m[2] * v.z,
        .y = m[4] * v.x + m[5] * v.y + m[6] * v.z,
        .z = m[8] * v.x + m[9] * v.y + m[10] * v.z,
    };
}

pub fn m4fromQuat(q: Quat) Mat4 {
    const qx = q.x;
    const qy = q.y;
    const qz = q.z;
    const qw = q.w;
    const x2 = qx + qx;
    const y2 = qy + qy;
    const z2 = qz + qz;
    const xx = qx * x2;
    const xy = qx * y2;
    const xz = qx * z2;
    const yy = qy * y2;
    const yz = qy * z2;
    const zz = qz * z2;
    const wx = qw * x2;
    const wy = qw * y2;
    const wz = qw * z2;
    return .{
        1 - yy - zz, xy - wz,     xz + wy,     0,
        xy + wz,     1 - xx - zz, yz - wx,     0,
        xz - wy,     yz + wx,     1 - xx - yy, 0,
        0,            0,            0,            1,
    };
}

pub fn m4fromEuler(x: f32, y: f32, z: f32) Mat4 {
    const cx = @cos(x);
    const sx = @sin(x);
    const cy = @cos(y);
    const sy = @sin(y);
    const cz = @cos(z);
    const sz = @sin(z);
    return .{
        cy * cz,             cy * sz * sx - sy * cx, cy * sz * cx + sy * sx, 0,
        sy * cz,             sy * sz * sx + cy * cx, sy * sz * cx - cy * sx, 0,
        -sz,                 cz * sx,                cz * cx,                0,
        0,                   0,                      0,                      1,
    };
}

pub fn m4decompose(m: Mat4) Decomposed {
    const sx = @sqrt(m[0] * m[0] + m[4] * m[4] + m[8] * m[8]);
    const sy = @sqrt(m[1] * m[1] + m[5] * m[5] + m[9] * m[9]);
    const sz = @sqrt(m[2] * m[2] + m[6] * m[6] + m[10] * m[10]);
    const isx = if (sx > EPSILON) 1.0 / sx else 0.0;
    const isy = if (sy > EPSILON) 1.0 / sy else 0.0;
    const isz = if (sz > EPSILON) 1.0 / sz else 0.0;
    const r00 = m[0] * isx;
    const r01 = m[1] * isy;
    const r02 = m[2] * isz;
    const r10 = m[4] * isx;
    const r11 = m[5] * isy;
    const r12 = m[6] * isz;
    const r20 = m[8] * isx;
    const r21 = m[9] * isy;
    const r22 = m[10] * isz;
    const trace = r00 + r11 + r22;

    var qx: f32 = undefined;
    var qy: f32 = undefined;
    var qz: f32 = undefined;
    var qw: f32 = undefined;

    if (trace > 0) {
        const s = 0.5 / @sqrt(trace + 1);
        qw = 0.25 / s;
        qx = (r21 - r12) * s;
        qy = (r02 - r20) * s;
        qz = (r10 - r01) * s;
    } else if (r00 > r11 and r00 > r22) {
        const s = 2 * @sqrt(1 + r00 - r11 - r22);
        qw = (r21 - r12) / s;
        qx = 0.25 * s;
        qy = (r01 + r10) / s;
        qz = (r02 + r20) / s;
    } else if (r11 > r22) {
        const s = 2 * @sqrt(1 + r11 - r00 - r22);
        qw = (r02 - r20) / s;
        qx = (r01 + r10) / s;
        qy = 0.25 * s;
        qz = (r12 + r21) / s;
    } else {
        const s = 2 * @sqrt(1 + r22 - r00 - r11);
        qw = (r10 - r01) / s;
        qx = (r02 + r20) / s;
        qy = (r12 + r21) / s;
        qz = 0.25 * s;
    }

    return .{
        .translation = .{ .x = m[3], .y = m[7], .z = m[11] },
        .rotation = .{ .x = qx, .y = qy, .z = qz, .w = qw },
        .scale = .{ .x = sx, .y = sy, .z = sz },
    };
}

// ============================================================================
// Quaternion [x, y, z, w]
// ============================================================================

pub const Quat = Vec4;

pub fn quatIdentity() Quat {
    return .{ .x = 0, .y = 0, .z = 0, .w = 1 };
}

pub fn quatCreate(x: f32, y: f32, z: f32, w: f32) Quat {
    return .{ .x = x, .y = y, .z = z, .w = w };
}

pub fn quatMultiply(a: Quat, b: Quat) Quat {
    return .{
        .x = a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y,
        .y = a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x,
        .z = a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w,
        .w = a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z,
    };
}

pub fn quatConjugate(q: Quat) Quat {
    return .{ .x = -q.x, .y = -q.y, .z = -q.z, .w = q.w };
}

pub fn quatInverse(q: Quat) Quat {
    const lenSq = q.x * q.x + q.y * q.y + q.z * q.z + q.w * q.w;
    if (lenSq < EPSILON) return .{ .x = 0, .y = 0, .z = 0, .w = 1 };
    const inv = 1.0 / lenSq;
    return .{ .x = -q.x * inv, .y = -q.y * inv, .z = -q.z * inv, .w = q.w * inv };
}

pub fn quatNormalize(q: Quat) Quat {
    const len = @sqrt(q.x * q.x + q.y * q.y + q.z * q.z + q.w * q.w);
    if (len > EPSILON) return .{ .x = q.x / len, .y = q.y / len, .z = q.z / len, .w = q.w / len };
    return .{ .x = 0, .y = 0, .z = 0, .w = 1 };
}

pub fn quatDot(a: Quat, b: Quat) f32 {
    return a.x * b.x + a.y * b.y + a.z * b.z + a.w * b.w;
}

pub fn quatLength(q: Quat) f32 {
    return @sqrt(q.x * q.x + q.y * q.y + q.z * q.z + q.w * q.w);
}

pub fn quatFromAxisAngle(axis: Vec3, radians: f32) Quat {
    const half = radians * 0.5;
    const s = @sin(half);
    const len = @sqrt(axis.x * axis.x + axis.y * axis.y + axis.z * axis.z);
    if (len < EPSILON) return .{ .x = 0, .y = 0, .z = 0, .w = 1 };
    const inv = s / len;
    return .{ .x = axis.x * inv, .y = axis.y * inv, .z = axis.z * inv, .w = @cos(half) };
}

pub fn quatFromEuler(x: f32, y: f32, z: f32) Quat {
    const cx = @cos(x * 0.5);
    const sx = @sin(x * 0.5);
    const cy = @cos(y * 0.5);
    const sy = @sin(y * 0.5);
    const cz = @cos(z * 0.5);
    const sz = @sin(z * 0.5);
    return .{
        .x = sx * cy * cz + cx * sy * sz,
        .y = cx * sy * cz - sx * cy * sz,
        .z = cx * cy * sz + sx * sy * cz,
        .w = cx * cy * cz - sx * sy * sz,
    };
}

pub fn quatToEuler(q: Quat) Vec3 {
    const x = q.x;
    const y = q.y;
    const z = q.z;
    const w = q.w;
    const sinP = 2 * (w * y - z * x);
    const pitch = if (@abs(sinP) >= 1)
        (if (sinP > 0) pi / 2.0 else -pi / 2.0)
    else
        std.math.asin(sinP);
    const yaw = std.math.atan2(2 * (w * z + x * y), 1 - 2 * (y * y + z * z));
    const roll = std.math.atan2(2 * (w * x + y * z), 1 - 2 * (x * x + y * y));
    return .{ .x = roll, .y = pitch, .z = yaw };
}

pub fn quatToMat4(q: Quat) Mat4 {
    return m4fromQuat(q);
}

pub fn quatSlerp(a: Quat, b: Quat, t: f32) Quat {
    var d = a.x * b.x + a.y * b.y + a.z * b.z + a.w * b.w;
    var bx = b.x;
    var by = b.y;
    var bz = b.z;
    var bw = b.w;
    if (d < 0) {
        d = -d;
        bx = -bx;
        by = -by;
        bz = -bz;
        bw = -bw;
    }
    if (d > 1 - EPSILON) {
        return quatNormalize(.{
            .x = a.x + (bx - a.x) * t,
            .y = a.y + (by - a.y) * t,
            .z = a.z + (bz - a.z) * t,
            .w = a.w + (bw - a.w) * t,
        });
    }
    const theta = std.math.acos(d);
    const sinTheta = @sin(theta);
    const wa = @sin((1 - t) * theta) / sinTheta;
    const wb = @sin(t * theta) / sinTheta;
    return .{
        .x = a.x * wa + bx * wb,
        .y = a.y * wa + by * wb,
        .z = a.z * wa + bz * wb,
        .w = a.w * wa + bw * wb,
    };
}

pub fn quatRotateVec3(q: Quat, v: Vec3) Vec3 {
    const qx = q.x;
    const qy = q.y;
    const qz = q.z;
    const qw = q.w;
    const tx = 2 * (qy * v.z - qz * v.y);
    const ty = 2 * (qz * v.x - qx * v.z);
    const tz = 2 * (qx * v.y - qy * v.x);
    return .{
        .x = v.x + qw * tx + qy * tz - qz * ty,
        .y = v.y + qw * ty + qz * tx - qx * tz,
        .z = v.z + qw * tz + qx * ty - qy * tx,
    };
}

// ============================================================================
// BBox2 / BBox3
// ============================================================================

pub const BBox2 = struct {
    min: Vec2 = .{},
    max: Vec2 = .{},
};

pub const BBox3 = struct {
    min: Vec3 = .{},
    max: Vec3 = .{},
};

pub fn bbox2(min_x: f32, min_y: f32, max_x: f32, max_y: f32) BBox2 {
    return .{
        .min = .{ .x = min_x, .y = min_y },
        .max = .{ .x = max_x, .y = max_y },
    };
}

pub fn bbox2width(b: BBox2) f32 {
    return b.max.x - b.min.x;
}

pub fn bbox2height(b: BBox2) f32 {
    return b.max.y - b.min.y;
}

pub fn bbox2center(b: BBox2) Vec2 {
    return .{
        .x = (b.min.x + b.max.x) / 2.0,
        .y = (b.min.y + b.max.y) / 2.0,
    };
}

pub fn bbox2containsPoint(b: BBox2, pt: Vec2) bool {
    return pt.x >= b.min.x and pt.x <= b.max.x and pt.y >= b.min.y and pt.y <= b.max.y;
}

pub fn bbox2containsBBox(outer: BBox2, inner: BBox2) bool {
    return inner.min.x >= outer.min.x and inner.max.x <= outer.max.x and
        inner.min.y >= outer.min.y and inner.max.y <= outer.max.y;
}

pub fn bbox2intersects(a: BBox2, b: BBox2) bool {
    return a.min.x <= b.max.x and a.max.x >= b.min.x and
        a.min.y <= b.max.y and a.max.y >= b.min.y;
}

pub fn bbox2intersection(a: BBox2, b: BBox2) ?BBox2 {
    const mnx = @max(a.min.x, b.min.x);
    const mny = @max(a.min.y, b.min.y);
    const mxx = @min(a.max.x, b.max.x);
    const mxy = @min(a.max.y, b.max.y);
    if (mnx > mxx or mny > mxy) return null;
    return .{
        .min = .{ .x = mnx, .y = mny },
        .max = .{ .x = mxx, .y = mxy },
    };
}

pub fn bbox2union(a: BBox2, b: BBox2) BBox2 {
    return .{
        .min = .{ .x = @min(a.min.x, b.min.x), .y = @min(a.min.y, b.min.y) },
        .max = .{ .x = @max(a.max.x, b.max.x), .y = @max(a.max.y, b.max.y) },
    };
}

pub fn bbox2expand(b: BBox2, amount: f32) BBox2 {
    return .{
        .min = .{ .x = b.min.x - amount, .y = b.min.y - amount },
        .max = .{ .x = b.max.x + amount, .y = b.max.y + amount },
    };
}

pub fn bbox3(min_x: f32, min_y: f32, min_z: f32, max_x: f32, max_y: f32, max_z: f32) BBox3 {
    return .{
        .min = .{ .x = min_x, .y = min_y, .z = min_z },
        .max = .{ .x = max_x, .y = max_y, .z = max_z },
    };
}

pub fn bbox3containsPoint(b: BBox3, pt: Vec3) bool {
    return pt.x >= b.min.x and pt.x <= b.max.x and
        pt.y >= b.min.y and pt.y <= b.max.y and
        pt.z >= b.min.z and pt.z <= b.max.z;
}

pub fn bbox3intersects(a: BBox3, b: BBox3) bool {
    return a.min.x <= b.max.x and a.max.x >= b.min.x and
        a.min.y <= b.max.y and a.max.y >= b.min.y and
        a.min.z <= b.max.z and a.max.z >= b.min.z;
}

pub fn bbox3union(a: BBox3, b: BBox3) BBox3 {
    return .{
        .min = .{ .x = @min(a.min.x, b.min.x), .y = @min(a.min.y, b.min.y), .z = @min(a.min.z, b.min.z) },
        .max = .{ .x = @max(a.max.x, b.max.x), .y = @max(a.max.y, b.max.y), .z = @max(a.max.z, b.max.z) },
    };
}

pub fn bbox3expand(b: BBox3, amount: f32) BBox3 {
    return .{
        .min = .{ .x = b.min.x - amount, .y = b.min.y - amount, .z = b.min.z - amount },
        .max = .{ .x = b.max.x + amount, .y = b.max.y + amount, .z = b.max.z + amount },
    };
}

// ============================================================================
// Geometry helpers
// ============================================================================

pub fn distancePointToSegment(point: Vec2, a: Vec2, b: Vec2) f32 {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const lenSq = dx * dx + dy * dy;
    if (lenSq == 0) {
        const px = point.x - a.x;
        const py = point.y - a.y;
        return @sqrt(px * px + py * py);
    }
    var t = ((point.x - a.x) * dx + (point.y - a.y) * dy) / lenSq;
    t = @max(0.0, @min(1.0, t));
    const px = point.x - (a.x + t * dx);
    const py = point.y - (a.y + t * dy);
    return @sqrt(px * px + py * py);
}

pub fn distancePointToRect(point: Vec2, rect: BBox2) f32 {
    const cx = @max(rect.min.x, @min(rect.max.x, point.x));
    const cy = @max(rect.min.y, @min(rect.max.y, point.y));
    const dx = point.x - cx;
    const dy = point.y - cy;
    return @sqrt(dx * dx + dy * dy);
}

pub fn circleContainsPoint(center: Vec2, radius: f32, point: Vec2) bool {
    const dx = point.x - center.x;
    const dy = point.y - center.y;
    return dx * dx + dy * dy <= radius * radius;
}

pub fn circleIntersectsRect(center: Vec2, radius: f32, rect: BBox2) bool {
    return distancePointToRect(center, rect) <= radius;
}

pub fn lineIntersection(a1: Vec2, a2: Vec2, b1: Vec2, b2: Vec2) ?Vec2 {
    const d1x = a2.x - a1.x;
    const d1y = a2.y - a1.y;
    const d2x = b2.x - b1.x;
    const d2y = b2.y - b1.y;
    const cr = d1x * d2y - d1y * d2x;
    if (@abs(cr) < 1e-10) return null;
    const dx = b1.x - a1.x;
    const dy = b1.y - a1.y;
    const t = (dx * d2y - dy * d2x) / cr;
    const u = (dx * d1y - dy * d1x) / cr;
    if (t < 0 or t > 1 or u < 0 or u > 1) return null;
    return .{ .x = a1.x + t * d1x, .y = a1.y + t * d1y };
}

// ============================================================================
// Interpolation
// ============================================================================

pub fn lerp(a: f32, b: f32, t: f32) f32 {
    return a + (b - a) * t;
}

pub fn inverseLerp(a: f32, b: f32, value: f32) f32 {
    if (a == b) return 0;
    return (value - a) / (b - a);
}

pub fn smoothstep(edge0: f32, edge1: f32, x: f32) f32 {
    const t = std.math.clamp((x - edge0) / (edge1 - edge0), 0.0, 1.0);
    return t * t * (3 - 2 * t);
}

pub fn smootherstep(edge0: f32, edge1: f32, x: f32) f32 {
    const t = std.math.clamp((x - edge0) / (edge1 - edge0), 0.0, 1.0);
    return t * t * t * (t * (t * 6 - 15) + 10);
}

pub fn remap(value: f32, inMin: f32, inMax: f32, outMin: f32, outMax: f32) f32 {
    return outMin + (outMax - outMin) * ((value - inMin) / (inMax - inMin));
}

pub fn clamp(value: f32, lo: f32, hi: f32) f32 {
    return std.math.clamp(value, lo, hi);
}

pub fn wrap(value: f32, lo: f32, hi: f32) f32 {
    const range = hi - lo;
    if (range == 0) return lo;
    return lo + @mod(@mod(value - lo, range) + range, range);
}

pub fn damp(a: f32, b: f32, smoothing: f32, dt: f32) f32 {
    return lerp(a, b, 1 - @exp(-smoothing * dt));
}

pub fn step(edge: f32, x: f32) f32 {
    return if (x < edge) 0 else 1;
}

pub fn pingPong(value: f32, length: f32) f32 {
    const t = wrap(value, 0, length * 2);
    return length - @abs(t - length);
}

pub fn moveTowards(current: f32, target: f32, maxDelta: f32) f32 {
    const diff = target - current;
    if (@abs(diff) <= maxDelta) return target;
    return current + (if (diff > 0) maxDelta else -maxDelta);
}

pub fn moveTowardsAngle(current: f32, target: f32, maxDelta: f32) f32 {
    var diff = target - current;
    while (diff > pi) diff -= pi * 2;
    while (diff < -pi) diff += pi * 2;
    if (@abs(diff) <= maxDelta) return target;
    return current + (if (diff > 0) maxDelta else -maxDelta);
}

pub const SmoothDampResult = struct {
    result: f32 = 0,
    velocity: f32 = 0,
};

pub fn smoothDamp(current: f32, target: f32, velocity: f32, smoothTime: f32, dt: f32, maxSpeed: f32) SmoothDampResult {
    const omega = 2.0 / @max(0.0001, smoothTime);
    const x = omega * dt;
    const e = 1.0 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
    var change = current - target;
    const maxChange = maxSpeed * smoothTime;
    change = std.math.clamp(change, -maxChange, maxChange);
    const adjustedTarget = current - change;
    const temp = (velocity + omega * change) * dt;
    var newVel = (velocity - omega * temp) * e;
    var result = adjustedTarget + (change + temp) * e;
    if ((target - current > 0) == (result > target)) {
        result = target;
        newVel = (result - target) / dt;
    }
    return .{ .result = result, .velocity = newVel };
}

pub fn toRadians(degrees: f32) f32 {
    return degrees * (pi / 180.0);
}

pub fn toDegrees(radians: f32) f32 {
    return radians * (180.0 / pi);
}

// ── Scalar math primitives (exposed for JS bridge) ────────────────
// Zig's @sin / @cos / @exp etc. are builtins, not library fns, so the
// v8_bindings_zigcall reflection can't pick them up. Thin wrappers make
// them callable from cart JS through math.sin(), math.cos(), etc.
pub fn sin(x: f32) f32 { return @sin(x); }
pub fn cos(x: f32) f32 { return @cos(x); }
pub fn tan(x: f32) f32 { return @tan(x); }
pub fn asin(x: f32) f32 { return std.math.asin(x); }
pub fn acos(x: f32) f32 { return std.math.acos(x); }
pub fn atan(x: f32) f32 { return std.math.atan(x); }
pub fn atan2(y: f32, x: f32) f32 { return std.math.atan2(y, x); }
pub fn exp(x: f32) f32 { return @exp(x); }
pub fn exp2(x: f32) f32 { return @exp2(x); }
pub fn log(x: f32) f32 { return @log(x); }
pub fn log2(x: f32) f32 { return @log2(x); }
pub fn log10(x: f32) f32 { return @log10(x); }
pub fn sqrt(x: f32) f32 { return @sqrt(x); }
pub fn pow(x: f32, y: f32) f32 { return std.math.pow(f32, x, y); }
pub fn absf(x: f32) f32 { return @abs(x); }
pub fn floorf(x: f32) f32 { return @floor(x); }
pub fn ceilf(x: f32) f32 { return @ceil(x); }
pub fn roundf(x: f32) f32 { return @round(x); }
pub fn signf(x: f32) f32 { if (x > 0) return 1; if (x < 0) return -1; return 0; }
pub fn hypot(x: f32, y: f32) f32 { return std.math.hypot(x, y); }
pub fn fract(x: f32) f32 { return x - @floor(x); }

pub fn piValue() f32 { return pi; }
pub fn tauValue() f32 { return pi * 2.0; }

// ============================================================================
// Perlin Noise
// ============================================================================

const perm = [256]u8{
    151, 160, 137, 91,  90,  15,  131, 13,  201, 95,  96,  53,  194, 233, 7,   225,
    140, 36,  103, 30,  69,  142, 8,   99,  37,  240, 21,  10,  23,  190, 6,   148,
    247, 120, 234, 75,  0,   26,  197, 62,  94,  252, 219, 203, 117, 35,  11,  32,
    57,  177, 33,  88,  237, 149, 56,  87,  174, 20,  125, 136, 171, 168, 68,  175,
    74,  165, 71,  134, 139, 48,  27,  166, 77,  146, 158, 231, 83,  111, 229, 122,
    60,  211, 133, 230, 220, 105, 92,  41,  55,  46,  245, 40,  244, 102, 143, 54,
    65,  25,  63,  161, 1,   216, 80,  73,  209, 76,  132, 187, 208, 89,  18,  169,
    200, 196, 135, 130, 116, 188, 159, 86,  164, 100, 109, 198, 173, 186, 3,   64,
    52,  217, 226, 250, 124, 123, 5,   202, 38,  147, 118, 126, 255, 82,  85,  212,
    207, 206, 59,  227, 47,  16,  58,  17,  182, 189, 28,  42,  223, 183, 170, 213,
    119, 248, 152, 2,   44,  154, 163, 70,  221, 153, 101, 155, 167, 43,  172, 9,
    129, 22,  39,  253, 19,  98,  108, 110, 79,  113, 224, 232, 178, 185, 112, 104,
    218, 246, 97,  228, 251, 34,  242, 193, 238, 210, 144, 12,  191, 179, 162, 241,
    81,  51,  145, 235, 249, 14,  239, 107, 49,  192, 214, 31,  181, 199, 106, 157,
    254, 157, 115, 66,  180, 156, 126, 1,   20,  69,  173, 92,  52,  28,  56,  233,
    127, 236, 243, 215, 128, 205, 184, 176, 195, 204, 138, 222, 121, 114, 67,  29,
};

// Doubled permutation table (512 entries, 0-indexed)
const p = blk: {
    var table: [512]u8 = undefined;
    for (0..256) |i| {
        table[i] = perm[i];
        table[i + 256] = perm[i];
    }
    break :blk table;
};

fn grad2d(hash: u32, x: f32, y: f32) f32 {
    const h = hash % 8;
    return switch (h) {
        0 => x + y,
        1 => -x + y,
        2 => x - y,
        3 => -x - y,
        4 => x,
        5 => -x,
        6 => y,
        else => -y,
    };
}

fn grad3d(hash: u32, x: f32, y: f32, z: f32) f32 {
    const h = hash % 12;
    return switch (h) {
        0 => x + y,
        1 => -x + y,
        2 => x - y,
        3 => -x - y,
        4 => x + z,
        5 => -x + z,
        6 => x - z,
        7 => -x - z,
        8 => y + z,
        9 => -y + z,
        10 => y - z,
        else => -y - z,
    };
}

fn fade(t: f32) f32 {
    return t * t * t * (t * (t * 6 - 15) + 10);
}

pub fn noise2d(x_in: f32, y_in: f32, seed: f32) f32 {
    const x = x_in + seed * 31.7;
    const y = y_in + seed * 17.3;
    const xi: u32 = @intCast(@as(i32, @intFromFloat(@floor(x))) & 255);
    const yi: u32 = @intCast(@as(i32, @intFromFloat(@floor(y))) & 255);
    const xf = x - @floor(x);
    const yf = y - @floor(y);
    const u = fade(xf);
    const v = fade(yf);
    const aa: u32 = @as(u32, p[@as(u32, p[xi]) + yi]);
    const ab: u32 = @as(u32, p[@as(u32, p[xi]) + yi + 1]);
    const ba: u32 = @as(u32, p[@as(u32, p[xi + 1]) + yi]);
    const bb: u32 = @as(u32, p[@as(u32, p[xi + 1]) + yi + 1]);
    const x1 = grad2d(aa, xf, yf) + (grad2d(ba, xf - 1, yf) - grad2d(aa, xf, yf)) * u;
    const x2 = grad2d(ab, xf, yf - 1) + (grad2d(bb, xf - 1, yf - 1) - grad2d(ab, xf, yf - 1)) * u;
    return x1 + (x2 - x1) * v;
}

pub fn noise3d(x_in: f32, y_in: f32, z_in: f32, seed: f32) f32 {
    const x = x_in + seed * 31.7;
    const y = y_in + seed * 17.3;
    const z = z_in + seed * 23.1;
    const xi: u32 = @intCast(@as(i32, @intFromFloat(@floor(x))) & 255);
    const yi: u32 = @intCast(@as(i32, @intFromFloat(@floor(y))) & 255);
    const zi: u32 = @intCast(@as(i32, @intFromFloat(@floor(z))) & 255);
    const xf = x - @floor(x);
    const yf = y - @floor(y);
    const zf = z - @floor(z);
    const u = fade(xf);
    const v = fade(yf);
    const w = fade(zf);
    const aaa: u32 = @as(u32, p[@as(u32, p[@as(u32, p[xi]) + yi]) + zi]);
    const aba: u32 = @as(u32, p[@as(u32, p[@as(u32, p[xi]) + yi + 1]) + zi]);
    const aab: u32 = @as(u32, p[@as(u32, p[@as(u32, p[xi]) + yi]) + zi + 1]);
    const abb: u32 = @as(u32, p[@as(u32, p[@as(u32, p[xi]) + yi + 1]) + zi + 1]);
    const baa: u32 = @as(u32, p[@as(u32, p[@as(u32, p[xi + 1]) + yi]) + zi]);
    const bba: u32 = @as(u32, p[@as(u32, p[@as(u32, p[xi + 1]) + yi + 1]) + zi]);
    const bab: u32 = @as(u32, p[@as(u32, p[@as(u32, p[xi + 1]) + yi]) + zi + 1]);
    const bbb: u32 = @as(u32, p[@as(u32, p[@as(u32, p[xi + 1]) + yi + 1]) + zi + 1]);
    const x1a = grad3d(aaa, xf, yf, zf) + (grad3d(baa, xf - 1, yf, zf) - grad3d(aaa, xf, yf, zf)) * u;
    const x2a = grad3d(aba, xf, yf - 1, zf) + (grad3d(bba, xf - 1, yf - 1, zf) - grad3d(aba, xf, yf - 1, zf)) * u;
    const y1 = x1a + (x2a - x1a) * v;
    const x1b = grad3d(aab, xf, yf, zf - 1) + (grad3d(bab, xf - 1, yf, zf - 1) - grad3d(aab, xf, yf, zf - 1)) * u;
    const x2b = grad3d(abb, xf, yf - 1, zf - 1) + (grad3d(bbb, xf - 1, yf - 1, zf - 1) - grad3d(abb, xf, yf - 1, zf - 1)) * u;
    const y2 = x1b + (x2b - x1b) * v;
    return y1 + (y2 - y1) * w;
}

pub fn fbm2d(x: f32, y: f32, octaves: u32, seed: f32, lacunarity: f32, persistence: f32) f32 {
    var total: f32 = 0;
    var amplitude: f32 = 1;
    var frequency: f32 = 1;
    var maxValue: f32 = 0;
    for (0..octaves) |_| {
        total += noise2d(x * frequency, y * frequency, seed) * amplitude;
        maxValue += amplitude;
        amplitude *= persistence;
        frequency *= lacunarity;
    }
    return total / maxValue;
}

pub fn fbm3d(x: f32, y: f32, z: f32, octaves: u32, seed: f32, lacunarity: f32, persistence: f32) f32 {
    var total: f32 = 0;
    var amplitude: f32 = 1;
    var frequency: f32 = 1;
    var maxValue: f32 = 0;
    for (0..octaves) |_| {
        total += noise3d(x * frequency, y * frequency, z * frequency, seed) * amplitude;
        maxValue += amplitude;
        amplitude *= persistence;
        frequency *= lacunarity;
    }
    return total / maxValue;
}

// ============================================================================
// Bezier curves
// ============================================================================

pub fn bezierPoint(points: []const Vec2, t: f32) Vec2 {
    const n = points.len;
    if (n == 0) return .{};
    if (n == 1) return points[0];

    // De Casteljau's algorithm using a stack buffer (max 32 control points)
    var work: [32]Vec2 = undefined;
    const count = @min(n, 32);
    for (0..count) |i| {
        work[i] = points[i];
    }
    var level: usize = count - 1;
    while (level >= 1) : (level -= 1) {
        for (0..level) |j| {
            work[j] = .{
                .x = work[j].x + (work[j + 1].x - work[j].x) * t,
                .y = work[j].y + (work[j + 1].y - work[j].y) * t,
            };
        }
    }
    return work[0];
}

pub fn bezierCurve(points: []const Vec2, segments: u32, out: []Vec2) u32 {
    if (points.len < 2) {
        if (points.len == 1 and out.len >= 1) {
            out[0] = points[0];
            return 1;
        }
        return 0;
    }
    const count = segments + 1;
    const write_count = @min(count, @as(u32, @intCast(out.len)));
    for (0..write_count) |i| {
        const t: f32 = @as(f32, @floatFromInt(i)) / @as(f32, @floatFromInt(segments));
        out[i] = bezierPoint(points, t);
    }
    return write_count;
}

pub fn cubicBezier(p0: Vec2, p1: Vec2, p2: Vec2, p3: Vec2, t: f32) Vec2 {
    const t2 = t * t;
    const t3 = t2 * t;
    const mt = 1 - t;
    const mt2 = mt * mt;
    const mt3 = mt2 * mt;
    return .{
        .x = mt3 * p0.x + 3 * mt2 * t * p1.x + 3 * mt * t2 * p2.x + t3 * p3.x,
        .y = mt3 * p0.y + 3 * mt2 * t * p1.y + 3 * mt * t2 * p2.y + t3 * p3.y,
    };
}

pub fn cubicBezierDerivative(p0: Vec2, p1: Vec2, p2: Vec2, p3: Vec2, t: f32) Vec2 {
    const mt = 1 - t;
    const mt2 = mt * mt;
    const t2 = t * t;
    return .{
        .x = 3 * mt2 * (p1.x - p0.x) + 6 * mt * t * (p2.x - p1.x) + 3 * t2 * (p3.x - p2.x),
        .y = 3 * mt2 * (p1.y - p0.y) + 6 * mt * t * (p2.y - p1.y) + 3 * t2 * (p3.y - p2.y),
    };
}

pub fn quadraticBezier(p0: Vec2, p1: Vec2, p2: Vec2, t: f32) Vec2 {
    const mt = 1 - t;
    const mt2 = mt * mt;
    const t2 = t * t;
    return .{
        .x = mt2 * p0.x + 2 * mt * t * p1.x + t2 * p2.x,
        .y = mt2 * p0.y + 2 * mt * t * p1.y + t2 * p2.y,
    };
}

// ============================================================================
// Tests
// ============================================================================

test "vec2 basic ops" {
    const a = v2(3, 4);
    const b = v2(1, 2);
    const sum = v2add(a, b);
    try std.testing.expectEqual(@as(f32, 4), sum.x);
    try std.testing.expectEqual(@as(f32, 6), sum.y);
    try std.testing.expectEqual(@as(f32, 5), v2length(a));
}

test "mat4 identity multiply" {
    const id = m4identity();
    const result = m4multiply(id, id);
    try std.testing.expectEqual(id, result);
}

test "noise2d returns bounded values" {
    const val = noise2d(1.5, 2.5, 0);
    try std.testing.expect(val >= -2 and val <= 2);
}

test "lerp basic" {
    try std.testing.expectEqual(@as(f32, 5), lerp(0, 10, 0.5));
}

test "bezier point at endpoints" {
    const pts = [_]Vec2{ v2(0, 0), v2(1, 1) };
    const start = bezierPoint(&pts, 0);
    const end = bezierPoint(&pts, 1);
    try std.testing.expectEqual(@as(f32, 0), start.x);
    try std.testing.expectEqual(@as(f32, 1), end.x);
}
