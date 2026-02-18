import React from 'react';
import { Box, Text, StackedBarChart } from '../../../packages/shared/src';
import { useThemeColors } from '../../../packages/theme/src';

const LABELS = ['Q1', 'Q2', 'Q3', 'Q4'];

const REVENUE_SERIES = [
  { label: 'Product', color: '#3b82f6', data: [30, 45, 52, 60] },
  { label: 'Services', color: '#22c55e', data: [20, 25, 30, 28] },
  { label: 'Support', color: '#f59e0b', data: [10, 12, 8, 15] },
];

const TRAFFIC_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const TRAFFIC_SERIES = [
  { label: 'Organic', color: '#22c55e', data: [120, 140, 135, 150, 160, 80, 70] },
  { label: 'Paid', color: '#3b82f6', data: [80, 90, 85, 95, 100, 40, 30] },
  { label: 'Direct', color: '#8b5cf6', data: [40, 45, 50, 42, 55, 60, 65] },
];

export function StackedBarChartStory() {
  const c = useThemeColors();
  return (
    <Box style={{ width: '100%', gap: 20, padding: 16 }}>

      {/* Basic */}
      <Box style={{ gap: 6 }}>
        <Text style={{ color: c.textSecondary, fontSize: 11, fontWeight: 'bold' }}>Quarterly Revenue</Text>
        <StackedBarChart
          series={REVENUE_SERIES}
          labels={LABELS}
          interactive
        />
      </Box>

      {/* Weekly Traffic */}
      <Box style={{ gap: 6 }}>
        <Text style={{ color: c.textSecondary, fontSize: 11, fontWeight: 'bold' }}>Weekly Traffic</Text>
        <StackedBarChart
          series={TRAFFIC_SERIES}
          labels={TRAFFIC_LABELS}
          height={140}
          interactive
        />
      </Box>

      {/* Legend */}
      <Box style={{ gap: 6 }}>
        <Text style={{ color: c.textSecondary, fontSize: 11, fontWeight: 'bold' }}>Legend</Text>
        <Box style={{ flexDirection: 'row', gap: 16, flexWrap: 'wrap' }}>
          {TRAFFIC_SERIES.map((s) => (
            <Box key={s.label} style={{ flexDirection: 'row', gap: 4, alignItems: 'center' }}>
              <Box style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: s.color }} />
              <Text style={{ color: c.textSecondary, fontSize: 10 }}>{s.label}</Text>
            </Box>
          ))}
        </Box>
      </Box>

    </Box>
  );
}
