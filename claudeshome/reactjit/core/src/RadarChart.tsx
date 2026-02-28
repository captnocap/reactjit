import React, { useState, useMemo } from 'react';
import { Box, Text } from './primitives';
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
  const [hovered, setHovered] = useState(false);

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

  return (
    <Box
      onPointerEnter={interactive ? () => setHovered(true) : undefined}
      onPointerLeave={interactive ? () => setHovered(false) : undefined}
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

      {/* Tooltip */}
      {interactive && hovered && (
        <Box style={{
          position: 'absolute',
          top: 0,
          left: '100%',
          marginLeft: 8,
          zIndex: 10,
        }}>
          <Box style={{
            backgroundColor: [0.03, 0.03, 0.05, 0.92],
            borderRadius: 4,
            paddingTop: 5,
            paddingBottom: 5,
            paddingLeft: 10,
            paddingRight: 10,
            borderWidth: 1,
            borderColor: '#40405a',
            gap: 3,
          }}>
            {axes.map((axis, i) => (
              <Box key={i} style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                <Text style={{ color: '#61a6fa', fontSize: 10 }}>
                  {`${axis.label}:`}
                </Text>
                <Text style={{ color: '#e1e4f0', fontSize: 10, fontWeight: 'bold' }}>
                  {`${data[i]}`}
                </Text>
                <Text style={{ color: '#8892a6', fontSize: 9 }}>
                  {`(${Math.round(normalized[i] * 100)}%)`}
                </Text>
              </Box>
            ))}
          </Box>
        </Box>
      )}
    </Box>
  );
}
