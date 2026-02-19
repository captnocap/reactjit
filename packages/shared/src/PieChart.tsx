import React, { useState, useMemo } from 'react';
import { Box, Text } from './primitives';
import type { Style, Color } from './types';

export interface PieChartSegment {
  label: string;
  value: number;
  color: Color;
}

export interface PieChartProps {
  data: PieChartSegment[];
  size?: number;
  innerRadius?: number;
  interactive?: boolean;
  style?: Style;
}

export function PieChart({
  data,
  size = 120,
  innerRadius = 0,
  interactive = false,
  style,
}: PieChartProps) {
  const [hovered, setHovered] = useState(false);

  const total = data.reduce((sum, d) => sum + d.value, 0) || 1;

  const segments = useMemo(() => {
    const result: {
      startAngle: number;
      endAngle: number;
      segment: PieChartSegment;
      pct: number;
    }[] = [];
    let cumAngle = -Math.PI / 2; // start at 12 o'clock
    for (const seg of data) {
      const sliceAngle = (seg.value / total) * Math.PI * 2;
      result.push({
        startAngle: cumAngle,
        endAngle: cumAngle + sliceAngle,
        segment: seg,
        pct: Math.round((seg.value / total) * 100),
      });
      cumAngle += sliceAngle;
    }
    return result;
  }, [data, total]);

  return (
    <Box
      onPointerEnter={interactive ? () => setHovered(true) : undefined}
      onPointerLeave={interactive ? () => setHovered(false) : undefined}
      style={{ position: 'relative', width: size, height: size, ...style }}
    >
      {segments.map((seg, i) => (
        <Box
          key={i}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: size,
            height: size,
            backgroundColor: seg.segment.color,
            arcShape: {
              startAngle: seg.startAngle,
              endAngle: seg.endAngle,
              innerRadius,
            },
          }}
        />
      ))}

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
            {segments.map((seg, i) => (
              <Box key={i} style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                <Box style={{ width: 6, height: 6, borderRadius: 1, backgroundColor: seg.segment.color }} />
                <Text style={{ color: '#e1e4f0', fontSize: 10 }}>
                  {`${seg.segment.label}: ${seg.segment.value} (${seg.pct}%)`}
                </Text>
              </Box>
            ))}
          </Box>
        </Box>
      )}
    </Box>
  );
}
