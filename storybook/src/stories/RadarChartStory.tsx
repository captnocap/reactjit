import React from 'react';
import { Box, Text, RadarChart } from '../../../packages/shared/src';
import { useThemeColors } from '../../../packages/theme/src';

const SKILLS_AXES = [
  { label: 'Speed', max: 100 },
  { label: 'Power', max: 100 },
  { label: 'Defense', max: 100 },
  { label: 'Accuracy', max: 100 },
  { label: 'Stamina', max: 100 },
];
const PLAYER_A = [85, 70, 60, 90, 75];
const PLAYER_B = [60, 90, 80, 50, 85];

const PERF_AXES = [
  { label: 'CPU' },
  { label: 'Memory' },
  { label: 'Disk' },
  { label: 'Network' },
  { label: 'Latency' },
  { label: 'Throughput' },
];
const PERF_DATA = [78, 65, 82, 55, 70, 88];

export function RadarChartStory() {
  const c = useThemeColors();
  return (
    <Box style={{ width: '100%', gap: 20, padding: 16 }}>

      {/* Basic */}
      <Box style={{ gap: 6 }}>
        <Text style={{ color: c.textSecondary, fontSize: 11, fontWeight: 'bold' }}>Player Stats</Text>
        <Box style={{ flexDirection: 'row', gap: 24, alignItems: 'center' }}>
          <Box style={{ gap: 4, alignItems: 'center' }}>
            <RadarChart
              axes={SKILLS_AXES}
              data={PLAYER_A}
              interactive
              color="#3b82f6"
            />
            <Text style={{ color: '#3b82f6', fontSize: 10 }}>Player A</Text>
          </Box>
          <Box style={{ gap: 4, alignItems: 'center' }}>
            <RadarChart
              axes={SKILLS_AXES}
              data={PLAYER_B}
              interactive
              color="#ef4444"
            />
            <Text style={{ color: '#ef4444', fontSize: 10 }}>Player B</Text>
          </Box>
        </Box>
      </Box>

      {/* 6 axes */}
      <Box style={{ gap: 6 }}>
        <Text style={{ color: c.textSecondary, fontSize: 11, fontWeight: 'bold' }}>System Performance</Text>
        <RadarChart
          axes={PERF_AXES}
          data={PERF_DATA}
          size={140}
          interactive
          color="#22c55e"
        />
      </Box>

      {/* Sizes */}
      <Box style={{ gap: 6 }}>
        <Text style={{ color: c.textSecondary, fontSize: 11, fontWeight: 'bold' }}>Sizes</Text>
        <Box style={{ flexDirection: 'row', gap: 16, alignItems: 'flex-end' }}>
          <RadarChart axes={SKILLS_AXES} data={PLAYER_A} size={60} color="#f59e0b" />
          <RadarChart axes={SKILLS_AXES} data={PLAYER_A} size={90} color="#f59e0b" />
          <RadarChart axes={SKILLS_AXES} data={PLAYER_A} size={120} color="#f59e0b" />
        </Box>
      </Box>

    </Box>
  );
}
