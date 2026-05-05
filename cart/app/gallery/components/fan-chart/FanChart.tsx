import { Fragment, useState } from 'react';
import { Box, Graph, Pressable, Text } from '@reactjit/runtime/primitives';
import { PALETTE, scaleLinear, plotArea } from '../../lib/chart-utils';
import { useSpring } from '../../lib/useSpring';
import { Tooltip } from '../../lib/Tooltip';
import { classifiers as S } from '@reactjit/core';

export type FanDatum = { label: string; base: number; upper: number; lower: number };

export type FanChartProps = {
  data?: FanDatum[];
  width?: number;
  height?: number;
};

export function FanChart(props: FanChartProps) {
  const width = props.width ?? 320;
  const height = props.height ?? 220;
  const plot = plotArea(width, height);
  const data = props.data ?? [
    { label: 'Jan', base: 45, upper: 52, lower: 38 },
    { label: 'Feb', base: 52, upper: 60, lower: 44 },
    { label: 'Mar', base: 48, upper: 55, lower: 41 },
    { label: 'Apr', base: 61, upper: 70, lower: 52 },
    { label: 'May', base: 58, upper: 67, lower: 49 },
    { label: 'Jun', base: 72, upper: 83, lower: 61 },
  ];
  const labels = data.map((d) => d.label);
  const base = data.map((d) => d.base);
  const upper = data.map((d) => d.upper);
  const lower = data.map((d) => d.lower);
  const max = Math.max(...upper);
  const min = Math.min(...lower);
  const yScale = scaleLinear([min, max], [plot.y + plot.h, plot.y]);
  const xScale = scaleLinear([0, base.length - 1], [plot.x, plot.x + plot.w]);

  const spread = useSpring(1, { stiffness: 90, damping: 18 });
  const [hovered, setHovered] = useState<number | null>(null);

  const midY = (plot.y + plot.h) / 2;

  return (
    <Box style={{ width, height }}>
      <S.BareGraph>
        {base.map((v, i) => {
          const by = yScale(v);
          const uy = yScale(upper[i]);
          const ly = yScale(lower[i]);
          const halfSpread = ((uy - ly) / 2) * spread;
          const top = midY - halfSpread;
          const bot = midY + halfSpread;
          const x = xScale(i);
          return (
            <Fragment key={i}>
              <Graph.Path
                d={`M ${x} ${by} L ${x} ${top}`}
                stroke={PALETTE.pink}
                strokeWidth={1}
                strokeDasharray="2,2"
              />
              <Graph.Path
                d={`M ${x} ${by} L ${x} ${bot}`}
                stroke={PALETTE.cyan}
                strokeWidth={1}
                strokeDasharray="2,2"
              />
              <Graph.Path
                d={`M ${x - 3} ${by} A 3 3 0 1 1 ${x + 3} ${by} A 3 3 0 1 1 ${x - 3} ${by}`}
                fill={hovered === i ? PALETTE.pink : PALETTE.white}
                stroke={PALETTE.pink}
                strokeWidth={1.5}
              />
            </Fragment>
          );
        })}
      </S.BareGraph>

      {base.map((_, i) => (
        <Pressable
          key={`hit-${i}`}
          onMouseEnter={() => setHovered(i)}
          onMouseLeave={() => setHovered(null)}
          style={{
            opacity: 0,
            position: 'absolute',
            left: xScale(i) - 12,
            top: plot.y,
            width: 24,
            height: plot.h,
          }}
        />
      ))}

      {hovered != null && (
        <Tooltip
          visible={true}
          x={xScale(hovered) + 12}
          y={yScale(base[hovered]) - 30}
          title={labels[hovered]}
          rows={[
            { label: 'Base', value: String(base[hovered]) },
            { label: 'Upper', value: String(upper[hovered]), color: PALETTE.pink },
            { label: 'Lower', value: String(lower[hovered]), color: PALETTE.cyan },
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
