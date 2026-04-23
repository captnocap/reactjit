import { defineGallerySection, defineGalleryStory } from '../types';
import { Radar } from '../components/radar/Radar';

export const radarSection = defineGallerySection({
  id: 'radar',
  title: 'Radar',
  stories: [
    defineGalleryStory({
      id: 'radar/default',
      title: 'Radar',
      source: 'cart/component-gallery/components/radar/Radar.tsx',
      status: 'draft',
      variants: [
        {
          id: 'default',
          name: 'Default',
          render: () => <Radar />,
        },
      ],
    }),
  ],
});
