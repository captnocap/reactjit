import { useState } from 'react';
import { Box, Graph, Pressable, Text } from '@reactjit/runtime/primitives';
import { PALETTE, scaleLinear, plotArea } from '../../lib/chart-utils';
import { useSpring } from '../../lib/useSpring';
import { Tooltip } from '../../lib/Tooltip';
import { classifiers as S } from '@reactjit/core';

export type ScatterplotDatum = { label?: string; x: number; y: number };

export type ScatterplotProps = {
  data?: ScatterplotDatum[];
  width?: number;
  height?: number;
};

export function Scatterplot(props: ScatterplotProps) {
  const width = props.width ?? 280;
  const height = props.height ?? 200;
  const plot = plotArea(width, height);
  const data = props.data ?? [];
  const xs = data.map((d) => d.x);
  const ys = data.map((d) => d.y);
  const xScale = scaleLinear([xs.length ? Math.min(...xs) : 0, xs.length ? Math.max(...xs) : 1], [plot.x, plot.x + plot.w]);
  const yScale = scaleLinear([ys.length ? Math.min(...ys) : 0, ys.length ? Math.max(...ys) : 1], [plot.y + plot.h, plot.y]);

  const fade = useSpring(1, { stiffness: 80, damping: 20 });
  const [hovered, setHovered] = useState<number | null>(null);

  return (
    <Box style={{ width, height }}>
      <S.BareGraph>
        <Graph.Path d={`M ${plot.x} ${plot.y} L ${plot.x} ${plot.y + plot.h} L ${plot.x + plot.w} ${plot.y + plot.h}`} stroke="#3a2a1e" strokeWidth={1} />
        {data.map((d, i) => (
          <Graph.Path
            key={i}
            d={`M ${xScale(d.x) - 4} ${yScale(d.y)} A 4 4 0 1 1 ${xScale(d.x) + 4} ${yScale(d.y)} A 4 4 0 1 1 ${xScale(d.x) - 4} ${yScale(d.y)}`}
            fill={hovered === i ? PALETTE.pink : PALETTE.cyan}
            stroke={PALETTE.white}
            strokeWidth={1}
          />
        ))}
      </S.BareGraph>

      {data.map((d, i) => (
        <Pressable
          key={`hit-${i}`}
          onMouseEnter={() => setHovered(i)}
          onMouseLeave={() => setHovered(null)}
          style={{
            opacity: 0,
            position: 'absolute',
            left: xScale(d.x) - 10,
            top: yScale(d.y) - 10,
            width: 20,
            height: 20,
          }}
        />
      ))}

      {hovered != null && data[hovered] && (
        <Tooltip
          visible={true}
          x={xScale(data[hovered].x) + 10}
          y={yScale(data[hovered].y) - 30}
          title={data[hovered].label ?? `Point ${hovered + 1}`}
          rows={[
            { label: 'X', value: String(data[hovered].x) },
            { label: 'Y', value: String(data[hovered].y), color: PALETTE.cyan },
          ]}
        />
      )}
    </Box>
  );
}
