const React: any = require('react');
const { useMemo } = React;
import { Box, Graph, Text } from '../../../../runtime/primitives';
import { PALETTE } from '../../lib/chart-utils';

export type FractionChartProps = {};

function personIcon(x: number, y: number, s: number): string {
  const headR = 3 * s;
  const bodyW = 6 * s;
  const bodyH = 10 * s;
  const headY = y - bodyH / 2;
  const d = `M ${x - headR} ${headY} A ${headR} ${headR} 0 1 1 ${x + headR} ${headY} A ${headR} ${headR} 0 1 1 ${x - headR} ${headY}`;
  return d + ` M ${x - bodyW / 2} ${headY + headR} L ${x + bodyW / 2} ${headY + headR} L ${x + bodyW / 2} ${headY + headR + bodyH} L ${x - bodyW / 2} ${headY + headR + bodyH} Z`;
}

export function FractionChart(_props: FractionChartProps) {
  const width = 280;
  const height = 160;
  const rows = useMemo(() => [
    { total: 10, filled: 7, color: PALETTE.pink },
    { total: 10, filled: 4, color: PALETTE.cyan },
    { total: 10, filled: 9, color: PALETTE.blue },
  ], []);
  const spacing = 18;
  const startY = 30;
  const startX = 20;

  return (
    <Box style={{ width, height }}>
      <Graph originTopLeft style={{ width, height }}>
        {rows.map((r, ri) =>
          Array.from({ length: r.total }).map((_, ci) => {
            const x = startX + ci * spacing;
            const y = startY + ri * 40;
            const isFilled = ci < r.filled;
            return (
              <Graph.Path
                key={`${ri}-${ci}`}
                d={personIcon(x, y, 1)}
                fill={isFilled ? r.color : '#2a2a4a'}
                stroke={isFilled ? r.color : '#3a3a5a'}
                strokeWidth={0.5}
              />
            );
          })
        )}
      </Graph>
      {rows.map((r, i) => (
        <Box key={`lbl-${i}`} style={{ position: 'absolute', left: startX + r.total * spacing + 8, top: startY + i * 40 - 6 }}>
          <Text fontSize={10} color={PALETTE.slateLight}>{r.filled}/{r.total}</Text>
        </Box>
      ))}
    </Box>
  );
}
