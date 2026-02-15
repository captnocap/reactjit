import React from 'react';
import { Box, Text } from '../../../../packages/shared/src';

export function BorderRadiusStory() {
  return (
    <Box style={{ gap: 12, padding: 16 }}>
      <Box style={{ flexDirection: 'row', gap: 12, flexWrap: 'wrap' }}>
        {[0, 4, 8, 16, 32, 50].map(r => (
          <Box key={r} style={{
            width: 64, height: 64,
            backgroundColor: '#3b82f6',
            borderRadius: r,
            justifyContent: 'center', alignItems: 'center',
          }}>
            <Text style={{ color: '#fff', fontSize: 11 }}>{`${r}px`}</Text>
          </Box>
        ))}
      </Box>

      {/* Border radius with border */}
      <Box style={{ flexDirection: 'row', gap: 12, flexWrap: 'wrap' }}>
        {[0, 8, 16, 32].map(r => (
          <Box key={r} style={{
            width: 64, height: 64,
            backgroundColor: '#1e293b',
            borderRadius: r,
            borderWidth: 2,
            borderColor: '#22c55e',
            justifyContent: 'center', alignItems: 'center',
          }}>
            <Text style={{ color: '#22c55e', fontSize: 11 }}>{`${r}px`}</Text>
          </Box>
        ))}
      </Box>

      {/* Full circle */}
      <Box style={{
        width: 80, height: 80,
        backgroundColor: '#8b5cf6',
        borderRadius: 40,
        justifyContent: 'center', alignItems: 'center',
      }}>
        <Text style={{ color: '#fff', fontSize: 11 }}>Circle</Text>
      </Box>
    </Box>
  );
}
