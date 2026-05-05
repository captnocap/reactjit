import { useState } from 'react';
import { Box, Graph, Pressable, Text } from '@reactjit/runtime/primitives';
import { PALETTE, scaleLinear, plotArea } from '../../lib/chart-utils';
import { useSpring } from '../../lib/useSpring';
import { Tooltip } from '../../lib/Tooltip';
import { classifiers as S } from '@reactjit/core';

export type BarChartDatum = { label: string; value: number; color?: string };

export type BarChartProps = {
  data?: BarChartDatum[];
  width?: number;
  height?: number;
};

export function BarChart(props: BarChartProps) {
  const width = props.width ?? 320;
  const height = props.height ?? 220;
  const data = props.data ?? [];
  const margin = { top: 16, right: 16, bottom: 28, left: 36 };
  const plotX = margin.left;
  const plotY = margin.top;
  const plotW = width - margin.left - margin.right;
  const plotH = height - margin.top - margin.bottom;

  const values = data.map((d) => d.value);
  const max = values.length ? Math.max(...values) : 1;

  const barW = (plotW / data.length) * 0.6;
  const gap = (plotW / data.length) * 0.4;

  const grow = useSpring(1, { stiffness: 120, damping: 14 });
  const [hovered, setHovered] = useState<number | null>(null);

  return (
    <Box style={{ position: 'relative', width, height }}>
      <S.BareGraph>
        {[0, 0.25, 0.5, 0.75, 1.0].map((t) => {
          const y = plotY + plotH * (1 - t);
          return (
            <Graph.Path
              key={`grid-${t}`}
              d={`M ${plotX} ${y} L ${plotX + plotW} ${y}`}
              stroke="theme:inkDim"
              strokeWidth={1}
            />
          );
        })}

        {data.map((d, i) => {
          const targetH = (d.value / max) * plotH;
          const bh = targetH * grow;
          const x = plotX + i * (plotW / data.length) + gap / 2;
          const y = plotY + plotH - bh;
          const path = `M ${x} ${plotY + plotH} L ${x} ${y} L ${x + barW} ${y} L ${x + barW} ${plotY + plotH} Z`;
          const color = d.color ?? (i % 2 === 0 ? PALETTE.pink : PALETTE.cyan);
          return (
            <Graph.Path
              key={i}
              d={path}
              fill={color}
              fillOpacity={hovered === i ? 1 : 0.85}
              stroke={color}
              strokeWidth={1}
            />
          );
        })}
      </S.BareGraph>

      {data.map((d, i) => {
        const targetH = (d.value / max) * plotH;
        const bh = targetH * grow;
        const x = plotX + i * (plotW / data.length) + gap / 2;
        const y = plotY + plotH - bh;
        return (
          <Pressable
            key={`hit-${i}`}
            onMouseEnter={() => setHovered(i)}
            onMouseLeave={() => setHovered(null)}
            style={{
              opacity: 0,
              position: 'absolute',
              left: x,
              top: y,
              width: barW,
              height: bh,
            }}
          />
        );
      })}

      {hovered != null && data[hovered] && (
        <Tooltip
          visible={true}
          x={plotX + hovered * (plotW / data.length) + gap / 2 + barW + 4}
          y={plotY + plotH - (data[hovered].value / max) * plotH * grow - 20}
          title={data[hovered].label}
          rows={[{ label: 'Value', value: String(data[hovered].value), color: data[hovered].color ?? PALETTE.pink }]}
        />
      )}

      {[0, 0.25, 0.5, 0.75, 1.0].map((t) => {
        const val = Math.round(max * t);
        const y = plotY + plotH * (1 - t) - 6;
        return (
          <Box key={`y-${t}`} style={{ position: 'absolute', left: 0, top: y, width: margin.left - 4, alignItems: 'flex-end' }}>
            <Text fontSize={9} color="theme:inkDimmer">{val}</Text>
          </Box>
        );
      })}

      {data.map((d, i) => {
        const x = plotX + i * (plotW / data.length) + gap / 2 + barW / 2 - 8;
        return (
          <Box key={`x-${d.label}`} style={{ position: 'absolute', left: x, top: plotY + plotH + 6, width: 16, alignItems: 'center' }}>
            <Text fontSize={9} color="theme:inkDimmer">{d.label}</Text>
          </Box>
        );
      })}
    </Box>
  );
}
