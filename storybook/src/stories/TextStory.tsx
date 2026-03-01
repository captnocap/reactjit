import React from 'react';
import { StoryPage } from './_shared/StoryScaffold';
import { TextStylesStory } from './TextStyles';
import { TextEffectsStory } from './TextEffectsStory';

export function TextStory() {
  return (
    <StoryPage>
      <TextStylesStory />
      <TextEffectsStory index={5} />
    </StoryPage>
  );
}
