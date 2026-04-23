const React: any = require('react');
const { useMemo } = React;
import { Box, Graph, Text } from '../../../../runtime/primitives';
import { PALETTE, polar } from '../../lib/chart-utils';

export type RadarProps = {};

export function Radar(_props: RadarProps) {
  const width = 220;
  const height = 200;
  // <Graph> world origin sits at the element center — polar paths below use
  // (0, 0) as center. Labels use the DOM top-left origin, so they need
  // width/2, height/2 as the center.
  const labelCx = width / 2;
  const labelCy = height / 2;
  const radius = 70;
  const axes = ['Speed', 'Reliability', 'Comfort', 'Safety', 'Efficiency', 'Price'];
  const data1 = [0.8, 0.6, 0.9, 0.7, 0.5, 0.4];
  const data2 = [0.5, 0.8, 0.6, 0.9, 0.7, 0.6];

  const angleStep = 360 / axes.length;

  function polyPath(values: number[]): string {
    const pts = values.map((v, i) => polar(0, 0, radius * v, i * angleStep));
    return `M ${pts.map((p) => `${p[0]} ${p[1]}`).join(' L ')} Z`;
  }

  return (
    <Box style={{ width, height }}>
      <Graph style={{ width, height }}>
        {/* grid rings */}
        {[0.2, 0.4, 0.6, 0.8, 1.0].map((r) => {
          const pts = Array.from({ length: axes.length }, (_, i) => polar(0, 0, radius * r, i * angleStep));
          const d = `M ${pts.map((p) => `${p[0]} ${p[1]}`).join(' L ')} Z`;
          return <Graph.Path key={r} d={d} fill="none" stroke="#2a2a4a" strokeWidth={1} />;
        })}
        {/* axis lines */}
        {axes.map((_, i) => {
          const [x, y] = polar(0, 0, radius, i * angleStep);
          return <Graph.Path key={`axis-${i}`} d={`M 0 0 L ${x} ${y}`} stroke="#2a2a4a" strokeWidth={1} />;
        })}
        {/* data polygons */}
        <Graph.Path d={polyPath(data1)} fill={PALETTE.pink} fillOpacity={0.25} stroke={PALETTE.pink} strokeWidth={1.5} />
        <Graph.Path d={polyPath(data2)} fill={PALETTE.cyan} fillOpacity={0.25} stroke={PALETTE.cyan} strokeWidth={1.5} />
      </Graph>
      {axes.map((a, i) => {
        const [x, y] = polar(labelCx, labelCy, radius + 14, i * angleStep);
        return (
          <Box key={a} style={{ position: 'absolute', left: x - 20, top: y - 6, width: 40, alignItems: 'center' }}>
            <Text fontSize={8} color={PALETTE.slateLight}>{a}</Text>
          </Box>
        );
      })}
    </Box>
  );
}
