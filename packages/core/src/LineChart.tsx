import React, { useState } from 'react';
import { Box } from './primitives';
import { ChartTooltip } from './ChartTooltip';
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

export function LineChart({
  data,
  width = 280,
  height = 120,
  color = '#3b82f6',
  showDots = true,
  showArea = false,
  areaOpacity = 0.3,
  interactive = false,
  onPointHover,
  onPointPress,
  style,
}: LineChartProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  if (data.length === 0) {
    return <Box style={{ width, height, ...style }} />;
  }

  const values = data.map(d => d.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const dotSize = 4;
  const colWidth = Math.max(1, width / data.length);
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
      ...style,
    }}>
      {data.map((point, i) => {
        const normalized = (point.value - min) / range;
        const dataHeight = Math.max(dotSize, Math.round(normalized * (height - dotSize) + dotSize));
        const spacerHeight = height - dataHeight;
        const isHovered = hoveredIndex === i;

        return (
          <Box
            key={i}
            onPointerEnter={interactive ? () => handleHover(i) : undefined}
            onPointerLeave={interactive ? () => handleHover(null) : undefined}
            onClick={interactive && onPointPress ? () => onPointPress(i, point) : undefined}
            style={{
              width: colWidth,
              height,
              position: 'relative',
            }}
          >
            {/* Spacer pushes content to correct y */}
            <Box style={{ height: spacerHeight }} />

            {/* Dot */}
            {showDots && (
              <Box style={{
                width: isHovered ? dotSize + 2 : dotSize,
                height: isHovered ? dotSize + 2 : dotSize,
                borderRadius: (isHovered ? dotSize + 2 : dotSize) / 2,
                backgroundColor: color,
                alignSelf: 'center',
                opacity: interactive && anyHovered && !isHovered ? 0.35 : 1,
              }} />
            )}

            {/* Area fill from dot to bottom */}
            {showArea && (
              <Box style={{
                flexGrow: 1,
                backgroundColor: color,
                opacity: interactive && anyHovered && !isHovered ? 0.1 : areaOpacity,
              }} />
            )}

            {/* Crosshair line */}
            {interactive && isHovered && (
              <Box style={{
                position: 'absolute',
                top: 0,
                bottom: 0,
                left: 0,
                right: 0,
                alignItems: 'center',
              }}>
                <Box style={{
                  width: 1,
                  height,
                  backgroundColor: '#475569',
                }} />
              </Box>
            )}

            {/* Tooltip */}
            <ChartTooltip visible={interactive && isHovered} anchor="top">
              {point.x ? <ChartTooltip.Label>{point.x}</ChartTooltip.Label> : null}
              <ChartTooltip.Value>{`${point.value}`}</ChartTooltip.Value>
            </ChartTooltip>
          </Box>
        );
      })}
    </Box>
  );
}
