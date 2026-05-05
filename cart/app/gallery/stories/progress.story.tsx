import { defineGallerySection, defineGalleryStory } from '../types';
import { Progress } from '../components/progress/Progress';

export const progressSection = defineGallerySection({
  id: 'progress',
  title: 'Progress',
  stories: [
    defineGalleryStory({
      id: 'progress/default',
      title: 'Progress',
      source: 'cart/app/gallery/components/progress/Progress.tsx',
      status: 'draft',
      variants: [
        {
          id: 'default',
          name: 'Default',
          render: () => <Progress />,
        },
      ],
    }),
  ],
});
