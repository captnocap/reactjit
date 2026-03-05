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
  return React.createElement('Chart2D', {
    chartType: 'pie',
    ...rest,
    size,
    style: { ...style, ...(size != null ? { width: size, height: size } : {}) },
  });
}
