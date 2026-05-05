import { defineGallerySection, defineGalleryStory } from '../types';
import { EasingsHostInterval } from '../components/easings/EasingsHostInterval';

export const easingsHostIntervalSection = defineGallerySection({
  id: 'easings-host-interval',
  title: 'Easings (Host-driven)',
  stories: [
    defineGalleryStory({
      id: 'easings-host-interval/default',
      title: 'Easings (Host-driven)',
      source: 'cart/app/gallery/components/easings/EasingsHostInterval.tsx',
      status: 'draft',
      tags: ['hooks', 'animation', 'perf', 'host-driven'],
      variants: [
        {
          id: 'default',
          name: 'Default',
          render: () => <EasingsHostInterval />,
        },
      ],
    }),
  ],
});
