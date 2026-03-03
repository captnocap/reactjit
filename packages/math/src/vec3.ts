import type { Vec3 } from './types';

const EPSILON = 1e-6;

export const Vec3 = {
  create(x = 0, y = 0, z = 0): Vec3 { return [x, y, z]; },
  zero(): Vec3 { return [0, 0, 0]; },
  one(): Vec3 { return [1, 1, 1]; },
  up(): Vec3 { return [0, 1, 0]; },
  forward(): Vec3 { return [0, 0, -1]; },
  right(): Vec3 { return [1, 0, 0]; },

  add(a: Vec3, b: Vec3): Vec3 { return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; },
  sub(a: Vec3, b: Vec3): Vec3 { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; },
  mul(a: Vec3, b: Vec3): Vec3 { return [a[0] * b[0], a[1] * b[1], a[2] * b[2]]; },
  div(a: Vec3, b: Vec3): Vec3 { return [a[0] / b[0], a[1] / b[1], a[2] / b[2]]; },
  scale(v: Vec3, s: number): Vec3 { return [v[0] * s, v[1] * s, v[2] * s]; },
  negate(v: Vec3): Vec3 { return [-v[0], -v[1], -v[2]]; },

  dot(a: Vec3, b: Vec3): number { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; },
  cross(a: Vec3, b: Vec3): Vec3 {
    return [
      a[1] * b[2] - a[2] * b[1],
      a[2] * b[0] - a[0] * b[2],
      a[0] * b[1] - a[1] * b[0],
    ];
  },

  length(v: Vec3): number { return Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]); },
  lengthSq(v: Vec3): number { return v[0] * v[0] + v[1] * v[1] + v[2] * v[2]; },

  distance(a: Vec3, b: Vec3): number {
    const dx = a[0] - b[0], dy = a[1] - b[1], dz = a[2] - b[2];
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  },
  distanceSq(a: Vec3, b: Vec3): number {
    const dx = a[0] - b[0], dy = a[1] - b[1], dz = a[2] - b[2];
    return dx * dx + dy * dy + dz * dz;
  },

  normalize(v: Vec3): Vec3 {
    const len = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
    return len > EPSILON ? [v[0] / len, v[1] / len, v[2] / len] : [0, 0, 0];
  },

  abs(v: Vec3): Vec3 { return [Math.abs(v[0]), Math.abs(v[1]), Math.abs(v[2])]; },
  floor(v: Vec3): Vec3 { return [Math.floor(v[0]), Math.floor(v[1]), Math.floor(v[2])]; },
  ceil(v: Vec3): Vec3 { return [Math.ceil(v[0]), Math.ceil(v[1]), Math.ceil(v[2])]; },
  round(v: Vec3): Vec3 { return [Math.round(v[0]), Math.round(v[1]), Math.round(v[2])]; },

  min(a: Vec3, b: Vec3): Vec3 { return [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.min(a[2], b[2])]; },
  max(a: Vec3, b: Vec3): Vec3 { return [Math.max(a[0], b[0]), Math.max(a[1], b[1]), Math.max(a[2], b[2])]; },
  clamp(v: Vec3, lo: Vec3, hi: Vec3): Vec3 {
    return [
      Math.max(lo[0], Math.min(hi[0], v[0])),
      Math.max(lo[1], Math.min(hi[1], v[1])),
      Math.max(lo[2], Math.min(hi[2], v[2])),
    ];
  },

  lerp(a: Vec3, b: Vec3, t: number): Vec3 {
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  },
  smoothstep(a: Vec3, b: Vec3, t: number): Vec3 {
    const s = t * t * (3 - 2 * t);
    return [a[0] + (b[0] - a[0]) * s, a[1] + (b[1] - a[1]) * s, a[2] + (b[2] - a[2]) * s];
  },

  reflect(v: Vec3, normal: Vec3): Vec3 {
    const d = 2 * Vec3.dot(v, normal);
    return [v[0] - d * normal[0], v[1] - d * normal[1], v[2] - d * normal[2]];
  },

  slerp(a: Vec3, b: Vec3, t: number): Vec3 {
    let d = Vec3.dot(a, b);
    d = Math.max(-1, Math.min(1, d));
    const theta = Math.acos(d) * t;
    const relative = Vec3.normalize(Vec3.sub(b, Vec3.scale(a, d)));
    return Vec3.add(Vec3.scale(a, Math.cos(theta)), Vec3.scale(relative, Math.sin(theta)));
  },

  equals(a: Vec3, b: Vec3): boolean { return a[0] === b[0] && a[1] === b[1] && a[2] === b[2]; },
  almostEquals(a: Vec3, b: Vec3, epsilon = EPSILON): boolean {
    return Math.abs(a[0] - b[0]) < epsilon && Math.abs(a[1] - b[1]) < epsilon && Math.abs(a[2] - b[2]) < epsilon;
  },
} as const;
