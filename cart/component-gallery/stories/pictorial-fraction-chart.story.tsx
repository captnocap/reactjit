import { defineGallerySection, defineGalleryStory } from '../types';
import { PictorialFractionChart } from '../components/pictorial-fraction-chart/PictorialFractionChart';

export const pictorialFractionChartSection = defineGallerySection({
  id: 'pictorial-fraction-chart',
  title: 'Pictorial Fraction Chart',
  stories: [
    defineGalleryStory({
      id: 'pictorial-fraction-chart/default',
      title: 'Pictorial Fraction Chart',
      source: 'cart/component-gallery/components/pictorial-fraction-chart/PictorialFractionChart.tsx',
      status: 'draft',
      variants: [
        {
          id: 'default',
          name: 'Default',
          render: () => <PictorialFractionChart />,
        },
      ],
    }),
  ],
});
