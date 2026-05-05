// Easing + interpolation helpers. All functions take t in [0..1] and return
// a scaled value. Classic Robert Penner set + cubic-bezier + catmull-rom.

export type EasingFn = (t: number) => number;

export function clamp01(t: number): number { return t < 0 ? 0 : t > 1 ? 1 : t; }

export const linear:       EasingFn = (t) => clamp01(t);
export const easeInQuad:   EasingFn = (t) => { t = clamp01(t); return t * t; };
export const easeOutQuad:  EasingFn = (t) => { t = clamp01(t); return 1 - (1 - t) * (1 - t); };
export const easeInOutQuad:EasingFn = (t) => { t = clamp01(t); return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; };
export const easeInCubic:  EasingFn = (t) => { t = clamp01(t); return t * t * t; };
export const easeOutCubic: EasingFn = (t) => { t = clamp01(t); return 1 - Math.pow(1 - t, 3); };
export const easeInOutCubic:EasingFn = (t) => { t = clamp01(t); return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
export const easeInQuart:  EasingFn = (t) => { t = clamp01(t); return t * t * t * t; };
export const easeOutQuart: EasingFn = (t) => { t = clamp01(t); return 1 - Math.pow(1 - t, 4); };
export const easeInExpo:   EasingFn = (t) => { t = clamp01(t); return t === 0 ? 0 : Math.pow(2, 10 * t - 10); };
export const easeOutExpo:  EasingFn = (t) => { t = clamp01(t); return t === 1 ? 1 : 1 - Math.pow(2, -10 * t); };
export const easeInOutExpo:EasingFn = (t) => {
  t = clamp01(t);
  if (t === 0) return 0; if (t === 1) return 1;
  return t < 0.5 ? Math.pow(2, 20 * t - 10) / 2 : (2 - Math.pow(2, -20 * t + 10)) / 2;
};
export const easeOutBack:  EasingFn = (t) => { t = clamp01(t); const c = 1.70158, c3 = c + 1; return 1 + c3 * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };
export const easeInBack:   EasingFn = (t) => { t = clamp01(t); const c = 1.70158, c3 = c + 1; return c3 * t * t * t - c * t * t; };
export const easeOutElastic: EasingFn = (t) => {
  t = clamp01(t);
  const c = (2 * Math.PI) / 3;
  return t === 0 ? 0 : t === 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c) + 1;
};
export const easeOutBounce: EasingFn = (t) => {
  t = clamp01(t);
  const n1 = 7.5625, d1 = 2.75;
  if (t < 1 / d1)      return n1 * t * t;
  else if (t < 2 / d1) { t -= 1.5 / d1; return n1 * t * t + 0.75; }
  else if (t < 2.5 / d1) { t -= 2.25 / d1; return n1 * t * t + 0.9375; }
  else                 { t -= 2.625 / d1; return n1 * t * t + 0.984375; }
};

export const EASING_PRESETS: { id: string; label: string; fn: EasingFn }[] = [
  { id: 'linear',         label: 'Linear',          fn: linear },
  { id: 'easeInQuad',     label: 'In Quad',         fn: easeInQuad },
  { id: 'easeOutQuad',    label: 'Out Quad',        fn: easeOutQuad },
  { id: 'easeInOutQuad',  label: 'InOut Quad',      fn: easeInOutQuad },
  { id: 'easeInCubic',    label: 'In Cubic',        fn: easeInCubic },
  { id: 'easeOutCubic',   label: 'Out Cubic',       fn: easeOutCubic },
  { id: 'easeInOutCubic', label: 'InOut Cubic',     fn: easeInOutCubic },
  { id: 'easeInQuart',    label: 'In Quart',        fn: easeInQuart },
  { id: 'easeOutQuart',   label: 'Out Quart',       fn: easeOutQuart },
  { id: 'easeInExpo',     label: 'In Expo',         fn: easeInExpo },
  { id: 'easeOutExpo',    label: 'Out Expo',        fn: easeOutExpo },
  { id: 'easeInOutExpo',  label: 'InOut Expo',      fn: easeInOutExpo },
  { id: 'easeInBack',     label: 'In Back',         fn: easeInBack },
  { id: 'easeOutBack',    label: 'Out Back',        fn: easeOutBack },
  { id: 'easeOutElastic', label: 'Out Elastic',     fn: easeOutElastic },
  { id: 'easeOutBounce',  label: 'Out Bounce',      fn: easeOutBounce },
];

export function easingById(id: string): EasingFn {
  const p = EASING_PRESETS.find((e) => e.id === id);
  return p ? p.fn : linear;
}

// Cubic Bezier (x1,y1,x2,y2) — compatible with CSS transition-timing-function.
// Solves t for a given x via Newton-Raphson, then samples y(t).
export function cubicBezier(x1: number, y1: number, x2: number, y2: number): EasingFn {
  const A = (a: number, b: number) => 1 - 3 * b + 3 * a;
  const B = (a: number, b: number) => 3 * b - 6 * a;
  const C = (a: number) => 3 * a;
  const calcBezier = (t: number, a1: number, a2: number) => ((A(a1, a2) * t + B(a1, a2)) * t + C(a1)) * t;
  const slope = (t: number, a1: number, a2: number) => 3 * A(a1, a2) * t * t + 2 * B(a1, a2) * t + C(a1);
  return (tX: number) => {
    tX = clamp01(tX);
    if (tX === 0 || tX === 1) return tX;
    let t = tX;
    for (let i = 0; i < 8; i++) {
      const cur = calcBezier(t, x1, x2) - tX;
      const d = slope(t, x1, x2);
      if (Math.abs(d) < 1e-6) break;
      t -= cur / d;
    }
    return calcBezier(t, y1, y2);
  };
}

// Catmull-Rom spline through a list of (x,y) control points. Useful for
// animating along a curve rather than a single easing axis.
export function catmullRom(points: [number, number][], tension: number = 0.5): (t: number) => [number, number] {
  if (points.length < 2) return () => points[0] || [0, 0];
  return (t: number) => {
    const n = points.length - 1;
    const u = clamp01(t) * n;
    const i = Math.min(n - 1, Math.floor(u));
    const f = u - i;
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[Math.min(n, i + 1)];
    const p3 = points[Math.min(n, i + 2)];
    const s = tension;
    const h1 = 2 * f * f * f - 3 * f * f + 1;
    const h2 = -2 * f * f * f + 3 * f * f;
    const h3 = f * f * f - 2 * f * f + f;
    const h4 = f * f * f - f * f;
    const m1x = s * (p2[0] - p0[0]);
    const m1y = s * (p2[1] - p0[1]);
    const m2x = s * (p3[0] - p1[0]);
    const m2y = s * (p3[1] - p1[1]);
    return [h1 * p1[0] + h2 * p2[0] + h3 * m1x + h4 * m2x, h1 * p1[1] + h2 * p2[1] + h3 * m1y + h4 * m2y];
  };
}
