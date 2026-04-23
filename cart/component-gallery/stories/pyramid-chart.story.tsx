import { defineGallerySection, defineGalleryStory } from '../types';
import { PyramidChart } from '../components/pyramid-chart/PyramidChart';

export const pyramidChartSection = defineGallerySection({
  id: 'pyramid-chart',
  title: 'Pyramid Chart',
  stories: [
    defineGalleryStory({
      id: 'pyramid-chart/default',
      title: 'Pyramid Chart',
      source: 'cart/component-gallery/components/pyramid-chart/PyramidChart.tsx',
      status: 'draft',
      variants: [
        {
          id: 'default',
          name: 'Default',
          render: () => <PyramidChart />,
        },
      ],
    }),
  ],
});
