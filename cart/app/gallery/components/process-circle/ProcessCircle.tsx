import { Fragment, useMemo, useState } from 'react';
import { Box, Graph, Pressable, Text } from '@reactjit/runtime/primitives';
import { COLORS, PALETTE, arcPath, polar } from '../../lib/chart-utils';
import { useSpring } from '../../lib/useSpring';
import { Tooltip } from '../../lib/Tooltip';

export type ProcessCircleStep = {
  label: string;
  color?: string;
};

export type ProcessCircleData = {
  value: number;
  label?: string;
  steps?: ProcessCircleStep[];
  completed?: number;
};

export type ProcessCircleProps = {
  data?: ProcessCircleData;
  width?: number;
  height?: number;
  radius?: number;
};

export function ProcessCircle(props: ProcessCircleProps) {
  const width = props.width ?? 180;
  const height = props.height ?? 180;
  const radius = props.radius ?? 60;
  const progress = props.data?.value ?? 0.72;
  const animatedProgress = useSpring(progress, { stiffness: 90, damping: 18 });
  const [hovered, setHovered] = useState(false);
  const steps = props.data?.steps ?? [
    { label: 'Plan', color: PALETTE.pink },
    { label: 'Build', color: PALETTE.cyan },
    { label: 'Review', color: PALETTE.blue },
    { label: 'Ship', color: PALETTE.teal },
    { label: 'Watch', color: PALETTE.purple },
  ];
  const stepCount = Math.max(1, steps.length);
  const completed = Math.max(0, Math.min(stepCount, props.data?.completed ?? Math.round(progress * stepCount)));
  const activeIndex = Math.max(0, Math.min(stepCount - 1, completed - 1));
  const segmentSize = 360 / stepCount;
  const gap = Math.min(10, segmentSize * 0.22);

  const segments = useMemo(
    () =>
      steps.map((step, index) => {
        const start = index * segmentSize + gap / 2;
        const end = (index + 1) * segmentSize - gap / 2;
        const mid = (start + end) / 2;
        const [dotX, dotY] = polar(0, 0, radius, mid);
        return {
          start,
          end,
          dotX,
          dotY,
          color: step.color ?? COLORS[index % COLORS.length],
        };
      }),
    [gap, radius, segmentSize, steps],
  );

  return (
    <Box style={{ width, height, alignItems: 'center', justifyContent: 'center' }}>
      <Graph style={{ width, height }}>
        {segments.map((segment, index) => {
          const segmentFill = Math.max(0, Math.min(1, animatedProgress * stepCount - index));
          const fillEnd = segment.start + (segment.end - segment.start) * segmentFill;
          const dotRadius = index === activeIndex ? 5 : 3.5;
          return (
            <Fragment key={`segment-${index}`}>
              <Graph.Path
                key={`track-${index}`}
                d={arcPath(0, 0, radius, segment.start, segment.end)}
                stroke={PALETTE.slateLight}
                strokeWidth={8}
                fill="none"
              />
              {segmentFill > 0 && (
                <Graph.Path
                  key={`fill-${index}`}
                  d={arcPath(0, 0, radius, segment.start, fillEnd)}
                  stroke={segment.color}
                  strokeWidth={8}
                  fill="none"
                />
              )}
              <Graph.Path
                key={`dot-${index}`}
                d={`M ${segment.dotX - dotRadius} ${segment.dotY} A ${dotRadius} ${dotRadius} 0 1 1 ${segment.dotX + dotRadius} ${segment.dotY} A ${dotRadius} ${dotRadius} 0 1 1 ${segment.dotX - dotRadius} ${segment.dotY}`}
                fill={index < completed ? segment.color : 'theme:paperAlt'}
                stroke={index < completed ? segment.color : PALETTE.slateLight}
                strokeWidth={1}
              />
            </Fragment>
          );
        })}
      </Graph>
      <Pressable
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          opacity: 0,
          position: 'absolute',
          left: width / 2 - radius - 10,
          top: height / 2 - radius - 10,
          width: radius * 2 + 20,
          height: radius * 2 + 20,
        }}
      />
      {hovered && (
        <Tooltip
          visible={true}
          x={width / 2 + 18}
          y={height / 2 - 18}
          title={props.data?.label ?? steps[activeIndex]?.label ?? 'Process'}
          rows={[
            { label: 'Step', value: `${completed}/${stepCount}`, color: segments[activeIndex]?.color ?? PALETTE.pink },
            { label: 'Progress', value: `${Math.round(progress * 100)}%`, color: PALETTE.cyan },
          ]}
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
        <Text fontSize={22} color="theme:paperInk" style={{ fontWeight: 'bold' }}>
          {completed}/{stepCount}
        </Text>
        <Text fontSize={10} color="theme:paperInkDim">
          {steps[activeIndex]?.label ?? props.data?.label ?? 'Step'}
        </Text>
      </Box>
    </Box>
  );
}
