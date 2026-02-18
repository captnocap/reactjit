import React from 'react';
import { Box, Text } from '../../../packages/shared/src';
import { useThemeColors } from '../../../packages/theme/src';

export function BoxNestedStory() {
  const c = useThemeColors();
  return (
    <Box style={{ width: '100%', gap: 12, padding: 16 }}>
      {/* Nested with padding */}
      <Box style={{
        padding: 16,
        backgroundColor: c.bgElevated,
        borderRadius: 8,
      }}>
        <Box style={{
          padding: 12,
          backgroundColor: c.surface,
          borderRadius: 6,
        }}>
          <Box style={{
            padding: 8,
            backgroundColor: '#475569',
            borderRadius: 4,
            alignItems: 'center',
          }}>
            <Text style={{ color: c.text, fontSize: 12 }}>3 levels deep</Text>
          </Box>
        </Box>
      </Box>

      {/* Nested with mixed layout */}
      <Box style={{
        padding: 12,
        backgroundColor: c.bgElevated,
        borderRadius: 8,
        gap: 8,
      }}>
        <Text style={{ color: c.textDim, fontSize: 11 }}>Parent (column)</Text>
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
