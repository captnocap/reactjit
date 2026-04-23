import { defineGallerySection, defineGalleryStory } from '../types';
import { BubbleCorrelation } from '../components/bubble-correlation/BubbleCorrelation';

export const bubbleCorrelationSection = defineGallerySection({
  id: 'bubble-correlation',
  title: 'Bubble Correlation',
  stories: [
    defineGalleryStory({
      id: 'bubble-correlation/default',
      title: 'Bubble Correlation',
      source: 'cart/component-gallery/components/bubble-correlation/BubbleCorrelation.tsx',
      status: 'draft',
      variants: [
        {
          id: 'default',
          name: 'Default',
          render: () => <BubbleCorrelation />,
        },
      ],
    }),
  ],
});
