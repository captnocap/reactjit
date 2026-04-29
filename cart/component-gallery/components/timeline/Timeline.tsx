import { useState } from 'react';
import { Box, Graph, Pressable, Text } from '@reactjit/runtime/primitives';
import { PALETTE } from '../../lib/chart-utils';
import { useSpring } from '../../lib/useSpring';
import { Tooltip } from '../../lib/Tooltip';
import { classifiers as S } from '@reactjit/core';

export type TimelineEvent = { label: string; status: 'done' | 'active' | 'pending' };

export type TimelineProps = {
  events?: TimelineEvent[];
  width?: number;
  height?: number;
};

export function Timeline(props: TimelineProps) {
  const width = props.width ?? 320;
  const height = props.height ?? 120;
  const tl = props.events ?? [
    { label: 'Kickoff', status: 'done' },
    { label: 'Design', status: 'done' },
    { label: 'Prototype', status: 'done' },
    { label: 'Beta', status: 'active' },
    { label: 'Launch', status: 'pending' },
  ];
  const events = tl.map((e, i) => ({
    x: 40 + i * 80,
    label: e.label,
    color: e.status === 'done' ? PALETTE.pink : e.status === 'active' ? PALETTE.cyan : PALETTE.blue,
  }));
  const y = height / 2;

  const grow = useSpring(1, { stiffness: 80, damping: 18 });
  const [hovered, setHovered] = useState<number | null>(null);
  const hoveredEvent = hovered != null ? events[hovered] : null;

  return (
    <Box style={{ width, height }}>
      <S.BareGraph>
        <Graph.Path d={`M 20 ${y} L ${20 + (width - 40) * grow} ${y}`} stroke={PALETTE.slateLight} strokeWidth={2} />
        {events.map((e, i) => [
          <Graph.Path
            key={`dot-${i}`}
            d={`M ${e.x - 5} ${y - 5} A 5 5 0 1 1 ${e.x + 5} ${y - 5} A 5 5 0 1 1 ${e.x - 5} ${y - 5}`}
            fill={e.color}
            stroke={PALETTE.white}
            strokeWidth={1.5}
          />,
          <Graph.Path key={`stem-${i}`} d={`M ${e.x} ${y} L ${e.x} ${y - 20}`} stroke={e.color} strokeWidth={1} strokeDasharray="2,2" />,
        ])}
      </S.BareGraph>

      {events.map((_, i) => (
        <Pressable
          key={`hit-${i}`}
          onMouseEnter={() => setHovered(i)}
          onMouseLeave={() => setHovered(null)}
          style={{
            opacity: 0,
            position: 'absolute',
            left: events[i].x - 12,
            top: y - 12,
            width: 24,
            height: 24,
          }}
        />
      ))}

      {hovered != null && hoveredEvent && (
        <Tooltip
          visible={true}
          x={hoveredEvent.x + 10}
          y={y - 45}
          title={hoveredEvent.label}
          rows={[{ label: 'Stage', value: String(hovered + 1), color: hoveredEvent.color }]}
        />
      )}

      {events.map((e, i) => (
        <Box key={`lbl-${i}`} style={{ position: 'absolute', left: e.x - 30, top: y - 38, width: 60, alignItems: 'center' }}>
          <Text fontSize={9} color={PALETTE.slateLight}>{e.label}</Text>
        </Box>
      ))}
    </Box>
  );
}
