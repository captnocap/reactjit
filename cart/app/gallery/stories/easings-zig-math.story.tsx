import { defineGallerySection, defineGalleryStory } from '../types';
import { EasingsZigMath } from '../components/easings/EasingsZigMath';

export const easingsZigMathSection = defineGallerySection({
  id: 'easings-zig-math',
  title: 'Easings (Zig math via bridge)',
  stories: [
    defineGalleryStory({
      id: 'easings-zig-math/default',
      title: 'Easings (Zig math via bridge)',
      source: 'cart/app/gallery/components/easings/EasingsZigMath.tsx',
      status: 'draft',
      tags: ['hooks', 'animation', 'perf', 'bridge'],
      variants: [
        {
          id: 'default',
          name: 'Default',
          render: () => <EasingsZigMath />,
        },
      ],
    }),
  ],
});
