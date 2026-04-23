import { defineGallerySection, defineGalleryStory } from '../types';
import { WaterfallChart } from '../components/waterfall-chart/WaterfallChart';

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
          render: () => <WaterfallChart />,
        },
      ],
    }),
  ],
});
