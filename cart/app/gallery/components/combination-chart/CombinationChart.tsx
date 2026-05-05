import { useState } from 'react';
import { Box, Graph, Pressable, Text } from '@reactjit/runtime/primitives';
import { PALETTE, scaleLinear, plotArea } from '../../lib/chart-utils';
import { useSpring } from '../../lib/useSpring';
import { Tooltip } from '../../lib/Tooltip';
import { classifiers as S } from '@reactjit/core';

export type CombinationChartDatum = { label: string; bar: number; line: number };

export type CombinationChartProps = {
  data?: CombinationChartDatum[];
  width?: number;
  height?: number;
};

export function CombinationChart(props: CombinationChartProps) {
  const width = props.width ?? 320;
  const height = props.height ?? 220;
  const plot = plotArea(width, height);
  const data = props.data ?? [];
  const bars = data.map((d) => d.bar);
  const line = data.map((d) => d.line);
  const labels = data.map((d) => d.label);
  const max = data.length ? Math.max(...bars, ...line) : 1;
  const yScale = scaleLinear([0, max], [plot.y + plot.h, plot.y]);
  const xScale = scaleLinear([0, Math.max(1, data.length - 1)], [plot.x, plot.x + plot.w]);
  const barW = (plot.w / Math.max(1, data.length)) * 0.4;

  const grow = useSpring(1, { stiffness: 100, damping: 16 });
  const [hovered, setHovered] = useState<number | null>(null);

  const linePath = data.length > 0
    ? `M ${xScale(0)} ${yScale(line[0])}` + line.slice(1).map((v, i) => ` L ${xScale(i + 1)} ${yScale(v)}`).join('')
    : '';

  return (
    <Box style={{ width, height }}>
      <S.BareGraph>
        {[0, 0.25, 0.5, 0.75, 1.0].map((t) => {
          const y = plot.y + plot.h * (1 - t);
          return (
            <Graph.Path key={`grid-${t}`} d={`M ${plot.x} ${y} L ${plot.x + plot.w} ${y}`} stroke="theme:rule" strokeWidth={1} />
          );
        })}
        {data.map((d, i) => {
          const bh = (d.bar / max) * plot.h * grow;
          const x = xScale(i) - barW / 2;
          const y = plot.y + plot.h - bh;
          return (
            <Graph.Path
              key={`b-${i}`}
              d={`M ${x} ${plot.y + plot.h} L ${x} ${y} L ${x + barW} ${y} L ${x + barW} ${plot.y + plot.h} Z`}
              fill={PALETTE.cyan}
              fillOpacity={hovered === i ? 0.8 : 0.6}
              stroke={PALETTE.cyan}
              strokeWidth={1}
            />
          );
        })}
        <Graph.Path d={linePath} stroke={PALETTE.pink} strokeWidth={2.5} fill="none" />
        {data.map((d, i) => (
          <Graph.Path
            key={`p-${i}`}
            d={`M ${xScale(i) - 3} ${yScale(d.line)} A 3 3 0 1 1 ${xScale(i) + 3} ${yScale(d.line)} A 3 3 0 1 1 ${xScale(i) - 3} ${yScale(d.line)}`}
            fill={hovered === i ? PALETTE.pink : PALETTE.white}
            stroke={PALETTE.pink}
            strokeWidth={1.5}
          />
        ))}
      </S.BareGraph>

      {data.map((_, i) => (
        <Pressable
          key={`hit-${i}`}
          onMouseEnter={() => setHovered(i)}
          onMouseLeave={() => setHovered(null)}
          style={{
            opacity: 0,
            position: 'absolute',
            left: xScale(i) - 14,
            top: plot.y,
            width: 28,
            height: plot.h,
          }}
        />
      ))}

      {hovered != null && data[hovered] && (
        <Tooltip
          visible={true}
          x={xScale(hovered) + 14}
          y={plot.y + 8}
          title={labels[hovered]}
          rows={[
            { label: 'Revenue', value: '$' + data[hovered].bar + 'k', color: PALETTE.cyan },
            { label: 'Margin', value: data[hovered].line + '%', color: PALETTE.pink },
          ]}
        />
      )}

      {labels.map((l, i) => (
        <Box key={l} style={{ position: 'absolute', left: xScale(i) - 8, top: plot.y + plot.h + 4, width: 16, alignItems: 'center' }}>
          <Text fontSize={9} color="theme:inkDimmer">{l}</Text>
        </Box>
      ))}
    </Box>
  );
}
