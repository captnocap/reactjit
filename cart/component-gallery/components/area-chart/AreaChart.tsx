const React: any = require('react');
const { useMemo } = React;
import { Box, Graph, Text } from '../../../../runtime/primitives';
import { PALETTE, scaleLinear, plotArea, niceTicks } from '../../lib/chart-utils';

export type AreaChartProps = {};

export function AreaChart(_props: AreaChartProps) {
  const width = 320;
  const height = 200;
  const plot = plotArea(width, height);
  const data1 = useMemo(() => [12, 19, 15, 25, 22, 30, 28, 35], []);
  const data2 = useMemo(() => [8, 14, 18, 20, 24, 22, 26, 30], []);
  const labels = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
  const max = Math.max(...data1, ...data2);
  const yScale = scaleLinear([0, max], [plot.y + plot.h, plot.y]);
  const xScale = scaleLinear([0, data1.length - 1], [plot.x, plot.x + plot.w]);
  const ticks = niceTicks(0, max, 5);

  const area1 = useMemo(() => {
    let d = `M ${xScale(0)} ${plot.y + plot.h}`;
    data1.forEach((v, i) => { d += ` L ${xScale(i)} ${yScale(v)}`; });
    d += ` L ${xScale(data1.length - 1)} ${plot.y + plot.h} Z`;
    return d;
  }, [data1, xScale, yScale]);

  const area2 = useMemo(() => {
    let d = `M ${xScale(0)} ${plot.y + plot.h}`;
    data2.forEach((v, i) => { d += ` L ${xScale(i)} ${yScale(v)}`; });
    d += ` L ${xScale(data2.length - 1)} ${plot.y + plot.h} Z`;
    return d;
  }, [data2, xScale, yScale]);

  return (
    <Box style={{ width, height }}>
      <Graph originTopLeft style={{ width, height }}>
        {ticks.map((t) => (
          <Graph.Path key={t} d={`M ${plot.x} ${yScale(t)} L ${plot.x + plot.w} ${yScale(t)}`} stroke="#2a2a4a" strokeWidth={1} />
        ))}
        <Graph.Path d={area2} fill={PALETTE.cyan} fillOpacity={0.3} stroke="none" />
        <Graph.Path d={area1} fill={PALETTE.pink} fillOpacity={0.4} stroke="none" />
        {data1.map((v, i) => (
          <Graph.Path key={`p1-${i}`} d={`M ${xScale(i) - 2} ${yScale(v)} A 2 2 0 1 1 ${xScale(i) + 2} ${yScale(v)} A 2 2 0 1 1 ${xScale(i) - 2} ${yScale(v)}`} fill={PALETTE.pink} stroke="none" />
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
