import { useState } from 'react';
import { Box, Graph, Pressable, Text } from '@reactjit/runtime/primitives';
import { PALETTE, scaleLinear, plotArea } from '../../lib/chart-utils';
import { useSpring } from '../../lib/useSpring';
import { Tooltip } from '../../lib/Tooltip';
import { classifiers as S } from '@reactjit/core';

export type GroupedBarChartProps = {
  labels?: string[];
  series1?: number[];
  series2?: number[];
  width?: number;
  height?: number;
};

export function GroupedBarChart(props: GroupedBarChartProps) {
  const width = props.width ?? 320;
  const height = props.height ?? 220;
  const plot = plotArea(width, height);
  const labels = props.labels ?? ['Q1', 'Q2', 'Q3', 'Q4'];
  const series1 = props.series1 ?? [45, 52, 48, 61];
  const series2 = props.series2 ?? [24, 28, 22, 32];
  const max = Math.max(...series1, ...series2);
  const yScale = scaleLinear([0, max], [plot.y + plot.h, plot.y]);
  const xScale = scaleLinear([0, labels.length], [plot.x, plot.x + plot.w]);
  const groupW = plot.w / labels.length;
  const barW = groupW * 0.35;
  const gap = 2;

  const grow = useSpring(1, { stiffness: 100, damping: 16 });
  const [hovered, setHovered] = useState<{ group: number; series: number } | null>(null);

  return (
    <Box style={{ width, height }}>
      <S.BareGraph>
        {[0, 0.25, 0.5, 0.75, 1.0].map((t) => {
          const y = plot.y + plot.h * (1 - t);
          return (
            <Graph.Path key={`grid-${t}`} d={`M ${plot.x} ${y} L ${plot.x + plot.w} ${y}`} stroke="#3a2a1e" strokeWidth={1} />
          );
        })}
        {labels.map((_, gi) => {
          const gx = xScale(gi) + groupW / 2;
          const v1 = series1[gi];
          const v2 = series2[gi];
          const h1 = (v1 / max) * plot.h * grow;
          const h2 = (v2 / max) * plot.h * grow;
          const y1 = plot.y + plot.h - h1;
          const y2 = plot.y + plot.h - h2;
          const x1 = gx - barW - gap / 2;
          const x2 = gx + gap / 2;
          return [
            <Graph.Path
              key={`s1-${gi}`}
              d={`M ${x1} ${plot.y + plot.h} L ${x1} ${y1} L ${x1 + barW} ${y1} L ${x1 + barW} ${plot.y + plot.h} Z`}
              fill={PALETTE.pink}
              fillOpacity={hovered && hovered.group === gi && hovered.series === 0 ? 1 : 0.85}
              stroke={PALETTE.pink}
              strokeWidth={1}
            />,
            <Graph.Path
              key={`s2-${gi}`}
              d={`M ${x2} ${plot.y + plot.h} L ${x2} ${y2} L ${x2 + barW} ${y2} L ${x2 + barW} ${plot.y + plot.h} Z`}
              fill={PALETTE.cyan}
              fillOpacity={hovered && hovered.group === gi && hovered.series === 1 ? 1 : 0.85}
              stroke={PALETTE.cyan}
              strokeWidth={1}
            />,
          ];
        })}
      </S.BareGraph>

      {labels.map((_, gi) => {
        const gx = xScale(gi) + groupW / 2;
        const x1 = gx - barW - gap / 2;
        const x2 = gx + gap / 2;
        return [
          <Pressable
            key={`hit-${gi}-s1`}
            onMouseEnter={() => setHovered({ group: gi, series: 0 })}
            onMouseLeave={() => setHovered(null)}
            style={{
              opacity: 0,
              position: 'absolute',
              left: x1,
              top: plot.y,
              width: barW,
              height: plot.h,
            }}
          />,
          <Pressable
            key={`hit-${gi}-s2`}
            onMouseEnter={() => setHovered({ group: gi, series: 1 })}
            onMouseLeave={() => setHovered(null)}
            style={{
              opacity: 0,
              position: 'absolute',
              left: x2,
              top: plot.y,
              width: barW,
              height: plot.h,
            }}
          />,
        ];
      })}

      {hovered != null && (
        <Tooltip
          visible={true}
          x={xScale(hovered.group) + groupW / 2 + 14}
          y={plot.y + 8}
          title={labels[hovered.group]}
          rows={[
            {
              label: hovered.series === 0 ? 'Series 1' : 'Series 2',
              value: hovered.series === 0 ? '$' + series1[hovered.group] + 'k' : series2[hovered.group] + '%',
              color: hovered.series === 0 ? PALETTE.pink : PALETTE.cyan,
            },
          ]}
        />
      )}

      {labels.map((l, i) => (
        <Box key={l} style={{ position: 'absolute', left: xScale(i + 0.5) - 8, top: plot.y + plot.h + 4, width: 16, alignItems: 'center' }}>
          <Text fontSize={9} color="#7a6e5d">{l}</Text>
        </Box>
      ))}
    </Box>
  );
}
