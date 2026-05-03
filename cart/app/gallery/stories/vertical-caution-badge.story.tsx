import { defineGallerySection, defineGalleryStory } from '../types';
import { VerticalCautionBadge } from '../components/controls-specimen/VerticalCautionBadge';

export const verticalCautionBadgeSection = defineGallerySection({
  id: 'vertical-caution-badge',
  title: 'Vertical Caution Badge',
  stories: [
    defineGalleryStory({
      id: 'vertical-caution-badge/default',
      title: 'Vertical Caution Badge',
      source: 'cart/component-gallery/components/controls-specimen/VerticalCautionBadge.tsx',
      status: 'ready',
      summary: 'Rotated hazard stripe badge for narrow mixed-axis warning states.',
      tags: ['controls', 'badge', 'mixed-axis', 'atom'],
      variants: [
        {
          id: 'warn',
          name: 'Warn',
          render: () => <VerticalCautionBadge label="CAUTION" />,
        },
        {
          id: 'flag',
          name: 'Flag',
          render: () => <VerticalCautionBadge label="RAT LOCK" tone="flag" />,
        },
      ],
    }),
  ],
});
