import { useState } from 'react';
import { Box, Graph, Pressable, Text } from '@reactjit/runtime/primitives';
import { PALETTE, polar } from '../../lib/chart-utils';
import { useSpring } from '../../lib/useSpring';
import { Tooltip } from '../../lib/Tooltip';
import { classifiers as S } from '@reactjit/core';

export type CircularBarChartProps = {
  labels?: string[];
  data?: number[];
  width?: number;
  height?: number;
};

export function CircularBarChart(props: CircularBarChartProps) {
  const width = props.width ?? 260;
  const height = props.height ?? 240;
  const cx = width / 2;
  const cy = height / 2;
  const innerR = 30;
  const maxBar = 55;
  const labels = props.labels ?? ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const data = props.data ?? [45, 52, 38, 61, 55, 42, 48];
  const angleStep = 360 / data.length;

  const sweep = useSpring(1, { stiffness: 100, damping: 16 });
  const [hovered, setHovered] = useState<number | null>(null);

  return (
    <Box style={{ width, height }}>
      <S.BareGraph>
        {data.map((v, i) => {
          const angle = i * angleStep;
          const barLen = (v / 50) * maxBar * sweep;
          const [x1, y1] = polar(cx, cy, innerR, angle);
          const [x2, y2] = polar(cx, cy, innerR + barLen, angle);
          return (
            <Graph.Path
              key={i}
              d={`M ${x1} ${y1} L ${x2} ${y2}`}
              stroke={hovered === i ? PALETTE.pink : i % 2 === 0 ? PALETTE.pink : PALETTE.cyan}
              strokeWidth={10}
              strokeLinecap="round"
            />
          );
        })}
      </S.BareGraph>

      {data.map((v, i) => {
        const angle = i * angleStep;
        const barLen = (v / 50) * maxBar;
        const [hx, hy] = polar(cx, cy, innerR + barLen + 10, angle);
        return (
          <Pressable
            key={`hit-${i}`}
            onMouseEnter={() => setHovered(i)}
            onMouseLeave={() => setHovered(null)}
            style={{
              opacity: 0,
              position: 'absolute',
              left: hx - 12,
              top: hy - 12,
              width: 24,
              height: 24,
            }}
          />
        );
      })}

      {hovered != null && (
        <Tooltip
          visible={true}
          x={cx + 20}
          y={cy - 40}
          title={labels[hovered]}
          rows={[{ label: 'Value', value: String(data[hovered]), color: PALETTE.pink }]}
        />
      )}

      {data.map((v, i) => {
        const angle = i * angleStep;
        const barLen = (v / 50) * maxBar;
        const [x, y] = polar(cx, cy, innerR + barLen + 14, angle);
        return (
          <Box key={`lbl-${i}`} style={{ position: 'absolute', left: x - 8, top: y - 6, width: 16, alignItems: 'center' }}>
            <Text fontSize={8} color={PALETTE.slateLight}>{labels[i]}</Text>
          </Box>
        );
      })}
    </Box>
  );
}
