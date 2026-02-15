import React from 'react';
import { Box, Text, BarChart } from '../../../../packages/shared/src';

const REVENUE_DATA = [
  { label: 'Jan', value: 42 },
  { label: 'Feb', value: 56 },
  { label: 'Mar', value: 38 },
  { label: 'Apr', value: 71 },
  { label: 'May', value: 64 },
  { label: 'Jun', value: 83 },
  { label: 'Jul', value: 77 },
];

const COLORED_DATA = [
  { label: 'React', value: 85, color: '#61dafb' },
  { label: 'Vue', value: 62, color: '#42b883' },
  { label: 'Svelte', value: 45, color: '#ff3e00' },
  { label: 'Angular', value: 38, color: '#dd0031' },
  { label: 'Solid', value: 28, color: '#4f88c6' },
];

const Q1 = [
  { label: 'Jan', value: 42 },
  { label: 'Feb', value: 56 },
  { label: 'Mar', value: 38 },
];

const Q2 = [
  { label: 'Apr', value: 71 },
  { label: 'May', value: 64 },
  { label: 'Jun', value: 83 },
];

export function BarChartStory() {
  return (
    <Box style={{ gap: 20, padding: 16 }}>

      {/* Basic Bar Chart */}
      <Box style={{ gap: 6 }}>
        <Text style={{ color: '#94a3b8', fontSize: 11, fontWeight: 'bold' }}>Basic Bar Chart</Text>
        <Text style={{ color: '#64748b', fontSize: 10 }}>Monthly revenue ($k)</Text>
        <BarChart data={REVENUE_DATA} height={100} />
      </Box>

      {/* Custom Colors */}
      <Box style={{ gap: 6 }}>
        <Text style={{ color: '#94a3b8', fontSize: 11, fontWeight: 'bold' }}>Custom Colors</Text>
        <Text style={{ color: '#64748b', fontSize: 10 }}>Framework popularity</Text>
        <BarChart data={COLORED_DATA} height={100} barWidth={24} gap={12} />
      </Box>

      {/* With Values */}
      <Box style={{ gap: 6 }}>
        <Text style={{ color: '#94a3b8', fontSize: 11, fontWeight: 'bold' }}>With Values</Text>
        <BarChart data={REVENUE_DATA} height={100} showValues color="#8b5cf6" />
      </Box>

      {/* Compact */}
      <Box style={{ gap: 6 }}>
        <Text style={{ color: '#94a3b8', fontSize: 11, fontWeight: 'bold' }}>Compact</Text>
        <BarChart data={REVENUE_DATA} height={48} barWidth={10} gap={4} color="#06b6d4" />
      </Box>

      {/* Side-by-Side */}
      <Box style={{ gap: 6 }}>
        <Text style={{ color: '#94a3b8', fontSize: 11, fontWeight: 'bold' }}>Side-by-Side Comparison</Text>
        <Box style={{ flexDirection: 'row', gap: 24 }}>
          <Box style={{ gap: 4 }}>
            <Text style={{ color: '#64748b', fontSize: 10 }}>Q1 Revenue</Text>
            <BarChart data={Q1} height={80} barWidth={24} gap={10} color="#3b82f6" />
          </Box>
          <Box style={{ gap: 4 }}>
            <Text style={{ color: '#64748b', fontSize: 10 }}>Q2 Revenue</Text>
            <BarChart data={Q2} height={80} barWidth={24} gap={10} color="#22c55e" />
          </Box>
        </Box>
      </Box>

    </Box>
  );
}
