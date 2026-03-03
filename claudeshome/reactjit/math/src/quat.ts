import type { Quat, Vec3, Mat4 } from './types';

const EPSILON = 1e-6;

export const Quat = {
  identity(): Quat { return [0, 0, 0, 1]; },
  create(x = 0, y = 0, z = 0, w = 1): Quat { return [x, y, z, w]; },

  multiply(a: Quat, b: Quat): Quat {
    return [
      a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
      a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
      a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
      a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2],
    ];
  },

  conjugate(q: Quat): Quat { return [-q[0], -q[1], -q[2], q[3]]; },

  inverse(q: Quat): Quat {
    const lenSq = q[0] * q[0] + q[1] * q[1] + q[2] * q[2] + q[3] * q[3];
    if (lenSq < EPSILON) return [0, 0, 0, 1];
    const inv = 1 / lenSq;
    return [-q[0] * inv, -q[1] * inv, -q[2] * inv, q[3] * inv];
  },

  normalize(q: Quat): Quat {
    const len = Math.sqrt(q[0] * q[0] + q[1] * q[1] + q[2] * q[2] + q[3] * q[3]);
    return len > EPSILON ? [q[0] / len, q[1] / len, q[2] / len, q[3] / len] : [0, 0, 0, 1];
  },

  dot(a: Quat, b: Quat): number {
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3];
  },

  length(q: Quat): number {
    return Math.sqrt(q[0] * q[0] + q[1] * q[1] + q[2] * q[2] + q[3] * q[3]);
  },

  fromAxisAngle(axis: Vec3, radians: number): Quat {
    const half = radians * 0.5;
    const s = Math.sin(half);
    const len = Math.sqrt(axis[0] * axis[0] + axis[1] * axis[1] + axis[2] * axis[2]);
    if (len < EPSILON) return [0, 0, 0, 1];
    const inv = s / len;
    return [axis[0] * inv, axis[1] * inv, axis[2] * inv, Math.cos(half)];
  },

  /** Create from Euler angles (radians, XYZ intrinsic) */
  fromEuler(x: number, y: number, z: number): Quat {
    const cx = Math.cos(x * 0.5), sx = Math.sin(x * 0.5);
    const cy = Math.cos(y * 0.5), sy = Math.sin(y * 0.5);
    const cz = Math.cos(z * 0.5), sz = Math.sin(z * 0.5);
    return [
      sx * cy * cz + cx * sy * sz,
      cx * sy * cz - sx * cy * sz,
      cx * cy * sz + sx * sy * cz,
      cx * cy * cz - sx * sy * sz,
    ];
  },

  /** Extract Euler angles (XYZ intrinsic, radians) */
  toEuler(q: Quat): Vec3 {
    const [x, y, z, w] = q;
    const sinP = 2 * (w * y - z * x);
    const pitch = Math.abs(sinP) >= 1
      ? Math.sign(sinP) * Math.PI / 2
      : Math.asin(sinP);
    const yaw = Math.atan2(2 * (w * z + x * y), 1 - 2 * (y * y + z * z));
    const roll = Math.atan2(2 * (w * x + y * z), 1 - 2 * (x * x + y * y));
    return [roll, pitch, yaw];
  },

  /** Convert to 4x4 rotation matrix */
  toMat4(q: Quat): Mat4 {
    const [qx, qy, qz, qw] = q;
    const x2 = qx + qx, y2 = qy + qy, z2 = qz + qz;
    const xx = qx * x2, xy = qx * y2, xz = qx * z2;
    const yy = qy * y2, yz = qy * z2, zz = qz * z2;
    const wx = qw * x2, wy = qw * y2, wz = qw * z2;
    return [
      1 - yy - zz, xy - wz, xz + wy, 0,
      xy + wz, 1 - xx - zz, yz - wx, 0,
      xz - wy, yz + wx, 1 - xx - yy, 0,
      0, 0, 0, 1,
    ];
  },

  /** Spherical linear interpolation */
  slerp(a: Quat, b: Quat, t: number): Quat {
    let d = a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3];
    let bx = b[0], by = b[1], bz = b[2], bw = b[3];
    if (d < 0) { d = -d; bx = -bx; by = -by; bz = -bz; bw = -bw; }
    if (d > 1 - EPSILON) {
      return Quat.normalize([
        a[0] + (bx - a[0]) * t,
        a[1] + (by - a[1]) * t,
        a[2] + (bz - a[2]) * t,
        a[3] + (bw - a[3]) * t,
      ]);
    }
    const theta = Math.acos(d);
    const sinTheta = Math.sin(theta);
    const wa = Math.sin((1 - t) * theta) / sinTheta;
    const wb = Math.sin(t * theta) / sinTheta;
    return [
      a[0] * wa + bx * wb,
      a[1] * wa + by * wb,
      a[2] * wa + bz * wb,
      a[3] * wa + bw * wb,
    ];
  },

  /** Rotate a Vec3 by this quaternion */
  rotateVec3(q: Quat, v: Vec3): Vec3 {
    const [qx, qy, qz, qw] = q;
    const tx = 2 * (qy * v[2] - qz * v[1]);
    const ty = 2 * (qz * v[0] - qx * v[2]);
    const tz = 2 * (qx * v[1] - qy * v[0]);
    return [
      v[0] + qw * tx + qy * tz - qz * ty,
      v[1] + qw * ty + qz * tx - qx * tz,
      v[2] + qw * tz + qx * ty - qy * tx,
    ];
  },
} as const;
