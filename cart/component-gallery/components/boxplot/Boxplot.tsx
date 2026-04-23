const React: any = require('react');
const { useMemo } = React;
import { Box, Graph, Text } from '../../../../runtime/primitives';
import { PALETTE, scaleLinear, plotArea } from '../../lib/chart-utils';

export type BoxplotProps = {};

export function Boxplot(_props: BoxplotProps) {
  const width = 320;
  const height = 200;
  const plot = plotArea(width, height);
  const data = useMemo(() => [
    { min: 5, q1: 12, median: 18, q3: 25, max: 35 },
    { min: 8, q1: 15, median: 22, q3: 28, max: 38 },
    { min: 3, q1: 10, median: 16, q3: 24, max: 32 },
    { min: 10, q1: 18, median: 24, q3: 30, max: 40 },
    { min: 6, q1: 14, median: 20, q3: 26, max: 34 },
  ], []);
  const labels = ['A', 'B', 'C', 'D', 'E'];
  const allVals = data.flatMap((d) => [d.min, d.max]);
  const maxV = Math.max(...allVals);
  const minV = Math.min(...allVals);
  const yScale = scaleLinear([minV, maxV], [plot.y + plot.h, plot.y]);
  const xScale = scaleLinear([0, data.length], [plot.x, plot.x + plot.w]);
  const boxW = (plot.w / data.length) * 0.5;

  return (
    <Box style={{ width, height }}>
      <Graph originTopLeft style={{ width, height }}>
        {data.map((d, i) => {
          const cx = xScale(i + 0.5);
          const x1 = cx - boxW / 2;
          const x2 = cx + boxW / 2;
          const yMin = yScale(d.min);
          const yQ1 = yScale(d.q1);
          const yMed = yScale(d.median);
          const yQ3 = yScale(d.q3);
          const yMax = yScale(d.max);
          const color = i % 2 === 0 ? PALETTE.pink : PALETTE.cyan;
          return (
            <React.Fragment key={i}>
              {/* whiskers */}
              <Graph.Path d={`M ${cx} ${yMin} L ${cx} ${yQ3}`} stroke={color} strokeWidth={1} />
              <Graph.Path d={`M ${cx} ${yQ1} L ${cx} ${yMax}`} stroke={color} strokeWidth={1} />
              <Graph.Path d={`M ${x1} ${yMin} L ${x2} ${yMin}`} stroke={color} strokeWidth={1} />
              <Graph.Path d={`M ${x1} ${yMax} L ${x2} ${yMax}`} stroke={color} strokeWidth={1} />
              {/* box */}
              <Graph.Path d={`M ${x1} ${yQ1} L ${x2} ${yQ1} L ${x2} ${yQ3} L ${x1} ${yQ3} Z`} fill={color} fillOpacity={0.3} stroke={color} strokeWidth={1.5} />
              {/* median */}
              <Graph.Path d={`M ${x1} ${yMed} L ${x2} ${yMed}`} stroke={PALETTE.white} strokeWidth={1.5} />
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
