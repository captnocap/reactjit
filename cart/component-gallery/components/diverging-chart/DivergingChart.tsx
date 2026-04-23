const React: any = require('react');
const { useMemo } = React;
import { Box, Graph, Text } from '../../../../runtime/primitives';
import { PALETTE, scaleLinear, plotArea } from '../../lib/chart-utils';

export type DivergingChartProps = {};

export function DivergingChart(_props: DivergingChartProps) {
  const width = 320;
  const height = 200;
  const plot = plotArea(width, height, { top: 20, right: 20, bottom: 20, left: 20 });
  const categories = useMemo(() => ['A', 'B', 'C', 'D', 'E', 'F'], []);
  const leftValues = useMemo(() => [-30, -45, -25, -50, -35, -40], []);
  const rightValues = useMemo(() => [25, 35, 40, 30, 45, 20], []);
  const max = Math.max(...leftValues.map(Math.abs), ...rightValues);
  const xScale = scaleLinear([-max, max], [plot.x, plot.x + plot.w]);
  const yScale = scaleLinear([0, categories.length], [plot.y, plot.y + plot.h]);
  const zeroX = xScale(0);
  const barH = (plot.h / categories.length) * 0.6;

  return (
    <Box style={{ width, height }}>
      <Graph originTopLeft style={{ width, height }}>
        <Graph.Path d={`M ${zeroX} ${plot.y} L ${zeroX} ${plot.y + plot.h}`} stroke={PALETTE.slateLight} strokeWidth={1} />
        {categories.map((cat, i) => {
          const y = yScale(i + 0.5) - barH / 2;
          const leftW = zeroX - xScale(leftValues[i]);
          const rightW = xScale(rightValues[i]) - zeroX;
          return (
            <React.Fragment key={cat}>
              <Graph.Path d={`M ${zeroX - leftW} ${y} L ${zeroX} ${y} L ${zeroX} ${y + barH} L ${zeroX - leftW} ${y + barH} Z`} fill={PALETTE.pink} fillOpacity={0.85} />
              <Graph.Path d={`M ${zeroX} ${y} L ${zeroX + rightW} ${y} L ${zeroX + rightW} ${y + barH} L ${zeroX} ${y + barH} Z`} fill={PALETTE.cyan} fillOpacity={0.85} />
            </React.Fragment>
          );
        })}
      </Graph>
      {categories.map((cat, i) => (
        <Box key={cat} style={{ position: 'absolute', left: plot.x + plot.w / 2 - 20, top: yScale(i + 0.5) - 6, width: 40, alignItems: 'center' }}>
          <Text fontSize={9} color={PALETTE.slateLight}>{cat}</Text>
        </Box>
      ))}
    </Box>
  );
}
