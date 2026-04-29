import { useState } from 'react';
import { Box, Graph, Pressable, Text } from '@reactjit/runtime/primitives';
import { PALETTE, arcPath } from '../../lib/chart-utils';
import { useSpring } from '../../lib/useSpring';
import { Tooltip } from '../../lib/Tooltip';

export type CircularProgressData = {
  value: number;
  label?: string;
};

export type CircularProgressProps = {
  data?: CircularProgressData;
  width?: number;
  height?: number;
  radius?: number;
};

export function CircularProgress(props: CircularProgressProps) {
  const width = props.width ?? 180;
  const height = props.height ?? 180;
  const radius = props.radius ?? 55;
  const progress = props.data?.value ?? 0.65;

  const sweep = useSpring(360 * progress, { stiffness: 90, damping: 18 });
  const [hovered, setHovered] = useState(false);

  const bgPath = arcPath(0, 0, radius, 0, 360);
  const fillPath = arcPath(0, 0, radius, 0, sweep);

  return (
    <Box style={{ width, height, alignItems: 'center', justifyContent: 'center' }}>
      <Graph style={{ width, height }}>
        <Graph.Path d={bgPath} stroke="#3a2a1e" strokeWidth={10} fill="none" />
        <Graph.Path d={fillPath} stroke={PALETTE.cyan} strokeWidth={10} fill="none" />
      </Graph>

      <Pressable
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          opacity: 0,
          position: 'absolute',
          left: width / 2 - 40,
          top: height / 2 - 40,
          width: 80,
          height: 80,
        }}
      />

      {hovered && (
        <Tooltip
          visible={true}
          x={width / 2 + 30}
          y={height / 2 - 30}
          title={props.data?.label ?? 'Progress'}
          rows={[{ label: 'Complete', value: Math.round(progress * 100) + '%', color: PALETTE.cyan }]}
        />
      )}

      <Box
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width,
          height,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text fontSize={22} color="#2a1f14" style={{ fontWeight: 'bold' }}>{Math.round(progress * 100)}%</Text>
      </Box>
    </Box>
  );
}
