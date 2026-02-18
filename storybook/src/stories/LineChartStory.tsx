import React from 'react';
import { Box, Text, LineChart } from '../../../packages/shared/src';
import { useThemeColors } from '../../../packages/theme/src';

const MONTHLY = [
  { x: 'Jan', value: 42 },
  { x: 'Feb', value: 58 },
  { x: 'Mar', value: 35 },
  { x: 'Apr', value: 72 },
  { x: 'May', value: 65 },
  { x: 'Jun', value: 83 },
  { x: 'Jul', value: 78 },
  { x: 'Aug', value: 91 },
];

const SINE = Array.from({ length: 30 }, (_, i) => ({
  value: Math.round(50 + Math.sin(i * 0.4) * 35),
}));

export function LineChartStory() {
  const c = useThemeColors();
  return (
    <Box style={{ width: '100%', gap: 20, padding: 16 }}>

      {/* Basic */}
      <Box style={{ gap: 6 }}>
        <Text style={{ color: c.textSecondary, fontSize: 11, fontWeight: 'bold' }}>Basic Line Chart</Text>
        <LineChart data={MONTHLY} interactive />
      </Box>

      {/* With Area */}
      <Box style={{ gap: 6 }}>
        <Text style={{ color: c.textSecondary, fontSize: 11, fontWeight: 'bold' }}>With Area Fill</Text>
        <LineChart data={MONTHLY} showArea interactive color="#22c55e" />
      </Box>

      {/* Dots Only */}
      <Box style={{ gap: 6 }}>
        <Text style={{ color: c.textSecondary, fontSize: 11, fontWeight: 'bold' }}>Dots Only (no area)</Text>
        <LineChart data={MONTHLY} interactive color="#f59e0b" />
      </Box>

      {/* Dense */}
      <Box style={{ gap: 6 }}>
        <Text style={{ color: c.textSecondary, fontSize: 11, fontWeight: 'bold' }}>Dense (30 points)</Text>
        <LineChart
          data={SINE}
          width={320}
          height={80}
          showDots={false}
          showArea
          interactive
          color="#8b5cf6"
        />
      </Box>

      {/* Side by side */}
      <Box style={{ gap: 6 }}>
        <Text style={{ color: c.textSecondary, fontSize: 11, fontWeight: 'bold' }}>Comparison</Text>
        <Box style={{ flexDirection: 'row', gap: 16 }}>
          <Box style={{ gap: 4 }}>
            <Text style={{ color: c.textSecondary, fontSize: 9 }}>Series A</Text>
            <LineChart
              data={MONTHLY}
              width={140}
              height={80}
              interactive
              color="#3b82f6"
            />
          </Box>
          <Box style={{ gap: 4 }}>
            <Text style={{ color: c.textSecondary, fontSize: 9 }}>Series B</Text>
            <LineChart
              data={MONTHLY.map(p => ({ ...p, value: 100 - p.value }))}
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
