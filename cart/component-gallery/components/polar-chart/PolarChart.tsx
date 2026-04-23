const React: any = require('react');
const { useMemo } = React;
import { Box, Graph, Text } from '../../../../runtime/primitives';
import { PALETTE, polar } from '../../lib/chart-utils';

export type PolarChartProps = {};

export function PolarChart(_props: PolarChartProps) {
  const width = 220;
  const height = 200;
  // <Graph> uses a center-origin world: world (0,0) maps to the element
  // center. Polar paths below use (0, 0) as the center. The absolute-positioned
  // <Box> labels use DOM coords (top-left origin), so they get width/2 + x.
  const labelCx = width / 2;
  const labelCy = height / 2;
  const radius = 70;
  const axes = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const data = [0.6, 0.4, 0.8, 0.5, 0.7, 0.3, 0.9, 0.5];
  const angleStep = 360 / axes.length;

  const dataPath = useMemo(() => {
    const pts = data.map((v, i) => polar(0, 0, radius * v, i * angleStep));
    return `M ${pts.map((p) => `${p[0]} ${p[1]}`).join(' L ')} Z`;
  }, [data, radius, angleStep]);

  return (
    <Box style={{ width, height }}>
      <Graph style={{ width, height }}>
        {[0.2, 0.4, 0.6, 0.8, 1.0].map((r) => {
          const pts = Array.from({ length: axes.length }, (_, i) => polar(0, 0, radius * r, i * angleStep));
          return <Graph.Path key={r} d={`M ${pts.map((p) => `${p[0]} ${p[1]}`).join(' L ')} Z`} fill="none" stroke="#2a2a4a" strokeWidth={1} />;
        })}
        {axes.map((_, i) => {
          const [x, y] = polar(0, 0, radius, i * angleStep);
          return <Graph.Path key={`axis-${i}`} d={`M 0 0 L ${x} ${y}`} stroke="#2a2a4a" strokeWidth={1} />;
        })}
        <Graph.Path d={dataPath} fill={PALETTE.cyan} fillOpacity={0.25} stroke={PALETTE.cyan} strokeWidth={1.5} />
        {data.map((v, i) => {
          const [x, y] = polar(0, 0, radius * v, i * angleStep);
          return (
            <Graph.Path
              key={`pt-${i}`}
              d={`M ${x - 3} ${y} A 3 3 0 1 1 ${x + 3} ${y} A 3 3 0 1 1 ${x - 3} ${y}`}
              fill={PALETTE.pink}
              stroke="none"
            />
          );
        })}
      </Graph>
      {axes.map((a, i) => {
        const [x, y] = polar(labelCx, labelCy, radius + 12, i * angleStep);
        return (
          <Box key={a} style={{ position: 'absolute', left: x - 10, top: y - 6, width: 20, alignItems: 'center' }}>
            <Text fontSize={8} color={PALETTE.slateLight}>{a}</Text>
          </Box>
        );
      })}
    </Box>
  );
}
