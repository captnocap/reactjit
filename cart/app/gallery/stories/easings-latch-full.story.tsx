import { defineGallerySection, defineGalleryStory } from '../types';
import { EasingsLatchFull } from '../components/easings/EasingsLatchFull';

export const easingsLatchFullSection = defineGallerySection({
  id: 'easings-latch-full',
  title: 'Easings (Combined)',
  stories: [
    defineGalleryStory({
      id: 'easings-latch-full/default',
      title: 'Easings (Combined)',
      source: 'cart/app/gallery/components/easings/EasingsLatchFull.tsx',
      status: 'draft',
      tags: ['hooks', 'animation', 'perf', 'latch'],
      variants: [
        {
          id: 'default',
          name: 'Default',
          render: () => <EasingsLatchFull />,
        },
      ],
    }),
  ],
});
