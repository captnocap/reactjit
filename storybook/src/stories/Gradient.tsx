import React from 'react';
import { Box, Text } from '../../../../packages/shared/src';

export function GradientStory() {
  return (
    <Box style={{ gap: 12, padding: 16 }}>
      <Box style={{
        width: 200, height: 60,
        backgroundGradient: { direction: 'horizontal', colors: ['#3b82f6', '#8b5cf6'] },
        borderRadius: 8,
        justifyContent: 'center', alignItems: 'center',
      }}>
        <Text style={{ color: '#fff', fontSize: 12 }}>Horizontal</Text>
      </Box>

      <Box style={{
        width: 200, height: 60,
        backgroundGradient: { direction: 'vertical', colors: ['#f97316', '#ef4444'] },
        borderRadius: 8,
        justifyContent: 'center', alignItems: 'center',
      }}>
        <Text style={{ color: '#fff', fontSize: 12 }}>Vertical</Text>
      </Box>

      <Box style={{
        width: 200, height: 60,
        backgroundGradient: { direction: 'diagonal', colors: ['#22c55e', '#06b6d4'] },
        borderRadius: 8,
        justifyContent: 'center', alignItems: 'center',
      }}>
        <Text style={{ color: '#fff', fontSize: 12 }}>Diagonal</Text>
      </Box>

      {/* Gradient with Love2D RGBA colors */}
      <Box style={{
        width: 200, height: 60,
        backgroundGradient: { direction: 'horizontal', colors: [[1, 0.8, 0, 1], [1, 0, 0.4, 1]] },
        borderRadius: 8,
        justifyContent: 'center', alignItems: 'center',
      }}>
        <Text style={{ color: '#fff', fontSize: 12 }}>RGBA colors</Text>
      </Box>
    </Box>
  );
}
