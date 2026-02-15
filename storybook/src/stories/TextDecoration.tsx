import React from 'react';
import { Box, Text } from '../../../../packages/shared/src';

export function TextDecorationStory() {
  return (
    <Box style={{ gap: 16, padding: 16 }}>
      {/* Underline */}
      <Box style={{ backgroundColor: '#1e293b', padding: 8, borderRadius: 4, gap: 8 }}>
        <Text style={{ color: '#888', fontSize: 10 }}>textDecorationLine</Text>

        <Text style={{ color: '#e2e8f0', fontSize: 16, textDecorationLine: 'underline' }}>
          Underlined text
        </Text>

        <Text style={{ color: '#3b82f6', fontSize: 14, textDecorationLine: 'line-through' }}>
          Strikethrough text
        </Text>

        <Text style={{ color: '#22c55e', fontSize: 14, textDecorationLine: 'none' }}>
          No decoration (explicit none)
        </Text>
      </Box>

      {/* Combined with bold */}
      <Box style={{ backgroundColor: '#1e293b', padding: 8, borderRadius: 4, gap: 8 }}>
        <Text style={{ color: '#888', fontSize: 10 }}>Combined with fontWeight</Text>

        <Text style={{ color: '#f59e0b', fontSize: 16, fontWeight: 'bold', textDecorationLine: 'underline' }}>
          Bold + Underline
        </Text>

        <Text style={{ color: '#ef4444', fontSize: 14, fontWeight: 'bold', textDecorationLine: 'line-through' }}>
          Bold + Strikethrough
        </Text>
      </Box>

      {/* Different sizes */}
      <Box style={{ backgroundColor: '#1e293b', padding: 8, borderRadius: 4, gap: 8 }}>
        <Text style={{ color: '#888', fontSize: 10 }}>Various sizes</Text>

        <Text style={{ color: '#e2e8f0', fontSize: 10, textDecorationLine: 'underline' }}>
          Small underlined (10px)
        </Text>
        <Text style={{ color: '#e2e8f0', fontSize: 16, textDecorationLine: 'underline' }}>
          Medium underlined (16px)
        </Text>
        <Text style={{ color: '#e2e8f0', fontSize: 22, textDecorationLine: 'underline' }}>
          Large underlined (22px)
        </Text>
      </Box>
    </Box>
  );
}
