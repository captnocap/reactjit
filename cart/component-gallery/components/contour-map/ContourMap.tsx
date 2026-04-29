import { useState } from 'react';
import { Box, Graph, Pressable } from '@reactjit/runtime/primitives';
import { PALETTE } from '../../lib/chart-utils';
import { useStagger } from '../../lib/useStagger';
import { Tooltip } from '../../lib/Tooltip';
import { classifiers as S } from '@reactjit/core';

export type ContourDatum = { cx: number; cy: number; rx: number; ry: number; name: string };

export type ContourMapProps = {
  data?: ContourDatum[];
  width?: number;
  height?: number;
};

export function ContourMap(props: ContourMapProps) {
  const width = props.width ?? 280;
  const height = props.height ?? 200;

  const contours = props.data ?? [
    { cx: 100, cy: 80, rx: 15, ry: 10, name: 'Peak A' },
    { cx: 100, cy: 80, rx: 30, ry: 20, name: 'Peak A' },
    { cx: 100, cy: 80, rx: 45, ry: 30, name: 'Peak A' },
    { cx: 100, cy: 80, rx: 60, ry: 40, name: 'Peak A' },
    { cx: 180, cy: 110, rx: 12, ry: 8, name: 'Peak B' },
    { cx: 180, cy: 110, rx: 25, ry: 16, name: 'Peak B' },
    { cx: 180, cy: 110, rx: 38, ry: 24, name: 'Peak B' },
    { cx: 140, cy: 60, rx: 10, ry: 7, name: 'Peak C' },
    { cx: 140, cy: 60, rx: 22, ry: 14, name: 'Peak C' },
    { cx: 140, cy: 60, rx: 34, ry: 21, name: 'Peak C' },
  ];

  const staggers = useStagger(contours.length, { stiffness: 120, damping: 16 });
  const [hovered, setHovered] = useState<number | null>(null);

  function ellipsePath(cx: number, cy: number, rx: number, ry: number): string {
    return `M ${cx - rx} ${cy} A ${rx} ${ry} 0 1 1 ${cx + rx} ${cy} A ${rx} ${ry} 0 1 1 ${cx - rx} ${cy}`;
  }

  return (
    <Box style={{ width, height }}>
      <S.BareGraph>
        {contours.map((c, i) => {
          const s = staggers[i];
          if (s <= 0) return null;
          return (
            <Graph.Path
              key={i}
              d={ellipsePath(c.cx, c.cy, c.rx * s, c.ry * s)}
              fill="none"
              stroke={i % 2 === 0 ? PALETTE.cyan : PALETTE.pink}
              strokeWidth={1.5}
              strokeOpacity={0.6}
            />
          );
        })}
      </S.BareGraph>

      {contours.map((c, i) => (
        <Pressable
          key={`hit-${i}`}
          onMouseEnter={() => setHovered(i)}
          onMouseLeave={() => setHovered(null)}
          style={{
            opacity: 0,
            position: 'absolute',
            left: c.cx - c.rx,
            top: c.cy - c.ry,
            width: c.rx * 2,
            height: c.ry * 2,
          }}
        />
      ))}

      {hovered != null && (
        <Tooltip
          visible={true}
          x={contours[hovered].cx + 10}
          y={contours[hovered].cy - 20}
          title={`Contour ${hovered + 1}`}
          rows={[{ label: 'Level', value: String((hovered % 4) + 1), color: PALETTE.cyan }]}
        />
      )}
    </Box>
  );
}
