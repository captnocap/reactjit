import { defineGallerySection, defineGalleryStory } from '../types';
import { EasingsLatch } from '../components/easings/EasingsLatch';

export const easingsLatchSection = defineGallerySection({
  id: 'easings-latch',
  title: 'Easings (StaticSurface)',
  stories: [
    defineGalleryStory({
      id: 'easings-latch/default',
      title: 'Easings (StaticSurface)',
      source: 'cart/app/gallery/components/easings/EasingsLatch.tsx',
      status: 'draft',
      tags: ['hooks', 'animation', 'perf'],
      variants: [
        {
          id: 'default',
          name: 'Default',
          render: () => <EasingsLatch />,
        },
      ],
    }),
  ],
});
