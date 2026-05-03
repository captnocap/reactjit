import { defineGallerySection, defineGalleryStory } from '../types';
import { PopulationPyramid } from '../components/population-pyramid/PopulationPyramid';

export const populationPyramidSection = defineGallerySection({
  id: 'population-pyramid',
  title: 'Population Pyramid',
  stories: [
    defineGalleryStory({
      id: 'population-pyramid/default',
      title: 'Population Pyramid',
      source: 'cart/component-gallery/components/population-pyramid/PopulationPyramid.tsx',
      status: 'draft',
      variants: [
        {
          id: 'default',
          name: 'Default',
          render: () => <PopulationPyramid />,
        },
      ],
    }),
  ],
});
