import { defineGallerySection, defineGalleryStory } from '../types';
import { StripBadge } from '../components/controls-specimen/StripBadge';

export const stripBadgeSection = defineGallerySection({
  id: 'strip-badge',
  title: 'Strip Badge',
  stories: [
    defineGalleryStory({
      id: 'strip-badge/default',
      title: 'Strip Badge',
      source: 'cart/component-gallery/components/controls-specimen/StripBadge.tsx',
      status: 'ready',
      summary: 'Multi-segment inline strip for compact route, state, and value tags.',
      tags: ['controls', 'badge', 'atom'],
      variants: [
        {
          id: 'live',
          name: 'Live',
          render: () => <StripBadge segments={[{ label: 'W·02', tone: 'accent' }, { label: 'THINKING' }, { label: '4m12s' }]} />,
        },
        {
          id: 'fail',
          name: 'Fail',
          render: () => <StripBadge segments={[{ label: 'FAIL', tone: 'flag' }, { label: 'T-059' }, { label: 'ret×3' }]} />,
        },
      ],
    }),
  ],
});
