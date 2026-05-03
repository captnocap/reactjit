import { useState } from 'react';
import { Box, Graph, Pressable, Text } from '@reactjit/runtime/primitives';
import { PALETTE, scaleLinear, plotArea } from '../../lib/chart-utils';
import { useSpring } from '../../lib/useSpring';
import { Tooltip } from '../../lib/Tooltip';
import { classifiers as S } from '@reactjit/core';

export type PopulationPyramidProps = {
  labels?: string[];
  left?: number[];
  right?: number[];
  width?: number;
  height?: number;
};

export function PopulationPyramid(props: PopulationPyramidProps) {
  const width = props.width ?? 320;
  const height = props.height ?? 200;
  const plot = plotArea(width, height, { top: 20, right: 20, bottom: 20, left: 20 });
  const labels = props.labels ?? ['0-10', '11-20', '21-30', '31-40', '41-50', '51-60', '61+'];
  const left = props.left ?? [8.2, 12.5, 18.3, 22.1, 19.8, 15.2, 10.5];
  const right = props.right ?? [7.8, 11.9, 17.5, 21.8, 20.5, 16.8, 13.2];
  const max = Math.max(...left, ...right);
  const xScale = scaleLinear([-max, max], [plot.x, plot.x + plot.w]);
  const yScale = scaleLinear([0, labels.length], [plot.y, plot.y + plot.h]);
  const zeroX = xScale(0);
  const barH = (plot.h / labels.length) * 0.7;

  const grow = useSpring(1, { stiffness: 90, damping: 18 });
  const [hovered, setHovered] = useState<number | null>(null);

  return (
    <Box style={{ width, height }}>
      <S.BareGraph>
        <Graph.Path d={`M ${zeroX} ${plot.y} L ${zeroX} ${plot.y + plot.h}`} stroke={PALETTE.slateLight} strokeWidth={1} />
        {labels.map((l, i) => {
          const y = yScale(i + 0.5) - barH / 2;
          const lw = (zeroX - xScale(-left[i])) * grow;
          const rw = (xScale(right[i]) - zeroX) * grow;
          return [
            <Graph.Path key={`left-${l}`} d={`M ${zeroX - lw} ${y} L ${zeroX} ${y} L ${zeroX} ${y + barH} L ${zeroX - lw} ${y + barH} Z`} fill={PALETTE.pink} fillOpacity={0.8} />,
            <Graph.Path key={`right-${l}`} d={`M ${zeroX} ${y} L ${zeroX + rw} ${y} L ${zeroX + rw} ${y + barH} L ${zeroX} ${y + barH} Z`} fill={PALETTE.cyan} fillOpacity={0.8} />,
          ];
        })}
      </S.BareGraph>

      {labels.map((_, i) => (
        <Pressable
          key={`hit-${i}`}
          onMouseEnter={() => setHovered(i)}
          onMouseLeave={() => setHovered(null)}
          style={{
            opacity: 0,
            position: 'absolute',
            left: plot.x,
            top: yScale(i + 0.5) - barH / 2,
            width: plot.w,
            height: barH,
          }}
        />
      ))}

      {hovered != null && (
        <Tooltip
          visible={true}
          x={zeroX + 8}
          y={yScale(hovered + 0.5) - 30}
          title={labels[hovered]}
          rows={[
            { label: 'Left', value: String(left[hovered]), color: PALETTE.pink },
            { label: 'Right', value: String(right[hovered]), color: PALETTE.cyan },
          ]}
        />
      )}

      {labels.map((l, i) => (
        <Box key={l} style={{ position: 'absolute', left: plot.x + plot.w / 2 - 20, top: yScale(i + 0.5) - 6, width: 40, alignItems: 'center' }}>
          <Text fontSize={8} color={PALETTE.slateLight}>{l}</Text>
        </Box>
      ))}
    </Box>
  );
}
