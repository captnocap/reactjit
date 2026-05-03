import { defineGallerySection, defineGalleryStory } from '../types';
import { VerticalBadge } from '../components/controls-specimen/VerticalBadge';

export const verticalBadgeSection = defineGallerySection({
  id: 'vertical-badge',
  title: 'Vertical Badge',
  stories: [
    defineGalleryStory({
      id: 'vertical-badge/default',
      title: 'Vertical Badge',
      source: 'cart/component-gallery/components/controls-specimen/VerticalBadge.tsx',
      status: 'ready',
      summary: 'Rotated spine label badge with outline and solid treatments.',
      tags: ['controls', 'badge', 'mixed-axis', 'atom'],
      variants: [
        {
          id: 'outline',
          name: 'Outline',
          render: () => <VerticalBadge label="PRIMARY" tone="accent" />,
        },
        {
          id: 'solid',
          name: 'Solid',
          render: () => <VerticalBadge label="ACTIVE" tone="accent" solid={true} />,
        },
      ],
    }),
  ],
});
