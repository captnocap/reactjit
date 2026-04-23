const React: any = require('react');
const { useMemo } = React;
import { Box, Graph, Text } from '../../../../runtime/primitives';
import { PALETTE, scaleLinear, plotArea, niceTicks } from '../../lib/chart-utils';

export type GroupedBarChartProps = {};

export function GroupedBarChart(_props: GroupedBarChartProps) {
  const width = 320;
  const height = 200;
  const plot = plotArea(width, height);
  const series1 = useMemo(() => [12, 19, 15, 25, 22], []);
  const series2 = useMemo(() => [8, 14, 18, 20, 24], []);
  const labels = ['A', 'B', 'C', 'D', 'E'];
  const max = Math.max(...series1, ...series2);
  const yScale = scaleLinear([0, max], [plot.y + plot.h, plot.y]);
  const xScale = scaleLinear([0, labels.length], [plot.x, plot.x + plot.w]);
  const groupW = plot.w / labels.length;
  const barW = groupW * 0.35;
  const gap = 2;
  const ticks = niceTicks(0, max, 5);

  return (
    <Box style={{ width, height }}>
      <Graph originTopLeft style={{ width, height }}>
        {ticks.map((t) => (
          <Graph.Path key={t} d={`M ${plot.x} ${yScale(t)} L ${plot.x + plot.w} ${yScale(t)}`} stroke="#2a2a4a" strokeWidth={1} />
        ))}
        {labels.map((_, gi) => {
          const gx = xScale(gi) + groupW / 2;
          const v1 = series1[gi];
          const v2 = series2[gi];
          const y1 = yScale(v1);
          const y2 = yScale(v2);
          const h1 = plot.y + plot.h - y1;
          const h2 = plot.y + plot.h - y2;
          const x1 = gx - barW - gap / 2;
          const x2 = gx + gap / 2;
          return (
            <React.Fragment key={gi}>
              <Graph.Path d={`M ${x1} ${plot.y + plot.h} L ${x1} ${y1} L ${x1 + barW} ${y1} L ${x1 + barW} ${plot.y + plot.h} Z`} fill={PALETTE.pink} fillOpacity={0.85} stroke={PALETTE.pink} strokeWidth={1} />
              <Graph.Path d={`M ${x2} ${plot.y + plot.h} L ${x2} ${y2} L ${x2 + barW} ${y2} L ${x2 + barW} ${plot.y + plot.h} Z`} fill={PALETTE.cyan} fillOpacity={0.85} stroke={PALETTE.cyan} strokeWidth={1} />
            </React.Fragment>
          );
        })}
      </Graph>
      {labels.map((l, i) => (
        <Box key={l} style={{ position: 'absolute', left: xScale(i + 0.5) - 8, top: plot.y + plot.h + 4, width: 16, alignItems: 'center' }}>
          <Text fontSize={9} color={PALETTE.slateLight}>{l}</Text>
        </Box>
      ))}
    </Box>
  );
}
