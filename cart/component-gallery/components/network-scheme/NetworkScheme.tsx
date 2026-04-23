const React: any = require('react');
const { useMemo } = React;
import { Box, Graph, Text } from '../../../../runtime/primitives';
import { PALETTE } from '../../lib/chart-utils';

export type NetworkSchemeProps = {};

export function NetworkScheme(_props: NetworkSchemeProps) {
  const width = 280;
  const height = 180;

  const nodes = useMemo(() => [
    { x: 140, y: 30, r: 8, color: PALETTE.pink, label: 'A' },
    { x: 80, y: 80, r: 6, color: PALETTE.cyan, label: 'B' },
    { x: 200, y: 80, r: 6, color: PALETTE.cyan, label: 'C' },
    { x: 50, y: 140, r: 5, color: PALETTE.blue, label: 'D' },
    { x: 120, y: 150, r: 5, color: PALETTE.blue, label: 'E' },
    { x: 190, y: 140, r: 5, color: PALETTE.blue, label: 'F' },
    { x: 230, y: 130, r: 5, color: PALETTE.blue, label: 'G' },
  ], []);

  const edges = useMemo(() => [
    [0, 1], [0, 2], [1, 3], [1, 4], [2, 4], [2, 5], [2, 6], [4, 5],
  ], []);

  return (
    <Box style={{ width, height }}>
      <Graph originTopLeft style={{ width, height }}>
        {edges.map(([a, b], i) => (
          <Graph.Path
            key={i}
            d={`M ${nodes[a].x} ${nodes[a].y} L ${nodes[b].x} ${nodes[b].y}`}
            stroke={PALETTE.slateLight}
            strokeWidth={1}
          />
        ))}
        {nodes.map((n, i) => (
          <React.Fragment key={i}>
            <Graph.Path
              d={`M ${n.x - n.r} ${n.y} A ${n.r} ${n.r} 0 1 1 ${n.x + n.r} ${n.y} A ${n.r} ${n.r} 0 1 1 ${n.x - n.r} ${n.y}`}
              fill={n.color}
              stroke={PALETTE.white}
              strokeWidth={1}
            />
          </React.Fragment>
        ))}
      </Graph>
      {nodes.map((n, i) => (
        <Box key={`lbl-${i}`} style={{ position: 'absolute', left: n.x - 8, top: n.y + n.r + 2, width: 16, alignItems: 'center' }}>
          <Text fontSize={8} color={PALETTE.slateLight}>{n.label}</Text>
        </Box>
      ))}
    </Box>
  );
}
