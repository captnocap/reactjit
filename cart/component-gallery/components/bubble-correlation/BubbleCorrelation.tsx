const React: any = require('react');
const { useMemo } = React;
import { Box, Graph, Text } from '../../../../runtime/primitives';
import { PALETTE, scaleLinear, plotArea } from '../../lib/chart-utils';

export type BubbleCorrelationProps = {};

export function BubbleCorrelation(_props: BubbleCorrelationProps) {
  const width = 320;
  const height = 220;
  const plot = plotArea(width, height);
  const data = useMemo(() => [
    { x: 10, y: 20, r: 12 },
    { x: 25, y: 35, r: 18 },
    { x: 40, y: 15, r: 10 },
    { x: 55, y: 45, r: 22 },
    { x: 70, y: 30, r: 15 },
    { x: 85, y: 55, r: 20 },
    { x: 30, y: 50, r: 14 },
    { x: 60, y: 20, r: 16 },
  ], []);
  const xs = data.map((d) => d.x);
  const ys = data.map((d) => d.y);
  const xScale = scaleLinear([Math.min(...xs), Math.max(...xs)], [plot.x, plot.x + plot.w]);
  const yScale = scaleLinear([Math.min(...ys), Math.max(...ys)], [plot.y + plot.h, plot.y]);

  return (
    <Box style={{ width, height }}>
      <Graph originTopLeft style={{ width, height }}>
        <Graph.Path d={`M ${plot.x} ${plot.y} L ${plot.x} ${plot.y + plot.h} L ${plot.x + plot.w} ${plot.y + plot.h}`} stroke="#2a2a4a" strokeWidth={1} />
        {data.map((d, i) => (
          <Graph.Path
            key={i}
            d={`M ${xScale(d.x) - d.r} ${yScale(d.y)} A ${d.r} ${d.r} 0 1 1 ${xScale(d.x) + d.r} ${yScale(d.y)} A ${d.r} ${d.r} 0 1 1 ${xScale(d.x) - d.r} ${yScale(d.y)}`}
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
