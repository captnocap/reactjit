import { defineGallerySection, defineGalleryStory } from '../types';
import { Boxplot } from '../components/boxplot/Boxplot';
import { DEMO_BOXPLOT } from '../lib/chart-utils';

export const boxplotSection = defineGallerySection({
  id: 'boxplot',
  title: 'Boxplot',
  stories: [
    defineGalleryStory({
      id: 'boxplot/default',
      title: 'Boxplot',
      source: 'cart/component-gallery/components/boxplot/Boxplot.tsx',
      status: 'draft',
      variants: [
        {
          id: 'default',
          name: 'Default',
          render: () => <Boxplot data={DEMO_BOXPLOT} />,
        },
      ],
    }),
  ],
});
