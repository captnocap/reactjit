import React from 'react';
import { Box, Text } from '../../../../packages/shared/src';

export function BoxNestedStory() {
  return (
    <Box style={{ gap: 12, padding: 16 }}>
      {/* Nested with padding */}
      <Box style={{
        padding: 16,
        backgroundColor: '#1e293b',
        borderRadius: 8,
      }}>
        <Box style={{
          padding: 12,
          backgroundColor: '#334155',
          borderRadius: 6,
        }}>
          <Box style={{
            padding: 8,
            backgroundColor: '#475569',
            borderRadius: 4,
            alignItems: 'center',
          }}>
            <Text style={{ color: '#e2e8f0', fontSize: 12 }}>3 levels deep</Text>
          </Box>
        </Box>
      </Box>

      {/* Nested with mixed layout */}
      <Box style={{
        padding: 12,
        backgroundColor: '#1a1a2e',
        borderRadius: 8,
        gap: 8,
      }}>
        <Text style={{ color: '#888', fontSize: 11 }}>Parent (column)</Text>
        <Box style={{ flexDirection: 'row', gap: 8, width: '100%', justifyContent: 'space-between' }}>
          <Box style={{
            flexGrow: 1, height: 40,
            backgroundColor: '#e94560',
            borderRadius: 4,
            justifyContent: 'center', alignItems: 'center',
          }}>
            <Text style={{ color: '#fff', fontSize: 11 }}>A</Text>
          </Box>
          <Box style={{
            flexGrow: 1, height: 40,
            backgroundColor: '#0f3460',
            borderRadius: 4,
            justifyContent: 'center', alignItems: 'center',
          }}>
            <Text style={{ color: '#fff', fontSize: 11 }}>B</Text>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
