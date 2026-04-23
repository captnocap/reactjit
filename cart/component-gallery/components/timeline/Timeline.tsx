const React: any = require('react');
const { useMemo } = React;
import { Box, Graph, Text } from '../../../../runtime/primitives';
import { PALETTE } from '../../lib/chart-utils';

export type TimelineProps = {};

export function Timeline(_props: TimelineProps) {
  const width = 320;
  const height = 120;
  const events = useMemo(() => [
    { x: 40, label: 'Start', color: PALETTE.pink },
    { x: 110, label: 'Milestone', color: PALETTE.cyan },
    { x: 200, label: 'Review', color: PALETTE.blue },
    { x: 280, label: 'Launch', color: PALETTE.purple },
  ], []);
  const y = height / 2;

  return (
    <Box style={{ width, height }}>
      <Graph originTopLeft style={{ width, height }}>
        <Graph.Path d={`M 20 ${y} L ${width - 20} ${y}`} stroke={PALETTE.slateLight} strokeWidth={2} />
        {events.map((e, i) => (
          <React.Fragment key={i}>
            <Graph.Path
              d={`M ${e.x - 5} ${y - 5} A 5 5 0 1 1 ${e.x + 5} ${y - 5} A 5 5 0 1 1 ${e.x - 5} ${y - 5}`}
              fill={e.color}
              stroke={PALETTE.white}
              strokeWidth={1.5}
            />
            <Graph.Path d={`M ${e.x} ${y} L ${e.x} ${y - 20}`} stroke={e.color} strokeWidth={1} strokeDasharray="2,2" />
          </React.Fragment>
        ))}
      </Graph>
      {events.map((e, i) => (
        <Box key={`lbl-${i}`} style={{ position: 'absolute', left: e.x - 30, top: y - 38, width: 60, alignItems: 'center' }}>
          <Text fontSize={9} color={PALETTE.slateLight}>{e.label}</Text>
        </Box>
      ))}
    </Box>
  );
}
