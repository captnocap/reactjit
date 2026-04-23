const React: any = require('react');
const { useMemo } = React;
import { Box, Graph, Text } from '../../../../runtime/primitives';
import { PALETTE, arcPath } from '../../lib/chart-utils';

export type CircularProgressProps = {};

export function CircularProgress(_props: CircularProgressProps) {
  const width = 180;
  const height = 180;
  // <Graph> world origin = element center — arcs draw from (0, 0).
  const radius = 55;
  const progress = 0.65;
  const endAngle = progress * 360;

  const bgPath = useMemo(() => arcPath(0, 0, radius, 0, 360), [radius]);
  const fillPath = useMemo(() => arcPath(0, 0, radius, 0, endAngle), [radius, endAngle]);

  return (
    <Box style={{ width, height, alignItems: 'center', justifyContent: 'center' }}>
      <Graph style={{ width, height }}>
        <Graph.Path d={bgPath} stroke="#2a2a4a" strokeWidth={10} fill="none" />
        <Graph.Path d={fillPath} stroke={PALETTE.cyan} strokeWidth={10} fill="none" />
      </Graph>
      <Box style={{ position: 'absolute', alignItems: 'center' }}>
        <Text fontSize={22} color={PALETTE.white} style={{ fontWeight: 'bold' }}>{Math.round(progress * 100)}%</Text>
      </Box>
    </Box>
  );
}
