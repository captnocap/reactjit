import { Box, Graph, Text } from '../../../../runtime/primitives';

export type BarChartProps = {};

export function BarChart(_props: BarChartProps) {
  const width = 320;
  const height = 220;
  const margin = { top: 16, right: 16, bottom: 28, left: 36 };
  const plotX = margin.left;
  const plotY = margin.top;
  const plotW = width - margin.left - margin.right;
  const plotH = height - margin.top - margin.bottom;

  const data = [12, 19, 15, 25, 22, 30, 28, 35];
  const labels = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
  const max = Math.max(...data);

  const barW = (plotW / data.length) * 0.6;
  const gap = (plotW / data.length) * 0.4;
  const palette = ['#f06292', '#4fc3f7', '#f06292', '#4fc3f7', '#f06292', '#4fc3f7', '#f06292', '#4fc3f7'];

  return (
    <Box style={{ position: 'relative', width, height }}>
      <Graph originTopLeft style={{ width, height }}>
        {[0, 0.25, 0.5, 0.75, 1.0].map((t) => {
          const y = plotY + plotH * (1 - t);
          return (
            <Graph.Path
              key={`grid-${t}`}
              d={`M ${plotX} ${y} L ${plotX + plotW} ${y}`}
              stroke="#c7d0dd"
              strokeWidth={1}
            />
          );
        })}

        {data.map((v, i) => {
          const bh = (v / max) * plotH;
          const x = plotX + i * (plotW / data.length) + gap / 2;
          const y = plotY + plotH - bh;
          const d = `M ${x} ${plotY + plotH} L ${x} ${y} L ${x + barW} ${y} L ${x + barW} ${plotY + plotH} Z`;
          return (
            <Graph.Path
              key={i}
              d={d}
              fill={palette[i]}
              fillOpacity={0.9}
              stroke={palette[i]}
              strokeWidth={1}
            />
          );
        })}
      </Graph>

      {[0, 0.25, 0.5, 0.75, 1.0].map((t) => {
        const val = Math.round(max * t);
        const y = plotY + plotH * (1 - t) - 6;
        return (
          <Box key={`y-${t}`} style={{ position: 'absolute', left: 0, top: y, width: margin.left - 4, alignItems: 'flex-end' }}>
            <Text fontSize={9} color="#657185">{val}</Text>
          </Box>
        );
      })}

      {labels.map((l, i) => {
        const x = plotX + i * (plotW / data.length) + gap / 2 + barW / 2 - 8;
        return (
          <Box key={`x-${l}`} style={{ position: 'absolute', left: x, top: plotY + plotH + 6, width: 16, alignItems: 'center' }}>
            <Text fontSize={9} color="#657185">{l}</Text>
          </Box>
        );
      })}
    </Box>
  );
}
