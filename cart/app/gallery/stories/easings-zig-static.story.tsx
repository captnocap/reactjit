import { defineGallerySection, defineGalleryStory } from '../types';
import { EasingsZigStatic } from '../components/easings/EasingsZigStatic';

export const easingsZigStaticSection = defineGallerySection({
  id: 'easings-zig-static',
  title: 'Easings (Zig math + StaticSurface)',
  stories: [
    defineGalleryStory({
      id: 'easings-zig-static/default',
      title: 'Easings (Zig math + StaticSurface)',
      source: 'cart/app/gallery/components/easings/EasingsZigStatic.tsx',
      status: 'draft',
      tags: ['hooks', 'animation', 'perf', 'bridge'],
      variants: [
        {
          id: 'default',
          name: 'Default',
          render: () => <EasingsZigStatic />,
        },
      ],
    }),
  ],
});
