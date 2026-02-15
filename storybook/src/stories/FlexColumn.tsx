import React from 'react';
import { Box, Text } from '../../../../packages/shared/src';

function Bar({ label, color }: { label: string; color: string }) {
  return (
    <Box style={{
      height: 28,
      backgroundColor: color,
      borderRadius: 3,
      justifyContent: 'center',
      paddingLeft: 8, paddingRight: 8,
    }}>
      <Text style={{ color: '#fff', fontSize: 11 }}>{label}</Text>
    </Box>
  );
}

export function FlexColumnStory() {
  return (
    <Box style={{ flexDirection: 'row', gap: 12, padding: 16 }}>
      {/* alignItems: start */}
      <Box style={{
        width: 120, height: 200,
        backgroundColor: '#1e293b', padding: 8, borderRadius: 4, gap: 6,
        alignItems: 'start',
      }}>
        <Text style={{ color: '#888', fontSize: 9 }}>align: start</Text>
        <Bar label="Short" color="#ef4444" />
        <Bar label="Medium text" color="#f97316" />
        <Bar label="Long label here" color="#eab308" />
      </Box>

      {/* alignItems: center */}
      <Box style={{
        width: 120, height: 200,
        backgroundColor: '#1e293b', padding: 8, borderRadius: 4, gap: 6,
        alignItems: 'center',
      }}>
        <Text style={{ color: '#888', fontSize: 9 }}>align: center</Text>
        <Bar label="Short" color="#22c55e" />
        <Bar label="Medium text" color="#14b8a6" />
        <Bar label="Long label here" color="#06b6d4" />
      </Box>

      {/* alignItems: end */}
      <Box style={{
        width: 120, height: 200,
        backgroundColor: '#1e293b', padding: 8, borderRadius: 4, gap: 6,
        alignItems: 'end',
      }}>
        <Text style={{ color: '#888', fontSize: 9 }}>align: end</Text>
        <Bar label="Short" color="#3b82f6" />
        <Bar label="Medium text" color="#6366f1" />
        <Bar label="Long label here" color="#8b5cf6" />
      </Box>
    </Box>
  );
}
