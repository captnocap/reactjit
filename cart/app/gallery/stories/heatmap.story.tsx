import { defineGallerySection, defineGalleryStory } from '../types';
import { Heatmap } from '../components/heatmap/Heatmap';
import { DEMO_HEATMAP } from '../lib/chart-utils';

export const heatmapSection = defineGallerySection({
  id: 'heatmap',
  title: 'Heatmap',
  stories: [
    defineGalleryStory({
      id: 'heatmap/default',
      title: 'Heatmap',
      source: 'cart/component-gallery/components/heatmap/Heatmap.tsx',
      status: 'draft',
      variants: [
        {
          id: 'default',
          name: 'Default',
          render: () => <Heatmap data={DEMO_HEATMAP} />,
        },
      ],
    }),
  ],
});
