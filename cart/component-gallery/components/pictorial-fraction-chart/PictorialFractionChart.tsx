const React: any = require('react');
const { useMemo } = React;
import { Box, Graph, Text } from '../../../../runtime/primitives';
import { PALETTE, polar } from '../../lib/chart-utils';

export type PictorialFractionChartProps = {};

function personPath(cx: number, cy: number, scale: number): string {
  const s = scale;
  // Simple person icon: head + body
  const headR = 4 * s;
  const bodyW = 8 * s;
  const bodyH = 14 * s;
  const headY = cy - bodyH / 2;
  // Circle head
  const d = `M ${cx - headR} ${headY} A ${headR} ${headR} 0 1 1 ${cx + headR} ${headY} A ${headR} ${headR} 0 1 1 ${cx - headR} ${headY} `;
  // Body rectangle
  return d + `M ${cx - bodyW / 2} ${headY + headR} L ${cx + bodyW / 2} ${headY + headR} L ${cx + bodyW / 2} ${headY + headR + bodyH} L ${cx - bodyW / 2} ${headY + headR + bodyH} Z`;
}

export function PictorialFractionChart(_props: PictorialFractionChartProps) {
  const width = 200;
  const height = 160;
  const total = 10;
  const filled = 7;
  const rows = 2;
  const cols = 5;
  // Keep spacing larger than an icon's full height (~26 at scale 1.2) so rows
  // read as separate rows, not a column block. Horizontal gets the same
  // treatment for aesthetic balance.
  const spacingX = 36;
  const spacingY = 44;
  const startX = (width - (cols - 1) * spacingX) / 2;
  const startY = (height - (rows - 1) * spacingY) / 2;

  return (
    <Box style={{ width, height, alignItems: 'center', justifyContent: 'center' }}>
      <Graph originTopLeft style={{ width, height }}>
        {Array.from({ length: total }).map((_, i) => {
          const r = Math.floor(i / cols);
          const c = i % cols;
          const x = startX + c * spacingX;
          const y = startY + r * spacingY;
          const isFilled = i < filled;
          return (
            <Graph.Path
              key={i}
              d={personPath(x, y, 1.2)}
              fill={isFilled ? PALETTE.pink : '#2a2a4a'}
              stroke={isFilled ? PALETTE.pinkDark : '#3a3a5a'}
              strokeWidth={1}
            />
          );
        })}
      </Graph>
      <Box style={{ position: 'absolute', top: 4, right: 8 }}>
        <Text fontSize={10} color={PALETTE.slateLight}>{filled}/{total}</Text>
      </Box>
    </Box>
  );
}
