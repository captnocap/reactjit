import React, { useState } from 'react';
import { Box, Text } from './primitives';
import { ChartTooltip } from './ChartTooltip';
import type { Style, Color } from './types';

export interface HorizontalBarChartBar {
  label: string;
  value: number;
  color?: Color;
}

export interface HorizontalBarChartProps {
  data: HorizontalBarChartBar[];
  width?: number;
  barHeight?: number;
  gap?: number;
  showLabels?: boolean;
  showValues?: boolean;
  labelWidth?: number;
  color?: Color;
  style?: Style;
  interactive?: boolean;
  onBarHover?: (index: number | null, bar: HorizontalBarChartBar | null) => void;
  onBarPress?: (index: number, bar: HorizontalBarChartBar) => void;
}

export function HorizontalBarChart({
  data,
  width = 280,
  barHeight = 20,
  gap = 6,
  showLabels = true,
  showValues = false,
  labelWidth = 60,
  color = '#3b82f6',
  style,
  interactive = false,
  onBarHover,
  onBarPress,
}: HorizontalBarChartProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  if (data.length === 0) {
    return <Box style={{ width, ...style }} />;
  }

  const maxValue = Math.max(...data.map(d => d.value)) || 1;
  const barAreaWidth = width - (showLabels ? labelWidth + 8 : 0) - (showValues ? 40 : 0);
  const anyHovered = hoveredIndex !== null;

  const handleHover = (i: number | null) => {
    setHoveredIndex(i);
    if (onBarHover) {
      onBarHover(i, i !== null ? data[i] : null);
    }
  };

  return (
    <Box style={{ width, gap, ...style }}>
      {data.map((bar, i) => {
        const fillWidth = Math.max(1, Math.round((bar.value / maxValue) * barAreaWidth));
        const barColor = bar.color ?? color;
        const isHovered = hoveredIndex === i;
        const pct = Math.round((bar.value / maxValue) * 100);

        return (
          <Box
            key={i}
            onPointerEnter={interactive ? () => handleHover(i) : undefined}
            onPointerLeave={interactive ? () => handleHover(null) : undefined}
            onClick={interactive && onBarPress ? () => onBarPress(i, bar) : undefined}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              height: barHeight,
              gap: 8,
              position: 'relative',
              opacity: interactive && anyHovered && !isHovered ? 0.35 : 1,
            }}
          >
            {showLabels && (
              <Box style={{ width: labelWidth }}>
                <Text style={{ color: '#94a3b8', fontSize: 10 }} numberOfLines={1}>
                  {bar.label}
                </Text>
              </Box>
            )}
            <Box style={{
              width: fillWidth,
              height: barHeight,
              backgroundColor: barColor,
              borderRadius: 3,
            }} />
            {showValues && (
              <Text style={{ color: '#64748b', fontSize: 10 }}>
                {`${bar.value}`}
              </Text>
            )}
            <ChartTooltip visible={interactive && isHovered} anchor="right">
              {bar.label ? <ChartTooltip.Label>{bar.label}</ChartTooltip.Label> : null}
              <ChartTooltip.Value>{`${bar.value}`}</ChartTooltip.Value>
              <ChartTooltip.Detail>{`${pct}%`}</ChartTooltip.Detail>
            </ChartTooltip>
          </Box>
        );
      })}
    </Box>
  );
}
