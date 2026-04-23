import { defineGallerySection, defineGalleryStory } from '../types';
import { CombinationChart } from '../components/combination-chart/CombinationChart';

export const combinationChartSection = defineGallerySection({
  id: 'combination-chart',
  title: 'Combination Chart',
  stories: [
    defineGalleryStory({
      id: 'combination-chart/default',
      title: 'Combination Chart',
      source: 'cart/component-gallery/components/combination-chart/CombinationChart.tsx',
      status: 'draft',
      variants: [
        {
          id: 'default',
          name: 'Default',
          render: () => <CombinationChart />,
        },
      ],
    }),
  ],
});
