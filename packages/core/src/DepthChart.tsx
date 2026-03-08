import React from 'react';
import type { Style, Color } from './types';

export interface DepthLevel {
  price: number;
  size: number;
}

export interface DepthChartProps {
  bids: DepthLevel[];
  asks: DepthLevel[];
  bidColor?: Color;
  askColor?: Color;
  bidFillColor?: Color;
  askFillColor?: Color;
  width?: number;
  height?: number;
  style?: Style;
}

export function DepthChart({ style, width, height, ...rest }: DepthChartProps) {
  return React.createElement('Chart2D', {
    chartType: 'depth',
    ...rest,
    width,
    height,
    style: {
      ...(width == null ? { width: '100%' } : {}),
      ...style,
      ...(width != null ? { width } : {}),
      ...(height != null ? { height } : {}),
    },
  });
}
