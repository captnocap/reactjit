import { useState } from 'react';
import { Box, Graph, Pressable, Text } from '@reactjit/runtime/primitives';
import { PALETTE, plotArea, scaleLinear } from '../../lib/chart-utils';
import { useSpring } from '../../lib/useSpring';
import { Tooltip } from '../../lib/Tooltip';
import { classifiers as S } from '@reactjit/core';

export type DivergingChartProps = {
  data?: number[];
  labels?: string[];
  width?: number;
  height?: number;
};

export function DivergingChart(props: DivergingChartProps) {
  const width = props.width ?? 320;
  const height = props.height ?? 220;
  const plot = plotArea(width, height, { top: 10, right: 10, bottom: 10, left: 10 });
  const data = props.data ?? [];
  const labels = props.labels ?? [];
  const max = Math.max(1, ...data.map(Math.abs));
  const sx = scaleLinear([-max, max], [plot.x, plot.x + plot.w]);
  const zeroX = sx(0);
  const bandH = data.length > 0 ? plot.h / data.length : 0;
  const barH = bandH * 0.7;

  const grow = useSpring(1, { stiffness: 100, damping: 16 });
  const [hovered, setHovered] = useState<number | null>(null);

  return (
    <Box style={{ width, height }}>
      <S.BareGraph>
        <Graph.Path d={`M ${zeroX} ${plot.y} L ${zeroX} ${plot.y + plot.h}`} stroke="theme:inkGhost" strokeWidth={1} />
        {data.map((v, i) => {
          const y = plot.y + i * bandH + (bandH - barH) / 2;
          const vx = sx(v * grow);
          const x = v >= 0 ? zeroX : vx;
          const bw = Math.abs(vx - zeroX);
          return (
            <Graph.Path
              key={`b-${i}`}
              d={`M ${x} ${y} L ${x + bw} ${y} L ${x + bw} ${y + barH} L ${x} ${y + barH} Z`}
              fill={v >= 0 ? PALETTE.cyan : PALETTE.pink}
            />
          );
        })}
      </S.BareGraph>

      {data.map((_, i) => {
        const y = plot.y + i * bandH + (bandH - barH) / 2;
        return (
          <Pressable
            key={`hit-${i}`}
            onMouseEnter={() => setHovered(i)}
            onMouseLeave={() => setHovered(null)}
            style={{
              opacity: 0,
              position: 'absolute',
              left: plot.x,
              top: y,
              width: plot.w,
              height: barH,
            }}
          />
        );
      })}

      {hovered != null && data[hovered] != null && (
        <Tooltip
          visible={true}
          x={plot.x + 10}
          y={plot.y + hovered * bandH}
          title={labels[hovered] ?? `Item ${hovered}`}
          rows={[{ label: 'Value', value: String(data[hovered]), color: data[hovered] >= 0 ? PALETTE.cyan : PALETTE.pink }]}
        />
      )}
    </Box>
  );
}
