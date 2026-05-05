
export type ChartScaleMode = 'linear' | 'log';

export type ChartScale = {
  mode: ChartScaleMode;
  domain: [number, number];
  range: [number, number];
  scale: (value: number) => number;
  invert: (value: number) => number;
  ticks: number[];
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function niceStep(span: number, count: number): number {
  if (!Number.isFinite(span) || span <= 0) return 1;
  const raw = span / Math.max(1, count);
  const pow = Math.pow(10, Math.floor(Math.log10(raw)));
  const frac = raw / pow;
  const nice = frac <= 1 ? 1 : frac <= 2 ? 2 : frac <= 2.5 ? 2.5 : frac <= 5 ? 5 : 10;
  return nice * pow;
}

function linear(domain: [number, number], range: [number, number]): ChartScale {
  const [d0, d1] = domain;
  const [r0, r1] = range;
  const span = d1 - d0 || 1;
  const scale = (value: number) => r0 + ((value - d0) / span) * (r1 - r0);
  const invert = (value: number) => d0 + ((value - r0) / (r1 - r0 || 1)) * span;
  const step = niceStep(Math.abs(span), 5);
  const start = Math.ceil(Math.min(d0, d1) / step) * step;
  const end = Math.floor(Math.max(d0, d1) / step) * step;
  const ticks: number[] = [];
  for (let value = start; value <= end + step * 0.5; value += step) ticks.push(Number(value.toFixed(6)));
  if (ticks.length === 0) ticks.push(d0, d1);
  return { mode: 'linear', domain, range, scale, invert, ticks };
}

function positiveDomain(domain: [number, number]): [number, number] {
  const minPositive = Math.min(
    Math.max(domain[0], 1e-6),
    Math.max(domain[1], 1e-6),
  );
  const maxPositive = Math.max(Math.max(domain[0], 1e-6), Math.max(domain[1], 1e-6));
  return [minPositive, maxPositive];
}

function log(domain: [number, number], range: [number, number]): ChartScale {
  const [d0, d1] = positiveDomain(domain);
  const [r0, r1] = range;
  const log0 = Math.log10(d0);
  const log1 = Math.log10(d1 || d0 * 10);
  const span = log1 - log0 || 1;
  const scale = (value: number) => {
    const v = Math.max(value, d0);
    return r0 + ((Math.log10(v) - log0) / span) * (r1 - r0);
  };
  const invert = (value: number) => {
    const t = (value - r0) / (r1 - r0 || 1);
    return Math.pow(10, log0 + t * span);
  };
  const ticks: number[] = [];
  const start = Math.floor(log0);
  const end = Math.ceil(log1);
  for (let exp = start; exp <= end; exp += 1) ticks.push(Number(Math.pow(10, exp).toFixed(6)));
  if (ticks.length === 0) ticks.push(d0, d1);
  return { mode: 'log', domain: [d0, d1], range, scale, invert, ticks };
}

export function createChartScale(mode: ChartScaleMode, domain: [number, number], range: [number, number]): ChartScale {
  if (mode === 'log') return log(domain, range);
  return linear(domain, range);
}

export function useChartScale(mode: ChartScaleMode, domain: [number, number], range: [number, number]): ChartScale {
  return useMemo(() => createChartScale(mode, domain, range), [mode, domain[0], domain[1], range[0], range[1]]);
}

export function formatTick(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1000000) return (value / 1000000).toFixed(abs >= 10000000 ? 0 : 1) + 'M';
  if (abs >= 1000) return (value / 1000).toFixed(abs >= 10000 ? 0 : 1) + 'K';
  if (Number.isInteger(value)) return String(value);
  return String(Math.round(value * 10) / 10);
}
