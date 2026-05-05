import { useState } from 'react';
import { Box, Graph, Pressable, Text } from '@reactjit/runtime/primitives';
import { PALETTE, plotArea } from '../../lib/chart-utils';
import { useSpring } from '../../lib/useSpring';
import { Tooltip } from '../../lib/Tooltip';
import { classifiers as S } from '@reactjit/core';

export type HeatmapProps = {
  data?: number[][];
  width?: number;
  height?: number;
};

export function Heatmap(props: HeatmapProps) {
  const width = props.width ?? 240;
  const height = props.height ?? 200;
  const plot = plotArea(width, height, { top: 10, right: 10, bottom: 10, left: 10 });
  const data = props.data ?? [];
  const rows = data.length;
  const cols = rows > 0 ? data[0].length : 0;
  const cellW = cols > 0 ? plot.w / cols : 0;
  const cellH = rows > 0 ? plot.h / rows : 0;

  const fade = useSpring(1, { stiffness: 80, damping: 20 });
  const [hovered, setHovered] = useState<{ r: number; c: number } | null>(null);

  function heatColor(t: number): string {
    if (t >= 0.82) return 'theme:accentHot';
    if (t >= 0.62) return 'theme:accent';
    if (t >= 0.42) return 'theme:warn';
    if (t >= 0.22) return 'theme:blue';
    return 'theme:bg2';
  }

  return (
    <Box style={{ width, height }}>
      <S.BareGraph>
        {data.map((row, ri) =>
          row.map((val, ci) => {
            const x = plot.x + ci * cellW + 1;
            const y = plot.y + ri * cellH + 1;
            const w = cellW - 2;
            const ch = cellH - 2;
            return (
              <Graph.Path
                key={`${ri}-${ci}`}
                d={`M ${x} ${y} L ${x + w} ${y} L ${x + w} ${y + ch} L ${x} ${y + ch} Z`}
                fill={heatColor(val)}
                stroke={hovered && hovered.r === ri && hovered.c === ci ? PALETTE.white : 'none'}
                strokeWidth={1}
              />
            );
          })
        )}
      </S.BareGraph>

      {data.map((row, ri) =>
        row.map((_, ci) => {
          const x = plot.x + ci * cellW;
          const y = plot.y + ri * cellH;
          return (
            <Pressable
              key={`hit-${ri}-${ci}`}
              onMouseEnter={() => setHovered({ r: ri, c: ci })}
              onMouseLeave={() => setHovered(null)}
              style={{
                opacity: 0,
                position: 'absolute',
                left: x,
                top: y,
                width: cellW,
                height: cellH,
              }}
            />
          );
        })
      )}

      {hovered != null && data[hovered.r] && data[hovered.r][hovered.c] != null && (
        <Tooltip
          visible={true}
          x={plot.x + hovered.c * cellW + cellW + 4}
          y={plot.y + hovered.r * cellH}
          title={`Cell ${hovered.r},${hovered.c}`}
          rows={[{ label: 'Value', value: data[hovered.r][hovered.c].toFixed(2), color: heatColor(data[hovered.r][hovered.c]) }]}
        />
      )}
    </Box>
  );
}
