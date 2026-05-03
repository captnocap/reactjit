import { useState } from 'react';
import { Box, Graph, Pressable, Text } from '@reactjit/runtime/primitives';
import { PALETTE, scaleLinear, plotArea } from '../../lib/chart-utils';
import { useSpring } from '../../lib/useSpring';
import { Tooltip } from '../../lib/Tooltip';
import { classifiers as S } from '@reactjit/core';

export type BoxplotDatum = { label: string; min: number; q1: number; median: number; q3: number; max: number };

export type BoxplotProps = {
  data?: BoxplotDatum[];
  width?: number;
  height?: number;
};

export function Boxplot(props: BoxplotProps) {
  const width = props.width ?? 320;
  const height = props.height ?? 220;
  const plot = plotArea(width, height);
  const data = props.data ?? [];
  const allVals = data.flatMap((d) => [d.min, d.max]);
  const maxV = allVals.length ? Math.max(...allVals) : 1;
  const minV = allVals.length ? Math.min(...allVals) : 0;
  const yScale = scaleLinear([minV, maxV], [plot.y + plot.h, plot.y]);
  const xScale = scaleLinear([0, Math.max(1, data.length)], [plot.x, plot.x + plot.w]);
  const boxW = (plot.w / Math.max(1, data.length)) * 0.5;

  const grow = useSpring(1, { stiffness: 100, damping: 16 });
  const [hovered, setHovered] = useState<number | null>(null);

  return (
    <Box style={{ width, height }}>
      <S.BareGraph>
        {data.map((d, i) => {
          const cx = xScale(i + 0.5);
          const x1 = cx - boxW / 2;
          const x2 = cx + boxW / 2;
          const yMin = yScale(d.min) + (plot.y + plot.h - yScale(d.min)) * (1 - grow);
          const yQ1 = yScale(d.q1) + (plot.y + plot.h - yScale(d.q1)) * (1 - grow);
          const yMed = yScale(d.median) + (plot.y + plot.h - yScale(d.median)) * (1 - grow);
          const yQ3 = yScale(d.q3) + (plot.y + plot.h - yScale(d.q3)) * (1 - grow);
          const yMax = yScale(d.max) + (plot.y + plot.h - yScale(d.max)) * (1 - grow);
          const color = i % 2 === 0 ? PALETTE.pink : PALETTE.cyan;
          return [
            <Graph.Path key={`lo-whisker-${i}`} d={`M ${cx} ${yMin} L ${cx} ${yQ3}`} stroke={color} strokeWidth={1} />,
            <Graph.Path key={`hi-whisker-${i}`} d={`M ${cx} ${yQ1} L ${cx} ${yMax}`} stroke={color} strokeWidth={1} />,
            <Graph.Path key={`lo-cap-${i}`} d={`M ${x1} ${yMin} L ${x2} ${yMin}`} stroke={color} strokeWidth={1} />,
            <Graph.Path key={`hi-cap-${i}`} d={`M ${x1} ${yMax} L ${x2} ${yMax}`} stroke={color} strokeWidth={1} />,
            <Graph.Path key={`box-${i}`} d={`M ${x1} ${yQ1} L ${x2} ${yQ1} L ${x2} ${yQ3} L ${x1} ${yQ3} Z`} fill={color} fillOpacity={hovered === i ? 0.5 : 0.3} stroke={color} strokeWidth={1.5} />,
            <Graph.Path key={`median-${i}`} d={`M ${x1} ${yMed} L ${x2} ${yMed}`} stroke={PALETTE.white} strokeWidth={1.5} />,
          ];
        })}
      </S.BareGraph>

      {data.map((_, i) => (
        <Pressable
          key={`hit-${i}`}
          onMouseEnter={() => setHovered(i)}
          onMouseLeave={() => setHovered(null)}
          style={{
            opacity: 0,
            position: 'absolute',
            left: xScale(i + 0.5) - boxW / 2 - 6,
            top: plot.y,
            width: boxW + 12,
            height: plot.h,
          }}
        />
      ))}

      {hovered != null && data[hovered] && (
        <Tooltip
          visible={true}
          x={xScale(hovered + 0.5) + boxW / 2 + 4}
          y={yScale(data[hovered].median) - 20}
          title={data[hovered].label}
          rows={[
            { label: 'Min', value: String(data[hovered].min) },
            { label: 'Q1', value: String(data[hovered].q1) },
            { label: 'Med', value: String(data[hovered].median), color: PALETTE.white },
            { label: 'Q3', value: String(data[hovered].q3) },
            { label: 'Max', value: String(data[hovered].max) },
          ]}
        />
      )}

      {data.map((d, i) => (
        <Box key={d.label} style={{ position: 'absolute', left: xScale(i + 0.5) - 8, top: plot.y + plot.h + 4, width: 16, alignItems: 'center' }}>
          <Text fontSize={9} color="#7a6e5d">{d.label}</Text>
        </Box>
      ))}
    </Box>
  );
}
