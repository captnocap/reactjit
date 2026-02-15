import React from 'react';
import { Box, Text } from '../../../../packages/shared/src';

export function ZIndexStory() {
  return (
    <Box style={{ gap: 16, padding: 16 }}>
      <Text style={{ color: '#888', fontSize: 10 }}>Overlapping boxes with zIndex</Text>

      <Box style={{ height: 120, position: 'relative' }}>
        <Box style={{
          position: 'absolute', top: 0, left: 0,
          width: 80, height: 80,
          backgroundColor: '#ef4444',
          borderRadius: 4,
          zIndex: 1,
          justifyContent: 'center', alignItems: 'center',
        }}>
          <Text style={{ color: '#fff', fontSize: 11 }}>z: 1</Text>
        </Box>

        <Box style={{
          position: 'absolute', top: 20, left: 30,
          width: 80, height: 80,
          backgroundColor: '#3b82f6',
          borderRadius: 4,
          zIndex: 3,
          justifyContent: 'center', alignItems: 'center',
        }}>
          <Text style={{ color: '#fff', fontSize: 11 }}>z: 3</Text>
        </Box>

        <Box style={{
          position: 'absolute', top: 40, left: 60,
          width: 80, height: 80,
          backgroundColor: '#22c55e',
          borderRadius: 4,
          zIndex: 2,
          justifyContent: 'center', alignItems: 'center',
        }}>
          <Text style={{ color: '#fff', fontSize: 11 }}>z: 2</Text>
        </Box>
      </Box>

      <Text style={{ color: '#666', fontSize: 10 }}>Blue (z:3) should be on top</Text>
    </Box>
  );
}
