import { defineGallerySection, defineGalleryStory } from '../types';
import { EasingsLatchOnly } from '../components/easings/EasingsLatchOnly';

export const easingsLatchOnlySection = defineGallerySection({
  id: 'easings-latch-only',
  title: 'Easings (Latches only)',
  stories: [
    defineGalleryStory({
      id: 'easings-latch-only/default',
      title: 'Easings (Latches only)',
      source: 'cart/app/gallery/components/easings/EasingsLatchOnly.tsx',
      status: 'draft',
      tags: ['hooks', 'animation', 'perf', 'latch'],
      variants: [
        {
          id: 'default',
          name: 'Default',
          render: () => <EasingsLatchOnly />,
        },
      ],
    }),
  ],
});
