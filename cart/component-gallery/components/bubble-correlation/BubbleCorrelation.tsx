import { useState } from 'react';
import { Box, Graph, Pressable } from '@reactjit/runtime/primitives';
import { PALETTE, scaleLinear, plotArea } from '../../lib/chart-utils';
import { useStagger } from '../../lib/useStagger';
import { Tooltip } from '../../lib/Tooltip';
import { classifiers as S } from '@reactjit/core';

export type CorrelationDatum = { x: number; y: number; r: number; label?: string };

export type BubbleCorrelationProps = {
  data?: CorrelationDatum[];
  width?: number;
  height?: number;
};

export function BubbleCorrelation(props: BubbleCorrelationProps) {
  const width = props.width ?? 320;
  const height = props.height ?? 220;
  const plot = plotArea(width, height);
  const raw = props.data ?? [
    { x: 24, y: 15, r: 8, label: 'A' },
    { x: 36, y: 22, r: 10, label: 'B' },
    { x: 50, y: 35, r: 12, label: 'C' },
    { x: 62, y: 48, r: 14, label: 'D' },
    { x: 30, y: 18, r: 9, label: 'E' },
    { x: 56, y: 42, r: 13, label: 'F' },
    { x: 70, y: 58, r: 16, label: 'G' },
    { x: 44, y: 30, r: 11, label: 'H' },
  ];
  const xs = raw.map((d) => d.x);
  const ys = raw.map((d) => d.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const xScale = scaleLinear([minX, Math.max(...xs)], [plot.x, plot.x + plot.w]);
  const yScale = scaleLinear([minY, Math.max(...ys)], [plot.y + plot.h, plot.y]);
  const visualRadius = (p: CorrelationDatum) => (p.x === minX && p.y === minY ? 4 : p.r);

  const staggers = useStagger(raw.length, { stiffness: 140, damping: 18 });
  const [hovered, setHovered] = useState<number | null>(null);

  return (
    <Box style={{ width, height }}>
      <S.BareGraph>
        <Graph.Path d={`M ${plot.x} ${plot.y} L ${plot.x} ${plot.y + plot.h} L ${plot.x + plot.w} ${plot.y + plot.h}`} stroke="#3a2a1e" strokeWidth={1} />
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
