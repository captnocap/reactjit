import { defineGallerySection, defineGalleryStory } from '../types';
import { Venn } from '../components/venn/Venn';

export const vennSection = defineGallerySection({
  id: 'venn',
  title: 'Venn',
  stories: [
    defineGalleryStory({
      id: 'venn/default',
      title: 'Venn',
      source: 'cart/component-gallery/components/venn/Venn.tsx',
      status: 'draft',
      variants: [
        {
          id: 'default',
          name: 'Default',
          render: () => <Venn />,
        },
      ],
    }),
  ],
});
