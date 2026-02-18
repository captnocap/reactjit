import React from 'react';
import { Box, Text, AreaChart } from '../../../packages/shared/src';
import { useThemeColors } from '../../../packages/theme/src';

const REVENUE = [
  { x: 'Jan', value: 12 },
  { x: 'Feb', value: 19 },
  { x: 'Mar', value: 15 },
  { x: 'Apr', value: 25 },
  { x: 'May', value: 22 },
  { x: 'Jun', value: 30 },
  { x: 'Jul', value: 28 },
  { x: 'Aug', value: 35 },
];

const TEMPERATURE = Array.from({ length: 24 }, (_, i) => ({
  value: Math.round(15 + Math.sin((i - 6) * Math.PI / 12) * 10),
}));

export function AreaChartStory() {
  const c = useThemeColors();
  return (
    <Box style={{ width: '100%', gap: 20, padding: 16 }}>

      {/* Basic */}
      <Box style={{ gap: 6 }}>
        <Text style={{ color: c.textSecondary, fontSize: 11, fontWeight: 'bold' }}>Basic Area Chart</Text>
        <AreaChart data={REVENUE} interactive color="#3b82f6" />
      </Box>

      {/* Temperature */}
      <Box style={{ gap: 6 }}>
        <Text style={{ color: c.textSecondary, fontSize: 11, fontWeight: 'bold' }}>24h Temperature</Text>
        <AreaChart
          data={TEMPERATURE}
          width={320}
          height={100}
          interactive
          color="#f59e0b"
          areaOpacity={0.25}
        />
      </Box>

      {/* With Dots */}
      <Box style={{ gap: 6 }}>
        <Text style={{ color: c.textSecondary, fontSize: 11, fontWeight: 'bold' }}>With Dots</Text>
        <AreaChart
          data={REVENUE}
          showDots
          interactive
          color="#22c55e"
        />
      </Box>

      {/* Comparison */}
      <Box style={{ gap: 6 }}>
        <Text style={{ color: c.textSecondary, fontSize: 11, fontWeight: 'bold' }}>Side by Side</Text>
        <Box style={{ flexDirection: 'row', gap: 16 }}>
          <Box style={{ gap: 4 }}>
            <Text style={{ color: c.textSecondary, fontSize: 9 }}>Revenue</Text>
            <AreaChart
              data={REVENUE}
              width={140}
              height={80}
              interactive
              color="#3b82f6"
            />
          </Box>
          <Box style={{ gap: 4 }}>
            <Text style={{ color: c.textSecondary, fontSize: 9 }}>Expenses</Text>
            <AreaChart
              data={REVENUE.map(p => ({ ...p, value: Math.round(p.value * 0.7) }))}
              width={140}
              height={80}
              interactive
              color="#ef4444"
            />
          </Box>
        </Box>
      </Box>

    </Box>
  );
}
