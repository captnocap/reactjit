import { useState } from 'react';
import { Box, Graph, Pressable, Text } from '@reactjit/runtime/primitives';
import { PALETTE, scaleLinear, plotArea } from '../../lib/chart-utils';
import { useSpring } from '../../lib/useSpring';
import { Tooltip } from '../../lib/Tooltip';
import { classifiers as S } from '@reactjit/core';

export type AreaChartDatum = { label: string; series1: number; series2: number };

export type AreaChartProps = {
  data?: AreaChartDatum[];
  width?: number;
  height?: number;
};

export function AreaChart(props: AreaChartProps) {
  const width = props.width ?? 320;
  const height = props.height ?? 220;
  const plot = plotArea(width, height);
  const data = props.data ?? [
    { label: 'Jan', series1: 45, series2: 12 },
    { label: 'Feb', series1: 52, series2: 14 },
    { label: 'Mar', series1: 48, series2: 11 },
    { label: 'Apr', series1: 61, series2: 16 },
    { label: 'May', series1: 58, series2: 15 },
    { label: 'Jun', series1: 72, series2: 18 },
    { label: 'Jul', series1: 68, series2: 17 },
    { label: 'Aug', series1: 75, series2: 19 },
  ];
  const labels = data.map((d) => d.label);
  const data1 = data.map((d) => d.series1);
  const data2 = data.map((d) => d.series2);
  const max = data.length ? Math.max(...data1, ...data2) : 1;
  const yScale = scaleLinear([0, max], [plot.y + plot.h, plot.y]);
  const xScale = scaleLinear([0, Math.max(1, data.length - 1)], [plot.x, plot.x + plot.w]);

  const grow = useSpring(1, { stiffness: 100, damping: 16 });
  const [hovered, setHovered] = useState<number | null>(null);

  const baseY = plot.y + plot.h;

  function areaPath(values: number[], progress: number): string {
    const pts = values.map((v, i) => ({ x: xScale(i), y: yScale(v) + (baseY - yScale(v)) * (1 - progress) }));
    let d = `M ${pts[0].x} ${baseY}`;
    pts.forEach((p) => { d += ` L ${p.x} ${p.y}`; });
    d += ` L ${pts[pts.length - 1].x} ${baseY} Z`;
    return d;
  }

  function linePath(values: number[], progress: number): string {
    const pts = values.map((v, i) => ({ x: xScale(i), y: yScale(v) + (baseY - yScale(v)) * (1 - progress) }));
    let d = `M ${pts[0].x} ${pts[0].y}`;
    pts.slice(1).forEach((p) => { d += ` L ${p.x} ${p.y}`; });
    return d;
  }

  return (
    <Box style={{ width, height }}>
      <S.BareGraph>
        {[0, 0.25, 0.5, 0.75, 1.0].map((t) => {
          const y = plot.y + plot.h * (1 - t);
          return (
            <Graph.Path key={`grid-${t}`} d={`M ${plot.x} ${y} L ${plot.x + plot.w} ${y}`} stroke="theme:rule" strokeWidth={1} />
          );
        })}
        <Graph.Path d={areaPath(data2, grow)} fill={PALETTE.cyan} fillOpacity={0.25} stroke="none" />
        <Graph.Path d={areaPath(data1, grow)} fill={PALETTE.pink} fillOpacity={0.35} stroke="none" />
        <Graph.Path d={linePath(data2, grow)} stroke={PALETTE.cyan} strokeWidth={2} fill="none" />
        <Graph.Path d={linePath(data1, grow)} stroke={PALETTE.pink} strokeWidth={2} fill="none" />
      </S.BareGraph>

      {labels.map((_, i) => (
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

      {hovered != null && data[hovered] && (
        <Tooltip
          visible={true}
          x={xScale(hovered) + 12}
          y={plot.y + 8}
          title={labels[hovered]}
          rows={[
            { label: 'Revenue', value: '$' + data1[hovered] + 'k', color: PALETTE.pink },
            { label: 'Margin', value: data2[hovered] + '%', color: PALETTE.cyan },
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
