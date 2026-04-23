import { defineGallerySection, defineGalleryStory } from '../types';
import { BarChart } from '../components/bar-chart/BarChart';

export const barChartSection = defineGallerySection({
  id: 'bar-chart',
  title: 'Bar Chart',
  stories: [
    defineGalleryStory({
      id: 'bar-chart/default',
      title: 'Bar Chart',
      source: 'cart/component-gallery/components/bar-chart/BarChart.tsx',
      status: 'draft',
      variants: [
        {
          id: 'default',
          name: 'Default',
          render: () => <BarChart />,
        },
      ],
    }),
  ],
});
