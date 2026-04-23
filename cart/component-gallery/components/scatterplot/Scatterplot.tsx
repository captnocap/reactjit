const React: any = require('react');
const { useMemo } = React;
import { Box, Graph, Text } from '../../../../runtime/primitives';
import { PALETTE, scaleLinear, plotArea, niceTicks } from '../../lib/chart-utils';

export type ScatterplotProps = {};

export function Scatterplot(_props: ScatterplotProps) {
  const width = 280;
  const height = 200;
  const plot = plotArea(width, height);
  const data = useMemo(() => [
    [10, 25], [20, 18], [30, 35], [40, 22], [50, 40], [60, 30], [70, 45], [80, 28], [90, 50]
  ], []);
  const xs = data.map((d) => d[0]);
  const ys = data.map((d) => d[1]);
  const xScale = scaleLinear([Math.min(...xs), Math.max(...xs)], [plot.x, plot.x + plot.w]);
  const yScale = scaleLinear([Math.min(...ys), Math.max(...ys)], [plot.y + plot.h, plot.y]);
  const yTicks = niceTicks(Math.min(...ys), Math.max(...ys), 4);
  const xTicks = niceTicks(Math.min(...xs), Math.max(...xs), 4);

  return (
    <Box style={{ width, height }}>
      <Graph originTopLeft style={{ width, height }}>
        {yTicks.map((t) => (
          <Graph.Path key={`y-${t}`} d={`M ${plot.x} ${yScale(t)} L ${plot.x + plot.w} ${yScale(t)}`} stroke="#2a2a4a" strokeWidth={1} />
        ))}
        {xTicks.map((t) => (
          <Graph.Path key={`x-${t}`} d={`M ${xScale(t)} ${plot.y} L ${xScale(t)} ${plot.y + plot.h}`} stroke="#2a2a4a" strokeWidth={1} />
        ))}
        {data.map((p, i) => (
          <Graph.Path
            key={i}
            d={`M ${xScale(p[0]) - 3} ${yScale(p[1])} A 3 3 0 1 1 ${xScale(p[0]) + 3} ${yScale(p[1])} A 3 3 0 1 1 ${xScale(p[0]) - 3} ${yScale(p[1])}`}
            fill={i % 2 === 0 ? PALETTE.pink : PALETTE.cyan}
            stroke="none"
          />
        ))}
      </Graph>
    </Box>
  );
}
