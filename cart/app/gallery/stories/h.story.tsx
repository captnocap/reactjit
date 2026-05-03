import { defineGallerySection, defineGalleryStory } from '../types';
import { H } from '../components/h/H';

export const hSection = defineGallerySection({
  id: "h",
  title: "H",
  group: {
    id: "components",
    title: "Components",
  },
  kind: "atom",
  stories: [
    defineGalleryStory({
      id: "h/default",
      title: "H",
      source: "cart/component-gallery/components/h/H.tsx",
      status: 'draft',
      variants: [
        {
          id: 'default',
          name: 'Default',
          render: () => <H />,
        },
      ],
    }),
  ],
});
