import React from 'react';
import type { Style, Color } from './types';

export interface LineChartPoint {
  x?: string;
  value: number;
}

export interface LineChartProps {
  data: LineChartPoint[];
  width?: number;
  height?: number;
  color?: Color;
  showDots?: boolean;
  showArea?: boolean;
  areaOpacity?: number;
  interactive?: boolean;
  onPointHover?: (index: number | null, point: LineChartPoint | null) => void;
  onPointPress?: (index: number, point: LineChartPoint) => void;
  style?: Style;
}

export function LineChart({ style, width, height, ...rest }: LineChartProps) {
  return React.createElement('Chart2D', {
    chartType: 'line',
    ...rest,
    width,
    height,
    style: { ...style, ...(width != null ? { width } : {}), ...(height != null ? { height } : {}) },
  });
}
