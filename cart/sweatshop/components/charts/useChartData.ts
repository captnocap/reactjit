const React: any = require('react');
const { useMemo } = React;

export type ChartDatum =
  | number
  | null
  | undefined
  | {
      x?: string | number;
      y?: number | null;
      value?: number | null;
      label?: string;
      name?: string;
      color?: string;
    };

export type ChartSeriesInput = {
  label?: string;
  color?: string;
  data: ChartDatum[];
};

export type ChartInput = Array<ChartDatum | ChartSeriesInput>;

export type ChartPoint = {
  index: number;
  label: string;
  x: number;
  y: number | null;
  color?: string;
  raw: ChartDatum;
  seriesId: string;
  seriesLabel: string;
};

export type ChartSeries = {
  id: string;
  label: string;
  color: string;
  points: ChartPoint[];
  min: number;
  max: number;
  sum: number;
};

export type ChartData = {
  series: ChartSeries[];
  labels: string[];
  min: number;
  max: number;
  pointCount: number;
  seriesCount: number;
};

function isSeriesInput(item: ChartDatum | ChartSeriesInput): item is ChartSeriesInput {
  return !!item && typeof item === 'object' && Array.isArray((item as ChartSeriesInput).data);
}

function asNumber(value: any): number | null {
  if (value == null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function baseLabel(value: ChartDatum, index: number): string {
  if (typeof value === 'number') return String(index + 1);
  if (!value || typeof value !== 'object') return String(index + 1);
  return String(value.label ?? value.name ?? value.x ?? index + 1);
}

function pointValue(value: ChartDatum): number | null {
  if (typeof value === 'number') return value;
  if (!value || typeof value !== 'object') return null;
  return asNumber(value.y ?? value.value);
}

function colorFor(value: ChartDatum, fallback: string | undefined): string | undefined {
  if (value && typeof value === 'object' && value.color) return value.color;
  return fallback;
}

function normalizeSeries(input: ChartSeriesInput, index: number): ChartSeries {
  const fallbackColor = input.color;
  const points: ChartPoint[] = input.data.map((datum, pointIndex) => ({
    index: pointIndex,
    label: baseLabel(datum, pointIndex),
    x: pointIndex,
    y: pointValue(datum),
    color: colorFor(datum, fallbackColor),
    raw: datum,
    seriesId: 's' + index,
    seriesLabel: input.label || 'Series ' + (index + 1),
  }));
  let min = Infinity;
  let max = -Infinity;
  let sum = 0;
  for (const point of points) {
    if (point.y == null) continue;
    min = Math.min(min, point.y);
    max = Math.max(max, point.y);
    sum += point.y;
  }
  return {
    id: 's' + index,
    label: input.label || 'Series ' + (index + 1),
    color: fallbackColor || '#3b82f6',
    points,
    min: min === Infinity ? 0 : min,
    max: max === -Infinity ? 0 : max,
    sum,
  };
}

function normalizePoints(input: ChartDatum[], index: number): ChartSeries {
  return normalizeSeries({ label: index === 0 ? 'Series' : 'Series ' + (index + 1), data: input }, index);
}

export function normalizeChartData(data: ChartInput): ChartData {
  const raw = Array.isArray(data) ? data : [];
  const seriesInputs = raw.some(isSeriesInput)
    ? (raw.filter(isSeriesInput) as ChartSeriesInput[])
    : [raw as ChartDatum[]];

  const series = seriesInputs.map((item, index) => Array.isArray(item) ? normalizePoints(item, index) : normalizeSeries(item, index));
  const labels: string[] = [];
  let min = Infinity;
  let max = -Infinity;

  for (const s of series) {
    for (const point of s.points) {
      if (labels.length <= point.index) labels[point.index] = point.label;
      if (point.y == null) continue;
      min = Math.min(min, point.y);
      max = Math.max(max, point.y);
    }
  }

  return {
    series,
    labels: labels.filter((item) => item != null).map((item) => String(item)),
    min: min === Infinity ? 0 : min,
    max: max === -Infinity ? 0 : max,
    pointCount: labels.length,
    seriesCount: series.length,
  };
}

export function useChartData(data: ChartInput): ChartData {
  return useMemo(() => normalizeChartData(data), [JSON.stringify(data)]);
}
