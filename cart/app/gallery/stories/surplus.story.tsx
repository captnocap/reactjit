import { defineGallerySection, defineGalleryStory } from '../types';
import { Surplus } from '../components/surplus/Surplus';

export const surplusSection = defineGallerySection({
  id: 'surplus',
  title: 'Surplus',
  stories: [
    defineGalleryStory({
      id: 'surplus/default',
      title: 'Surplus',
      source: 'cart/app/gallery/components/surplus/Surplus.tsx',
      status: 'draft',
      variants: [
        {
          id: 'default',
          name: 'Default',
          render: () => <Surplus />,
        },
      ],
    }),
  ],
});
