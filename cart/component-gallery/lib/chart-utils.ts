const React: any = require('react');

export const PALETTE = {
  pink: '#f06292',
  pinkLight: '#f8bbd0',
  pinkDark: '#c2185b',
  cyan: '#4fc3f7',
  cyanLight: '#b3e5fc',
  cyanDark: '#0288d1',
  blue: '#7986cb',
  blueLight: '#c5cae9',
  blueDark: '#303f9f',
  purple: '#ba68c8',
  teal: '#4db6ac',
  indigo: '#5c6bc0',
  slate: '#37474f',
  slateLight: '#90a4ae',
  white: '#ffffff',
  bg: '#1a1a2e',
};

export const COLORS = [
  PALETTE.pink,
  PALETTE.cyan,
  PALETTE.blue,
  PALETTE.purple,
  PALETTE.teal,
  PALETTE.indigo,
  PALETTE.pinkLight,
  PALETTE.cyanLight,
];

export function scaleLinear(domain: [number, number], range: [number, number]) {
  const [d0, d1] = domain;
  const [r0, r1] = range;
  const m = (r1 - r0) / (d1 - d0 || 1);
  return (v: number) => r0 + (v - d0) * m;
}

// Produces ~count nicely-rounded ticks covering [min, max].
//
// Old formula used `10 ^ floor(log10(range/count))` which collapses to 1 whenever
// range/count is in [1, 10) — e.g. range=32/count=4 → step=1 → 33 gridlines
// packed into the plot area as a dense bottom band. Replaced with the standard
// 1/2/5 × 10^k quantisation so the step size is always close to range/count
// but snaps to human-readable intervals.
export function niceTicks(min: number, max: number, count: number = 5): number[] {
  const range = max - min;
  if (range === 0) return [min];
  const rawStep = range / Math.max(1, count);
  const pow10 = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const norm = rawStep / pow10; // in [1, 10)
  let step: number;
  if (norm < 1.5) step = 1 * pow10;
  else if (norm < 3) step = 2 * pow10;
  else if (norm < 7) step = 5 * pow10;
  else step = 10 * pow10;
  const ticks: number[] = [];
  const start = Math.ceil(min / step) * step;
  // Loop guards against FP drift — step*0.5 slack avoids missing the last tick
  // and the hard cap prevents runaway if something pathological gets here.
  let t = start;
  while (t <= max + step * 0.5 && ticks.length < 128) {
    ticks.push(Number(t.toFixed(10)));
    t += step;
  }
  return ticks.length ? ticks : [min, max];
}

export function polar(cx: number, cy: number, radius: number, angleDeg: number): [number, number] {
  const rad = (angleDeg - 90) * (Math.PI / 180);
  return [cx + radius * Math.cos(rad), cy + radius * Math.sin(rad)];
}

export function arcPath(cx: number, cy: number, radius: number, start: number, end: number): string {
  const [sx, sy] = polar(cx, cy, radius, start);
  const [ex, ey] = polar(cx, cy, radius, end);
  const large = end - start > 180 ? 1 : 0;
  return `M ${sx} ${sy} A ${radius} ${radius} 0 ${large} 1 ${ex} ${ey}`;
}

export function donutSegment(cx: number, cy: number, inner: number, outer: number, start: number, end: number): string {
  const [sxo, syo] = polar(cx, cy, outer, start);
  const [exo, eyo] = polar(cx, cy, outer, end);
  const [sxi, syi] = polar(cx, cy, inner, start);
  const [exi, eyi] = polar(cx, cy, inner, end);
  const large = end - start > 180 ? 1 : 0;
  return `M ${sxo} ${syo} A ${outer} ${outer} 0 ${large} 1 ${exo} ${eyo} L ${exi} ${eyi} A ${inner} ${inner} 0 ${large} 0 ${sxi} ${syi} Z`;
}

export function hexColorWithAlpha(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

export type Margin = { top: number; right: number; bottom: number; left: number };

export function plotArea(width: number, height: number, margin: Margin = { top: 20, right: 20, bottom: 32, left: 40 }) {
  return {
    width,
    height,
    x: margin.left,
    y: margin.top,
    w: Math.max(40, width - margin.left - margin.right),
    h: Math.max(40, height - margin.top - margin.bottom),
  };
}

export function useDemoData() {
  return React.useMemo(() => ({
    months: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
    values1: [12, 19, 15, 25, 22, 30, 28, 35, 32, 40, 38, 45],
    values2: [8, 14, 18, 20, 24, 22, 26, 30, 28, 34, 36, 32],
    values3: [-10, -5, 8, 15, -3, 12, 20, 5, -8, 18, 25, 10],
  }), []);
}
