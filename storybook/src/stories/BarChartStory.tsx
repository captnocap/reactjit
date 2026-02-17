import React from 'react';
import { Box, Text, BarChart } from '../../../packages/shared/src';

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

const DENSE_DATA = Array.from({ length: 120 }, (_, i) => ({
  label: '',
  value: Math.round(20 + Math.sin(i * 0.15) * 30 + Math.random() * 25),
}));

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
    <Box style={{ gap: 20, padding: 20 }}>

      {/* Basic Bar Chart — fluid width, contained in card */}
      <Box style={{
        gap: 8,
        backgroundColor: '#1e293b',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#334155',
        padding: 16,
      }}>
        <Text style={{ color: '#e2e8f0', fontSize: 13, fontWeight: 'bold' }}>Basic Bar Chart</Text>
        <Text style={{ color: '#64748b', fontSize: 11 }}>Monthly revenue ($k) -- bars fill available width</Text>
        <BarChart data={REVENUE_DATA} height={120} interactive />
      </Box>

      {/* Two cards side by side — both fluid */}
      <Box style={{ flexDirection: 'row', gap: 12, width: '100%' }}>
        {/* Custom Colors — fluid, fills card */}
        <Box style={{
          flexGrow: 1,
          gap: 8,
          backgroundColor: '#1e293b',
          borderRadius: 8,
          borderWidth: 1,
          borderColor: '#334155',
          padding: 16,
        }}>
          <Text style={{ color: '#e2e8f0', fontSize: 13, fontWeight: 'bold' }}>Custom Colors</Text>
          <Text style={{ color: '#64748b', fontSize: 11 }}>Per-bar colors</Text>
          <BarChart data={COLORED_DATA} height={120} gap={12} interactive />
        </Box>

        {/* Compact — fluid, shorter bars */}
        <Box style={{
          flexGrow: 1,
          alignSelf: 'start',
          gap: 8,
          backgroundColor: '#1e293b',
          borderRadius: 8,
          borderWidth: 1,
          borderColor: '#334155',
          padding: 16,
        }}>
          <Text style={{ color: '#e2e8f0', fontSize: 13, fontWeight: 'bold' }}>Compact</Text>
          <Text style={{ color: '#64748b', fontSize: 11 }}>Reduced height</Text>
          <BarChart data={REVENUE_DATA} height={60} gap={6} color="#06b6d4" />
        </Box>
      </Box>

      {/* With Values — fluid width, contained in card */}
      <Box style={{
        gap: 8,
        backgroundColor: '#1e293b',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#334155',
        padding: 16,
      }}>
        <Text style={{ color: '#e2e8f0', fontSize: 13, fontWeight: 'bold' }}>With Values</Text>
        <Text style={{ color: '#64748b', fontSize: 11 }}>Value labels above each bar</Text>
        <BarChart data={REVENUE_DATA} height={120} showValues color="#8b5cf6" interactive />
      </Box>

      {/* Dense — 120 bars, no labels, looks like a waveform */}
      <Box style={{
        gap: 8,
        backgroundColor: '#1e293b',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#334155',
        padding: 16,
      }}>
        <Text style={{ color: '#e2e8f0', fontSize: 13, fontWeight: 'bold' }}>Dense (120 bars)</Text>
        <Text style={{ color: '#64748b', fontSize: 11 }}>120 bars -- hover for tooltip</Text>
        <BarChart data={DENSE_DATA} height={100} gap={2} showLabels={false} color="#22c55e" interactive />
      </Box>

      {/* Side-by-Side Comparison */}
      <Box style={{
        gap: 8,
        backgroundColor: '#1e293b',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#334155',
        padding: 16,
      }}>
        <Text style={{ color: '#e2e8f0', fontSize: 13, fontWeight: 'bold' }}>Side-by-Side Comparison</Text>
        <Box style={{ flexDirection: 'row', gap: 24, width: '100%' }}>
          <Box style={{ gap: 4, flexGrow: 1 }}>
            <Text style={{ color: '#64748b', fontSize: 11 }}>Q1 Revenue</Text>
            <BarChart data={Q1} height={100} gap={10} color="#3b82f6" showValues interactive />
          </Box>
          <Box style={{ gap: 4, flexGrow: 1 }}>
            <Text style={{ color: '#64748b', fontSize: 11 }}>Q2 Revenue</Text>
            <BarChart data={Q2} height={100} gap={10} color="#22c55e" showValues interactive />
          </Box>
        </Box>
      </Box>

    </Box>
  );
}
