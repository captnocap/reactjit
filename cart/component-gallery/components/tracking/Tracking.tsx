import { useState } from 'react';
import { Box, Graph, Pressable } from '@reactjit/runtime/primitives';
import { PALETTE, scaleLinear, plotArea } from '../../lib/chart-utils';
import { useSpring } from '../../lib/useSpring';
import { Tooltip } from '../../lib/Tooltip';
import { classifiers as S } from '@reactjit/core';

export type TrackingDatum = { label: string; value: number };

export type TrackingProps = {
  data?: TrackingDatum[];
  width?: number;
  height?: number;
};

export function Tracking(props: TrackingProps) {
  const width = props.width ?? 320;
  const height = props.height ?? 140;
  const plot = plotArea(width, height, { top: 20, right: 20, bottom: 20, left: 20 });
  const data = props.data ?? [
    { label: 'Ordered', value: 45 },
    { label: 'Packed', value: 52 },
    { label: 'Shipped', value: 38 },
    { label: 'In Transit', value: 61 },
    { label: 'Delivered', value: 55 },
  ];
  const labels = data.map((d) => d.label);
  const values = data.map((d) => d.value);
  const max = Math.max(...values);
  const min = Math.min(...values);
  const yScale = scaleLinear([min, max], [plot.y + plot.h, plot.y]);
  const xScale = scaleLinear([0, values.length - 1], [plot.x, plot.x + plot.w]);

  const fade = useSpring(1, { stiffness: 80, damping: 20 });
  const [hovered, setHovered] = useState<number | null>(null);

  const path = `M ${xScale(0)} ${yScale(values[0])}` + values.slice(1).map((v, i) => ` L ${xScale(i + 1)} ${yScale(v)}`).join('');

  return (
    <Box style={{ width, height }}>
      <S.BareGraph>
        <Graph.Path d={path} stroke={PALETTE.cyan} strokeWidth={2} fill="none" />
        {values.map((v, i) => (
          <Graph.Path
            key={i}
            d={`M ${xScale(i) - 3} ${yScale(v)} A 3 3 0 1 1 ${xScale(i) + 3} ${yScale(v)} A 3 3 0 1 1 ${xScale(i) - 3} ${yScale(v)}`}
            fill={hovered === i ? PALETTE.pink : PALETTE.white}
            stroke={PALETTE.cyan}
            strokeWidth={1.5}
          />
        ))}
      </S.BareGraph>

      {values.map((v, i) => (
        <Pressable
          key={`hit-${i}`}
          onMouseEnter={() => setHovered(i)}
          onMouseLeave={() => setHovered(null)}
          style={{
            opacity: 0,
            position: 'absolute',
            left: xScale(i) - 8,
            top: yScale(v) - 8,
            width: 16,
            height: 16,
          }}
        />
      ))}

      {hovered != null && (
        <Tooltip
          visible={true}
          x={xScale(hovered) + 12}
          y={yScale(values[hovered]) - 30}
          title={labels[hovered]}
          rows={[{ label: 'Latency', value: values[hovered] + 'ms', color: PALETTE.cyan }]}
        />
      )}
    </Box>
  );
}
