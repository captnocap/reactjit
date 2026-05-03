import { useState } from 'react';
import { Box, Graph, Pressable, Text } from '@reactjit/runtime/primitives';
import { PALETTE } from '../../lib/chart-utils';
import { useSpring } from '../../lib/useSpring';
import { Tooltip } from '../../lib/Tooltip';
import { classifiers as S } from '@reactjit/core';

export type VennDatum = { label: string; cx: number; cy: number; r: number; color: string; size: number };

export type VennProps = {
  data?: VennDatum[];
  width?: number;
  height?: number;
};

export function Venn(props: VennProps) {
  const width = props.width ?? 240;
  const height = props.height ?? 180;
  const cx = width / 2;
  const cy = height / 2;
  const r = 45;

  const circles = props.data ?? [
    { cx: cx - 25, cy, r, color: PALETTE.pink, label: 'A', size: 35 },
    { cx: cx + 25, cy, r, color: PALETTE.cyan, label: 'B', size: 28 },
    { cx: cx, cy: cy + 20, r, color: PALETTE.blue, label: 'C', size: 22 },
  ];

  const fade = useSpring(1, { stiffness: 100, damping: 18 });
  const [hovered, setHovered] = useState<number | null>(null);
  const hoveredCircle = hovered != null ? circles[hovered] : null;

  return (
    <Box style={{ width, height }}>
      <S.BareGraph>
        {circles.map((c, i) => (
          <Graph.Path
            key={i}
            d={`M ${c.cx - c.r} ${c.cy} A ${c.r} ${c.r} 0 1 1 ${c.cx + c.r} ${c.cy} A ${c.r} ${c.r} 0 1 1 ${c.cx - c.r} ${c.cy}`}
            fill={c.color}
            fillOpacity={hovered === i ? 0.55 : 0.35 * fade}
            stroke={c.color}
            strokeWidth={hovered === i ? 2.5 : 1.5}
          />
        ))}
      </S.BareGraph>

      {circles.map((c, i) => (
        <Pressable
          key={`hit-${i}`}
          onMouseEnter={() => setHovered(i)}
          onMouseLeave={() => setHovered(null)}
          style={{
            opacity: 0,
            position: 'absolute',
            left: c.cx - c.r,
            top: c.cy - c.r,
            width: c.r * 2,
            height: c.r * 2,
          }}
        />
      ))}

      {hovered != null && hoveredCircle && (
        <Tooltip
          visible={true}
          x={hoveredCircle.cx + 20}
          y={hoveredCircle.cy - 30}
          title={`Set ${hoveredCircle.label}`}
          rows={[{ label: 'Size', value: String(hoveredCircle.size), color: hoveredCircle.color }]}
        />
      )}

      {circles.map((c, i) => (
        <Box key={`lbl-${i}`} style={{ position: 'absolute', left: c.cx - 20, top: c.cy - c.r - 14, width: 40, alignItems: 'center' }}>
          <Text fontSize={9} color={PALETTE.slateLight}>{c.label}</Text>
        </Box>
      ))}
    </Box>
  );
}
