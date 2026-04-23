const React: any = require('react');
const { useMemo } = React;
import { Box, Graph, Text } from '../../../../runtime/primitives';
import { PALETTE } from '../../lib/chart-utils';

export type PyramidChartProps = {};

export function PyramidChart(_props: PyramidChartProps) {
  const width = 200;
  const height = 180;
  const cx = width / 2;
  const baseY = height - 20;
  const topY = 20;
  const baseW = 140;

  const levels = useMemo(() => [
    { label: 'Top', value: 10, color: PALETTE.pink },
    { label: 'Mid', value: 25, color: PALETTE.cyan },
    { label: 'Base', value: 40, color: PALETTE.blue },
  ], []);

  const total = levels.reduce((s, l) => s + l.value, 0);
  let currentY = topY;

  // Width ramps from 0 at the apex (topY) to baseW at the floor (baseY).
  // The previous `1 - t` formula was the inverse — fattest at top, thinnest at
  // bottom — i.e. a funnel, not a pyramid.
  const widthAt = (yv: number): number => baseW * ((yv - topY) / (baseY - topY));

  return (
    <Box style={{ width, height }}>
      <Graph originTopLeft style={{ width, height }}>
        {levels.map((l, i) => {
          // NB: do NOT name this `h` — esbuild lowers JSX to `h(...)` calls
          // and a local `h` shadows the factory (see WorkerCharts.tsx).
          const levelHeight = ((l.value / total) * (baseY - topY));
          const topWidth = widthAt(currentY);
          const bottomWidth = widthAt(currentY + levelHeight);
          const y1 = currentY;
          const y2 = currentY + levelHeight;
          const x1 = cx - topWidth / 2;
          const x2 = cx + topWidth / 2;
          const x3 = cx + bottomWidth / 2;
          const x4 = cx - bottomWidth / 2;
          currentY += levelHeight;
          return (
            <Graph.Path
              key={i}
              d={`M ${x1} ${y1} L ${x2} ${y1} L ${x3} ${y2} L ${x4} ${y2} Z`}
              fill={l.color}
              fillOpacity={0.8}
              stroke={l.color}
              strokeWidth={1}
            />
          );
        })}
      </Graph>
      {levels.map((l, i) => {
        const levelHeight = ((l.value / total) * (baseY - topY));
        const y = currentY - levelHeight / 2;
        currentY -= levelHeight;
        return (
          <Box key={`lbl-${i}`} style={{ position: 'absolute', left: cx - 20, top: y - 6, width: 40, alignItems: 'center' }}>
            <Text fontSize={9} color={PALETTE.white}>{l.label}</Text>
          </Box>
        );
      })}
    </Box>
  );
}
