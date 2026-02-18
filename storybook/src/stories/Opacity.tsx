import React from 'react';
import { Box, Text } from '../../../packages/shared/src';
import { useThemeColors } from '../../../packages/theme/src';

export function OpacityStory() {
  const c = useThemeColors();
  return (
    <Box style={{ width: '100%', gap: 12, padding: 16 }}>
      {/* Opacity levels */}
      <Box style={{ flexDirection: 'row', gap: 8 }}>
        {[1.0, 0.75, 0.5, 0.25, 0.1].map(op => (
          <Box key={op} style={{
            width: 50, height: 50,
            backgroundColor: c.primary,
            borderRadius: 4,
            opacity: op,
            justifyContent: 'center', alignItems: 'center',
          }}>
            <Text style={{ color: '#fff', fontSize: 10 }}>{op}</Text>
          </Box>
        ))}
      </Box>

      {/* Nested opacity stacking */}
      <Box style={{ backgroundColor: c.bgElevated, padding: 8, borderRadius: 4, gap: 4 }}>
        <Text style={{ color: c.textDim, fontSize: 10 }}>Nested opacity (should multiply)</Text>
        <Box style={{ opacity: 0.8, padding: 8, backgroundColor: '#ef4444', borderRadius: 4 }}>
          <Text style={{ color: '#fff', fontSize: 11 }}>Parent: 0.8</Text>
          <Box style={{ opacity: 0.5, padding: 8, marginTop: 4, backgroundColor: '#f97316', borderRadius: 4 }}>
            <Text style={{ color: '#fff', fontSize: 11 }}>Child: 0.5 (effective: 0.4)</Text>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
