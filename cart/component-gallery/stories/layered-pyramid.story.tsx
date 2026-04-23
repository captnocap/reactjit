import { defineGallerySection, defineGalleryStory } from '../types';
import { LayeredPyramid } from '../components/layered-pyramid/LayeredPyramid';

export const layeredPyramidSection = defineGallerySection({
  id: 'layered-pyramid',
  title: 'Layered Pyramid',
  stories: [
    defineGalleryStory({
      id: 'layered-pyramid/default',
      title: 'Layered Pyramid',
      source: 'cart/component-gallery/components/layered-pyramid/LayeredPyramid.tsx',
      status: 'draft',
      variants: [
        {
          id: 'default',
          name: 'Default',
          render: () => <LayeredPyramid />,
        },
      ],
    }),
  ],
});
