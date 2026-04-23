import { defineGallerySection, defineGalleryStory } from '../types';
import { Scatterplot } from '../components/scatterplot/Scatterplot';

export const scatterplotSection = defineGallerySection({
  id: 'scatterplot',
  title: 'Scatterplot',
  stories: [
    defineGalleryStory({
      id: 'scatterplot/default',
      title: 'Scatterplot',
      source: 'cart/component-gallery/components/scatterplot/Scatterplot.tsx',
      status: 'draft',
      variants: [
        {
          id: 'default',
          name: 'Default',
          render: () => <Scatterplot />,
        },
      ],
    }),
  ],
});
