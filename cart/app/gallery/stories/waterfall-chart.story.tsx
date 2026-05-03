import { defineGallerySection, defineGalleryStory } from '../types';
import { WaterfallChart } from '../components/waterfall-chart/WaterfallChart';
import { DEMO_WATERFALL } from '../lib/chart-utils';

export const waterfallChartSection = defineGallerySection({
  id: 'waterfall-chart',
  title: 'Waterfall Chart',
  stories: [
    defineGalleryStory({
      id: 'waterfall-chart/default',
      title: 'Waterfall Chart',
      source: 'cart/component-gallery/components/waterfall-chart/WaterfallChart.tsx',
      status: 'draft',
      variants: [
        {
          id: 'default',
          name: 'Default',
          render: () => <WaterfallChart data={DEMO_WATERFALL} />,
        },
      ],
    }),
  ],
});
