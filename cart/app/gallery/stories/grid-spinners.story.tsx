import { defineGallerySection, defineGalleryStory } from '../types';
import { GridSpinners } from '../components/grid-spinners/GridSpinners';

export const gridSpinnersSection = defineGallerySection({
  id: 'grid-spinners',
  title: 'Grid Spinners',
  stories: [
    defineGalleryStory({
      id: 'grid-spinners/default',
      title: 'Grid Spinners',
      source: 'cart/component-gallery/components/grid-spinners/GridSpinners.tsx',
      status: 'draft',
      tags: ['animation'],
      variants: [
        {
          id: 'default',
          name: 'Default',
          render: () => <GridSpinners />,
        },
      ],
    }),
  ],
});
