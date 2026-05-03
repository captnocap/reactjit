import { defineGallerySection, defineGalleryStory } from '../types';
import { AreaChart } from '../components/area-chart/AreaChart';

export const areaChartSection = defineGallerySection({
  id: 'area-chart',
  title: 'Area Chart',
  stories: [
    defineGalleryStory({
      id: 'area-chart/default',
      title: 'Area Chart',
      source: 'cart/component-gallery/components/area-chart/AreaChart.tsx',
      status: 'draft',
      variants: [
        {
          id: 'default',
          name: 'Default',
          render: () => <AreaChart />,
        },
      ],
    }),
  ],
});
