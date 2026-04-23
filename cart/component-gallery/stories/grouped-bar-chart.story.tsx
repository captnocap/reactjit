import { defineGallerySection, defineGalleryStory } from '../types';
import { GroupedBarChart } from '../components/grouped-bar-chart/GroupedBarChart';

export const groupedBarChartSection = defineGallerySection({
  id: 'grouped-bar-chart',
  title: 'Grouped Bar Chart',
  stories: [
    defineGalleryStory({
      id: 'grouped-bar-chart/default',
      title: 'Grouped Bar Chart',
      source: 'cart/component-gallery/components/grouped-bar-chart/GroupedBarChart.tsx',
      status: 'draft',
      variants: [
        {
          id: 'default',
          name: 'Default',
          render: () => <GroupedBarChart />,
        },
      ],
    }),
  ],
});
