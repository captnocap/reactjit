import React from 'react';
import { Box, Text } from '../../../../packages/shared/src';

export function TextStylesStory() {
  return (
    <Box style={{ gap: 12, padding: 16 }}>
      <Text style={{ color: '#ffffff', fontSize: 24, fontWeight: 'bold' }}>
        Bold 24px
      </Text>

      <Text style={{ color: '#94a3b8', fontSize: 16 }}>
        Regular 16px gray
      </Text>

      <Text style={{ color: '#3b82f6', fontSize: 14, letterSpacing: 2 }}>
        Letter spacing 2px
      </Text>

      <Text style={{ color: '#f59e0b', fontSize: 14, lineHeight: 28 }}>
        Line height 28px - this text demonstrates how line height affects
        the spacing between lines when the text wraps to multiple lines
      </Text>

      {/* Text alignment */}
      <Box style={{
        width: 200,
        padding: 8,
        backgroundColor: '#1e293b',
        borderRadius: 4,
        gap: 4,
      }}>
        <Text style={{ color: '#e2e8f0', fontSize: 12, textAlign: 'left' }}>
          Left aligned
        </Text>
        <Text style={{ color: '#e2e8f0', fontSize: 12, textAlign: 'center' }}>
          Center aligned
        </Text>
        <Text style={{ color: '#e2e8f0', fontSize: 12, textAlign: 'right' }}>
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
