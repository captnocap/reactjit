const React: any = require('react');
const { useMemo } = React;
import { Box, Graph, Text } from '../../../../runtime/primitives';
import { PALETTE, scaleLinear, plotArea } from '../../lib/chart-utils';

export type BubbleScatterplotProps = {};

export function BubbleScatterplot(_props: BubbleScatterplotProps) {
  const width = 280;
  const height = 200;
  const plot = plotArea(width, height);
  const data = useMemo(() => [
    { x: 20, y: 30, r: 8 },
    { x: 40, y: 50, r: 12 },
    { x: 60, y: 25, r: 6 },
    { x: 80, y: 60, r: 15 },
    { x: 100, y: 40, r: 10 },
    { x: 30, y: 70, r: 7 },
    { x: 70, y: 80, r: 9 },
  ], []);
  const xs = data.map((d) => d.x);
  const ys = data.map((d) => d.y);
  const xScale = scaleLinear([Math.min(...xs), Math.max(...xs)], [plot.x, plot.x + plot.w]);
  const yScale = scaleLinear([Math.min(...ys), Math.max(...ys)], [plot.y + plot.h, plot.y]);

  return (
    <Box style={{ width, height }}>
      <Graph originTopLeft style={{ width, height }}>
        <Graph.Path d={`M ${plot.x} ${plot.y} L ${plot.x} ${plot.y + plot.h} L ${plot.x + plot.w} ${plot.y + plot.h}`} stroke="#2a2a4a" strokeWidth={1} />
        {data.map((p, i) => (
          <Graph.Path
            key={i}
            d={`M ${xScale(p.x) - p.r} ${yScale(p.y)} A ${p.r} ${p.r} 0 1 1 ${xScale(p.x) + p.r} ${yScale(p.y)} A ${p.r} ${p.r} 0 1 1 ${xScale(p.x) - p.r} ${yScale(p.y)}`}
            fill={i % 2 === 0 ? PALETTE.pink : PALETTE.cyan}
            fillOpacity={0.6}
            stroke={i % 2 === 0 ? PALETTE.pink : PALETTE.cyan}
            strokeWidth={1}
          />
        ))}
      </Graph>
    </Box>
  );
}
