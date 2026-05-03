import { defineGallerySection, defineGalleryStory } from '../types';
import { Scatterplot } from '../components/scatterplot/Scatterplot';
import { DEMO_CAMPAIGNS } from '../lib/chart-utils';

const scatterplotData = DEMO_CAMPAIGNS.map((point, i) => ({
  label: `Campaign ${i + 1}`,
  x: point.x,
  y: point.y,
}));

export const scatterplotSection = defineGallerySection({
  id: 'scatterplot',
  title: 'Scatterplot',
  stories: [
    defineGalleryStory({
      id: 'scatterplot/default',
      title: 'Scatterplot',
      source: 'cart/component-gallery/components/scatterplot/Scatterplot.tsx',
      status: 'draft',
      variants: [
        {
          id: 'default',
          name: 'Default',
          render: () => <Scatterplot data={scatterplotData} />,
        },
      ],
    }),
  ],
});
