import { defineGallerySection, defineGalleryStory } from '../types';
import { ScaleLabelCard } from '../components/controls-specimen/ScaleLabelCard';

export const scaleLabelCardSection = defineGallerySection({
  id: "scale-label-card",
  title: "Scale Label Card",
  stories: [
    defineGalleryStory({
      id: "scale-label-card/default",
      title: "Scale Label Card",
      source: "cart/component-gallery/components/controls-specimen/ScaleLabelCard.tsx",
      status: 'ready',
      summary: 'Readout card with vertical unit rails and inline spark bars.',
      tags: ['controls', 'mixed-axis', 'metric', 'atom'],
      variants: [
        {
          id: 'default',
          name: 'Default',
          render: () => <ScaleLabelCard />,
        },
      ],
    }),
  ],
});
