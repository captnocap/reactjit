import { defineGallerySection, defineGalleryStory } from '../types';
import { UnitRail } from '../components/controls-specimen/UnitRail';

export const unitRailSection = defineGallerySection({
  id: 'unit-rail',
  title: 'Unit Rail',
  stories: [
    defineGalleryStory({
      id: 'unit-rail/default',
      title: 'Unit Rail',
      source: 'cart/component-gallery/components/controls-specimen/UnitRail.tsx',
      status: 'ready',
      summary: 'Vertical unit rail paired with a horizontal numeric readout.',
      tags: ['controls', 'badge', 'mixed-axis', 'atom'],
      variants: [
        {
          id: 'tokens',
          name: 'Tokens',
          render: () => <UnitRail unit="TOKENS" value="128k" sub="ctx · 84%" />,
        },
        {
          id: 'latency',
          name: 'Latency',
          render: () => <UnitRail unit="LATENCY" value="118" sub="ms p95" />,
        },
      ],
    }),
  ],
});
