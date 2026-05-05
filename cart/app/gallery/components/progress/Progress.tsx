import { Fragment, useState } from 'react';
import { Box, Graph, Pressable, Text } from '@reactjit/runtime/primitives';
import { PALETTE } from '../../lib/chart-utils';
import { useSpring } from '../../lib/useSpring';
import { Tooltip } from '../../lib/Tooltip';
import { classifiers as S } from '@reactjit/core';

export type ProgressDatum = { label: string; value: number; color?: string };

export type ProgressProps = {
  data?: ProgressDatum[];
  width?: number;
  height?: number;
};

export function Progress(props: ProgressProps) {
  const width = props.width ?? 280;
  const height = props.height ?? 140;
  const bars = props.data ?? [
    { label: 'Task A', value: 75 },
    { label: 'Task B', value: 45 },
    { label: 'Task C', value: 90 },
  ];
  const barH = 18;
  const gap = 24;
  const startY = 30;
  const startX = 20;
  const barW = 220;

  const fill = useSpring(1, { stiffness: 80, damping: 18 });
  const [hovered, setHovered] = useState<number | null>(null);

  return (
    <Box style={{ width, height }}>
      <S.BareGraph>
        {bars.map((b, i) => {
          const y = startY + i * (barH + gap);
          const fillW = (b.value / 100) * barW * fill;
          const color = b.color ?? (i === 0 ? PALETTE.pink : i === 1 ? PALETTE.cyan : PALETTE.blue);
          return (
            <Fragment key={i}>
              <Graph.Path d={`M ${startX} ${y} L ${startX + barW} ${y} L ${startX + barW} ${y + barH} L ${startX} ${y + barH} Z`} fill="theme:rule" stroke="none" />
              <Graph.Path d={`M ${startX} ${y} L ${startX + fillW} ${y} L ${startX + fillW} ${y + barH} L ${startX} ${y + barH} Z`} fill={color} fillOpacity={0.9} stroke="none" />
              <Graph.Path d={`M ${startX + fillW - 4} ${y} A 4 4 0 0 1 ${startX + fillW} ${y + 4} L ${startX + fillW} ${y + barH - 4} A 4 4 0 0 1 ${startX + fillW - 4} ${y + barH} Z`} fill={color} stroke="none" />
            </Fragment>
          );
        })}
      </S.BareGraph>

      {bars.map((b, i) => {
        const y = startY + i * (barH + gap);
        return (
          <Pressable
            key={`hit-${i}`}
            onMouseEnter={() => setHovered(i)}
            onMouseLeave={() => setHovered(null)}
            style={{
              opacity: 0,
              position: 'absolute',
              left: startX,
              top: y,
              width: barW,
              height: barH,
            }}
          />
        );
      })}

      {hovered != null && (
        <Tooltip
          visible={true}
          x={startX + barW + 8}
          y={startY + hovered * (barH + gap)}
          title={bars[hovered].label}
          rows={[{ label: 'Progress', value: bars[hovered].value + '%', color: PALETTE.cyan }]}
        />
      )}

      {bars.map((b, i) => (
        <Box key={`lbl-${i}`} style={{ position: 'absolute', left: startX, top: startY + i * (barH + gap) - 14 }}>
          <Text fontSize={9} color={PALETTE.slateLight}>{b.label}</Text>
        </Box>
      ))}
      {bars.map((b, i) => (
        <Box key={`pct-${i}`} style={{ position: 'absolute', left: startX + barW - 30, top: startY + i * (barH + gap) + 4, width: 28, alignItems: 'flex-end' }}>
          <Text fontSize={9} color={PALETTE.white}>{b.value}%</Text>
        </Box>
      ))}
    </Box>
  );
}
