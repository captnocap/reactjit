import React from 'react';
import { StoryPage } from './_shared/StoryScaffold';
import { TextEffectsStory } from './TextEffectsStory';

export function TextStory() {
  return (
    <StoryPage>
      <TextEffectsStory index={1} />
    </StoryPage>
  );
}
