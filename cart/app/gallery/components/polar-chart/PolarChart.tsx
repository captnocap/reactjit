import { useState } from 'react';
import { Box, Graph, Pressable, Text } from '@reactjit/runtime/primitives';
import { PALETTE, polar } from '../../lib/chart-utils';
import { useSpring } from '../../lib/useSpring';
import { Tooltip } from '../../lib/Tooltip';

export type PolarDatum = { label: string; value: number };

export type PolarChartProps = {
  data?: PolarDatum[];
  width?: number;
  height?: number;
};

export function PolarChart(props: PolarChartProps) {
  const width = props.width ?? 220;
  const height = props.height ?? 200;
  const labelCx = width / 2;
  const labelCy = height / 2;
  const radius = 70;
  const source = props.data ?? [
    { label: 'N', value: 0.6 },
    { label: 'NE', value: 0.4 },
    { label: 'E', value: 0.8 },
    { label: 'SE', value: 0.5 },
    { label: 'S', value: 0.7 },
    { label: 'SW', value: 0.3 },
    { label: 'W', value: 0.9 },
    { label: 'NW', value: 0.5 },
  ];
  const axes = source.map((item) => item.label);
  const data = source.map((item) => item.value);
  const angleStep = 360 / axes.length;

  const grow = useSpring(1, { stiffness: 100, damping: 18 });
  const [hovered, setHovered] = useState<number | null>(null);

  function dataPath(progress: number): string {
    const pts = data.map((v, i) => polar(0, 0, radius * v * progress, i * angleStep));
    return `M ${pts.map((p) => `${p[0]} ${p[1]}`).join(' L ')} Z`;
  }

  return (
    <Box style={{ width, height }}>
      <Graph style={{ width, height }}>
        {[0.2, 0.4, 0.6, 0.8, 1.0].map((r) => {
          const pts = Array.from({ length: axes.length }, (_, i) => polar(0, 0, radius * r, i * angleStep));
          return <Graph.Path key={r} d={`M ${pts.map((p) => `${p[0]} ${p[1]}`).join(' L ')} Z`} fill="none" stroke="#3a2a1e" strokeWidth={1} />;
        })}
        {axes.map((_, i) => {
          const [x, y] = polar(0, 0, radius, i * angleStep);
          return <Graph.Path key={`axis-${i}`} d={`M 0 0 L ${x} ${y}`} stroke="#3a2a1e" strokeWidth={1} />;
        })}
        <Graph.Path d={dataPath(grow)} fill={PALETTE.cyan} fillOpacity={0.25} stroke={PALETTE.cyan} strokeWidth={1.5} />
        {data.map((v, i) => {
          const [x, y] = polar(0, 0, radius * v * grow, i * angleStep);
          return (
            <Graph.Path
              key={`pt-${i}`}
              d={`M ${x - 3} ${y} A 3 3 0 1 1 ${x + 3} ${y} A 3 3 0 1 1 ${x - 3} ${y}`}
              fill={hovered === i ? PALETTE.pink : PALETTE.cyan}
              stroke="none"
            />
          );
        })}
      </Graph>

      {axes.map((_, i) => {
        const [x, y] = polar(labelCx, labelCy, radius + 12, i * angleStep);
        return (
          <Pressable
            key={`hit-${i}`}
            onMouseEnter={() => setHovered(i)}
            onMouseLeave={() => setHovered(null)}
            style={{
              opacity: 0,
              position: 'absolute',
              left: x - 16,
              top: y - 16,
              width: 32,
              height: 32,
            }}
          />
        );
      })}

      {hovered != null && (
        <Tooltip
          visible={true}
          x={polar(labelCx, labelCy, radius + 12, hovered * angleStep)[0] + 8}
          y={polar(labelCx, labelCy, radius + 12, hovered * angleStep)[1] - 20}
          title={axes[hovered]}
          rows={[{ label: 'Value', value: String(data[hovered]), color: PALETTE.cyan }]}
        />
      )}

      {axes.map((a, i) => {
        const [x, y] = polar(labelCx, labelCy, radius + 12, i * angleStep);
        return (
          <Box key={a} style={{ position: 'absolute', left: x - 10, top: y - 6, width: 20, alignItems: 'center' }}>
            <Text fontSize={8} color={PALETTE.slateLight}>{a}</Text>
          </Box>
        );
      })}
    </Box>
  );
}
