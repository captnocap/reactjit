import React from 'react';
import type { Style, Color } from './types';

export interface BarChartBar {
  label: string;
  value: number;
  color?: Color;
}

export interface BarChartProps {
  data: BarChartBar[];
  height?: number;
  barWidth?: number;
  gap?: number;
  showLabels?: boolean;
  showValues?: boolean;
  color?: Color;
  style?: Style;
  interactive?: boolean;
  onBarHover?: (index: number | null, bar: BarChartBar | null) => void;
  onBarPress?: (index: number, bar: BarChartBar) => void;
}

export function BarChart({ style, width, height, ...rest }: BarChartProps) {
  return React.createElement('Chart2D', {
    chartType: 'bar',
    ...rest,
    width,
    height,
    style: { ...style, ...(width != null ? { width } : {}), ...(height != null ? { height } : {}) },
  });
}
