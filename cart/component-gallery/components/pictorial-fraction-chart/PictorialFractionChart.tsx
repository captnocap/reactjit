import { useState } from 'react';
import { Box, Graph, Pressable, Text } from '@reactjit/runtime/primitives';
import { PALETTE } from '../../lib/chart-utils';
import { useSpring } from '../../lib/useSpring';
import { Tooltip } from '../../lib/Tooltip';
import { classifiers as S } from '@reactjit/core';

export type PictorialFractionData = {
  total: number;
  filled: number;
  rows?: number;
  cols?: number;
  color?: string;
  label?: string;
};

export type PictorialFractionChartProps = {
  data?: PictorialFractionData;
  width?: number;
  height?: number;
};

function personPath(cx: number, cy: number, scale: number): string {
  const s = scale;
  const headR = 4 * s;
  const bodyW = 8 * s;
  const bodyH = 14 * s;
  const headY = cy - bodyH / 2;
  const d = `M ${cx - headR} ${headY} A ${headR} ${headR} 0 1 1 ${cx + headR} ${headY} A ${headR} ${headR} 0 1 1 ${cx - headR} ${headY}`;
  return d + ` M ${cx - bodyW / 2} ${headY + headR} L ${cx + bodyW / 2} ${headY + headR} L ${cx + bodyW / 2} ${headY + headR + bodyH} L ${cx - bodyW / 2} ${headY + headR + bodyH} Z`;
}

export function PictorialFractionChart(props: PictorialFractionChartProps) {
  const width = props.width ?? 200;
  const height = props.height ?? 160;
  const total = props.data?.total ?? 10;
  const filled = props.data?.filled ?? 7;
  const rows = props.data?.rows ?? 2;
  const cols = props.data?.cols ?? 5;
  const color = props.data?.color ?? PALETTE.pink;
  const spacing = 32;
  const startX = (width - (cols - 1) * spacing) / 2;
  const startY = (height - (rows - 1) * spacing) / 2;

  const fillProgress = useSpring(1, { stiffness: 100, damping: 18 });
  const [hovered, setHovered] = useState(false);

  const visibleFilled = Math.floor(filled * fillProgress);
  const partial = (filled * fillProgress) - visibleFilled;

  return (
    <Box style={{ width, height }}>
      <S.BareGraph>
        {Array.from({ length: total }).map((_, i) => {
          const r = Math.floor(i / cols);
          const c = i % cols;
          const x = startX + c * spacing;
          const y = startY + r * spacing;
          const isFilled = i < visibleFilled;
          const isPartial = i === visibleFilled && partial > 0;
          return (
            <Graph.Path
              key={i}
              d={personPath(x, y, 1.2)}
              fill={isFilled ? color : isPartial ? PALETTE.pinkLight : '#3a2a1e'}
              fillOpacity={isPartial ? partial : 1}
              stroke={isFilled || isPartial ? color : '#3a2a1e'}
              strokeWidth={1}
            />
          );
        })}
      </S.BareGraph>

      <Pressable
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          opacity: 0,
          position: 'absolute',
          left: startX - 10,
          top: startY - 10,
          width: cols * spacing + 20,
          height: rows * spacing + 20,
        }}
      />

      {hovered && (
        <Tooltip
          visible={true}
          x={width - 60}
          y={10}
          title={props.data?.label ?? 'Fraction'}
          rows={[{ label: 'Filled', value: `${Math.round(filled * fillProgress)}/${total}`, color }]}
        />
      )}
    </Box>
  );
}
