import React from 'react';
import { Box, Text, PieChart } from '../../../packages/shared/src';
import { useThemeColors } from '../../../packages/theme/src';

const BROWSER_SHARE = [
  { label: 'Chrome', value: 65, color: '#4285f4' },
  { label: 'Safari', value: 18, color: '#a3aaae' },
  { label: 'Firefox', value: 8, color: '#ff7139' },
  { label: 'Edge', value: 5, color: '#0078d7' },
  { label: 'Other', value: 4, color: '#6b7280' },
];

const BUDGET = [
  { label: 'Engineering', value: 45, color: '#3b82f6' },
  { label: 'Marketing', value: 25, color: '#22c55e' },
  { label: 'Operations', value: 20, color: '#f59e0b' },
  { label: 'Support', value: 10, color: '#8b5cf6' },
];

const STORAGE = [
  { label: 'Used', value: 72, color: '#3b82f6' },
  { label: 'Free', value: 28, color: '#1e293b' },
];

export function PieChartStory() {
  const c = useThemeColors();
  return (
    <Box style={{ width: '100%', gap: 20, padding: 16 }}>

      {/* Pie */}
      <Box style={{ gap: 6 }}>
        <Text style={{ color: c.textSecondary, fontSize: 11, fontWeight: 'bold' }}>Pie Chart</Text>
        <Box style={{ flexDirection: 'row', gap: 16, alignItems: 'center' }}>
          <PieChart data={BROWSER_SHARE} interactive />
          <Box style={{ gap: 4 }}>
            {BROWSER_SHARE.map((s) => (
              <Box key={s.label} style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                <Box style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: s.color }} />
                <Text style={{ color: c.textSecondary, fontSize: 10 }}>{s.label}</Text>
              </Box>
            ))}
          </Box>
        </Box>
      </Box>

      {/* Donut */}
      <Box style={{ gap: 6 }}>
        <Text style={{ color: c.textSecondary, fontSize: 11, fontWeight: 'bold' }}>Donut Chart</Text>
        <Box style={{ flexDirection: 'row', gap: 16, alignItems: 'center' }}>
          <PieChart data={BUDGET} innerRadius={35} interactive />
          <Box style={{ gap: 4 }}>
            {BUDGET.map((s) => (
              <Box key={s.label} style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                <Box style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: s.color }} />
                <Text style={{ color: c.textSecondary, fontSize: 10 }}>{s.label}</Text>
              </Box>
            ))}
          </Box>
        </Box>
      </Box>

      {/* Ring Gauge */}
      <Box style={{ gap: 6 }}>
        <Text style={{ color: c.textSecondary, fontSize: 11, fontWeight: 'bold' }}>Ring Gauge</Text>
        <Box style={{ flexDirection: 'row', gap: 20 }}>
          <Box style={{ gap: 4, alignItems: 'center' }}>
            <PieChart data={STORAGE} size={80} innerRadius={25} interactive />
            <Text style={{ color: c.textSecondary, fontSize: 10 }}>72% used</Text>
          </Box>
          <Box style={{ gap: 4, alignItems: 'center' }}>
            <PieChart
              data={[
                { label: 'Complete', value: 45, color: '#22c55e' },
                { label: 'Remaining', value: 55, color: '#1e293b' },
              ]}
              size={80}
              innerRadius={25}
              interactive
            />
            <Text style={{ color: c.textSecondary, fontSize: 10 }}>45% done</Text>
          </Box>
        </Box>
      </Box>

      {/* Sizes */}
      <Box style={{ gap: 6 }}>
        <Text style={{ color: c.textSecondary, fontSize: 11, fontWeight: 'bold' }}>Sizes</Text>
        <Box style={{ flexDirection: 'row', gap: 16, alignItems: 'flex-end' }}>
          <PieChart data={BUDGET} size={60} />
          <PieChart data={BUDGET} size={90} />
          <PieChart data={BUDGET} size={120} />
        </Box>
      </Box>

    </Box>
  );
}
