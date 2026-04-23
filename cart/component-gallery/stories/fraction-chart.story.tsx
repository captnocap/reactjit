import { defineGallerySection, defineGalleryStory } from '../types';
import { FractionChart } from '../components/fraction-chart/FractionChart';

export const fractionChartSection = defineGallerySection({
  id: 'fraction-chart',
  title: 'Fraction Chart',
  stories: [
    defineGalleryStory({
      id: 'fraction-chart/default',
      title: 'Fraction Chart',
      source: 'cart/component-gallery/components/fraction-chart/FractionChart.tsx',
      status: 'draft',
      variants: [
        {
          id: 'default',
          name: 'Default',
          render: () => <FractionChart />,
        },
      ],
    }),
  ],
});
