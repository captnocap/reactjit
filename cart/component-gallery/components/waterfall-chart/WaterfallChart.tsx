const React: any = require('react');
const { useMemo } = React;
import { Box, Graph, Text } from '../../../../runtime/primitives';
import { PALETTE, scaleLinear, plotArea, niceTicks } from '../../lib/chart-utils';

export type WaterfallChartProps = {};

export function WaterfallChart(_props: WaterfallChartProps) {
  const width = 320;
  const height = 200;
  const plot = plotArea(width, height);
  const changes = useMemo(() => [20, 15, -10, 25, -8, 12, -5], []);
  const labels = ['Start', 'A', 'B', 'C', 'D', 'E', 'End'];

  let running = 0;
  const bars = changes.map((c) => {
    const start = running;
    running += c;
    return { start, end: running, change: c };
  });

  const allVals = [0, ...bars.map((b) => b.end)];
  const max = Math.max(...allVals);
  const min = Math.min(...allVals);
  const yScale = scaleLinear([min, max], [plot.y + plot.h, plot.y]);
  const xScale = scaleLinear([0, bars.length], [plot.x, plot.x + plot.w]);
  const barW = (plot.w / bars.length) * 0.5;
  const ticks = niceTicks(min, max, 5);

  return (
    <Box style={{ width, height }}>
      <Graph originTopLeft style={{ width, height }}>
        {ticks.map((t) => (
          <Graph.Path key={t} d={`M ${plot.x} ${yScale(t)} L ${plot.x + plot.w} ${yScale(t)}`} stroke="#2a2a4a" strokeWidth={1} />
        ))}
        <Graph.Path d={`M ${plot.x} ${yScale(0)} L ${plot.x + plot.w} ${yScale(0)}`} stroke={PALETTE.slateLight} strokeWidth={1} />
        {bars.map((b, i) => {
          const x = xScale(i + 0.5) - barW / 2;
          const y = yScale(Math.max(b.start, b.end));
          const h = Math.abs(yScale(b.end) - yScale(b.start));
          const color = b.change >= 0 ? PALETTE.pink : PALETTE.cyan;
          return (
            <React.Fragment key={i}>
              <Graph.Path d={`M ${x} ${y} L ${x + barW} ${y} L ${x + barW} ${y + h} L ${x} ${y + h} Z`} fill={color} fillOpacity={0.8} stroke={color} strokeWidth={1} />
              {i < bars.length - 1 && (
                <Graph.Path d={`M ${x + barW} ${yScale(b.end)} L ${xScale(i + 1.5) - barW / 2} ${yScale(b.end)}`} stroke={PALETTE.slateLight} strokeWidth={1} strokeDasharray="3,3" />
              )}
            </React.Fragment>
          );
        })}
      </Graph>
      {labels.map((l, i) => (
        <Box key={l} style={{ position: 'absolute', left: xScale(i + 0.5) - 12, top: plot.y + plot.h + 4, width: 24, alignItems: 'center' }}>
          <Text fontSize={8} color={PALETTE.slateLight}>{l}</Text>
        </Box>
      ))}
    </Box>
  );
}
