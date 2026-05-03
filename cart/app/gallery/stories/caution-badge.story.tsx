import { defineGallerySection, defineGalleryStory } from '../types';
import { CautionBadge } from '../components/controls-specimen/CautionBadge';

export const cautionBadgeSection = defineGallerySection({
  id: 'caution-badge',
  title: 'Caution Badge',
  stories: [
    defineGalleryStory({
      id: 'caution-badge/default',
      title: 'Caution Badge',
      source: 'cart/component-gallery/components/controls-specimen/CautionBadge.tsx',
      status: 'ready',
      summary: 'Solid caution stripe badge for hazard, restriction, and escalation states.',
      tags: ['controls', 'badge', 'atom'],
      variants: [
        {
          id: 'warn',
          name: 'Warn',
          render: () => <CautionBadge label="CAUTION" />,
        },
        {
          id: 'flag',
          name: 'Flag',
          render: () => <CautionBadge label="RAT LOCK" tone="flag" />,
        },
      ],
    }),
  ],
});
