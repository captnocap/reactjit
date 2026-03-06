import React, { useMemo } from 'react';
import { Box } from './primitives';
import type { Style, Color } from './types';

export interface RadarChartAxis {
  label: string;
  max?: number;
}

export interface RadarChartProps {
  axes: RadarChartAxis[];
  data: number[];
  size?: number;
  color?: Color;
  gridColor?: Color;
  interactive?: boolean;
  style?: Style;
}

export function RadarChart({
  axes,
  data,
  size = 120,
  color = '#3b82f6',
  gridColor = '#1e293b',
  interactive = false,
  style,
}: RadarChartProps) {
  const cx = size / 2;
  const cy = size / 2;
  const radius = size / 2 - 2; // 2px margin so rings aren't clipped
  const numAxes = axes.length;

  const normalized = useMemo(() => {
    return data.map((val, i) => {
      const maxVal = axes[i]?.max ?? Math.max(...data);
      return Math.min(1, Math.max(0, val / (maxVal || 1)));
    });
  }, [data, axes]);

  // Vertex positions in box-local coords (origin = box top-left)
  const vertices = useMemo(() => {
    return normalized.map((val, i) => {
      const angle = (i / numAxes) * Math.PI * 2 - Math.PI / 2;
      const r = val * radius;
      return { x: cx + Math.cos(angle) * r, y: cy + Math.sin(angle) * r };
    });
  }, [normalized, numAxes, radius, cx, cy]);

  const polygonPoints = useMemo(
    () => vertices.flatMap(v => [v.x, v.y]),
    [vertices],
  );

  const tooltipContent = interactive && axes.length > 0
    ? axes.map((axis, i) => `${axis.label}:\t${data[i]} (${Math.round(normalized[i] * 100)}%)`).join('\n')
    : undefined;

  return (
    <Box
      tooltip={tooltipContent ? { content: tooltipContent, layout: 'table' } : undefined}
      style={{ position: 'relative', width: size, height: size, ...style }}
    >
      {/* Grid rings at 25 / 50 / 75 / 100% */}
      {([0.25, 0.5, 0.75, 1.0] as const).map((pct, i) => {
        const ringD = radius * 2 * pct;
        const offset = (size - ringD) / 2;
        return (
          <Box
            key={`ring-${i}`}
            style={{
              position: 'absolute',
              top: offset,
              left: offset,
              width: ringD,
              height: ringD,
              borderRadius: ringD / 2,
              borderWidth: 1,
              borderColor: gridColor,
            }}
          />
        );
      })}

      {/* Axis lines from center to each vertex direction */}
      {axes.map((_axis, i) => {
        const rotateDeg = (i / numAxes) * 360;
        return (
          <Box
            key={`axis-${i}`}
            style={{
              position: 'absolute',
              width: 1,
              height: radius,
              top: cy - radius,
              left: cx,
              backgroundColor: gridColor,
              transform: { rotate: rotateDeg, originX: 0.5, originY: 1 },
            }}
          />
        );
      })}

      {/* Data polygon fill */}
      {polygonPoints.length >= 6 && (
        <Box
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: size,
            height: size,
            backgroundColor: color,
            polygonPoints,
            opacity: 0.6,
          }}
        />
      )}
    </Box>
  );
}
