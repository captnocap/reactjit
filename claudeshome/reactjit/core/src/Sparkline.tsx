import React, { useState } from 'react';
import { Box } from './primitives';
import { ChartTooltip } from './ChartTooltip';
import type { Style, Color } from './types';

export interface SparklineProps {
  data: number[];
  width?: number;
  height?: number;
  color?: Color;
  style?: Style;
  interactive?: boolean;
  onPointHover?: (index: number | null, value: number | null) => void;
  onPointPress?: (index: number, value: number) => void;
}

export function Sparkline({
  data,
  width = 80,
  height = 24,
  color = '#3b82f6',
  style,
  interactive = false,
  onPointHover,
  onPointPress,
}: SparklineProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  if (data.length === 0) {
    return <Box style={{ width, height, ...style }} />;
  }

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const barGap = 1;
  const barWidth = Math.max(1, (width - (data.length - 1) * barGap) / data.length);
  const anyHovered = hoveredIndex !== null;

  const handleHover = (i: number | null) => {
    setHoveredIndex(i);
    if (onPointHover) {
      onPointHover(i, i !== null ? data[i] : null);
    }
  };

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
        const isHovered = hoveredIndex === i;
        return (
          <Box
            key={i}
            onPointerEnter={interactive ? () => handleHover(i) : undefined}
            onPointerLeave={interactive ? () => handleHover(null) : undefined}
            onClick={interactive && onPointPress ? () => onPointPress(i, value) : undefined}
            style={{
              width: barWidth,
              height: barHeight,
              backgroundColor: color,
              borderRadius: 1,
              position: interactive ? 'relative' : undefined,
              opacity: interactive && anyHovered && !isHovered ? 0.35 : 1,
            }}
          >
            <ChartTooltip visible={interactive && isHovered} anchor="top">
              <ChartTooltip.Value>{`${value}`}</ChartTooltip.Value>
              <ChartTooltip.Detail>{`index ${i}`}</ChartTooltip.Detail>
            </ChartTooltip>
          </Box>
        );
      })}
    </Box>
  );
}
