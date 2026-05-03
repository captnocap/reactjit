import { defineGallerySection, defineGalleryStory } from '../types';
import { DivergingChart } from '../components/diverging-chart/DivergingChart';
import { DEMO_SENTIMENT } from '../lib/chart-utils';

const divergingData = DEMO_SENTIMENT.map((item) => item.value);
const divergingLabels = DEMO_SENTIMENT.map((item) => item.label);

export const divergingChartSection = defineGallerySection({
  id: 'diverging-chart',
  title: 'Diverging Chart',
  stories: [
    defineGalleryStory({
      id: 'diverging-chart/default',
      title: 'Diverging Chart',
      source: 'cart/component-gallery/components/diverging-chart/DivergingChart.tsx',
      status: 'draft',
      variants: [
        {
          id: 'default',
          name: 'Default',
          render: () => <DivergingChart data={divergingData} labels={divergingLabels} />,
        },
      ],
    }),
  ],
});
