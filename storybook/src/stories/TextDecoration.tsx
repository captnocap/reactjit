import React from 'react';
import { Box, Text } from '../../../packages/shared/src';
import { useThemeColors } from '../../../packages/theme/src';

export function TextDecorationStory() {
  const c = useThemeColors();
  return (
    <Box style={{ width: '100%', gap: 16, padding: 16 }}>
      {/* Underline */}
      <Box style={{ backgroundColor: c.bgElevated, padding: 8, borderRadius: 4, gap: 8 }}>
        <Text style={{ color: c.textDim, fontSize: 10 }}>textDecorationLine</Text>

        <Text style={{ color: c.text, fontSize: 16, textDecorationLine: 'underline' }}>
          Underlined text
        </Text>

        <Text style={{ color: c.primary, fontSize: 14, textDecorationLine: 'line-through' }}>
          Strikethrough text
        </Text>

        <Text style={{ color: c.success, fontSize: 14, textDecorationLine: 'none' }}>
          No decoration (explicit none)
        </Text>
      </Box>

      {/* Combined with bold */}
      <Box style={{ backgroundColor: c.bgElevated, padding: 8, borderRadius: 4, gap: 8 }}>
        <Text style={{ color: c.textDim, fontSize: 10 }}>Combined with fontWeight</Text>

        <Text style={{ color: c.warning, fontSize: 16, fontWeight: 'bold', textDecorationLine: 'underline' }}>
          Bold + Underline
        </Text>

        <Text style={{ color: c.error, fontSize: 14, fontWeight: 'bold', textDecorationLine: 'line-through' }}>
          Bold + Strikethrough
        </Text>
      </Box>

      {/* Different sizes */}
      <Box style={{ backgroundColor: c.bgElevated, padding: 8, borderRadius: 4, gap: 8 }}>
        <Text style={{ color: c.textDim, fontSize: 10 }}>Various sizes</Text>

        <Text style={{ color: c.text, fontSize: 10, textDecorationLine: 'underline' }}>
          Small underlined (10px)
        </Text>
        <Text style={{ color: c.text, fontSize: 16, textDecorationLine: 'underline' }}>
          Medium underlined (16px)
        </Text>
        <Text style={{ color: c.text, fontSize: 22, textDecorationLine: 'underline' }}>
          Large underlined (22px)
        </Text>
      </Box>
    </Box>
  );
}
