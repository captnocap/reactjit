import React from 'react';
import { Box, Text } from '../../../../packages/shared/src';

export function ShadowStory() {
  return (
    <Box style={{ gap: 20, padding: 24 }}>
      <Box style={{
        width: 160, height: 60,
        backgroundColor: '#1e293b',
        borderRadius: 8,
        shadowColor: '#3b82f6',
        shadowOffsetX: 0, shadowOffsetY: 4,
        shadowBlur: 12,
        justifyContent: 'center', alignItems: 'center',
      }}>
        <Text style={{ color: '#e2e8f0', fontSize: 12 }}>Blue glow</Text>
      </Box>

      <Box style={{
        width: 160, height: 60,
        backgroundColor: '#1e293b',
        borderRadius: 8,
        shadowColor: '#000000',
        shadowOffsetX: 4, shadowOffsetY: 4,
        shadowBlur: 8,
        justifyContent: 'center', alignItems: 'center',
      }}>
        <Text style={{ color: '#e2e8f0', fontSize: 12 }}>Drop shadow</Text>
      </Box>

      <Box style={{
        width: 160, height: 60,
        backgroundColor: '#1e293b',
        borderRadius: 8,
        shadowColor: '#ef4444',
        shadowOffsetX: 0, shadowOffsetY: 0,
        shadowBlur: 20,
        justifyContent: 'center', alignItems: 'center',
      }}>
        <Text style={{ color: '#e2e8f0', fontSize: 12 }}>Red halo</Text>
      </Box>
    </Box>
  );
}
