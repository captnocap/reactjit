import { useState } from 'react';
import { Box, Graph, Pressable, Text } from '@reactjit/runtime/primitives';
import { PALETTE, scaleLinear, plotArea } from '../../lib/chart-utils';
import { useSpring } from '../../lib/useSpring';
import { Tooltip } from '../../lib/Tooltip';
import { classifiers as S } from '@reactjit/core';

export type WaterfallChartDatum = { label: string; value: number };

export type WaterfallChartProps = {
  data?: WaterfallChartDatum[];
  width?: number;
  height?: number;
};

export function WaterfallChart(props: WaterfallChartProps) {
  const width = props.width ?? 320;
  const height = props.height ?? 220;
  const plot = plotArea(width, height);
  const data = props.data ?? [];

  let running = 0;
  const bars = data.map((c) => {
    const start = running;
    running += c.value;
    return { start, end: running, change: c.value };
  });

  const allVals = [0, ...bars.map((b) => b.end)];
  const max = allVals.length ? Math.max(...allVals) : 1;
  const min = allVals.length ? Math.min(...allVals) : 0;
  const yScale = scaleLinear([min, max], [plot.y + plot.h, plot.y]);
  const xScale = scaleLinear([0, Math.max(1, bars.length)], [plot.x, plot.x + plot.w]);
  const barW = (plot.w / Math.max(1, bars.length)) * 0.5;

  const grow = useSpring(1, { stiffness: 100, damping: 16 });
  const [hovered, setHovered] = useState<number | null>(null);

  return (
    <Box style={{ width, height }}>
      <S.BareGraph>
        <Graph.Path d={`M ${plot.x} ${yScale(0)} L ${plot.x + plot.w} ${yScale(0)}`} stroke={PALETTE.slateLight} strokeWidth={1} />
        {bars.map((b, i) => {
          const targetTop = Math.min(yScale(b.start), yScale(b.end));
          const targetBot = Math.max(yScale(b.start), yScale(b.end));
          const currBot = targetTop + (targetBot - targetTop) * grow;
          const x = xScale(i + 0.5) - barW / 2;
          const color = b.change >= 0 ? PALETTE.pink : PALETTE.cyan;
          return (
            <Fragment key={i}>
              <Graph.Path
                d={`M ${x} ${targetTop} L ${x + barW} ${targetTop} L ${x + barW} ${currBot} L ${x} ${currBot} Z`}
                fill={color}
                fillOpacity={hovered === i ? 1 : 0.8}
                stroke={color}
                strokeWidth={1}
              />
              {i < bars.length - 1 && grow > 0.99 && (
                <Graph.Path
                  d={`M ${x + barW} ${yScale(b.end)} L ${xScale(i + 1.5) - barW / 2} ${yScale(b.end)}`}
                  stroke={PALETTE.slateLight}
                  strokeWidth={1}
                  strokeDasharray="3,3"
                />
              )}
            </Fragment>
          );
        })}
      </S.BareGraph>

      {bars.map((_, i) => (
        <Pressable
          key={`hit-${i}`}
          onMouseEnter={() => setHovered(i)}
          onMouseLeave={() => setHovered(null)}
          style={{
            opacity: 0,
            position: 'absolute',
            left: xScale(i + 0.5) - barW / 2 - 4,
            top: plot.y,
            width: barW + 8,
            height: plot.h,
          }}
        />
      ))}

      {hovered != null && data[hovered] && (
        <Tooltip
          visible={true}
          x={xScale(hovered + 0.5) + barW / 2 + 4}
          y={yScale(bars[hovered].end) - 20}
          title={data[hovered].label}
          rows={[
            { label: 'Change', value: (bars[hovered].change > 0 ? '+' : '') + bars[hovered].change, color: bars[hovered].change >= 0 ? PALETTE.pink : PALETTE.cyan },
            { label: 'Total', value: String(bars[hovered].end) },
          ]}
        />
      )}

      {data.map((d, i) => (
        <Box key={d.label} style={{ position: 'absolute', left: xScale(i + 0.5) - 12, top: plot.y + plot.h + 4, width: 24, alignItems: 'center' }}>
          <Text fontSize={8} color="theme:inkDimmer">{d.label}</Text>
        </Box>
      ))}
    </Box>
  );
}
