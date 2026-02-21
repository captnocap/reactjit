import React from 'react';
import { Box } from '../../../packages/shared/src';
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
