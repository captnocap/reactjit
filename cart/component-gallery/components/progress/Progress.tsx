const React: any = require('react');
const { useMemo } = React;
import { Box, Graph, Text } from '../../../../runtime/primitives';
import { PALETTE } from '../../lib/chart-utils';

export type ProgressProps = {};

export function Progress(_props: ProgressProps) {
  const width = 280;
  const height = 140;
  const bars = useMemo(() => [
    { label: 'Task A', value: 75 },
    { label: 'Task B', value: 45 },
    { label: 'Task C', value: 90 },
  ], []);
  const barH = 18;
  const gap = 24;
  const startY = 30;
  const startX = 20;
  const barW = 220;

  return (
    <Box style={{ width, height }}>
      <Graph originTopLeft style={{ width, height }}>
        {bars.map((b, i) => {
          const y = startY + i * (barH + gap);
          const fillW = (b.value / 100) * barW;
          const color = i === 0 ? PALETTE.pink : i === 1 ? PALETTE.cyan : PALETTE.blue;
          return (
            <React.Fragment key={i}>
              {/* background track */}
              <Graph.Path d={`M ${startX} ${y} L ${startX + barW} ${y} L ${startX + barW} ${y + barH} L ${startX} ${y + barH} Z`} fill="#2a2a4a" stroke="none" />
              {/* fill */}
              <Graph.Path d={`M ${startX} ${y} L ${startX + fillW} ${y} L ${startX + fillW} ${y + barH} L ${startX} ${y + barH} Z`} fill={color} fillOpacity={0.9} stroke="none" />
              {/* rounded cap simulation */}
              <Graph.Path d={`M ${startX + fillW - 4} ${y} A 4 4 0 0 1 ${startX + fillW} ${y + 4} L ${startX + fillW} ${y + barH - 4} A 4 4 0 0 1 ${startX + fillW - 4} ${y + barH} Z`} fill={color} stroke="none" />
            </React.Fragment>
          );
        })}
      </Graph>
      {bars.map((b, i) => (
        <Box key={`lbl-${i}`} style={{ position: 'absolute', left: startX, top: startY + i * (barH + gap) - 14 }}>
          <Text fontSize={9} color={PALETTE.slateLight}>{b.label}</Text>
        </Box>
      ))}
      {bars.map((b, i) => (
        <Box key={`pct-${i}`} style={{ position: 'absolute', left: startX + barW - 30, top: startY + i * (barH + gap) + 4, width: 28, alignItems: 'flex-end' }}>
          <Text fontSize={9} color={PALETTE.white}>{b.value}%</Text>
        </Box>
      ))}
    </Box>
  );
}
