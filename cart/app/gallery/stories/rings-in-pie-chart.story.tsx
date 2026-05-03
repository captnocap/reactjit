import { defineGallerySection, defineGalleryStory } from '../types';
import { RingsInPieChart } from '../components/rings-in-pie-chart/RingsInPieChart';

export const ringsInPieChartSection = defineGallerySection({
  id: 'rings-in-pie-chart',
  title: 'Rings In Pie Chart',
  stories: [
    defineGalleryStory({
      id: 'rings-in-pie-chart/default',
      title: 'Rings In Pie Chart',
      source: 'cart/component-gallery/components/rings-in-pie-chart/RingsInPieChart.tsx',
      status: 'draft',
      variants: [
        {
          id: 'default',
          name: 'Default',
          render: () => <RingsInPieChart />,
        },
      ],
    }),
  ],
});
