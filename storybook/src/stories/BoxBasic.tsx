import React from 'react';
import { Box, Text } from '../../../../packages/shared/src';

export function BoxBasicStory() {
  return (
    <Box style={{ gap: 12, padding: 16 }}>
      {/* Simple colored box */}
      <Box style={{
        width: 120, height: 60,
        backgroundColor: '#3b82f6',
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center',
      }}>
        <Text style={{ color: '#ffffff', fontSize: 14 }}>Blue</Text>
      </Box>

      {/* Box with Love2D-style RGBA color */}
      <Box style={{
        width: 120, height: 60,
        backgroundColor: [0.9, 0.3, 0.3, 1],
        borderRadius: 4,
        justifyContent: 'center',
        alignItems: 'center',
      }}>
        <Text style={{ color: '#ffffff', fontSize: 14 }}>Red (RGBA)</Text>
      </Box>

      {/* Box with border */}
      <Box style={{
        width: 120, height: 60,
        backgroundColor: '#1a1a2e',
        borderWidth: 2,
        borderColor: '#e94560',
        borderRadius: 6,
        justifyContent: 'center',
        alignItems: 'center',
      }}>
        <Text style={{ color: '#e94560', fontSize: 14 }}>Bordered</Text>
      </Box>

      {/* Box with no border radius (sharp corners) */}
      <Box style={{
        width: 120, height: 60,
        backgroundColor: '#16213e',
        borderWidth: 1,
        borderColor: '#533483',
        justifyContent: 'center',
        alignItems: 'center',
      }}>
        <Text style={{ color: '#533483', fontSize: 14 }}>Sharp</Text>
      </Box>
    </Box>
  );
}
