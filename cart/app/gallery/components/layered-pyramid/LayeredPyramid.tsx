import { useState } from 'react';
import { Box, Graph, Pressable, Text } from '@reactjit/runtime/primitives';
import { COLORS, PALETTE } from '../../lib/chart-utils';
import { useStagger } from '../../lib/useStagger';
import { Tooltip } from '../../lib/Tooltip';
import { classifiers as S } from '@reactjit/core';

export type LayeredPyramidDatum = { label: string; h: number; color?: string };

export type LayeredPyramidProps = {
  data?: LayeredPyramidDatum[];
  width?: number;
  height?: number;
};

export function LayeredPyramid(props: LayeredPyramidProps) {
  const width = props.width ?? 220;
  const height = props.height ?? 200;
  const cx = width / 2;
  const baseY = height - 20;
  const topY = 30;
  const baseW = 160;

  const levels = props.data ?? [
    { label: 'A', color: PALETTE.pink, h: 35 },
    { label: 'B', color: PALETTE.cyan, h: 40 },
    { label: 'C', color: PALETTE.blue, h: 45 },
    { label: 'D', color: PALETTE.purple, h: 30 },
  ];

  const staggers = useStagger(levels.length, { stiffness: 100, damping: 16 });
  const [hovered, setHovered] = useState<number | null>(null);

  return (
    <Box style={{ width, height }}>
      <S.BareGraph>
        {levels.map((l, i) => {
          const s = staggers[i];
          const layerH = l.h * s;
          const y2 = baseY - (levels.slice(0, i).reduce((sum, ll) => sum + ll.h, 0) + layerH);
          const y1 = baseY - levels.slice(0, i).reduce((sum, ll) => sum + ll.h, 0);
          const topWidth = baseW * (1 - (y1 - topY) / (baseY - topY));
          const bottomWidth = baseW * (1 - (y2 - topY) / (baseY - topY));
          const x1 = cx - topWidth / 2;
          const x2 = cx + topWidth / 2;
          const x3 = cx + bottomWidth / 2;
          const x4 = cx - bottomWidth / 2;
          return (
            <Graph.Path
              key={i}
              d={`M ${x1} ${y1} L ${x2} ${y1} L ${x3} ${y2} L ${x4} ${y2} Z`}
              fill={l.color ?? COLORS[i % COLORS.length]}
              fillOpacity={hovered === i ? 1 : 0.8}
              stroke={l.color ?? COLORS[i % COLORS.length]}
              strokeWidth={1}
            />
          );
        })}
      </S.BareGraph>

      {levels.map((_, i) => {
        const y = baseY - levels.slice(0, i + 1).reduce((sum, l) => sum + l.h, 0) + levels[i].h / 2;
        return (
          <Pressable
            key={`hit-${i}`}
            onMouseEnter={() => setHovered(i)}
            onMouseLeave={() => setHovered(null)}
            style={{
              opacity: 0,
              position: 'absolute',
              left: cx - 40,
              top: y - 14,
              width: 80,
              height: 28,
            }}
          />
        );
      })}

      {hovered != null && (
        <Tooltip
          visible={true}
          x={cx + 50}
          y={baseY - levels.slice(0, hovered + 1).reduce((sum, l) => sum + l.h, 0) + levels[hovered].h / 2}
          title={`Layer ${levels[hovered].label}`}
          rows={[{ label: 'Height', value: String(levels[hovered].h), color: levels[hovered].color ?? COLORS[hovered % COLORS.length] }]}
        />
      )}
    </Box>
  );
}
