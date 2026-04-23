import { defineGallerySection, defineGalleryStory } from '../types';
import { CircularProgress } from '../components/circular-progress/CircularProgress';

export const circularProgressSection = defineGallerySection({
  id: 'circular-progress',
  title: 'Circular Progress',
  stories: [
    defineGalleryStory({
      id: 'circular-progress/default',
      title: 'Circular Progress',
      source: 'cart/component-gallery/components/circular-progress/CircularProgress.tsx',
      status: 'draft',
      variants: [
        {
          id: 'default',
          name: 'Default',
          render: () => <CircularProgress />,
        },
      ],
    }),
  ],
});
