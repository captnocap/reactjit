import { defineGallerySection, defineGalleryStory } from '../types';
import { Timeline } from '../components/timeline/Timeline';

export const timelineSection = defineGallerySection({
  id: 'timeline',
  title: 'Timeline',
  stories: [
    defineGalleryStory({
      id: 'timeline/default',
      title: 'Timeline',
      source: 'cart/component-gallery/components/timeline/Timeline.tsx',
      status: 'draft',
      variants: [
        {
          id: 'default',
          name: 'Default',
          render: () => <Timeline />,
        },
      ],
    }),
  ],
});
