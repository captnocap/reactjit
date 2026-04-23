const React: any = require('react');
const { useMemo } = React;
import { Box, Graph, Text } from '../../../../runtime/primitives';
import { PALETTE, polar } from '../../lib/chart-utils';

export type CircularBarChartProps = {};

export function CircularBarChart(_props: CircularBarChartProps) {
  const width = 220;
  const height = 200;
  // <Graph> world origin is at the element center; polar paths use (0, 0).
  // Labels use DOM top-left origin so they get width/2, height/2.
  const labelCx = width / 2;
  const labelCy = height / 2;
  const innerR = 30;
  const maxBar = 50;
  const data = useMemo(() => [20, 35, 45, 30, 40, 25, 50], []);
  const labels = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
  const angleStep = 360 / data.length;

  return (
    <Box style={{ width, height }}>
      <Graph style={{ width, height }}>
        {data.map((v, i) => {
          const angle = i * angleStep;
          const barLen = (v / 50) * maxBar;
          const [x1, y1] = polar(0, 0, innerR, angle);
          const [x2, y2] = polar(0, 0, innerR + barLen, angle);
          return (
            <Graph.Path
              key={i}
              d={`M ${x1} ${y1} L ${x2} ${y2}`}
              stroke={i % 2 === 0 ? PALETTE.pink : PALETTE.cyan}
              strokeWidth={8}
              strokeLinecap="round"
            />
          );
        })}
      </Graph>
      {data.map((v, i) => {
        const angle = i * angleStep;
        const barLen = (v / 50) * maxBar;
        const [x, y] = polar(labelCx, labelCy, innerR + barLen + 10, angle);
        return (
          <Box key={`lbl-${i}`} style={{ position: 'absolute', left: x - 8, top: y - 6, width: 16, alignItems: 'center' }}>
            <Text fontSize={8} color={PALETTE.slateLight}>{labels[i]}</Text>
          </Box>
        );
      })}
    </Box>
  );
}
