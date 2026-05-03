import { useState } from 'react';
import { Box, Graph, Pressable, Text } from '@reactjit/runtime/primitives';
import { PALETTE } from '../../lib/chart-utils';
import { useSpring } from '../../lib/useSpring';
import { Tooltip } from '../../lib/Tooltip';
import { classifiers as S } from '@reactjit/core';

export type ProportionDatum = { cx: number; cy: number; r: number; color: string; label: string };

export type ProportionFiltersProps = {
  data?: ProportionDatum[];
  width?: number;
  height?: number;
};

export function ProportionFilters(props: ProportionFiltersProps) {
  const width = props.width ?? 260;
  const height = props.height ?? 160;
  const bubbles = props.data ?? [
    { cx: 60, cy: 80, r: 35, color: PALETTE.pink, label: '35%' },
    { cx: 150, cy: 60, r: 25, color: PALETTE.cyan, label: '25%' },
    { cx: 200, cy: 110, r: 18, color: PALETTE.blue, label: '18%' },
    { cx: 110, cy: 120, r: 12, color: PALETTE.purple, label: '12%' },
  ];

  const grow = useSpring(1, { stiffness: 100, damping: 18 });
  const [hovered, setHovered] = useState<number | null>(null);

  return (
    <Box style={{ width, height }}>
      <S.BareGraph>
        {bubbles.map((b, i) => (
          <Graph.Path
            key={i}
            d={`M ${b.cx - b.r * grow} ${b.cy} A ${b.r * grow} ${b.r * grow} 0 1 1 ${b.cx + b.r * grow} ${b.cy} A ${b.r * grow} ${b.r * grow} 0 1 1 ${b.cx - b.r * grow} ${b.cy}`}
            fill={b.color}
            fillOpacity={hovered === i ? 0.9 : 0.7}
            stroke={b.color}
            strokeWidth={hovered === i ? 2.5 : 1.5}
          />
        ))}
      </S.BareGraph>

      {bubbles.map((b, i) => (
        <Pressable
          key={`hit-${i}`}
          onMouseEnter={() => setHovered(i)}
          onMouseLeave={() => setHovered(null)}
          style={{
            opacity: 0,
            position: 'absolute',
            left: b.cx - b.r,
            top: b.cy - b.r,
            width: b.r * 2,
            height: b.r * 2,
          }}
        />
      ))}

      {hovered != null && (
        <Tooltip
          visible={true}
          x={bubbles[hovered].cx + bubbles[hovered].r + 4}
          y={bubbles[hovered].cy - 20}
          title={`Filter ${String.fromCharCode(65 + hovered)}`}
          rows={[{ label: 'Proportion', value: bubbles[hovered].label, color: bubbles[hovered].color }]}
        />
      )}

      {bubbles.map((b, i) => (
        <Box key={`lbl-${i}`} style={{ position: 'absolute', left: b.cx - 14, top: b.cy - 6, width: 28, alignItems: 'center' }}>
          <Text fontSize={9} color={PALETTE.white} style={{ fontWeight: 'bold' }}>{b.label}</Text>
        </Box>
      ))}
    </Box>
  );
}
