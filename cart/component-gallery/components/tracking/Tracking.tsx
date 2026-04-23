const React: any = require('react');
const { useMemo } = React;
import { Box, Graph, Text } from '../../../../runtime/primitives';
import { PALETTE, scaleLinear, plotArea } from '../../lib/chart-utils';

export type TrackingProps = {};

export function Tracking(_props: TrackingProps) {
  const width = 320;
  const height = 140;
  const plot = plotArea(width, height, { top: 20, right: 20, bottom: 20, left: 20 });
  const data = useMemo(() => [30, 45, 35, 50, 40, 55, 48, 60, 52, 65], []);
  const max = Math.max(...data);
  const min = Math.min(...data);
  const yScale = scaleLinear([min, max], [plot.y + plot.h, plot.y]);
  const xScale = scaleLinear([0, data.length - 1], [plot.x, plot.x + plot.w]);

  const path = useMemo(() => {
    let d = `M ${xScale(0)} ${yScale(data[0])}`;
    for (let i = 1; i < data.length; i++) {
      const x = xScale(i);
      const y = yScale(data[i]);
      d += ` L ${x} ${y}`;
    }
    return d;
  }, [data, xScale, yScale]);

  return (
    <Box style={{ width, height }}>
      <Graph originTopLeft style={{ width, height }}>
        <Graph.Path d={path} stroke={PALETTE.cyan} strokeWidth={2} fill="none" />
        {data.map((v, i) => (
          <Graph.Path
            key={i}
            d={`M ${xScale(i) - 3} ${yScale(v)} A 3 3 0 1 1 ${xScale(i) + 3} ${yScale(v)} A 3 3 0 1 1 ${xScale(i) - 3} ${yScale(v)}`}
            fill={PALETTE.pink}
            stroke={PALETTE.white}
            strokeWidth={1}
          />
        ))}
      </Graph>
    </Box>
  );
}
