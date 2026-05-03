import { defineGallerySection, defineGalleryStory } from '../types';
import { TotemStack } from '../components/controls-specimen/TotemStack';

export const totemStackSection = defineGallerySection({
  id: 'totem-stack',
  title: 'Totem Stack',
  stories: [
    defineGalleryStory({
      id: 'totem-stack/default',
      title: 'Totem Stack',
      source: 'cart/component-gallery/components/controls-specimen/TotemStack.tsx',
      status: 'ready',
      summary: 'Stacked vertical status totem for compact mixed-axis state summaries.',
      tags: ['controls', 'badge', 'mixed-axis', 'atom'],
      variants: [
        {
          id: 'live',
          name: 'Live',
          render: () => <TotemStack segments={[{ label: 'LIVE', tone: 'accent' }, { label: 'W · 02' }, { label: '4m12s' }]} />,
        },
        {
          id: 'fail',
          name: 'Fail',
          render: () => <TotemStack segments={[{ label: 'FAIL', tone: 'flag' }, { label: 'T-059' }, { label: 'ret×3' }]} />,
        },
      ],
    }),
  ],
});
