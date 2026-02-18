import React from 'react';
import { Box, Text } from '../../../packages/shared/src';
import { useThemeColors } from '../../../packages/theme/src';

export function BorderRadiusStory() {
  const c = useThemeColors();
  return (
    <Box style={{ width: '100%', gap: 12, padding: 16 }}>
      <Box style={{ flexDirection: 'row', gap: 12, flexWrap: 'wrap' }}>
        {[0, 4, 8, 16, 32, 50].map(r => (
          <Box key={r} style={{
            width: 64, height: 64,
            backgroundColor: c.primary,
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
            backgroundColor: c.bgElevated,
            borderRadius: r,
            borderWidth: 2,
            borderColor: c.success,
            justifyContent: 'center', alignItems: 'center',
          }}>
            <Text style={{ color: c.success, fontSize: 11 }}>{`${r}px`}</Text>
          </Box>
        ))}
      </Box>

      {/* Full circle */}
      <Box style={{
        width: 80, height: 80,
        backgroundColor: c.accent,
        borderRadius: 40,
        justifyContent: 'center', alignItems: 'center',
      }}>
        <Text style={{ color: '#fff', fontSize: 11 }}>Circle</Text>
      </Box>
    </Box>
  );
}
