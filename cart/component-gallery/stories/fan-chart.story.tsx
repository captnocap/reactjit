import { defineGallerySection, defineGalleryStory } from '../types';
import { FanChart } from '../components/fan-chart/FanChart';

export const fanChartSection = defineGallerySection({
  id: 'fan-chart',
  title: 'Fan Chart',
  stories: [
    defineGalleryStory({
      id: 'fan-chart/default',
      title: 'Fan Chart',
      source: 'cart/component-gallery/components/fan-chart/FanChart.tsx',
      status: 'draft',
      variants: [
        {
          id: 'default',
          name: 'Default',
          render: () => <FanChart />,
        },
      ],
    }),
  ],
});
