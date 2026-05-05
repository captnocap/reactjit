import { useState } from 'react';
import { Box, Graph, Pressable } from '@reactjit/runtime/primitives';
import { PALETTE } from '../../lib/chart-utils';
import { useStagger } from '../../lib/useStagger';
import { Tooltip } from '../../lib/Tooltip';
import { classifiers as S } from '@reactjit/core';

export type FractionRow = { total: number; filled: number; color: string; label: string };

export type FractionChartProps = {
  rows?: FractionRow[];
  width?: number;
  height?: number;
};

function personIcon(x: number, y: number, s: number): string {
  const headR = 3 * s;
  const bodyW = 6 * s;
  const bodyH = 10 * s;
  const headY = y - bodyH / 2;
  const d = `M ${x - headR} ${headY} A ${headR} ${headR} 0 1 1 ${x + headR} ${headY} A ${headR} ${headR} 0 1 1 ${x - headR} ${headY}`;
  return d + ` M ${x - bodyW / 2} ${headY + headR} L ${x + bodyW / 2} ${headY + headR} L ${x + bodyW / 2} ${headY + headR + bodyH} L ${x - bodyW / 2} ${headY + headR + bodyH} Z`;
}

export function FractionChart(props: FractionChartProps) {
  const width = props.width ?? 320;
  const height = props.height ?? 160;
  const rows = props.rows ?? [
    { total: 10, filled: 7, color: PALETTE.pink, label: 'Satisfied' },
    { total: 10, filled: 4, color: PALETTE.cyan, label: 'Neutral' },
    { total: 10, filled: 9, color: PALETTE.blue, label: 'Recommend' },
  ];
  const spacing = 24;
  const startY = 30;
  const startX = 24;

  const allIcons = rows.flatMap((r, ri) =>
    Array.from({ length: r.total }, (_, ci) => ({ ri, ci, color: r.color, isFilled: ci < r.filled }))
  );
  const staggers = useStagger(allIcons.length, { stiffness: 200, damping: 20 });
  const [hovered, setHovered] = useState<number | null>(null);

  return (
    <Box style={{ width, height }}>
      <S.BareGraph>
        {allIcons.map((icon, idx) => {
          const x = startX + icon.ci * spacing;
          const y = startY + icon.ri * 40;
          const s = staggers[idx];
          const r = 3 * s;
          if (r < 0.5) return null;
          return (
            <Graph.Path
              key={idx}
              d={personIcon(x, y, s)}
              fill={icon.isFilled ? icon.color : 'theme:rule'}
              stroke={icon.isFilled ? icon.color : 'theme:rule'}
              strokeWidth={0.5}
            />
          );
        })}
      </S.BareGraph>

      {rows.map((r, i) => (
        <Pressable
          key={`hit-${i}`}
          onMouseEnter={() => setHovered(i)}
          onMouseLeave={() => setHovered(null)}
          style={{
            opacity: 0,
            position: 'absolute',
            left: startX,
            top: startY + i * 40 - 10,
            width: r.total * spacing,
            height: 30,
          }}
        />
      ))}

      {hovered != null && (
        <Tooltip
          visible={true}
          x={startX + rows[hovered].total * spacing + 8}
          y={startY + hovered * 40}
          title={`Row ${hovered + 1}`}
          rows={[
            { label: 'Filled', value: `${rows[hovered].filled}/${rows[hovered].total}`, color: rows[hovered].color },
          ]}
        />
      )}
    </Box>
  );
}
