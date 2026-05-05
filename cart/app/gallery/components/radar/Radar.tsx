import { useState } from 'react';
import { Box, Graph, Pressable, Text } from '@reactjit/runtime/primitives';
import { PALETTE, polar } from '../../lib/chart-utils';
import { useSpring } from '../../lib/useSpring';
import { Tooltip } from '../../lib/Tooltip';

export type RadarDatum = { axis: string; a: number; b: number };

export type RadarProps = {
  data?: RadarDatum[];
  width?: number;
  height?: number;
};

export function Radar(props: RadarProps) {
  const width = props.width ?? 220;
  const height = props.height ?? 200;
  const labelCx = width / 2;
  const labelCy = height / 2;
  const radius = 70;
  const data = props.data ?? [];
  const axes = data.map((d) => d.axis);
  const data1 = data.map((d) => d.a);
  const data2 = data.map((d) => d.b);
  const angleStep = axes.length > 0 ? 360 / axes.length : 0;

  const fade = useSpring(1, { stiffness: 80, damping: 20 });
  const [hovered, setHovered] = useState<number | null>(null);

  function polyPath(values: number[]): string {
    const pts = values.map((v, i) => polar(0, 0, radius * v, i * angleStep));
    return `M ${pts.map((p) => `${p[0]} ${p[1]}`).join(' L ')} Z`;
  }

  return (
    <Box style={{ width, height }}>
      <Graph style={{ width, height }}>
        {[0.2, 0.4, 0.6, 0.8, 1.0].map((r) => {
          const pts = Array.from({ length: axes.length }, (_, i) => polar(0, 0, radius * r, i * angleStep));
          return <Graph.Path key={r} d={`M ${pts.map((p) => `${p[0]} ${p[1]}`).join(' L ')} Z`} fill="none" stroke="theme:rule" strokeWidth={1} />;
        })}
        {axes.map((_, i) => {
          const [x, y] = polar(0, 0, radius, i * angleStep);
          return <Graph.Path key={`axis-${i}`} d={`M 0 0 L ${x} ${y}`} stroke="theme:rule" strokeWidth={1} />;
        })}
        <Graph.Path d={polyPath(data1)} fill={PALETTE.pink} fillOpacity={0.25 * fade} stroke={PALETTE.pink} strokeWidth={1.5} />
        <Graph.Path d={polyPath(data2)} fill={PALETTE.cyan} fillOpacity={0.25 * fade} stroke={PALETTE.cyan} strokeWidth={1.5} />
      </Graph>

      {axes.map((_, i) => {
        const [x, y] = polar(labelCx, labelCy, radius + 14, i * angleStep);
        return (
          <Pressable
            key={`hit-${i}`}
            onMouseEnter={() => setHovered(i)}
            onMouseLeave={() => setHovered(null)}
            style={{
              opacity: 0,
              position: 'absolute',
              left: x - 20,
              top: y - 8,
              width: 40,
              height: 16,
            }}
          />
        );
      })}

      {hovered != null && data[hovered] && (
        <Tooltip
          visible={true}
          x={labelCx + 20}
          y={labelCy - 40}
          title={axes[hovered]}
          rows={[
            { label: 'Product A', value: String(data1[hovered]), color: PALETTE.pink },
            { label: 'Product B', value: String(data2[hovered]), color: PALETTE.cyan },
          ]}
        />
      )}

      {axes.map((a, i) => {
        const [x, y] = polar(labelCx, labelCy, radius + 14, i * angleStep);
        return (
          <Box key={a} style={{ position: 'absolute', left: x - 20, top: y - 6, width: 40, alignItems: 'center' }}>
            <Text fontSize={8} color={PALETTE.slateLight}>{a}</Text>
          </Box>
        );
      })}
    </Box>
  );
}
