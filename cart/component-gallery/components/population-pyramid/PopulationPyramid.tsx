const React: any = require('react');
const { useMemo } = React;
import { Box, Graph, Text } from '../../../../runtime/primitives';
import { PALETTE, scaleLinear, plotArea } from '../../lib/chart-utils';

export type PopulationPyramidProps = {};

export function PopulationPyramid(_props: PopulationPyramidProps) {
  const width = 320;
  const height = 200;
  const plot = plotArea(width, height, { top: 20, right: 20, bottom: 20, left: 20 });
  const labels = useMemo(() => ['0-10', '11-20', '21-30', '31-40', '41-50', '51-60', '61+'], []);
  const left = useMemo(() => [8, 12, 18, 22, 20, 15, 10], []);
  const right = useMemo(() => [9, 11, 17, 21, 19, 16, 12], []);
  const max = Math.max(...left, ...right);
  const xScale = scaleLinear([-max, max], [plot.x, plot.x + plot.w]);
  const yScale = scaleLinear([0, labels.length], [plot.y, plot.y + plot.h]);
  const zeroX = xScale(0);
  const barH = (plot.h / labels.length) * 0.7;

  return (
    <Box style={{ width, height }}>
      <Graph originTopLeft style={{ width, height }}>
        <Graph.Path d={`M ${zeroX} ${plot.y} L ${zeroX} ${plot.y + plot.h}`} stroke={PALETTE.slateLight} strokeWidth={1} />
        {labels.map((l, i) => {
          const y = yScale(i + 0.5) - barH / 2;
          const lw = zeroX - xScale(-left[i]);
          const rw = xScale(right[i]) - zeroX;
          return (
            <React.Fragment key={l}>
              <Graph.Path d={`M ${zeroX - lw} ${y} L ${zeroX} ${y} L ${zeroX} ${y + barH} L ${zeroX - lw} ${y + barH} Z`} fill={PALETTE.pink} fillOpacity={0.8} />
              <Graph.Path d={`M ${zeroX} ${y} L ${zeroX + rw} ${y} L ${zeroX + rw} ${y + barH} L ${zeroX} ${y + barH} Z`} fill={PALETTE.cyan} fillOpacity={0.8} />
            </React.Fragment>
          );
        })}
      </Graph>
      {labels.map((l, i) => (
        <Box key={l} style={{ position: 'absolute', left: plot.x + plot.w / 2 - 20, top: yScale(i + 0.5) - 6, width: 40, alignItems: 'center' }}>
          <Text fontSize={8} color={PALETTE.slateLight}>{l}</Text>
        </Box>
      ))}
    </Box>
  );
}
