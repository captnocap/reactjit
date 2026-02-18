import React from 'react';
import { Box, Text } from '../../../packages/shared/src';
import { useThemeColors } from '../../../packages/theme/src';

const COLORS = [
  '#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6',
  '#06b6d4', '#3b82f6', '#6366f1', '#8b5cf6', '#ec4899',
];

export function FlexWrapStory() {
  const c = useThemeColors();
  return (
    <Box style={{ width: '100%', gap: 16, padding: 16 }}>
      {/* Wrap with gap */}
      <Box style={{ backgroundColor: c.bgElevated, padding: 8, borderRadius: 4, gap: 4 }}>
        <Text style={{ color: c.textDim, fontSize: 10 }}>flexWrap + gap: 6</Text>
        <Box style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: 6,
        }}>
          {COLORS.map((color, i) => (
            <Box key={i} style={{
              width: 44, height: 44,
              backgroundColor: color,
              borderRadius: 4,
              justifyContent: 'center',
              alignItems: 'center',
            }}>
              <Text style={{ color: '#fff', fontSize: 10 }}>{i + 1}</Text>
            </Box>
          ))}
        </Box>
      </Box>

      {/* Wrap with flexGrow children */}
      <Box style={{ backgroundColor: c.bgElevated, padding: 8, borderRadius: 4, gap: 4 }}>
        <Text style={{ color: c.textDim, fontSize: 10 }}>flexWrap + flexGrow</Text>
        <Box style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: 6,
        }}>
          {['Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon'].map((name, i) => (
            <Box key={i} style={{
              flexBasis: 80,
              flexGrow: 1,
              height: 32,
              backgroundColor: COLORS[i],
              borderRadius: 3,
              justifyContent: 'center',
              alignItems: 'center',
            }}>
              <Text style={{ color: '#fff', fontSize: 10 }}>{name}</Text>
            </Box>
          ))}
        </Box>
      </Box>
    </Box>
  );
}
