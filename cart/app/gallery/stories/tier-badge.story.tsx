import { defineGallerySection, defineGalleryStory } from '../types';
import { TierBadge } from '../components/controls-specimen/TierBadge';

export const tierBadgeSection = defineGallerySection({
  id: 'tier-badge',
  title: 'Tier Badge',
  stories: [
    defineGalleryStory({
      id: 'tier-badge/default',
      title: 'Tier Badge',
      source: 'cart/component-gallery/components/controls-specimen/TierBadge.tsx',
      status: 'ready',
      summary: 'Flat tier chip for severity, queue rank, and incident priority labels.',
      tags: ['controls', 'badge', 'atom'],
      variants: [
        {
          id: 'p0',
          name: 'P0',
          render: () => <TierBadge label="P0" tone="ink" />,
        },
        {
          id: 'warn',
          name: 'Warn',
          render: () => <TierBadge label="T2" tone="warn" />,
        },
        {
          id: 'flag',
          name: 'Flag',
          render: () => <TierBadge label="CRIT" tone="flag" />,
        },
      ],
    }),
  ],
});
