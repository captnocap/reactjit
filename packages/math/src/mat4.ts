import type { Mat4, Vec3, Quat } from './types';

const EPSILON = 1e-6;

export const Mat4 = {
  identity(): Mat4 {
    return [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
  },

  /** Multiply two 4x4 matrices (a * b) */
  multiply(a: Mat4, b: Mat4): Mat4 {
    const [a0, a1, a2, a3, a4, a5, a6, a7, a8, a9, a10, a11, a12, a13, a14, a15] = a;
    const [b0, b1, b2, b3, b4, b5, b6, b7, b8, b9, b10, b11, b12, b13, b14, b15] = b;
    return [
      a0*b0 + a1*b4 + a2*b8 + a3*b12, a0*b1 + a1*b5 + a2*b9 + a3*b13,
      a0*b2 + a1*b6 + a2*b10 + a3*b14, a0*b3 + a1*b7 + a2*b11 + a3*b15,
      a4*b0 + a5*b4 + a6*b8 + a7*b12, a4*b1 + a5*b5 + a6*b9 + a7*b13,
      a4*b2 + a5*b6 + a6*b10 + a7*b14, a4*b3 + a5*b7 + a6*b11 + a7*b15,
      a8*b0 + a9*b4 + a10*b8 + a11*b12, a8*b1 + a9*b5 + a10*b9 + a11*b13,
      a8*b2 + a9*b6 + a10*b10 + a11*b14, a8*b3 + a9*b7 + a10*b11 + a11*b15,
      a12*b0 + a13*b4 + a14*b8 + a15*b12, a12*b1 + a13*b5 + a14*b9 + a15*b13,
      a12*b2 + a13*b6 + a14*b10 + a15*b14, a12*b3 + a13*b7 + a14*b11 + a15*b15,
    ];
  },

  transpose(m: Mat4): Mat4 {
    return [
      m[0], m[4], m[8], m[12],
      m[1], m[5], m[9], m[13],
      m[2], m[6], m[10], m[14],
      m[3], m[7], m[11], m[15],
    ];
  },

  determinant(m: Mat4): number {
    const [a0, a1, a2, a3, a4, a5, a6, a7, a8, a9, a10, a11, a12, a13, a14, a15] = m;
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
    return b0 * b11 - b1 * b10 + b2 * b9 + b3 * b8 - b4 * b7 + b5 * b6;
  },

  invert(m: Mat4): Mat4 | null {
    const [a0, a1, a2, a3, a4, a5, a6, a7, a8, a9, a10, a11, a12, a13, a14, a15] = m;
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
    if (Math.abs(det) < EPSILON) return null;
    const invDet = 1 / det;
    return [
      (a5 * b11 - a6 * b10 + a7 * b9) * invDet,
      (-a1 * b11 + a2 * b10 - a3 * b9) * invDet,
      (a13 * b5 - a14 * b4 + a15 * b3) * invDet,
      (-a9 * b5 + a10 * b4 - a11 * b3) * invDet,
      (-a4 * b11 + a6 * b8 - a7 * b7) * invDet,
      (a0 * b11 - a2 * b8 + a3 * b7) * invDet,
      (-a12 * b5 + a14 * b2 - a15 * b1) * invDet,
      (a8 * b5 - a10 * b2 + a11 * b1) * invDet,
      (a4 * b10 - a5 * b8 + a7 * b6) * invDet,
      (-a0 * b10 + a1 * b8 - a3 * b6) * invDet,
      (a12 * b4 - a13 * b2 + a15 * b0) * invDet,
      (-a8 * b4 + a9 * b2 - a11 * b0) * invDet,
      (-a4 * b9 + a5 * b7 - a6 * b6) * invDet,
      (a0 * b9 - a1 * b7 + a2 * b6) * invDet,
      (-a12 * b3 + a13 * b1 - a14 * b0) * invDet,
      (a8 * b3 - a9 * b1 + a10 * b0) * invDet,
    ];
  },

  translate(m: Mat4, v: Vec3): Mat4 {
    const [x, y, z] = v;
    const out = [...m] as unknown as [number, number, number, number, number, number, number, number, number, number, number, number, number, number, number, number];
    out[3] = m[0] * x + m[1] * y + m[2] * z + m[3];
    out[7] = m[4] * x + m[5] * y + m[6] * z + m[7];
    out[11] = m[8] * x + m[9] * y + m[10] * z + m[11];
    out[15] = m[12] * x + m[13] * y + m[14] * z + m[15];
    return out;
  },

  scale(m: Mat4, v: Vec3): Mat4 {
    const [sx, sy, sz] = v;
    return [
      m[0] * sx, m[1] * sy, m[2] * sz, m[3],
      m[4] * sx, m[5] * sy, m[6] * sz, m[7],
      m[8] * sx, m[9] * sy, m[10] * sz, m[11],
      m[12] * sx, m[13] * sy, m[14] * sz, m[15],
    ];
  },

  rotateX(m: Mat4, radians: number): Mat4 {
    const c = Math.cos(radians), s = Math.sin(radians);
    const rot: Mat4 = [1, 0, 0, 0, 0, c, -s, 0, 0, s, c, 0, 0, 0, 0, 1];
    return Mat4.multiply(m, rot);
  },

  rotateY(m: Mat4, radians: number): Mat4 {
    const c = Math.cos(radians), s = Math.sin(radians);
    const rot: Mat4 = [c, 0, s, 0, 0, 1, 0, 0, -s, 0, c, 0, 0, 0, 0, 1];
    return Mat4.multiply(m, rot);
  },

  rotateZ(m: Mat4, radians: number): Mat4 {
    const c = Math.cos(radians), s = Math.sin(radians);
    const rot: Mat4 = [c, -s, 0, 0, s, c, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
    return Mat4.multiply(m, rot);
  },

  /** Look-at view matrix */
  lookAt(eye: Vec3, target: Vec3, up: Vec3): Mat4 {
    let fx = eye[0] - target[0], fy = eye[1] - target[1], fz = eye[2] - target[2];
    let len = Math.sqrt(fx * fx + fy * fy + fz * fz);
    if (len > EPSILON) { fx /= len; fy /= len; fz /= len; }

    let sx = up[1] * fz - up[2] * fy, sy = up[2] * fx - up[0] * fz, sz = up[0] * fy - up[1] * fx;
    len = Math.sqrt(sx * sx + sy * sy + sz * sz);
    if (len > EPSILON) { sx /= len; sy /= len; sz /= len; }

    const ux = fy * sz - fz * sy, uy = fz * sx - fx * sz, uz = fx * sy - fy * sx;

    return [
      sx, sy, sz, -(sx * eye[0] + sy * eye[1] + sz * eye[2]),
      ux, uy, uz, -(ux * eye[0] + uy * eye[1] + uz * eye[2]),
      fx, fy, fz, -(fx * eye[0] + fy * eye[1] + fz * eye[2]),
      0, 0, 0, 1,
    ];
  },

  /** Perspective projection matrix */
  perspective(fovRadians: number, aspect: number, near: number, far: number): Mat4 {
    const f = 1 / Math.tan(fovRadians / 2);
    const rangeInv = 1 / (near - far);
    return [
      f / aspect, 0, 0, 0,
      0, f, 0, 0,
      0, 0, (near + far) * rangeInv, 2 * near * far * rangeInv,
      0, 0, -1, 0,
    ];
  },

  /** Orthographic projection matrix */
  ortho(left: number, right: number, bottom: number, top: number, near: number, far: number): Mat4 {
    const rl = 1 / (right - left);
    const tb = 1 / (top - bottom);
    const nf = 1 / (near - far);
    return [
      2 * rl, 0, 0, -(right + left) * rl,
      0, 2 * tb, 0, -(top + bottom) * tb,
      0, 0, 2 * nf, (far + near) * nf,
      0, 0, 0, 1,
    ];
  },

  /** Transform a 3D point by a 4x4 matrix (applies translation) */
  transformPoint(m: Mat4, v: Vec3): Vec3 {
    const w = m[12] * v[0] + m[13] * v[1] + m[14] * v[2] + m[15];
    const invW = Math.abs(w) > EPSILON ? 1 / w : 1;
    return [
      (m[0] * v[0] + m[1] * v[1] + m[2] * v[2] + m[3]) * invW,
      (m[4] * v[0] + m[5] * v[1] + m[6] * v[2] + m[7]) * invW,
      (m[8] * v[0] + m[9] * v[1] + m[10] * v[2] + m[11]) * invW,
    ];
  },

  /** Transform a 3D direction by a 4x4 matrix (ignores translation) */
  transformDirection(m: Mat4, v: Vec3): Vec3 {
    return [
      m[0] * v[0] + m[1] * v[1] + m[2] * v[2],
      m[4] * v[0] + m[5] * v[1] + m[6] * v[2],
      m[8] * v[0] + m[9] * v[1] + m[10] * v[2],
    ];
  },

  /** Create a Mat4 from a quaternion */
  fromQuat(q: Quat): Mat4 {
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

  /** Create a Mat4 from Euler angles (radians, XYZ order) */
  fromEuler(x: number, y: number, z: number): Mat4 {
    const cx = Math.cos(x), sx = Math.sin(x);
    const cy = Math.cos(y), sy = Math.sin(y);
    const cz = Math.cos(z), sz = Math.sin(z);
    return [
      cy * cz, cy * sz * sx - sy * cx, cy * sz * cx + sy * sx, 0,
      sy * cz, sy * sz * sx + cy * cx, sy * sz * cx - cy * sx, 0,
      -sz, cz * sx, cz * cx, 0,
      0, 0, 0, 1,
    ];
  },

  /** Decompose a Mat4 into translation, rotation (quat), and scale */
  decompose(m: Mat4): { translation: Vec3; rotation: Quat; scale: Vec3 } {
    const sx = Math.sqrt(m[0] * m[0] + m[4] * m[4] + m[8] * m[8]);
    const sy = Math.sqrt(m[1] * m[1] + m[5] * m[5] + m[9] * m[9]);
    const sz = Math.sqrt(m[2] * m[2] + m[6] * m[6] + m[10] * m[10]);

    const isx = sx > EPSILON ? 1 / sx : 0;
    const isy = sy > EPSILON ? 1 / sy : 0;
    const isz = sz > EPSILON ? 1 / sz : 0;

    const r00 = m[0] * isx, r01 = m[1] * isy, r02 = m[2] * isz;
    const r10 = m[4] * isx, r11 = m[5] * isy, r12 = m[6] * isz;
    const r20 = m[8] * isx, r21 = m[9] * isy, r22 = m[10] * isz;

    const trace = r00 + r11 + r22;
    let qx: number, qy: number, qz: number, qw: number;
    if (trace > 0) {
      const s = 0.5 / Math.sqrt(trace + 1);
      qw = 0.25 / s;
      qx = (r21 - r12) * s;
      qy = (r02 - r20) * s;
      qz = (r10 - r01) * s;
    } else if (r00 > r11 && r00 > r22) {
      const s = 2 * Math.sqrt(1 + r00 - r11 - r22);
      qw = (r21 - r12) / s;
      qx = 0.25 * s;
      qy = (r01 + r10) / s;
      qz = (r02 + r20) / s;
    } else if (r11 > r22) {
      const s = 2 * Math.sqrt(1 + r11 - r00 - r22);
      qw = (r02 - r20) / s;
      qx = (r01 + r10) / s;
      qy = 0.25 * s;
      qz = (r12 + r21) / s;
    } else {
      const s = 2 * Math.sqrt(1 + r22 - r00 - r11);
      qw = (r10 - r01) / s;
      qx = (r02 + r20) / s;
      qy = (r12 + r21) / s;
      qz = 0.25 * s;
    }

    return {
      translation: [m[3], m[7], m[11]],
      rotation: [qx, qy, qz, qw],
      scale: [sx, sy, sz],
    };
  },
} as const;
