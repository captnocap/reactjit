import React, { useState } from 'react';
import { Box, Text } from './primitives';
import type { Style, Color } from './types';

export interface StackedBarChartSeries {
  label: string;
  color: Color;
  data: number[];
}

export interface StackedBarChartProps {
  series: StackedBarChartSeries[];
  labels?: string[];
  height?: number;
  barWidth?: number;
  gap?: number;
  showLabels?: boolean;
  style?: Style;
  interactive?: boolean;
}

export function StackedBarChart({
  series,
  labels,
  height = 120,
  barWidth,
  gap = 8,
  showLabels = true,
  style,
  interactive = false,
}: StackedBarChartProps) {
  const [hoveredStack, setHoveredStack] = useState<number | null>(null);

  if (series.length === 0 || series[0].data.length === 0) {
    return <Box style={{ height, ...style }} />;
  }

  const numBars = series[0].data.length;

  const totals: number[] = [];
  for (let col = 0; col < numBars; col++) {
    let sum = 0;
    for (const s of series) {
      sum += s.data[col] ?? 0;
    }
    totals.push(sum);
  }
  const maxTotal = Math.max(...totals) || 1;

  const fixed = barWidth != null;
  const chartWidth = fixed ? numBars * barWidth + (numBars - 1) * gap : undefined;
  const anyHovered = hoveredStack !== null;

  return (
    <Box style={{ width: chartWidth, ...style }}>
      <Box style={{
        width: chartWidth ?? '100%',
        height,
        flexDirection: 'row',
        alignItems: 'flex-end',
        gap,
      }}>
        {Array.from({ length: numBars }, (_, col) => {
          const isHovered = hoveredStack === col;
          const stackTotal = totals[col];

          const seriesLines = series.map(s => `${s.label}: ${s.data[col] ?? 0}`).join('\n');
          const tooltipLabel = labels?.[col] ? `${labels[col]}\n` : '';
          const tooltipContent = `${tooltipLabel}${stackTotal}\n${seriesLines}`;

          return (
            <Box
              key={col}
              onPointerEnter={interactive ? () => setHoveredStack(col) : undefined}
              onPointerLeave={interactive ? () => setHoveredStack(null) : undefined}
              tooltip={interactive ? { content: tooltipContent, type: 'anchor', anchor: 'top', layout: 'descriptive' } : undefined}
              style={{
                flexGrow: fixed ? 0 : 1,
                width: barWidth,
                alignItems: 'center',
                opacity: interactive && anyHovered && !isHovered ? 0.35 : 1,
              }}
            >
              <Box style={{
                width: barWidth,
                alignSelf: fixed ? undefined : 'stretch',
                borderRadius: 3,
                overflow: 'hidden',
              }}>
                {series.map((s, si) => {
                  const val = s.data[col] ?? 0;
                  const segmentHeight = Math.max(0, Math.round((val / maxTotal) * height));
                  if (segmentHeight === 0) return null;
                  return (
                    <Box
                      key={si}
                      style={{
                        height: segmentHeight,
                        backgroundColor: s.color,
                      }}
                    />
                  );
                }).reverse()}
              </Box>
            </Box>
          );
        })}
      </Box>

      {showLabels && labels && (
        <Box style={{
          width: chartWidth ?? '100%',
          flexDirection: 'row',
          gap,
          marginTop: 4,
        }}>
          {labels.map((lbl, i) => (
            <Box key={i} style={{
              width: barWidth,
              flexGrow: fixed ? 0 : 1,
              alignItems: 'center',
            }}>
              <Text style={{ color: '#64748b', fontSize: 9 }}>
                {lbl}
              </Text>
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
}
