import React from 'react';
import { Box, Text } from '../../../packages/core/src';
import { useThemeColors } from '../../../packages/theme/src';

export function GamesStory() {
  const c = useThemeColors();

  return (
    <Box style={{ width: '100%', height: '100%', backgroundColor: c.bg, padding: 24, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontSize: 16, color: c.textDim }}>Games</Text>
      <Text style={{ fontSize: 11, color: c.muted }}>Game templates have been removed. This story is a placeholder.</Text>
    </Box>
  );
}
