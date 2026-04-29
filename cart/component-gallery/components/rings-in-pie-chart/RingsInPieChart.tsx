import { useState } from 'react';
import { Box, Graph, Pressable } from '@reactjit/runtime/primitives';
import { PALETTE, donutSegment } from '../../lib/chart-utils';
import { useSpring } from '../../lib/useSpring';
import { Tooltip } from '../../lib/Tooltip';

export type RingDatum = { label: string; value: number; color?: string };
export type RingsDatum = { inner: number; outer: number; data: RingDatum[] };

export type RingsInPieChartProps = {
  rings?: RingsDatum[];
  width?: number;
  height?: number;
};

export function RingsInPieChart(props: RingsInPieChartProps) {
  const width = props.width ?? 200;
  const height = props.height ?? 200;

  const rings = props.rings ?? [
    { outer: 80, inner: 65, data: [
      { label: 'Direct', value: 40, color: PALETTE.pink },
      { label: 'Social', value: 35, color: PALETTE.cyan },
      { label: 'Organic', value: 25, color: PALETTE.blue },
    ]},
    { outer: 60, inner: 45, data: [
      { label: 'US', value: 50, color: PALETTE.purple },
      { label: 'EU', value: 30, color: PALETTE.teal },
      { label: 'APAC', value: 20, color: PALETTE.indigo },
    ]},
    { outer: 40, inner: 25, data: [
      { label: 'New', value: 60, color: PALETTE.pinkLight },
      { label: 'Returning', value: 40, color: PALETTE.cyanLight },
    ]},
  ];

  const sweep = useSpring(360, { stiffness: 80, damping: 18 });
  const [hovered, setHovered] = useState<string | null>(null);

  return (
    <Box style={{ width, height, alignItems: 'center', justifyContent: 'center' }}>
      <Graph style={{ width, height }}>
        {rings.map((ring, ri) => {
          const total = ring.data.reduce((s, d) => s + d.value, 0);
          let cursor = 0;
          return ring.data.map((d, di) => {
            const start = cursor;
            const end = cursor + (d.value / total) * sweep;
            cursor = end;
            const key = `${ri}-${di}`;
            return (
              <Graph.Path
                key={key}
                d={donutSegment(0, 0, ring.inner, ring.outer, start, end)}
                fill={d.color}
                fillOpacity={hovered === key ? 1 : 0.8}
                stroke={d.color}
                strokeWidth={0.5}
              />
            );
          });
        })}
      </Graph>

      {rings.map((ring, ri) => {
        const total = ring.data.reduce((s, d) => s + d.value, 0);
        let cursor = 0;
        return ring.data.map((d, di) => {
          const start = cursor;
          const end = cursor + (d.value / total) * 360;
          cursor = end;
          const midAngle = (start + end) / 2;
          const rad = (midAngle - 90) * (Math.PI / 180);
          const midR = (ring.inner + ring.outer) / 2;
          const hx = width / 2 + midR * Math.cos(rad);
          const hy = height / 2 + midR * Math.sin(rad);
          const key = `${ri}-${di}`;
          return (
            <Pressable
              key={`hit-${key}`}
              onMouseEnter={() => setHovered(key)}
              onMouseLeave={() => setHovered(null)}
              style={{
                opacity: 0,
                position: 'absolute',
                left: hx - 16,
                top: hy - 16,
                width: 32,
                height: 32,
              }}
            />
          );
        });
      })}

      {typeof hovered === 'string' && (
        (() => {
          const parts = hovered.split('-');
          if (parts.length !== 2) return null;
          const ri = Number(parts[0]);
          const di = Number(parts[1]);
          if (!Number.isFinite(ri) || !Number.isFinite(di)) return null;
          const ring = rings[ri];
          if (!ring || !Array.isArray(ring.data) || di < 0 || di >= ring.data.length) return null;
          const d = ring.data[di];
          const total = ring.data.reduce((s, x) => s + x.value, 0);
          return (
            <Tooltip
              visible={true}
              x={width / 2 + 20}
              y={height / 2 - 30}
              title={`Ring ${ri + 1}`}
              rows={[
                { label: 'Value', value: String(d.value), color: d.color },
                { label: 'Share', value: Math.round((d.value / total) * 100) + '%' },
              ]}
            />
          );
        })()
      )}
    </Box>
  );
}
