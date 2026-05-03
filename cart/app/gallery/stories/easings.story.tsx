import { defineGallerySection, defineGalleryStory } from '../types';
import { Easings } from '../components/easings/Easings';

export const easingsSection = defineGallerySection({
  id: 'easings',
  title: 'Easings',
  stories: [
    defineGalleryStory({
      id: 'easings/default',
      title: 'Easings',
      source: 'cart/component-gallery/components/easings/Easings.tsx',
      status: 'draft',
      tags: ['hooks', 'animation'],
      variants: [
        {
          id: 'default',
          name: 'Default',
          render: () => <Easings />,
        },
      ],
    }),
  ],
});
