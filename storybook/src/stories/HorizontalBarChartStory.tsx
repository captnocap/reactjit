import React from 'react';
import { Box, Text, HorizontalBarChart } from '../../../packages/shared/src';
import { useThemeColors } from '../../../packages/theme/src';

const LANGUAGES = [
  { label: 'JavaScript', value: 65, color: '#f7df1e' },
  { label: 'Python', value: 58, color: '#3776ab' },
  { label: 'TypeScript', value: 45, color: '#3178c6' },
  { label: 'Rust', value: 32, color: '#dea584' },
  { label: 'Go', value: 28, color: '#00add8' },
  { label: 'Java', value: 24, color: '#ed8b00' },
];

const LEADERBOARD = [
  { label: 'Alice', value: 2480 },
  { label: 'Bob', value: 2150 },
  { label: 'Charlie', value: 1890 },
  { label: 'Diana', value: 1640 },
  { label: 'Eve', value: 1320 },
];

export function HorizontalBarChartStory() {
  const c = useThemeColors();
  return (
    <Box style={{ width: '100%', gap: 20, padding: 16 }}>

      {/* Basic */}
      <Box style={{ gap: 6 }}>
        <Text style={{ color: c.textSecondary, fontSize: 11, fontWeight: 'bold' }}>Basic</Text>
        <HorizontalBarChart data={LANGUAGES} interactive />
      </Box>

      {/* With Values */}
      <Box style={{ gap: 6 }}>
        <Text style={{ color: c.textSecondary, fontSize: 11, fontWeight: 'bold' }}>With Values</Text>
        <HorizontalBarChart data={LANGUAGES} showValues interactive />
      </Box>

      {/* Leaderboard */}
      <Box style={{ gap: 6 }}>
        <Text style={{ color: c.textSecondary, fontSize: 11, fontWeight: 'bold' }}>Leaderboard</Text>
        <HorizontalBarChart
          data={LEADERBOARD}
          showValues
          interactive
          color="#8b5cf6"
          barHeight={16}
          gap={4}
        />
      </Box>

      {/* No Labels */}
      <Box style={{ gap: 6 }}>
        <Text style={{ color: c.textSecondary, fontSize: 11, fontWeight: 'bold' }}>Compact (no labels)</Text>
        <HorizontalBarChart
          data={LANGUAGES.slice(0, 4)}
          showLabels={false}
          barHeight={12}
          gap={3}
          width={200}
          color="#22c55e"
        />
      </Box>

    </Box>
  );
}
