const React: any = require('react');
const { useMemo } = React;
import { Box, Graph, Text } from '../../../../runtime/primitives';
import { PALETTE } from '../../lib/chart-utils';

export type ProportionFiltersProps = {};

export function ProportionFilters(_props: ProportionFiltersProps) {
  const width = 260;
  const height = 160;
  const bubbles = useMemo(() => [
    { cx: 60, cy: 80, r: 35, color: PALETTE.pink, label: '35%' },
    { cx: 150, cy: 60, r: 25, color: PALETTE.cyan, label: '25%' },
    { cx: 200, cy: 110, r: 18, color: PALETTE.blue, label: '18%' },
    { cx: 110, cy: 120, r: 12, color: PALETTE.purple, label: '12%' },
  ], []);

  return (
    <Box style={{ width, height }}>
      <Graph originTopLeft style={{ width, height }}>
        {bubbles.map((b, i) => (
          <React.Fragment key={i}>
            <Graph.Path
              d={`M ${b.cx - b.r} ${b.cy} A ${b.r} ${b.r} 0 1 1 ${b.cx + b.r} ${b.cy} A ${b.r} ${b.r} 0 1 1 ${b.cx - b.r} ${b.cy}`}
              fill={b.color}
              fillOpacity={0.7}
              stroke={b.color}
              strokeWidth={1.5}
            />
          </React.Fragment>
        ))}
      </Graph>
      {bubbles.map((b, i) => (
        <Box key={`lbl-${i}`} style={{ position: 'absolute', left: b.cx - 14, top: b.cy - 6, width: 28, alignItems: 'center' }}>
          <Text fontSize={9} color={PALETTE.white} style={{ fontWeight: 'bold' }}>{b.label}</Text>
        </Box>
      ))}
    </Box>
  );
}
