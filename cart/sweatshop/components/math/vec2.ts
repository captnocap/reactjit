export type Vec2 = [number, number];

export function vec2(x = 0, y = 0): Vec2 {
  return [x, y];
}

export function addVec2(a: Vec2, b: Vec2): Vec2 {
  return [a[0] + b[0], a[1] + b[1]];
}

export function subVec2(a: Vec2, b: Vec2): Vec2 {
  return [a[0] - b[0], a[1] - b[1]];
}

export function scaleVec2(v: Vec2, s: number): Vec2 {
  return [v[0] * s, v[1] * s];
}

export function dotVec2(a: Vec2, b: Vec2): number {
  return a[0] * b[0] + a[1] * b[1];
}

export function crossVec2(a: Vec2, b: Vec2): number {
  return a[0] * b[1] - a[1] * b[0];
}

export function lengthVec2(v: Vec2): number {
  return Math.hypot(v[0], v[1]);
}

export function normalizeVec2(v: Vec2): Vec2 {
  const len = lengthVec2(v);
  return len > 0 ? [v[0] / len, v[1] / len] : [0, 0];
}

export function distanceVec2(a: Vec2, b: Vec2): number {
  return lengthVec2(subVec2(a, b));
}

export function lerpVec2(a: Vec2, b: Vec2, t: number): Vec2 {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}

export function clampVec2(v: Vec2, min: Vec2, max: Vec2): Vec2 {
  return [
    Math.max(min[0], Math.min(max[0], v[0])),
    Math.max(min[1], Math.min(max[1], v[1])),
  ];
}

export function fromAngleVec2(radians: number, length = 1): Vec2 {
  return [Math.cos(radians) * length, Math.sin(radians) * length];
}

export function rotateVec2(v: Vec2, radians: number): Vec2 {
  const c = Math.cos(radians);
  const s = Math.sin(radians);
  return [v[0] * c - v[1] * s, v[0] * s + v[1] * c];
}

export function roundVec2(v: Vec2, digits = 3): Vec2 {
  const factor = 10 ** digits;
  return [Math.round(v[0] * factor) / factor, Math.round(v[1] * factor) / factor];
}
