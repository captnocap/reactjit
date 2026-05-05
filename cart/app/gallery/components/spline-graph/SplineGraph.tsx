import { useState } from 'react';
import { Box, Graph, Pressable, Text } from '@reactjit/runtime/primitives';
import { PALETTE, scaleLinear, plotArea } from '../../lib/chart-utils';
import { useSpring } from '../../lib/useSpring';
import { Tooltip } from '../../lib/Tooltip';
import { classifiers as S } from '@reactjit/core';

export type SplineGraphDatum = { label: string; value: number };

export type SplineGraphProps = {
  data?: SplineGraphDatum[];
  width?: number;
  height?: number;
};

export function SplineGraph(props: SplineGraphProps) {
  const width = props.width ?? 320;
  const height = props.height ?? 220;
  const plot = plotArea(width, height);
  const data = props.data ?? [];
  const values = data.map((d) => d.value);
  const labels = data.map((d) => d.label);
  const max = values.length ? Math.max(...values) : 1;
  const yScale = scaleLinear([0, max], [plot.y + plot.h, plot.y]);
  const xScale = scaleLinear([0, Math.max(1, data.length - 1)], [plot.x, plot.x + plot.w]);

  const grow = useSpring(1, { stiffness: 100, damping: 16 });
  const [hovered, setHovered] = useState<number | null>(null);

  const pts = data.map((d, i) => ({ x: xScale(i), y: yScale(d.value) + (plot.y + plot.h - yScale(d.value)) * (1 - grow) }));

  let path = '';
  if (pts.length > 0) {
    path = `M ${pts[0].x} ${pts[0].y}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i - 1] || pts[i];
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const p3 = pts[i + 2] || p2;
      const c1x = p1.x + (p2.x - p0.x) / 6;
      const c1y = p1.y + (p2.y - p0.y) / 6;
      const c2x = p2.x - (p3.x - p1.x) / 6;
      const c2y = p2.y - (p3.y - p1.y) / 6;
      path += ` C ${c1x} ${c1y} ${c2x} ${c2y} ${p2.x} ${p2.y}`;
    }
  }

  const areaPath = path ? `${path} L ${pts[pts.length - 1].x} ${plot.y + plot.h} L ${pts[0].x} ${plot.y + plot.h} Z` : '';

  return (
    <Box style={{ width, height }}>
      <S.BareGraph>
        {[0, 0.25, 0.5, 0.75, 1.0].map((t) => {
          const y = plot.y + plot.h * (1 - t);
          return (
            <Graph.Path key={`grid-${t}`} d={`M ${plot.x} ${y} L ${plot.x + plot.w} ${y}`} stroke="theme:rule" strokeWidth={1} />
          );
        })}
        <Graph.Path d={areaPath} fill={PALETTE.pink} fillOpacity={0.2} stroke="none" />
        <Graph.Path d={path} stroke={PALETTE.pink} strokeWidth={2.5} fill="none" />
        {pts.map((p, i) => (
          <Graph.Path
            key={`pt-${i}`}
            d={`M ${p.x - 3} ${p.y} A 3 3 0 1 1 ${p.x + 3} ${p.y} A 3 3 0 1 1 ${p.x - 3} ${p.y}`}
            fill={hovered === i ? PALETTE.pink : PALETTE.white}
            stroke={PALETTE.pink}
            strokeWidth={1.5}
          />
        ))}
      </S.BareGraph>

      {data.map((_, i) => (
        <Pressable
          key={`hit-${i}`}
          onMouseEnter={() => setHovered(i)}
          onMouseLeave={() => setHovered(null)}
          style={{
            opacity: 0,
            position: 'absolute',
            left: xScale(i) - 10,
            top: plot.y,
            width: 20,
            height: plot.h,
          }}
        />
      ))}

      {hovered != null && data[hovered] && (
        <Tooltip
          visible={true}
          x={xScale(hovered) + 12}
          y={yScale(data[hovered].value) - 30}
          title={labels[hovered]}
          rows={[{ label: 'Temp', value: data[hovered].value + '°C', color: PALETTE.pink }]}
        />
      )}

      {labels.map((l, i) => (
        <Box key={l} style={{ position: 'absolute', left: xScale(i) - 8, top: plot.y + plot.h + 4, width: 16, alignItems: 'center' }}>
          <Text fontSize={9} color="theme:inkDimmer">{l}</Text>
        </Box>
      ))}
    </Box>
  );
}
