const React: any = require('react');
const { useMemo } = React;
import { Box, Graph, Text } from '../../../../runtime/primitives';
import { PALETTE } from '../../lib/chart-utils';

export type VennProps = {};

export function Venn(_props: VennProps) {
  const width = 240;
  const height = 180;
  const cx = width / 2;
  const cy = height / 2;
  const r = 45;

  const circles = useMemo(() => [
    { cx: cx - 25, cy, r, color: PALETTE.pink },
    { cx: cx + 25, cy, r, color: PALETTE.cyan },
    { cx: cx, cy: cy + 20, r, color: PALETTE.blue },
  ], []);

  return (
    <Box style={{ width, height }}>
      <Graph originTopLeft style={{ width, height }}>
        {circles.map((c, i) => (
          <Graph.Path
            key={i}
            d={`M ${c.cx - c.r} ${c.cy} A ${c.r} ${c.r} 0 1 1 ${c.cx + c.r} ${c.cy} A ${c.r} ${c.r} 0 1 1 ${c.cx - c.r} ${c.cy}`}
            fill={c.color}
            fillOpacity={0.35}
            stroke={c.color}
            strokeWidth={1.5}
          />
        ))}
      </Graph>
      {circles.map((c, i) => (
        <Box key={`lbl-${i}`} style={{ position: 'absolute', left: c.cx - 20, top: c.cy - c.r - 14, width: 40, alignItems: 'center' }}>
          <Text fontSize={9} color={PALETTE.slateLight}>{String.fromCharCode(65 + i)}</Text>
        </Box>
      ))}
    </Box>
  );
}
