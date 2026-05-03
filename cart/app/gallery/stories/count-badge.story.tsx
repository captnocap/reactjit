import { defineGallerySection, defineGalleryStory } from '../types';
import { CountBadge } from '../components/controls-specimen/CountBadge';

export const countBadgeSection = defineGallerySection({
  id: 'count-badge',
  title: 'Count Badge',
  stories: [
    defineGalleryStory({
      id: 'count-badge/default',
      title: 'Count Badge',
      source: 'cart/component-gallery/components/controls-specimen/CountBadge.tsx',
      status: 'ready',
      summary: 'Micro label plus framed numeric readout for counters and totals.',
      tags: ['controls', 'badge', 'atom'],
      variants: [
        {
          id: 'workers',
          name: 'Workers',
          render: () => <CountBadge label="WORKERS" value="08" tone="accent" />,
        },
        {
          id: 'flag',
          name: 'Flag',
          render: () => <CountBadge label="FLAG" value="02" tone="flag" />,
        },
      ],
    }),
  ],
});
