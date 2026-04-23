const React: any = require('react');
const { useMemo } = React;
import { Box, Graph, Text } from '../../../../runtime/primitives';
import { PALETTE, scaleLinear, plotArea, niceTicks } from '../../lib/chart-utils';

export type CandlestickProps = {};

export function Candlestick(_props: CandlestickProps) {
  const width = 320;
  const height = 200;
  const plot = plotArea(width, height);
  const data = useMemo(() => [
    { o: 20, h: 28, l: 18, c: 25 },
    { o: 25, h: 30, l: 22, c: 28 },
    { o: 28, h: 32, l: 24, c: 26 },
    { o: 26, h: 29, l: 21, c: 22 },
    { o: 22, h: 27, l: 20, c: 24 },
    { o: 24, h: 31, l: 23, c: 30 },
    { o: 30, h: 35, l: 28, c: 33 },
    { o: 33, h: 36, l: 30, c: 32 },
  ], []);
  const all = data.flatMap((d) => [d.h, d.l]);
  const max = Math.max(...all);
  const min = Math.min(...all);
  const yScale = scaleLinear([min, max], [plot.y + plot.h, plot.y]);
  const xScale = scaleLinear([0, data.length], [plot.x, plot.x + plot.w]);
  const candleW = (plot.w / data.length) * 0.5;
  const ticks = niceTicks(min, max, 5);

  return (
    <Box style={{ width, height }}>
      <Graph originTopLeft style={{ width, height }}>
        {ticks.map((t) => (
          <Graph.Path key={t} d={`M ${plot.x} ${yScale(t)} L ${plot.x + plot.w} ${yScale(t)}`} stroke="#2a2a4a" strokeWidth={1} />
        ))}
        {data.map((d, i) => {
          const cx = xScale(i + 0.5);
          const x1 = cx - candleW / 2;
          const x2 = cx + candleW / 2;
          const yO = yScale(d.o);
          const yH = yScale(d.h);
          const yL = yScale(d.l);
          const yC = yScale(d.c);
          const isUp = d.c >= d.o;
          const color = isUp ? PALETTE.pink : PALETTE.cyan;
          const top = Math.min(yO, yC);
          const bottom = Math.max(yO, yC);
          const bodyH = Math.max(1, bottom - top);
          return (
            <React.Fragment key={i}>
              {/* wick */}
              <Graph.Path d={`M ${cx} ${yH} L ${cx} ${yL}`} stroke={color} strokeWidth={1} />
              {/* body */}
              <Graph.Path d={`M ${x1} ${top} L ${x2} ${top} L ${x2} ${top + bodyH} L ${x1} ${top + bodyH} Z`} fill={color} stroke={color} strokeWidth={1} />
            </React.Fragment>
          );
        })}
      </Graph>
    </Box>
  );
}
