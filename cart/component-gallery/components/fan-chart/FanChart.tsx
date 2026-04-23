const React: any = require('react');
const { useMemo } = React;
import { Box, Graph, Text } from '../../../../runtime/primitives';
import { PALETTE, scaleLinear, plotArea } from '../../lib/chart-utils';

export type FanChartProps = {};

export function FanChart(_props: FanChartProps) {
  const width = 320;
  const height = 200;
  const plot = plotArea(width, height);
  const base = useMemo(() => [20, 22, 25, 28, 30, 32], []);
  const upper = useMemo(() => [25, 28, 32, 36, 40, 45], []);
  const lower = useMemo(() => [15, 16, 18, 20, 22, 24], []);
  const labels = ['A', 'B', 'C', 'D', 'E', 'F'];
  const max = Math.max(...upper);
  const min = Math.min(...lower);
  const yScale = scaleLinear([min, max], [plot.y + plot.h, plot.y]);
  const xScale = scaleLinear([0, base.length - 1], [plot.x, plot.x + plot.w]);

  const fanPath = useMemo(() => {
    let d = `M ${xScale(0)} ${yScale(base[0])}`;
    base.forEach((v, i) => { if (i > 0) d += ` L ${xScale(i)} ${yScale(v)}`; });
    upper.forEach((v, i) => { d += ` L ${xScale(upper.length - 1 - i)} ${yScale(upper[upper.length - 1 - i])}`; });
    d += ' Z';
    return d;
  }, [base, upper, xScale, yScale]);

  const lowerPath = useMemo(() => {
    let d = `M ${xScale(0)} ${yScale(base[0])}`;
    base.forEach((v, i) => { if (i > 0) d += ` L ${xScale(i)} ${yScale(v)}`; });
    lower.forEach((v, i) => { d += ` L ${xScale(lower.length - 1 - i)} ${yScale(lower[lower.length - 1 - i])}`; });
    d += ' Z';
    return d;
  }, [base, lower, xScale, yScale]);

  const linePath = useMemo(() => {
    let d = `M ${xScale(0)} ${yScale(base[0])}`;
    base.forEach((v, i) => { if (i > 0) d += ` L ${xScale(i)} ${yScale(v)}`; });
    return d;
  }, [base, xScale, yScale]);

  return (
    <Box style={{ width, height }}>
      <Graph originTopLeft style={{ width, height }}>
        <Graph.Path d={fanPath} fill={PALETTE.pink} fillOpacity={0.2} stroke="none" />
        <Graph.Path d={lowerPath} fill={PALETTE.cyan} fillOpacity={0.15} stroke="none" />
        <Graph.Path d={linePath} stroke={PALETTE.pink} strokeWidth={2} fill="none" />
      </Graph>
      {labels.map((l, i) => (
        <Box key={l} style={{ position: 'absolute', left: xScale(i) - 8, top: plot.y + plot.h + 4, width: 16, alignItems: 'center' }}>
          <Text fontSize={9} color={PALETTE.slateLight}>{l}</Text>
        </Box>
      ))}
    </Box>
  );
}
