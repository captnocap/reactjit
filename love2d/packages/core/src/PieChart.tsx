import React from 'react';
import type { Style, Color } from './types';

export interface PieChartSegment {
  label: string;
  value: number;
  color: Color;
}

export interface PieChartProps {
  data: PieChartSegment[];
  size?: number;
  innerRadius?: number;
  interactive?: boolean;
  style?: Style;
}

export function PieChart({ style, size, ...rest }: PieChartProps) {
  // rjit-ignore-next-line — .tslx migration candidate: chart data compute
  const total = rest.data.reduce((s, d) => s + d.value, 0) || 1;
  const tooltip = rest.interactive && rest.data.length > 0
    ? { content: rest.data.map(d => `${d.label}:\t${d.value} (${Math.round(d.value / total * 100)}%)`).join('\n'), layout: 'table' as const }
    : undefined;

  return React.createElement('Chart2D', {
    chartType: 'pie',
    ...rest,
    size,
    tooltip,
    style: { ...style, ...(size != null ? { width: size, height: size } : {}) },
  });
}
