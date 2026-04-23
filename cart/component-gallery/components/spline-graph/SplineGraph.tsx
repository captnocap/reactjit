const React: any = require('react');
const { useMemo } = React;
import { Box, Graph, Text } from '../../../../runtime/primitives';
import { PALETTE, scaleLinear, plotArea } from '../../lib/chart-utils';

export type SplineGraphProps = {};

export function SplineGraph(_props: SplineGraphProps) {
  const width = 320;
  const height = 200;
  const plot = plotArea(width, height);
  const data = useMemo(() => [15, 35, 25, 45, 30, 55, 40, 50], []);
  const labels = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
  const max = Math.max(...data);
  const yScale = scaleLinear([0, max], [plot.y + plot.h, plot.y]);
  const xScale = scaleLinear([0, data.length - 1], [plot.x, plot.x + plot.w]);

  const path = useMemo(() => {
    const pts = data.map((v, i) => ({ x: xScale(i), y: yScale(v) }));
    if (pts.length === 0) return '';
    let d = `M ${pts[0].x} ${pts[0].y}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i - 1] || pts[i];
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const p3 = pts[i + 2] || p2;
      const c1x = p1.x + (p2.x - p0.x) / 6;
      const c1y = p1.y + (p2.y - p0.y) / 6;
      const c2x = p2.x - (p3.x - p1.x) / 6;
      const c2y = p2.y - (p3.y - p1.y) / 6;
      d += ` C ${c1x} ${c1y} ${c2x} ${c2y} ${p2.x} ${p2.y}`;
    }
    return d;
  }, [data, xScale, yScale]);

  const areaPath = useMemo(() => {
    if (!path) return '';
    const lastX = xScale(data.length - 1);
    const baseY = plot.y + plot.h;
    return `${path} L ${lastX} ${baseY} L ${xScale(0)} ${baseY} Z`;
  }, [path, xScale, data.length, plot.y, plot.h]);

  return (
    <Box style={{ width, height }}>
      <Graph originTopLeft style={{ width, height }}>
        {[0, 0.25, 0.5, 0.75, 1.0].map((t) => {
          const y = plot.y + plot.h * (1 - t);
          return (
            <Graph.Path key={`grid-${t}`} d={`M ${plot.x} ${y} L ${plot.x + plot.w} ${y}`} stroke="#2a2a4a" strokeWidth={1} />
          );
        })}
        <Graph.Path d={areaPath} fill={PALETTE.pink} fillOpacity={0.2} stroke="none" />
        <Graph.Path d={path} stroke={PALETTE.pink} strokeWidth={2.5} fill="none" />
        {data.map((v, i) => (
          <Graph.Path
            key={`pt-${i}`}
            d={`M ${xScale(i) - 3} ${yScale(v)} A 3 3 0 1 1 ${xScale(i) + 3} ${yScale(v)} A 3 3 0 1 1 ${xScale(i) - 3} ${yScale(v)}`}
            fill={PALETTE.white}
            stroke={PALETTE.pink}
            strokeWidth={1.5}
          />
        ))}
      </Graph>
      {labels.map((l, i) => (
        <Box key={l} style={{ position: 'absolute', left: xScale(i) - 8, top: plot.y + plot.h + 4, width: 16, alignItems: 'center' }}>
          <Text fontSize={9} color="#657185">{l}</Text>
        </Box>
      ))}
    </Box>
  );
}
