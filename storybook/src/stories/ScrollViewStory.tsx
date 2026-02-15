import React from 'react';
import { Box, Text, ScrollView } from '../../../../packages/shared/src';

const COLORS = [
  '#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6',
  '#06b6d4', '#3b82f6', '#6366f1', '#8b5cf6', '#ec4899',
  '#f43f5e', '#a855f7', '#d946ef', '#84cc16', '#10b981',
];

export function ScrollViewStory() {
  return (
    <Box style={{ gap: 12, padding: 16 }}>
      {/* Vertical scroll */}
      <Box style={{ gap: 4 }}>
        <Text style={{ color: '#888', fontSize: 10 }}>Vertical scroll (height: 150)</Text>
        <ScrollView style={{ height: 150, backgroundColor: '#1e293b', borderRadius: 4, padding: 8 }}>
          {COLORS.map((color, i) => (
            <Box key={i} style={{
              height: 32, marginBottom: 4,
              backgroundColor: color,
              borderRadius: 3,
              justifyContent: 'center',
              paddingLeft: 8,
            }}>
              <Text style={{ color: '#fff', fontSize: 11 }}>{`Item ${i + 1}`}</Text>
            </Box>
          ))}
        </ScrollView>
      </Box>

      {/* Horizontal scroll */}
      <Box style={{ gap: 4 }}>
        <Text style={{ color: '#888', fontSize: 10 }}>Horizontal scroll</Text>
        <ScrollView
          horizontal
          style={{ height: 60, backgroundColor: '#1e293b', borderRadius: 4, padding: 8 }}
        >
          {COLORS.map((color, i) => (
            <Box key={i} style={{
              width: 60, height: 44,
              backgroundColor: color,
              borderRadius: 3,
              marginRight: 4,
              justifyContent: 'center',
              alignItems: 'center',
            }}>
              <Text style={{ color: '#fff', fontSize: 10 }}>{i + 1}</Text>
            </Box>
          ))}
        </ScrollView>
      </Box>
    </Box>
  );
}
