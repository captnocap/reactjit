import { defineGallerySection, defineGalleryStory } from '../types';
import { CircularBarChart } from '../components/circular-bar-chart/CircularBarChart';
import { DEMO_DAYS, DEMO_RESPONSE_TIME } from '../lib/chart-utils';

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
          render: () => <CircularBarChart labels={DEMO_DAYS} data={DEMO_RESPONSE_TIME} />,
        },
      ],
    }),
  ],
});
