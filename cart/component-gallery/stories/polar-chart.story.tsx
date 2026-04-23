import { defineGallerySection, defineGalleryStory } from '../types';
import { PolarChart } from '../components/polar-chart/PolarChart';

export const polarChartSection = defineGallerySection({
  id: 'polar-chart',
  title: 'Polar Chart',
  stories: [
    defineGalleryStory({
      id: 'polar-chart/default',
      title: 'Polar Chart',
      source: 'cart/component-gallery/components/polar-chart/PolarChart.tsx',
      status: 'draft',
      variants: [
        {
          id: 'default',
          name: 'Default',
          render: () => <PolarChart />,
        },
      ],
    }),
  ],
});
