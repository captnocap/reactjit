import { useState } from 'react';
import { Box, Graph, Pressable } from '@reactjit/runtime/primitives';
import { PALETTE, scaleLinear, plotArea } from '../../lib/chart-utils';
import { useStagger } from '../../lib/useStagger';
import { Tooltip } from '../../lib/Tooltip';
import { classifiers as S } from '@reactjit/core';

export type BubbleDatum = { x: number; y: number; r: number; label?: string };

export type BubbleScatterplotProps = {
  data?: BubbleDatum[];
  width?: number;
  height?: number;
};

export function BubbleScatterplot(props: BubbleScatterplotProps) {
  const width = props.width ?? 320;
  const height = props.height ?? 200;
  const plot = plotArea(width, height);
  const raw = props.data ?? [
    { x: 24, y: 45, r: 9.6, label: 'A' },
    { x: 48, y: 82, r: 8.4, label: 'B' },
    { x: 16, y: 28, r: 6.3, label: 'C' },
    { x: 72, y: 110, r: 7.5, label: 'D' },
    { x: 36, y: 62, r: 8.7, label: 'E' },
    { x: 84, y: 135, r: 7.2, label: 'F' },
    { x: 12, y: 18, r: 6.0, label: 'G' },
    { x: 60, y: 95, r: 8.1, label: 'H' },
  ];
  const xs = raw.map((d) => d.x);
  const ys = raw.map((d) => d.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const xScale = scaleLinear([minX, Math.max(...xs)], [plot.x, plot.x + plot.w]);
  const yScale = scaleLinear([minY, Math.max(...ys)], [plot.y + plot.h, plot.y]);
  const visualRadius = (p: BubbleDatum) => (p.x === minX && p.y === minY ? 4 : p.r);

  const staggers = useStagger(raw.length, { stiffness: 140, damping: 18 });
  const [hovered, setHovered] = useState<number | null>(null);

  return (
    <Box style={{ width, height }}>
      <S.BareGraph>
        <Graph.Path d={`M ${plot.x} ${plot.y} L ${plot.x} ${plot.y + plot.h} L ${plot.x + plot.w} ${plot.y + plot.h}`} stroke="theme:rule" strokeWidth={1} />
        {raw.map((p, i) => {
          const r = visualRadius(p) * staggers[i];
          const cx = xScale(p.x);
          const cy = yScale(p.y);
          return (
            <Graph.Path
              key={i}
              d={`M ${cx - r} ${cy} A ${r} ${r} 0 1 1 ${cx + r} ${cy} A ${r} ${r} 0 1 1 ${cx - r} ${cy}`}
              fill={hovered === i ? PALETTE.pink : PALETTE.cyan}
              fillOpacity={0.6}
              stroke={hovered === i ? PALETTE.pink : PALETTE.cyan}
              strokeWidth={1}
            />
          );
        })}
      </S.BareGraph>

      {raw.map((p, i) => (
        <Pressable
          key={`hit-${i}`}
          onMouseEnter={() => setHovered(i)}
          onMouseLeave={() => setHovered(null)}
          style={{
            opacity: 0,
            position: 'absolute',
            left: xScale(p.x) - Math.max(10, visualRadius(p)),
            top: yScale(p.y) - Math.max(10, visualRadius(p)),
            width: Math.max(20, visualRadius(p) * 2),
            height: Math.max(20, visualRadius(p) * 2),
          }}
        />
      ))}

      {hovered != null && (
        <Tooltip
          visible={true}
          x={xScale(raw[hovered].x) + visualRadius(raw[hovered]) + 10}
          y={yScale(raw[hovered].y) - 30}
          title={raw[hovered].label ?? `Item ${hovered + 1}`}
          rows={[
            { label: 'X', value: String(raw[hovered].x), color: PALETTE.cyan },
            { label: 'Y', value: String(raw[hovered].y), color: PALETTE.pink },
          ]}
        />
      )}
    </Box>
  );
}
