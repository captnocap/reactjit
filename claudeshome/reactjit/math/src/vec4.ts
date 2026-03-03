import type { Vec4 } from './types';

const EPSILON = 1e-6;

export const Vec4 = {
  create(x = 0, y = 0, z = 0, w = 0): Vec4 { return [x, y, z, w]; },
  zero(): Vec4 { return [0, 0, 0, 0]; },
  one(): Vec4 { return [1, 1, 1, 1]; },

  add(a: Vec4, b: Vec4): Vec4 { return [a[0] + b[0], a[1] + b[1], a[2] + b[2], a[3] + b[3]]; },
  sub(a: Vec4, b: Vec4): Vec4 { return [a[0] - b[0], a[1] - b[1], a[2] - b[2], a[3] - b[3]]; },
  mul(a: Vec4, b: Vec4): Vec4 { return [a[0] * b[0], a[1] * b[1], a[2] * b[2], a[3] * b[3]]; },
  div(a: Vec4, b: Vec4): Vec4 { return [a[0] / b[0], a[1] / b[1], a[2] / b[2], a[3] / b[3]]; },
  scale(v: Vec4, s: number): Vec4 { return [v[0] * s, v[1] * s, v[2] * s, v[3] * s]; },
  negate(v: Vec4): Vec4 { return [-v[0], -v[1], -v[2], -v[3]]; },

  dot(a: Vec4, b: Vec4): number { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3]; },

  length(v: Vec4): number { return Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2] + v[3] * v[3]); },
  lengthSq(v: Vec4): number { return v[0] * v[0] + v[1] * v[1] + v[2] * v[2] + v[3] * v[3]; },

  normalize(v: Vec4): Vec4 {
    const len = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2] + v[3] * v[3]);
    return len > EPSILON ? [v[0] / len, v[1] / len, v[2] / len, v[3] / len] : [0, 0, 0, 0];
  },

  lerp(a: Vec4, b: Vec4, t: number): Vec4 {
    return [
      a[0] + (b[0] - a[0]) * t,
      a[1] + (b[1] - a[1]) * t,
      a[2] + (b[2] - a[2]) * t,
      a[3] + (b[3] - a[3]) * t,
    ];
  },

  min(a: Vec4, b: Vec4): Vec4 { return [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.min(a[2], b[2]), Math.min(a[3], b[3])]; },
  max(a: Vec4, b: Vec4): Vec4 { return [Math.max(a[0], b[0]), Math.max(a[1], b[1]), Math.max(a[2], b[2]), Math.max(a[3], b[3])]; },
  clamp(v: Vec4, lo: Vec4, hi: Vec4): Vec4 {
    return [
      Math.max(lo[0], Math.min(hi[0], v[0])),
      Math.max(lo[1], Math.min(hi[1], v[1])),
      Math.max(lo[2], Math.min(hi[2], v[2])),
      Math.max(lo[3], Math.min(hi[3], v[3])),
    ];
  },

  equals(a: Vec4, b: Vec4): boolean { return a[0] === b[0] && a[1] === b[1] && a[2] === b[2] && a[3] === b[3]; },
  almostEquals(a: Vec4, b: Vec4, epsilon = EPSILON): boolean {
    return Math.abs(a[0] - b[0]) < epsilon && Math.abs(a[1] - b[1]) < epsilon
      && Math.abs(a[2] - b[2]) < epsilon && Math.abs(a[3] - b[3]) < epsilon;
  },
} as const;
