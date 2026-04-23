import { defineGallerySection, defineGalleryStory } from '../types';
import { CircularBarChart } from '../components/circular-bar-chart/CircularBarChart';

export const circularBarChartSection = defineGallerySection({
  id: 'circular-bar-chart',
  title: 'Circular Bar Chart',
  stories: [
    defineGalleryStory({
      id: 'circular-bar-chart/default',
      title: 'Circular Bar Chart',
      source: 'cart/component-gallery/components/circular-bar-chart/CircularBarChart.tsx',
      status: 'draft',
      variants: [
        {
          id: 'default',
          name: 'Default',
          render: () => <CircularBarChart />,
        },
      ],
    }),
  ],
});
