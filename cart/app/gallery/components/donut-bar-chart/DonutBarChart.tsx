import { useState } from 'react';
import { Box, Graph, Pressable, Text } from '@reactjit/runtime/primitives';
import { PALETTE, donutSegment } from '../../lib/chart-utils';
import { useSpring } from '../../lib/useSpring';
import { Tooltip } from '../../lib/Tooltip';

export type DonutDatum = { label: string; value: number; color?: string };

export type DonutBarChartProps = {
  data?: DonutDatum[];
  width?: number;
  height?: number;
  innerRadius?: number;
  outerRadius?: number;
};

export function DonutBarChart(props: DonutBarChartProps) {
  const width = props.width ?? 220;
  const height = props.height ?? 220;
  const outer = props.outerRadius ?? 80;
  const inner = props.innerRadius ?? 50;

  const data = props.data ?? [
    { value: 35, color: PALETTE.pink, label: 'R&D' },
    { value: 25, color: PALETTE.cyan, label: 'Marketing' },
    { value: 20, color: PALETTE.blue, label: 'Ops' },
    { value: 20, color: PALETTE.purple, label: 'Sales' },
  ];

  const total = data.reduce((s, d) => s + d.value, 0);
  const sweep = useSpring(360, { stiffness: 90, damping: 18 });
  const [hovered, setHovered] = useState<number | null>(null);

  let cursor = 0;
  const segments = data.map((d) => {
    const start = cursor;
    const end = cursor + (d.value / total) * sweep;
    cursor = end;
    return { ...d, start, end };
  });

  return (
    <Box style={{ width, height, alignItems: 'center', justifyContent: 'center' }}>
      <Graph style={{ width, height }}>
        {segments.map((s, i) => (
          <Graph.Path
            key={i}
            d={donutSegment(0, 0, inner, outer, s.start, s.end)}
            fill={s.color}
            fillOpacity={hovered === i ? 1 : 0.85}
            stroke={s.color}
            strokeWidth={1}
          />
        ))}
      </Graph>

      {segments.map((s, i) => {
        const midAngle = (s.start + s.end) / 2;
        const rad = (midAngle - 90) * (Math.PI / 180);
        const hx = width / 2 + (outer + 10) * Math.cos(rad);
        const hy = height / 2 + (outer + 10) * Math.sin(rad);
        return (
          <Pressable
            key={`hit-${i}`}
            onMouseEnter={() => setHovered(i)}
            onMouseLeave={() => setHovered(null)}
            style={{
              opacity: 0,
              position: 'absolute',
              left: hx - 20,
              top: hy - 20,
              width: 40,
              height: 40,
            }}
          />
        );
      })}

      {hovered != null && (
        <Tooltip
          visible={true}
          x={width / 2 + 20}
          y={height / 2 - 40}
          title={data[hovered].label}
          rows={[
            { label: 'Value', value: String(data[hovered].value), color: data[hovered].color },
            { label: 'Share', value: Math.round((data[hovered].value / total) * 100) + '%' },
          ]}
        />
      )}

      <Box style={{ position: 'absolute', alignItems: 'center' }}>
        <Text fontSize={10} color="#7a6e5d">Total</Text>
        <Text fontSize={16} color={PALETTE.white} style={{ fontWeight: 'bold' }}>{total}</Text>
      </Box>
    </Box>
  );
}
