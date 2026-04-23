const React: any = require('react');
const { useMemo } = React;
import { Box, Graph, Text } from '../../../../runtime/primitives';
import { PALETTE, donutSegment } from '../../lib/chart-utils';

export type RingsInPieChartProps = {};

export function RingsInPieChart(_props: RingsInPieChartProps) {
  const width = 200;
  const height = 200;
  // <Graph> world origin = element center — donut segments draw from (0, 0).

  const rings = useMemo(() => [
    { outer: 80, inner: 65, data: [{ v: 40, c: PALETTE.pink }, { v: 35, c: PALETTE.cyan }, { v: 25, c: PALETTE.blue }] },
    { outer: 60, inner: 45, data: [{ v: 50, c: PALETTE.purple }, { v: 30, c: PALETTE.teal }, { v: 20, c: PALETTE.indigo }] },
    { outer: 40, inner: 25, data: [{ v: 60, c: PALETTE.pinkLight }, { v: 40, c: PALETTE.cyanLight }] },
  ], []);

  return (
    <Box style={{ width, height, alignItems: 'center', justifyContent: 'center' }}>
      <Graph style={{ width, height }}>
        {rings.map((ring, ri) => {
          const total = ring.data.reduce((s, d) => s + d.v, 0);
          let cursor = 0;
          return ring.data.map((d) => {
            const start = cursor;
            const end = cursor + (d.v / total) * 360;
            cursor = end;
            return (
              <Graph.Path
                key={`${ri}-${start}`}
                d={donutSegment(0, 0, ring.inner, ring.outer, start, end)}
                fill={d.c}
                fillOpacity={0.8}
                stroke={d.c}
                strokeWidth={0.5}
              />
            );
          });
        })}
      </Graph>
    </Box>
  );
}
