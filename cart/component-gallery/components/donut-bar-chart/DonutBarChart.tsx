const React: any = require('react');
const { useMemo } = React;
import { Box, Graph, Text } from '../../../../runtime/primitives';
import { PALETTE, donutSegment } from '../../lib/chart-utils';

export type DonutBarChartProps = {};

export function DonutBarChart(_props: DonutBarChartProps) {
  const width = 200;
  const height = 200;
  // <Graph> world origin is the element center — donut segments draw from (0,0).
  const outer = 70;
  const inner = 45;

  const data = useMemo(() => [
    { value: 35, color: PALETTE.pink },
    { value: 25, color: PALETTE.cyan },
    { value: 20, color: PALETTE.blue },
    { value: 20, color: PALETTE.purple },
  ], []);

  const total = data.reduce((s, d) => s + d.value, 0);
  let cursor = 0;
  const segments = data.map((d) => {
    const start = cursor;
    const end = cursor + (d.value / total) * 360;
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
            fillOpacity={0.85}
            stroke={s.color}
            strokeWidth={1}
          />
        ))}
      </Graph>
      <Box style={{ position: 'absolute', alignItems: 'center' }}>
        <Text fontSize={11} color={PALETTE.slateLight}>Total</Text>
        <Text fontSize={16} color={PALETTE.white} style={{ fontWeight: 'bold' }}>{total}</Text>
      </Box>
    </Box>
  );
}
