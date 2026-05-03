import { defineGallerySection, defineGalleryStory } from '../types';
import { CombinationChart } from '../components/combination-chart/CombinationChart';
import { DEMO_MARGIN, DEMO_MONTHS, DEMO_REVENUE } from '../lib/chart-utils';

const combinationData = DEMO_MONTHS.slice(0, 8).map((label, i) => ({
  label,
  bar: DEMO_REVENUE[i],
  line: DEMO_MARGIN[i],
}));

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
          render: () => <CombinationChart data={combinationData} />,
        },
      ],
    }),
  ],
});
