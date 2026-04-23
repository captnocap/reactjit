
import { Box, Text } from '../../../../runtime/primitives';
import { COLORS, TOKENS } from '../../theme';

export type ChartPlotRect = { x: number; y: number; w: number; h: number };

export function ChartAxis(props: {
  plot: ChartPlotRect;
  xLabels: string[];
  yTicks: Array<{ value: number; label: string }>;
  showLabels: boolean;
  showGrid?: boolean;
}) {
  const { plot, xLabels, yTicks, showLabels, showGrid = true } = props;
  if (!showLabels && !showGrid) return null;
  const tickText = { fontSize: 9, color: COLORS.textDim } as const;

  return (
    <Box style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, pointerEvents: 'none' }}>
      <Box style={{ position: 'absolute', left: plot.x, top: plot.y, width: plot.w, height: plot.h, borderLeftWidth: 1, borderBottomWidth: 1, borderColor: COLORS.borderSoft }} />
      {showGrid ? yTicks.map((tick) => (
        <Box key={'y' + tick.value} style={{ position: 'absolute', left: plot.x, top: tick.value, width: plot.w, height: 1, backgroundColor: COLORS.borderSoft, opacity: 0.5 }} />
      )) : null}
      {showLabels ? yTicks.map((tick) => (
        <Box key={'yl' + tick.value} style={{ position: 'absolute', left: Math.max(0, plot.x - 46), top: tick.value - 6, width: 40, alignItems: 'flex-end' }}>
          <Text fontSize={9} color={COLORS.textDim}>{tick.label}</Text>
        </Box>
      )) : null}
      {showLabels ? xLabels.map((label, index) => (
        <Box
          key={'x' + index}
          style={{
            position: 'absolute',
            left: plot.x + ((index + 0.5) * plot.w) / Math.max(1, xLabels.length) - 26,
            top: plot.y + plot.h + 4,
            width: 52,
            alignItems: 'center',
          }}
        >
          <Text fontSize={9} color={COLORS.textDim} numberOfLines={1}>{label}</Text>
        </Box>
      )) : null}
    </Box>
  );
}
