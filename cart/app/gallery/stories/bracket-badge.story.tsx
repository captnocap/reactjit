import { defineGallerySection, defineGalleryStory } from '../types';
import { BracketBadge } from '../components/controls-specimen/BracketBadge';

export const bracketBadgeSection = defineGallerySection({
  id: 'bracket-badge',
  title: 'Bracket Badge',
  stories: [
    defineGalleryStory({
      id: 'bracket-badge/default',
      title: 'Bracket Badge',
      source: 'cart/component-gallery/components/controls-specimen/BracketBadge.tsx',
      status: 'ready',
      summary: 'Typographic inline badge framed by configurable bracket characters.',
      tags: ['controls', 'badge', 'atom'],
      variants: [
        {
          id: 'default',
          name: 'Default',
          render: () => <BracketBadge left="[" right="]" value="128k" />,
        },
        {
          id: 'alert',
          name: 'Alert',
          render: () => <BracketBadge left="[" right="]" value="OOM" tone="flag" />,
        },
      ],
    }),
  ],
});
