import { defineGallerySection, defineGalleryStory } from '../types';
import { PrefixDataCard } from '../components/controls-specimen/PrefixDataCard';

export const prefixDataCardSection = defineGallerySection({
  id: 'prefix-data-card',
  title: 'Prefix Data Card',
  stories: [
    defineGalleryStory({
      id: 'prefix-data-card/default',
      title: 'Prefix Data Card',
      source: 'cart/component-gallery/components/controls-specimen/PrefixDataCard.tsx',
      status: 'ready',
      summary: 'Card with a vertical prefix tab and horizontal metadata copy block.',
      tags: ['controls', 'badge', 'mixed-axis', 'atom'],
      variants: [
        {
          id: 'run',
          name: 'Run',
          render: () => <PrefixDataCard prefix="RUN" headline="#8241 · auth-flow" subline="STARTED · 14:02Z · 4m12s" />,
        },
        {
          id: 'error',
          name: 'Error',
          render: () => <PrefixDataCard prefix="ERR" tone="flag" headline="E·142 · OOM" subline="worker · W·02 · retry 3/3" />,
        },
      ],
    }),
  ],
});
