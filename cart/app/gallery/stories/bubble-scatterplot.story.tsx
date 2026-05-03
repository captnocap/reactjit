import { defineGallerySection, defineGalleryStory } from '../types';
import { BubbleScatterplot } from '../components/bubble-scatterplot/BubbleScatterplot';

export const bubbleScatterplotSection = defineGallerySection({
  id: 'bubble-scatterplot',
  title: 'Bubble Scatterplot',
  stories: [
    defineGalleryStory({
      id: 'bubble-scatterplot/default',
      title: 'Bubble Scatterplot',
      source: 'cart/component-gallery/components/bubble-scatterplot/BubbleScatterplot.tsx',
      status: 'draft',
      variants: [
        {
          id: 'default',
          name: 'Default',
          render: () => <BubbleScatterplot />,
        },
      ],
    }),
  ],
});
