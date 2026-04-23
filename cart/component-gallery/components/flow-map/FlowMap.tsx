const React: any = require('react');
const { useMemo } = React;
import { Box, Graph, Text } from '../../../../runtime/primitives';
import { PALETTE } from '../../lib/chart-utils';

export type FlowMapProps = {};

export function FlowMap(_props: FlowMapProps) {
  const width = 320;
  const height = 180;

  const nodes = useMemo(() => [
    { x: 60, y: 90, r: 5 },
    { x: 140, y: 50, r: 4 },
    { x: 160, y: 120, r: 4 },
    { x: 240, y: 70, r: 5 },
    { x: 260, y: 110, r: 4 },
  ], []);

  const flows = useMemo(() => [
    { from: 0, to: 1 },
    { from: 0, to: 2 },
    { from: 1, to: 3 },
    { from: 2, to: 4 },
    { from: 3, to: 4 },
  ], []);

  return (
    <Box style={{ width, height }}>
      <Graph originTopLeft style={{ width, height }}>
        {flows.map((f, i) => {
          const a = nodes[f.from];
          const b = nodes[f.to];
          return (
            <Graph.Path
              key={i}
              d={`M ${a.x} ${a.y} L ${b.x} ${b.y}`}
              stroke={PALETTE.cyan}
              strokeWidth={2}
              strokeOpacity={0.5}
            />
          );
        })}
        {nodes.map((n, i) => (
          <Graph.Path
            key={`n-${i}`}
            d={`M ${n.x - n.r} ${n.y} A ${n.r} ${n.r} 0 1 1 ${n.x + n.r} ${n.y} A ${n.r} ${n.r} 0 1 1 ${n.x - n.r} ${n.y}`}
            fill={PALETTE.pink}
            stroke={PALETTE.white}
            strokeWidth={1}
          />
        ))}
      </Graph>
    </Box>
  );
}
