import { defineGallerySection, defineGalleryStory } from '../types';
import { ProcessCircle } from '../components/process-circle/ProcessCircle';

export const processCircleSection = defineGallerySection({
  id: 'process-circle',
  title: 'Process Circle',
  stories: [
    defineGalleryStory({
      id: 'process-circle/default',
      title: 'Process Circle',
      source: 'cart/component-gallery/components/process-circle/ProcessCircle.tsx',
      status: 'draft',
      variants: [
        {
          id: 'default',
          name: 'Default',
          render: () => <ProcessCircle />,
        },
      ],
    }),
  ],
});
