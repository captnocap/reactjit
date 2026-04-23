const React: any = require('react');
const { useMemo } = React;
import { Box, Graph, Text } from '../../../../runtime/primitives';
import { PALETTE, scaleLinear, plotArea } from '../../lib/chart-utils';

export type HeatmapProps = {};

export function Heatmap(_props: HeatmapProps) {
  const width = 240;
  const height = 200;
  const plot = plotArea(width, height, { top: 10, right: 10, bottom: 10, left: 10 });
  const cols = 8;
  const rows = 7;
  const cellW = plot.w / cols;
  const cellH = plot.h / rows;

  const data = useMemo(() => {
    const d: number[][] = [];
    for (let r = 0; r < rows; r++) {
      d.push([]);
      for (let c = 0; c < cols; c++) {
        d[r].push(Math.random());
      }
    }
    return d;
  }, []);

  const colorScale = scaleLinear([0, 1], [0, 1]);

  function heatColor(t: number): string {
    const r = Math.round(26 + t * (240 - 26));
    const g = Math.round(26 + t * (98 - 26));
    const b = Math.round(46 + t * (146 - 46));
    return `rgb(${r},${g},${b})`;
  }

  return (
    <Box style={{ width, height }}>
      <Graph originTopLeft style={{ width, height }}>
        {data.map((row, ri) =>
          row.map((val, ci) => {
            const x = plot.x + ci * cellW + 1;
            const y = plot.y + ri * cellH + 1;
            const w = cellW - 2;
            // NB: do NOT name this `h` — esbuild lowers JSX to `h(...)` calls
            // and a local `h` shadows the factory (see WorkerCharts.tsx).
            const cellHeight = cellH - 2;
            return (
              <Graph.Path
                key={`${ri}-${ci}`}
                d={`M ${x} ${y} L ${x + w} ${y} L ${x + w} ${y + cellHeight} L ${x} ${y + cellHeight} Z`}
                fill={heatColor(colorScale(val))}
                stroke="none"
              />
            );
          })
        )}
      </Graph>
    </Box>
  );
}
