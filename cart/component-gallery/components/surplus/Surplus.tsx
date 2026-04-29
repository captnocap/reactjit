import { useState } from 'react';
import { Box, Graph, Pressable } from '@reactjit/runtime/primitives';
import { PALETTE, scaleLinear, plotArea } from '../../lib/chart-utils';
import { useSpring } from '../../lib/useSpring';
import { Tooltip } from '../../lib/Tooltip';
import { classifiers as S } from '@reactjit/core';

export type SurplusProps = {
  data?: number[];
  labels?: string[];
  width?: number;
  height?: number;
};

export function Surplus(props: SurplusProps) {
  const width = props.width ?? 320;
  const height = props.height ?? 220;
  const plot = plotArea(width, height);
  const data = props.data ?? [12, 19, 15, 25, 22, 30, 28, 35, 32, 40, 38, 45];
  const labels = props.labels ?? ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const max = Math.max(...data);
  const min = Math.min(...data);
  const yScale = scaleLinear([min, max], [plot.y + plot.h, plot.y]);
  const xScale = scaleLinear([0, data.length - 1], [plot.x, plot.x + plot.w]);
  const baseline = yScale(0);

  const grow = useSpring(1, { stiffness: 100, damping: 16 });
  const [hovered, setHovered] = useState<number | null>(null);

  const pts = data.map((v, i) => ({ x: xScale(i), y: yScale(v) + (baseline - yScale(v)) * (1 - grow) }));
  const areaD = pts.length > 0 ? `M ${pts[0].x} ${baseline} ` + pts.map((p) => `L ${p.x} ${p.y}`).join(' ') + ` L ${pts[pts.length - 1].x} ${baseline} Z` : '';
  const lineD = pts.length > 0 ? `M ${pts[0].x} ${pts[0].y} ` + pts.slice(1).map((p) => `L ${p.x} ${p.y}`).join(' ') : '';

  return (
    <Box style={{ width, height }}>
      <S.BareGraph>
        <Graph.Path d={areaD} fill={PALETTE.pink} fillOpacity={0.25} stroke="none" />
        <Graph.Path d={lineD} stroke={PALETTE.pink} strokeWidth={2} fill="none" />
        {pts.map((p, i) => (
          <Graph.Path
            key={i}
            d={`M ${p.x - 2} ${p.y} A 2 2 0 1 1 ${p.x + 2} ${p.y} A 2 2 0 1 1 ${p.x - 2} ${p.y}`}
            fill={hovered === i ? PALETTE.pink : 'none'}
            stroke={PALETTE.pink}
            strokeWidth={1}
          />
        ))}
      </S.BareGraph>

      {pts.map((_, i) => (
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

      {hovered != null && (
        <Tooltip
          visible={true}
          x={xScale(hovered) + 10}
          y={yScale(data[hovered]) - 20}
          title={labels[hovered]}
          rows={[{ label: 'Revenue', value: '$' + data[hovered] + 'k', color: PALETTE.pink }]}
        />
      )}
    </Box>
  );
}
