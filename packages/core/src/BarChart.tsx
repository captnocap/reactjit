import React, { useState } from 'react';
import { Box, Text } from './primitives';
import { ChartTooltip } from './ChartTooltip';
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

export function BarChart({
  data,
  height = 120,
  barWidth,
  gap = 8,
  showLabels = true,
  showValues = false,
  color = '#3b82f6',
  style,
  interactive = false,
  onBarHover,
  onBarPress,
}: BarChartProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  if (data.length === 0) {
    return <Box style={{ height, ...style }} />;
  }

  const maxValue = Math.max(...data.map(d => d.value)) || 1;
  const valueLabelSpace = showValues ? 14 : 0;
  const barAreaHeight = height - valueLabelSpace;

  // When barWidth is given, compute a fixed chart width (legacy behavior).
  // Otherwise, fill the parent and distribute bars evenly.
  const fixed = barWidth != null;
  const chartWidth = fixed ? data.length * barWidth + (data.length - 1) * gap : undefined;

  const handleHover = (i: number | null) => {
    setHoveredIndex(i);
    if (onBarHover) {
      onBarHover(i, i !== null ? data[i] : null);
    }
  };

  return (
    <Box style={{ width: chartWidth, ...style }}>
      {/* Chart area */}
      <Box style={{
        width: chartWidth ?? '100%',
        height,
        flexDirection: 'row',
        alignItems: 'flex-end',
        gap,
      }}>
        {data.map((bar, i) => {
          const barHeight = Math.max(1, Math.round((bar.value / maxValue) * barAreaHeight));
          const barColor = bar.color ?? color;
          const isHovered = hoveredIndex === i;
          const anyHovered = hoveredIndex !== null;
          const pct = Math.round((bar.value / maxValue) * 100);

          return (
            <Box
              key={i}
              onPointerEnter={interactive ? () => handleHover(i) : undefined}
              onPointerLeave={interactive ? () => handleHover(null) : undefined}
              onClick={interactive && onBarPress ? () => onBarPress(i, bar) : undefined}
              style={{
                alignItems: 'center',
                gap: 2,
                flexGrow: fixed ? 0 : 1,
                position: interactive ? 'relative' : undefined,
                opacity: interactive && anyHovered && !isHovered ? 0.35 : 1,
              }}
            >
              <ChartTooltip visible={interactive && isHovered} anchor="top">
                {bar.label ? <ChartTooltip.Label>{bar.label}</ChartTooltip.Label> : null}
                <ChartTooltip.Value>{`${bar.value}`}</ChartTooltip.Value>
                <ChartTooltip.Detail>{`${pct}%`}</ChartTooltip.Detail>
              </ChartTooltip>
              {showValues && (
                <Text style={{ color: '#94a3b8', fontSize: 9 }}>
                  {bar.value}
                </Text>
              )}
              <Box style={{
                width: barWidth,
                alignSelf: fixed ? undefined : 'stretch',
                height: barHeight,
                backgroundColor: barColor,
                borderRadius: 3,
              }} />
            </Box>
          );
        })}
      </Box>

      {/* Labels row */}
      {showLabels && (
        <Box style={{
          width: chartWidth ?? '100%',
          flexDirection: 'row',
          gap,
          marginTop: 4,
        }}>
          {data.map((bar, i) => (
            <Box key={i} style={{
              width: barWidth,
              flexGrow: fixed ? 0 : 1,
              alignItems: 'center',
            }}>
              <Text style={{ color: '#64748b', fontSize: 9 }}>
                {bar.label}
              </Text>
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
}
