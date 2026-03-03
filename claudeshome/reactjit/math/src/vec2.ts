import type { Vec2 } from './types';

const EPSILON = 1e-6;

export const Vec2 = {
  create(x = 0, y = 0): Vec2 { return [x, y]; },
  zero(): Vec2 { return [0, 0]; },
  one(): Vec2 { return [1, 1]; },

  add(a: Vec2, b: Vec2): Vec2 { return [a[0] + b[0], a[1] + b[1]]; },
  sub(a: Vec2, b: Vec2): Vec2 { return [a[0] - b[0], a[1] - b[1]]; },
  mul(a: Vec2, b: Vec2): Vec2 { return [a[0] * b[0], a[1] * b[1]]; },
  div(a: Vec2, b: Vec2): Vec2 { return [a[0] / b[0], a[1] / b[1]]; },
  scale(v: Vec2, s: number): Vec2 { return [v[0] * s, v[1] * s]; },
  negate(v: Vec2): Vec2 { return [-v[0], -v[1]]; },

  dot(a: Vec2, b: Vec2): number { return a[0] * b[0] + a[1] * b[1]; },
  cross(a: Vec2, b: Vec2): number { return a[0] * b[1] - a[1] * b[0]; },

  length(v: Vec2): number { return Math.sqrt(v[0] * v[0] + v[1] * v[1]); },
  lengthSq(v: Vec2): number { return v[0] * v[0] + v[1] * v[1]; },

  distance(a: Vec2, b: Vec2): number {
    const dx = a[0] - b[0], dy = a[1] - b[1];
    return Math.sqrt(dx * dx + dy * dy);
  },
  distanceSq(a: Vec2, b: Vec2): number {
    const dx = a[0] - b[0], dy = a[1] - b[1];
    return dx * dx + dy * dy;
  },

  normalize(v: Vec2): Vec2 {
    const len = Math.sqrt(v[0] * v[0] + v[1] * v[1]);
    return len > EPSILON ? [v[0] / len, v[1] / len] : [0, 0];
  },

  abs(v: Vec2): Vec2 { return [Math.abs(v[0]), Math.abs(v[1])]; },
  floor(v: Vec2): Vec2 { return [Math.floor(v[0]), Math.floor(v[1])]; },
  ceil(v: Vec2): Vec2 { return [Math.ceil(v[0]), Math.ceil(v[1])]; },
  round(v: Vec2): Vec2 { return [Math.round(v[0]), Math.round(v[1])]; },

  min(a: Vec2, b: Vec2): Vec2 { return [Math.min(a[0], b[0]), Math.min(a[1], b[1])]; },
  max(a: Vec2, b: Vec2): Vec2 { return [Math.max(a[0], b[0]), Math.max(a[1], b[1])]; },
  clamp(v: Vec2, lo: Vec2, hi: Vec2): Vec2 {
    return [
      Math.max(lo[0], Math.min(hi[0], v[0])),
      Math.max(lo[1], Math.min(hi[1], v[1])),
    ];
  },

  lerp(a: Vec2, b: Vec2, t: number): Vec2 {
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  },
  smoothstep(a: Vec2, b: Vec2, t: number): Vec2 {
    const s = t * t * (3 - 2 * t);
    return [a[0] + (b[0] - a[0]) * s, a[1] + (b[1] - a[1]) * s];
  },

  angle(v: Vec2): number { return Math.atan2(v[1], v[0]); },
  fromAngle(radians: number): Vec2 { return [Math.cos(radians), Math.sin(radians)]; },

  rotate(v: Vec2, radians: number): Vec2 {
    const c = Math.cos(radians), s = Math.sin(radians);
    return [v[0] * c - v[1] * s, v[0] * s + v[1] * c];
  },

  equals(a: Vec2, b: Vec2): boolean { return a[0] === b[0] && a[1] === b[1]; },
  almostEquals(a: Vec2, b: Vec2, epsilon = EPSILON): boolean {
    return Math.abs(a[0] - b[0]) < epsilon && Math.abs(a[1] - b[1]) < epsilon;
  },
} as const;
