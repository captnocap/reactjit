// Effect context — built each frame by __dispatchEffectRender and passed as
// `e` to the user's onRender callback. Handles the zero-copy pixel buffer
// view plus all the helper math, color, and noise functions.
//
// Hot path: setPixel is called per-pixel in nested loops. We stay in JS and
// write directly to the Uint8ClampedArray view — no FFI hop per pixel.

export type Vec3 = [number, number, number];

// ── Value noise (fast hash-based) ─────────────────────────────────
// Not Perlin; deterministic bilinear/trilinear-interpolated value noise.
// Close enough aesthetically to the noise primitives used in the .tsz
// effects being ported.

function hash2(x: number, y: number): number {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

function hash3(x: number, y: number, z: number): number {
  let h =
    Math.imul(x | 0, 374761393) ^
    Math.imul(y | 0, 668265263) ^
    Math.imul(z | 0, 2147483647);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

function smooth(t: number): number {
  return t * t * (3 - 2 * t);
}

function noise2(x: number, y: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = smooth(x - xi);
  const yf = smooth(y - yi);
  const a = hash2(xi, yi);
  const b = hash2(xi + 1, yi);
  const c = hash2(xi, yi + 1);
  const d = hash2(xi + 1, yi + 1);
  const ab = a + (b - a) * xf;
  const cd = c + (d - c) * xf;
  return (ab + (cd - ab) * yf) * 2 - 1;
}

function noise3(x: number, y: number, z: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const zi = Math.floor(z);
  const xf = smooth(x - xi);
  const yf = smooth(y - yi);
  const zf = smooth(z - zi);

  const c000 = hash3(xi, yi, zi);
  const c100 = hash3(xi + 1, yi, zi);
  const c010 = hash3(xi, yi + 1, zi);
  const c110 = hash3(xi + 1, yi + 1, zi);
  const c001 = hash3(xi, yi, zi + 1);
  const c101 = hash3(xi + 1, yi, zi + 1);
  const c011 = hash3(xi, yi + 1, zi + 1);
  const c111 = hash3(xi + 1, yi + 1, zi + 1);

  const x00 = c000 + (c100 - c000) * xf;
  const x10 = c010 + (c110 - c010) * xf;
  const x01 = c001 + (c101 - c001) * xf;
  const x11 = c011 + (c111 - c011) * xf;
  const y0 = x00 + (x10 - x00) * yf;
  const y1 = x01 + (x11 - x01) * yf;
  return (y0 + (y1 - y0) * zf) * 2 - 1;
}

function fbm(x: number, y: number, octaves: number): number {
  let sum = 0;
  let amp = 1;
  let freq = 1;
  let norm = 0;
  const n = Math.max(1, Math.min(8, octaves | 0));
  for (let i = 0; i < n; i++) {
    sum += noise2(x * freq, y * freq) * amp;
    norm += amp;
    amp *= 0.5;
    freq *= 2;
  }
  return norm > 0 ? sum / norm : 0;
}

// ── Color helpers ─────────────────────────────────────────────────

function hsv(h: number, s: number, v: number): Vec3 {
  const hh = (h - Math.floor(h)) * 6;
  const i = Math.floor(hh);
  const f = hh - i;
  const p = v * (1 - s);
  const q = v * (1 - s * f);
  const t = v * (1 - s * (1 - f));
  switch (i % 6) {
    case 0: return [v, t, p];
    case 1: return [q, v, p];
    case 2: return [p, v, t];
    case 3: return [p, q, v];
    case 4: return [t, p, v];
    default: return [v, p, q];
  }
}

function hue2rgb(p: number, q: number, t: number): number {
  if (t < 0) t += 1;
  if (t > 1) t -= 1;
  if (t < 1 / 6) return p + (q - p) * 6 * t;
  if (t < 1 / 2) return q;
  if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
  return p;
}

function hsl(h: number, s: number, l: number): Vec3 {
  if (s === 0) return [l, l, l];
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return [hue2rgb(p, q, h + 1 / 3), hue2rgb(p, q, h), hue2rgb(p, q, h - 1 / 3)];
}

// ── Context factory ───────────────────────────────────────────────

export interface EffectContext {
  width: number;
  height: number;
  time: number;
  dt: number;
  frame: number;
  mouse_x: number;
  mouse_y: number;
  mouse_inside: boolean;

  setPixel(x: number, y: number, r: number, g: number, b: number, a: number): void;
  setPixelRaw(x: number, y: number, r: number, g: number, b: number, a: number): void;
  getPixel(x: number, y: number): [number, number, number, number];
  clearColor(r: number, g: number, b: number, a: number): void;
  fade(alpha: number): void;

  sin(x: number): number;
  cos(x: number): number;
  tan(x: number): number;
  atan2(y: number, x: number): number;
  sqrt(x: number): number;
  abs(x: number): number;
  floor(x: number): number;
  ceil(x: number): number;
  pow(x: number, y: number): number;
  exp(x: number): number;
  log(x: number): number;
  min(...xs: number[]): number;
  max(...xs: number[]): number;
  clamp(x: number, lo: number, hi: number): number;
  mod(x: number, y: number): number;

  noise2(x: number, y: number): number;
  noise3(x: number, y: number, z: number): number;
  fbm(x: number, y: number, octaves: number): number;
  hsv(h: number, s: number, v: number): Vec3;
  hsl(h: number, s: number, l: number): Vec3;
}

// One context per node, reused across frames. The pixel buffer is detached
// and reassigned each frame — we rebuild the typed array view when the
// buffer identity changes.
interface ContextSlot {
  ctx: EffectContext;
  buffer: ArrayBuffer | null;
  pixels: Uint8ClampedArray | null;
  stride: number;
}

const slots = new Map<number, ContextSlot>();

export function getOrCreateContext(id: number): EffectContext {
  let slot = slots.get(id);
  if (slot) return slot.ctx;

  slot = { ctx: null as any, buffer: null, pixels: null, stride: 0 };

  const ctx: EffectContext = {
    width: 0,
    height: 0,
    time: 0,
    dt: 0,
    frame: 0,
    mouse_x: 0,
    mouse_y: 0,
    mouse_inside: false,

    setPixel(x, y, r, g, b, a) {
      const px = slot!.pixels;
      if (!px) return;
      const ux = x | 0;
      const uy = y | 0;
      if (ux < 0 || uy < 0 || ux >= ctx.width || uy >= ctx.height) return;
      const idx = uy * slot!.stride + ux * 4;
      px[idx] = r * 255;
      px[idx + 1] = g * 255;
      px[idx + 2] = b * 255;
      px[idx + 3] = a * 255;
    },

    setPixelRaw(x, y, r, g, b, a) {
      const px = slot!.pixels;
      if (!px) return;
      const ux = x | 0;
      const uy = y | 0;
      if (ux < 0 || uy < 0 || ux >= ctx.width || uy >= ctx.height) return;
      const idx = uy * slot!.stride + ux * 4;
      px[idx] = r;
      px[idx + 1] = g;
      px[idx + 2] = b;
      px[idx + 3] = a;
    },

    getPixel(x, y) {
      const px = slot!.pixels;
      if (!px) return [0, 0, 0, 0];
      const ux = x | 0;
      const uy = y | 0;
      if (ux < 0 || uy < 0 || ux >= ctx.width || uy >= ctx.height) return [0, 0, 0, 0];
      const idx = uy * slot!.stride + ux * 4;
      return [px[idx] / 255, px[idx + 1] / 255, px[idx + 2] / 255, px[idx + 3] / 255];
    },

    clearColor(r, g, b, a) {
      const px = slot!.pixels;
      if (!px) return;
      const r8 = (r * 255) | 0;
      const g8 = (g * 255) | 0;
      const b8 = (b * 255) | 0;
      const a8 = (a * 255) | 0;
      for (let i = 0; i < px.length; i += 4) {
        px[i] = r8;
        px[i + 1] = g8;
        px[i + 2] = b8;
        px[i + 3] = a8;
      }
    },

    fade(alpha) {
      const px = slot!.pixels;
      if (!px) return;
      const a = Math.max(0, Math.min(1, alpha));
      // Trail-decay: multiply every pixel's alpha channel by `a`. Cheaper
      // than a full RGB fade and matches love2d's spirograph trail behavior.
      for (let i = 3; i < px.length; i += 4) {
        px[i] = (px[i] * a) | 0;
      }
    },

    sin: Math.sin,
    cos: Math.cos,
    tan: Math.tan,
    atan2: Math.atan2,
    sqrt: Math.sqrt,
    abs: Math.abs,
    floor: Math.floor,
    ceil: Math.ceil,
    pow: Math.pow,
    exp: Math.exp,
    log: Math.log,
    min: Math.min,
    max: Math.max,
    clamp: (x, lo, hi) => (x < lo ? lo : x > hi ? hi : x),
    mod: (x, y) => {
      const r = x - Math.floor(x / y) * y;
      return r;
    },

    noise2,
    noise3,
    fbm,
    hsv,
    hsl,
  };

  slot.ctx = ctx;
  slots.set(id, slot);
  return ctx;
}

export function prepareContext(
  id: number,
  buffer: ArrayBuffer,
  width: number,
  height: number,
  stride: number,
  time: number,
  dt: number,
  mouse_x: number,
  mouse_y: number,
  mouse_inside: boolean,
  frame: number,
): EffectContext {
  const ctx = getOrCreateContext(id);
  const slot = slots.get(id)!;
  // The ArrayBuffer identity changes every frame (host re-wraps the Zig
  // pixel buffer each call, then detaches it when the handler returns).
  // Rebuild the Uint8ClampedArray view so writes land in the fresh buffer.
  if (slot.buffer !== buffer) {
    slot.buffer = buffer;
    slot.pixels = new Uint8ClampedArray(buffer);
  }
  slot.stride = stride;
  ctx.width = width;
  ctx.height = height;
  ctx.time = time;
  ctx.dt = dt;
  ctx.mouse_x = mouse_x;
  ctx.mouse_y = mouse_y;
  ctx.mouse_inside = mouse_inside;
  ctx.frame = frame;
  return ctx;
}

export function releaseContext(id: number): void {
  slots.delete(id);
}
