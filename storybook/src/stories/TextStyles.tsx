import React from 'react';
import { Box, Text } from '../../../packages/shared/src';
import { useThemeColors } from '../../../packages/theme/src';

export function TextStylesStory() {
  const c = useThemeColors();
  return (
    <Box style={{ width: '100%', gap: 12, padding: 16 }}>
      <Text style={{ color: c.text, fontSize: 24, fontWeight: 'bold' }}>
        Bold 24px
      </Text>

      <Text style={{ color: c.textSecondary, fontSize: 16 }}>
        Regular 16px gray
      </Text>

      <Text style={{ color: c.primary, fontSize: 14, letterSpacing: 2 }}>
        Letter spacing 2px
      </Text>

      <Text style={{ color: c.warning, fontSize: 14, lineHeight: 28 }}>
        Line height 28px - this text demonstrates how line height affects
        the spacing between lines when the text wraps to multiple lines
      </Text>

      {/* Text alignment */}
      <Box style={{
        width: 200,
        padding: 8,
        backgroundColor: c.bgElevated,
        borderRadius: 4,
        gap: 4,
      }}>
        <Text style={{ color: c.text, fontSize: 12, textAlign: 'left' }}>
          Left aligned
        </Text>
        <Text style={{ color: c.text, fontSize: 12, textAlign: 'center' }}>
          Center aligned
        </Text>
        <Text style={{ color: c.text, fontSize: 12, textAlign: 'right' }}>
          Right aligned
        </Text>
      </Box>

      {/* Love2D RGBA color */}
      <Text style={{ color: [0.2, 0.8, 0.4, 1], fontSize: 16 }}>
        Love2D RGBA green
      </Text>
    </Box>
  );
}
