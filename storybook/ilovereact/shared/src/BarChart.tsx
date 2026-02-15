import React from 'react';
import { Box, Text } from './primitives';
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
}

export function BarChart({
  data,
  height = 120,
  barWidth = 20,
  gap = 8,
  showLabels = true,
  showValues = false,
  color = '#3b82f6',
  style,
}: BarChartProps) {
  if (data.length === 0) {
    return <Box style={{ height, ...style }} />;
  }

  const maxValue = Math.max(...data.map(d => d.value)) || 1;
  const chartWidth = data.length * barWidth + (data.length - 1) * gap;

  return (
    <Box style={{ width: chartWidth, ...style }}>
      {/* Chart area */}
      <Box style={{
        width: chartWidth,
        height,
        flexDirection: 'row',
        alignItems: 'flex-end',
        gap,
      }}>
        {data.map((bar, i) => {
          const barHeight = Math.max(1, Math.round((bar.value / maxValue) * height));
          const barColor = bar.color ?? color;

          return (
            <Box key={i} style={{ alignItems: 'center', gap: 2 }}>
              {showValues && (
                <Text style={{ color: '#94a3b8', fontSize: 9 }}>
                  {bar.value}
                </Text>
              )}
              <Box style={{
                width: barWidth,
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
          width: chartWidth,
          flexDirection: 'row',
          gap,
          marginTop: 4,
        }}>
          {data.map((bar, i) => (
            <Box key={i} style={{ width: barWidth, alignItems: 'center' }}>
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
