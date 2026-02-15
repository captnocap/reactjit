import React from 'react';
import { Box } from './primitives';
import type { Style, Color } from './types';

export interface SparklineProps {
  data: number[];
  width?: number;
  height?: number;
  color?: Color;
  style?: Style;
}

export function Sparkline({
  data,
  width = 80,
  height = 24,
  color = '#3b82f6',
  style,
}: SparklineProps) {
  if (data.length === 0) {
    return <Box style={{ width, height, ...style }} />;
  }

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const barGap = 1;
  const barWidth = Math.max(1, (width - (data.length - 1) * barGap) / data.length);

  return (
    <Box style={{
      width,
      height,
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: barGap,
      ...style,
    }}>
      {data.map((value, i) => {
        const normalized = (value - min) / range;
        const barHeight = Math.max(1, Math.round(normalized * height));
        return (
          <Box
            key={i}
            style={{
              width: barWidth,
              height: barHeight,
              backgroundColor: color,
              borderRadius: 1,
            }}
          />
        );
      })}
    </Box>
  );
}
