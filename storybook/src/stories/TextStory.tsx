import React from 'react';
import { Box } from '../../../packages/core/src';
import { TextStylesStory } from './TextStyles';
import { TextEffectsStory } from './TextEffectsStory';

export function TextStory() {
  return (
    <Box style={{ width: '100%' }}>
      <TextStylesStory />
      <TextEffectsStory />
    </Box>
  );
}
