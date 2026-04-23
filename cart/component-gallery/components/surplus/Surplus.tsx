const React: any = require('react');
const { useMemo } = React;
import { Box, Graph, Text } from '../../../../runtime/primitives';
import { PALETTE, scaleLinear, niceTicks, plotArea } from '../../lib/chart-utils';

export type SurplusProps = {};

export function Surplus(_props: SurplusProps) {
  const width = 320;
  const height = 200;
  const plot = plotArea(width, height);
  const data = useMemo(() => [12, 19, 15, 25, 22, 30, 28, 35, 32, 40, 38, 45], []);
  const max = Math.max(...data);
  const min = Math.min(...data);
  const yScale = scaleLinear([min, max], [plot.y + plot.h, plot.y]);
  const xScale = scaleLinear([0, data.length - 1], [plot.x, plot.x + plot.w]);
  const baseline = yScale(0);
  const ticks = niceTicks(min, max, 5);

  const areaD = useMemo(() => {
    let d = `M ${xScale(0)} ${baseline}`;
    data.forEach((v, i) => {
      d += ` L ${xScale(i)} ${yScale(v)}`;
    });
    d += ` L ${xScale(data.length - 1)} ${baseline} Z`;
    return d;
  }, [data, xScale, yScale, baseline]);

  const lineD = useMemo(() => {
    let d = `M ${xScale(0)} ${yScale(data[0])}`;
    data.forEach((v, i) => {
      if (i === 0) return;
      d += ` L ${xScale(i)} ${yScale(v)}`;
    });
    return d;
  }, [data, xScale, yScale]);

  return (
    <Box style={{ width, height }}>
      <Graph originTopLeft style={{ width, height }}>
        {ticks.map((t) => (
          <Graph.Path key={t} d={`M ${plot.x} ${yScale(t)} L ${plot.x + plot.w} ${yScale(t)}`} stroke="#2a2a4a" strokeWidth={1} />
        ))}
        <Graph.Path d={areaD} fill={PALETTE.pink} fillOpacity={0.25} stroke="none" />
        <Graph.Path d={lineD} stroke={PALETTE.pink} strokeWidth={2} fill="none" />
      </Graph>
    </Box>
  );
}
