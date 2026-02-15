import React from 'react';
import { Box, Text, Sparkline } from '../../../../packages/shared/src';

const SAMPLE_DATA = [4, 7, 3, 8, 5, 9, 2, 6, 8, 3, 7, 5, 9, 4, 6, 8, 3, 7, 5, 10];
const UPTREND = [2, 3, 2, 4, 5, 4, 6, 7, 6, 8, 9, 8, 10, 11, 10, 12, 13, 12, 14, 15];
const DOWNTREND = [15, 14, 13, 14, 12, 11, 12, 10, 9, 10, 8, 7, 8, 6, 5, 6, 4, 3, 4, 2];
const VOLATILE = [10, 2, 15, 1, 12, 3, 14, 2, 11, 4, 13, 1, 10, 5, 15, 2, 8, 3, 12, 1];

export function SparklineStory() {
  return (
    <Box style={{ gap: 20, padding: 16 }}>

      {/* Basic Sparkline */}
      <Box style={{ gap: 6 }}>
        <Text style={{ color: '#94a3b8', fontSize: 11, fontWeight: 'bold' }}>Basic Sparkline</Text>
        <Sparkline data={SAMPLE_DATA} />
      </Box>

      {/* Multiple Sizes */}
      <Box style={{ gap: 6 }}>
        <Text style={{ color: '#94a3b8', fontSize: 11, fontWeight: 'bold' }}>Sizes</Text>
        <Box style={{ gap: 8 }}>
          <Box style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
            <Text style={{ color: '#64748b', fontSize: 10, width: 60 }}>60 x 16</Text>
            <Sparkline data={SAMPLE_DATA} width={60} height={16} />
          </Box>
          <Box style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
            <Text style={{ color: '#64748b', fontSize: 10, width: 60 }}>80 x 24</Text>
            <Sparkline data={SAMPLE_DATA} width={80} height={24} />
          </Box>
          <Box style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
            <Text style={{ color: '#64748b', fontSize: 10, width: 60 }}>120 x 32</Text>
            <Sparkline data={SAMPLE_DATA} width={120} height={32} />
          </Box>
          <Box style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
            <Text style={{ color: '#64748b', fontSize: 10, width: 60 }}>200 x 48</Text>
            <Sparkline data={SAMPLE_DATA} width={200} height={48} />
          </Box>
        </Box>
      </Box>

      {/* Inline with Text (KPI cards) */}
      <Box style={{ gap: 6 }}>
        <Text style={{ color: '#94a3b8', fontSize: 11, fontWeight: 'bold' }}>Inline KPI Cards</Text>
        <Box style={{ gap: 8 }}>
          {[
            { label: 'Revenue', value: '$48.2k', data: UPTREND, color: '#22c55e' },
            { label: 'Users', value: '1,247', data: SAMPLE_DATA, color: '#3b82f6' },
            { label: 'Churn', value: '2.4%', data: DOWNTREND, color: '#ef4444' },
            { label: 'Latency', value: '142ms', data: VOLATILE, color: '#f59e0b' },
          ].map((kpi) => (
            <Box key={kpi.label} style={{
              flexDirection: 'row',
              width: 260,
              alignItems: 'center',
              backgroundColor: '#1e293b',
              borderRadius: 6,
              padding: 10,
              gap: 12,
            }}>
              <Box style={{ width: 100, height: 30, gap: 2 }}>
                <Text style={{ color: '#64748b', fontSize: 10 }}>{kpi.label}</Text>
                <Text style={{ color: '#e2e8f0', fontSize: 16, fontWeight: 'bold' }}>{kpi.value}</Text>
              </Box>
              <Sparkline data={kpi.data} width={80} height={24} color={kpi.color} />
            </Box>
          ))}
        </Box>
      </Box>

      {/* Colors */}
      <Box style={{ gap: 6 }}>
        <Text style={{ color: '#94a3b8', fontSize: 11, fontWeight: 'bold' }}>Colors</Text>
        <Box style={{ gap: 6 }}>
          <Sparkline data={SAMPLE_DATA} color="#3b82f6" width={120} height={20} />
          <Sparkline data={SAMPLE_DATA} color="#22c55e" width={120} height={20} />
          <Sparkline data={SAMPLE_DATA} color="#f59e0b" width={120} height={20} />
          <Sparkline data={SAMPLE_DATA} color="#ef4444" width={120} height={20} />
          <Sparkline data={SAMPLE_DATA} color="#8b5cf6" width={120} height={20} />
        </Box>
      </Box>

    </Box>
  );
}
