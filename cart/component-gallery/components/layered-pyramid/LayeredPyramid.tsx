const React: any = require('react');
const { useMemo } = React;
import { Box, Graph, Text } from '../../../../runtime/primitives';
import { PALETTE } from '../../lib/chart-utils';

export type LayeredPyramidProps = {};

export function LayeredPyramid(_props: LayeredPyramidProps) {
  const width = 200;
  const height = 180;
  // <Graph> world origin sits at element center. Keep the pyramid's geometry
  // in DOM-style top-left coordinates below for readability (topY=30 from the
  // top edge, baseY=20 above the bottom edge), then translate into Graph
  // world coords via OX/OY when drawing paths.
  const cx = width / 2;
  const baseY = height - 20;
  const topY = 30;
  const baseW = 160;
  const OX = -width / 2;
  const OY = -height / 2;

  const levels = useMemo(() => [
    { label: 'A', color: PALETTE.pink, h: 35 },
    { label: 'B', color: PALETTE.cyan, h: 40 },
    { label: 'C', color: PALETTE.blue, h: 45 },
    { label: 'D', color: PALETTE.purple, h: 30 },
  ], []);

  let currentY = topY;

  return (
    <Box style={{ width, height }}>
      <Graph style={{ width, height }}>
        {levels.map((l, i) => {
          const y1 = currentY;
          const y2 = currentY + l.h;
          const topWidth = baseW * (1 - (y1 - topY) / (baseY - topY));
          const bottomWidth = baseW * (1 - (y2 - topY) / (baseY - topY));
          const x1 = cx - topWidth / 2;
          const x2 = cx + topWidth / 2;
          const x3 = cx + bottomWidth / 2;
          const x4 = cx - bottomWidth / 2;
          currentY += l.h;
          return (
            <Graph.Path
              key={i}
              d={`M ${x1 + OX} ${y1 + OY} L ${x2 + OX} ${y1 + OY} L ${x3 + OX} ${y2 + OY} L ${x4 + OX} ${y2 + OY} Z`}
              fill={l.color}
              fillOpacity={0.8}
              stroke={l.color}
              strokeWidth={1}
            />
          );
        })}
      </Graph>
      {(() => { currentY = topY; return null; })()}
      {levels.map((l, i) => {
        const y = currentY + l.h / 2;
        currentY += l.h;
        return (
          <Box key={`lbl-${i}`} style={{ position: 'absolute', left: cx - 20, top: y - 6, width: 40, alignItems: 'center' }}>
            <Text fontSize={9} color={PALETTE.white}>{l.label}</Text>
          </Box>
        );
      })}
    </Box>
  );
}
