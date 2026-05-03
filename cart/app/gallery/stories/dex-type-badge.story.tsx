import { defineGallerySection, defineGalleryStory } from '../types';
import { DexTypeBadge } from '../components/dex-type-badge/DexTypeBadge';

export const dexTypeBadgeSection = defineGallerySection({
  id: "dex-type-badge",
  title: "Dex Type Badge",
  group: {
    id: "components",
    title: "Components",
  },
  kind: "atom",
  stories: [
    defineGalleryStory({
      id: "dex-type-badge/default",
      title: "Dex Type Badge",
      source: "cart/component-gallery/components/dex-type-badge/DexTypeBadge.tsx",
      status: 'ready',
      summary: 'Small typed-value badge used by tree rows and inspectors.',
      tags: ["data-explorer", "atom"],
      variants: [
        {
          id: 'default',
          name: 'Default',
          render: () => <DexTypeBadge />,
        },
      ],
    }),
  ],
});
