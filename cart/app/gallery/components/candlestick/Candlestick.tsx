import { useState } from 'react';
import { Box, Graph, Pressable, Text } from '@reactjit/runtime/primitives';
import { PALETTE, scaleLinear, plotArea } from '../../lib/chart-utils';
import { useSpring } from '../../lib/useSpring';
import { Tooltip } from '../../lib/Tooltip';
import { classifiers as S } from '@reactjit/core';

export type CandlestickDatum = { o: number; h: number; l: number; c: number };

export type CandlestickProps = {
  data?: CandlestickDatum[];
  width?: number;
  height?: number;
};

export function Candlestick(props: CandlestickProps) {
  const width = props.width ?? 320;
  const height = props.height ?? 220;
  const plot = plotArea(width, height);
  const data = props.data ?? [];
  const all = data.flatMap((d) => [d.h, d.l]);
  const max = all.length ? Math.max(...all) : 1;
  const min = all.length ? Math.min(...all) : 0;
  const yScale = scaleLinear([min, max], [plot.y + plot.h, plot.y]);
  const xScale = scaleLinear([0, Math.max(1, data.length)], [plot.x, plot.x + plot.w]);
  const candleW = (plot.w / Math.max(1, data.length)) * 0.5;

  const grow = useSpring(1, { stiffness: 100, damping: 16 });
  const [hovered, setHovered] = useState<number | null>(null);

  return (
    <Box style={{ width, height }}>
      <S.BareGraph>
        {data.map((d, i) => {
          const cx = xScale(i + 0.5);
          const x1 = cx - candleW / 2;
          const x2 = cx + candleW / 2;
          const yO = yScale(d.o) + (plot.y + plot.h - yScale(d.o)) * (1 - grow);
          const yH = yScale(d.h) + (plot.y + plot.h - yScale(d.h)) * (1 - grow);
          const yL = yScale(d.l) + (plot.y + plot.h - yScale(d.l)) * (1 - grow);
          const yC = yScale(d.c) + (plot.y + plot.h - yScale(d.c)) * (1 - grow);
          const isUp = d.c >= d.o;
          const color = isUp ? PALETTE.pink : PALETTE.cyan;
          const top = Math.min(yO, yC);
          const bot = Math.max(yO, yC);
          return [
            <Graph.Path key={`wick-${i}`} d={`M ${cx} ${yH} L ${cx} ${yL}`} stroke={color} strokeWidth={1} />,
            <Graph.Path key={`body-${i}`} d={`M ${x1} ${top} L ${x2} ${top} L ${x2} ${bot} L ${x1} ${bot} Z`} fill={color} stroke={color} strokeWidth={1} />,
          ];
        })}
      </S.BareGraph>

      {data.map((_, i) => (
        <Pressable
          key={`hit-${i}`}
          onMouseEnter={() => setHovered(i)}
          onMouseLeave={() => setHovered(null)}
          style={{
            opacity: 0,
            position: 'absolute',
            left: xScale(i + 0.5) - candleW / 2 - 4,
            top: plot.y,
            width: candleW + 8,
            height: plot.h,
          }}
        />
      ))}

      {hovered != null && data[hovered] && (
        <Tooltip
          visible={true}
          x={xScale(hovered + 0.5) + candleW / 2 + 4}
          y={yScale(data[hovered].h) - 20}
          title={`Day ${hovered + 1}`}
          rows={[
            { label: 'Open', value: String(data[hovered].o) },
            { label: 'High', value: String(data[hovered].h) },
            { label: 'Low', value: String(data[hovered].l) },
            { label: 'Close', value: String(data[hovered].c), color: data[hovered].c >= data[hovered].o ? PALETTE.pink : PALETTE.cyan },
          ]}
        />
      )}
    </Box>
  );
}
