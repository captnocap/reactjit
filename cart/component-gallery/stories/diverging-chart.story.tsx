import { defineGallerySection, defineGalleryStory } from '../types';
import { DivergingChart } from '../components/diverging-chart/DivergingChart';

export const divergingChartSection = defineGallerySection({
  id: 'diverging-chart',
  title: 'Diverging Chart',
  stories: [
    defineGalleryStory({
      id: 'diverging-chart/default',
      title: 'Diverging Chart',
      source: 'cart/component-gallery/components/diverging-chart/DivergingChart.tsx',
      status: 'draft',
      variants: [
        {
          id: 'default',
          name: 'Default',
          render: () => <DivergingChart />,
        },
      ],
    }),
  ],
});
