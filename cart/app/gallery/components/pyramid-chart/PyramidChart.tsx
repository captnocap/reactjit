import { useState } from 'react';
import { Box, Graph, Pressable, Text } from '@reactjit/runtime/primitives';
import { PALETTE } from '../../lib/chart-utils';
import { useSpring } from '../../lib/useSpring';
import { Tooltip } from '../../lib/Tooltip';
import { classifiers as S } from '@reactjit/core';

export type PyramidDatum = { label: string; value: number; color?: string };

export type PyramidChartProps = {
  data?: PyramidDatum[];
  width?: number;
  height?: number;
};

export function PyramidChart(props: PyramidChartProps) {
  const width = props.width ?? 200;
  const height = props.height ?? 180;
  const cx = width / 2;
  const baseY = height - 20;
  const topY = 20;
  const baseW = 140;

  const levels = props.data ?? [
    { label: 'Enterprise', value: 10, color: PALETTE.pink },
    { label: 'Pro', value: 25, color: PALETTE.cyan },
    { label: 'Basic', value: 40, color: PALETTE.blue },
  ];

  const total = levels.reduce((s, l) => s + l.value, 0);
  const rise = useSpring(1, { stiffness: 90, damping: 18 });
  const [hovered, setHovered] = useState<number | null>(null);
  const hoveredLevel = hovered != null ? levels[hovered] : null;

  const widthAt = (yv: number): number => baseW * ((yv - topY) / (baseY - topY));

  let currentY = topY;

  return (
    <Box style={{ width, height }}>
      <S.BareGraph>
        {levels.map((l, i) => {
          const levelHeight = ((l.value / total) * (baseY - topY)) * rise;
          const topWidth = widthAt(currentY);
          const bottomWidth = widthAt(currentY + levelHeight);
          const y1 = currentY + (baseY - topY) * (1 - rise);
          const y2 = y1 + levelHeight;
          const x1 = cx - topWidth / 2;
          const x2 = cx + topWidth / 2;
          const x3 = cx + bottomWidth / 2;
          const x4 = cx - bottomWidth / 2;
          currentY += ((l.value / total) * (baseY - topY));
          return (
            <Graph.Path
              key={i}
              d={`M ${x1} ${y1} L ${x2} ${y1} L ${x3} ${y2} L ${x4} ${y2} Z`}
              fill={l.color}
              fillOpacity={hovered === i ? 1 : 0.8}
              stroke={l.color}
              strokeWidth={1}
            />
          );
        })}
      </S.BareGraph>

      {levels.map((_, i) => {
        const levelHeight = ((levels[i].value / total) * (baseY - topY));
        const y = topY + levels.slice(0, i).reduce((s, l) => s + ((l.value / total) * (baseY - topY)), 0) + levelHeight / 2;
        const topW = widthAt(topY + levels.slice(0, i).reduce((s, l) => s + ((l.value / total) * (baseY - topY)), 0));
        const bottomW = widthAt(topY + levels.slice(0, i + 1).reduce((s, l) => s + ((l.value / total) * (baseY - topY)), 0));
        const w = Math.max(topW, bottomW);
        return (
          <Pressable
            key={`hit-${i}`}
            onMouseEnter={() => setHovered(i)}
            onMouseLeave={() => setHovered(null)}
            style={{
              opacity: 0,
              position: 'absolute',
              left: cx - w / 2 - 4,
              top: y - levelHeight / 2 - 4,
              width: w + 8,
              height: levelHeight + 8,
            }}
          />
        );
      })}

      {hovered != null && hoveredLevel && (
        <Tooltip
          visible={true}
          x={cx + 20}
          y={topY + levels.slice(0, hovered).reduce((s, l) => s + ((l.value / total) * (baseY - topY)), 0) + ((hoveredLevel.value / total) * (baseY - topY)) / 2 - 20}
          title={hoveredLevel.label}
          rows={[
            { label: 'Value', value: String(hoveredLevel.value), color: hoveredLevel.color },
            { label: 'Share', value: Math.round((hoveredLevel.value / total) * 100) + '%' },
          ]}
        />
      )}

      {levels.map((l, i) => {
        const levelHeight = ((l.value / total) * (baseY - topY));
        const y = topY + levels.slice(0, i).reduce((s, ll) => s + ((ll.value / total) * (baseY - topY)), 0) + levelHeight / 2;
        return (
          <Box key={`lbl-${i}`} style={{ position: 'absolute', left: cx - 20, top: y - 6, width: 40, alignItems: 'center' }}>
            <Text fontSize={9} color={PALETTE.white}>{l.label}</Text>
          </Box>
        );
      })}
    </Box>
  );
}
