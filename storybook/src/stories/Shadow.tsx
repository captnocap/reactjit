import React from 'react';
import { Box, Text } from '../../../packages/shared/src';
import { useThemeColors } from '../../../packages/theme/src';

export function ShadowStory() {
  const c = useThemeColors();
  return (
    <Box style={{ width: '100%', gap: 20, padding: 24 }}>
      <Box style={{
        width: 160, height: 60,
        backgroundColor: c.bgElevated,
        borderRadius: 8,
        shadowColor: c.primary,
        shadowOffsetX: 0, shadowOffsetY: 4,
        shadowBlur: 12,
        justifyContent: 'center', alignItems: 'center',
      }}>
        <Text style={{ color: c.text, fontSize: 12 }}>Blue glow</Text>
      </Box>

      <Box style={{
        width: 160, height: 60,
        backgroundColor: c.bgElevated,
        borderRadius: 8,
        shadowColor: '#000000',
        shadowOffsetX: 4, shadowOffsetY: 4,
        shadowBlur: 8,
        justifyContent: 'center', alignItems: 'center',
      }}>
        <Text style={{ color: c.text, fontSize: 12 }}>Drop shadow</Text>
      </Box>

      <Box style={{
        width: 160, height: 60,
        backgroundColor: c.bgElevated,
        borderRadius: 8,
        shadowColor: c.error,
        shadowOffsetX: 0, shadowOffsetY: 0,
        shadowBlur: 20,
        justifyContent: 'center', alignItems: 'center',
      }}>
        <Text style={{ color: c.text, fontSize: 12 }}>Red halo</Text>
      </Box>
    </Box>
  );
}
