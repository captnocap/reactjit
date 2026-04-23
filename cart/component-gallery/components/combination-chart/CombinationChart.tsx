const React: any = require('react');
const { useMemo } = React;
import { Box, Graph, Text } from '../../../../runtime/primitives';
import { PALETTE, scaleLinear, plotArea, niceTicks } from '../../lib/chart-utils';

export type CombinationChartProps = {};

export function CombinationChart(_props: CombinationChartProps) {
  const width = 320;
  const height = 200;
  const plot = plotArea(width, height);
  const bars = useMemo(() => [15, 25, 20, 30, 28, 35], []);
  const line = useMemo(() => [12, 22, 24, 28, 32, 38], []);
  const labels = ['A', 'B', 'C', 'D', 'E', 'F'];
  const max = Math.max(...bars, ...line);
  const yScale = scaleLinear([0, max], [plot.y + plot.h, plot.y]);
  const xScale = scaleLinear([0, bars.length - 1], [plot.x, plot.x + plot.w]);
  const barW = (plot.w / bars.length) * 0.4;
  const ticks = niceTicks(0, max, 5);

  const linePath = useMemo(() => {
    let d = `M ${xScale(0)} ${yScale(line[0])}`;
    line.forEach((v, i) => { if (i > 0) d += ` L ${xScale(i)} ${yScale(v)}`; });
    return d;
  }, [line, xScale, yScale]);

  return (
    <Box style={{ width, height }}>
      <Graph originTopLeft style={{ width, height }}>
        {ticks.map((t) => (
          <Graph.Path key={t} d={`M ${plot.x} ${yScale(t)} L ${plot.x + plot.w} ${yScale(t)}`} stroke="#2a2a4a" strokeWidth={1} />
        ))}
        {bars.map((v, i) => {
          const x = xScale(i) - barW / 2;
          const y = yScale(v);
          // NB: do NOT name this `h` — esbuild lowers JSX to `h(...)` calls
          // and a local `h` shadows the factory (see WorkerCharts.tsx).
          const barHeight = plot.y + plot.h - y;
          void barHeight;
          return <Graph.Path key={`b-${i}`} d={`M ${x} ${plot.y + plot.h} L ${x} ${y} L ${x + barW} ${y} L ${x + barW} ${plot.y + plot.h} Z`} fill={PALETTE.cyan} fillOpacity={0.6} stroke={PALETTE.cyan} strokeWidth={1} />;
        })}
        <Graph.Path d={linePath} stroke={PALETTE.pink} strokeWidth={2.5} fill="none" />
        {line.map((v, i) => (
          <Graph.Path key={`p-${i}`} d={`M ${xScale(i) - 3} ${yScale(v)} A 3 3 0 1 1 ${xScale(i) + 3} ${yScale(v)} A 3 3 0 1 1 ${xScale(i) - 3} ${yScale(v)}`} fill={PALETTE.pink} stroke="none" />
        ))}
      </Graph>
      {labels.map((l, i) => (
        <Box key={l} style={{ position: 'absolute', left: xScale(i) - 8, top: plot.y + plot.h + 4, width: 16, alignItems: 'center' }}>
          <Text fontSize={9} color={PALETTE.slateLight}>{l}</Text>
        </Box>
      ))}
    </Box>
  );
}
