import { defineGallerySection, defineGalleryStory } from '../types';
import { DonutBarChart } from '../components/donut-bar-chart/DonutBarChart';

export const donutBarChartSection = defineGallerySection({
  id: 'donut-bar-chart',
  title: 'Donut Bar Chart',
  stories: [
    defineGalleryStory({
      id: 'donut-bar-chart/default',
      title: 'Donut Bar Chart',
      source: 'cart/component-gallery/components/donut-bar-chart/DonutBarChart.tsx',
      status: 'draft',
      variants: [
        {
          id: 'default',
          name: 'Default',
          render: () => <DonutBarChart />,
        },
      ],
    }),
  ],
});
