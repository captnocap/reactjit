const React: any = require('react');
const { useMemo } = React;
import { Box, Graph, Text } from '../../../../runtime/primitives';
import { PALETTE } from '../../lib/chart-utils';

export type ContourMapProps = {};

export function ContourMap(_props: ContourMapProps) {
  const width = 280;
  const height = 180;

  const contours = useMemo(() => {
    const rings: Array<{ cx: number; cy: number; rx: number; ry: number }> = [];
    const centers = [
      { cx: 100, cy: 80 },
      { cx: 180, cy: 110 },
      { cx: 140, cy: 60 },
    ];
    centers.forEach((c) => {
      for (let i = 1; i <= 4; i++) {
        rings.push({ cx: c.cx, cy: c.cy, rx: 15 * i, ry: 10 * i });
      }
    });
    return rings;
  }, []);

  function ellipsePath(cx: number, cy: number, rx: number, ry: number): string {
    return `M ${cx - rx} ${cy} A ${rx} ${ry} 0 1 1 ${cx + rx} ${cy} A ${rx} ${ry} 0 1 1 ${cx - rx} ${cy}`;
  }

  return (
    <Box style={{ width, height }}>
      <Graph originTopLeft style={{ width, height }}>
        {contours.map((c, i) => (
          <Graph.Path
            key={i}
            d={ellipsePath(c.cx, c.cy, c.rx, c.ry)}
            fill="none"
            stroke={i % 2 === 0 ? PALETTE.cyan : PALETTE.pink}
            strokeWidth={1.5}
            strokeOpacity={0.6}
          />
        ))}
      </Graph>
    </Box>
  );
}
