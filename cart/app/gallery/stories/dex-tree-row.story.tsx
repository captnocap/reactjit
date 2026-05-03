import { defineGallerySection, defineGalleryStory } from '../types';
import { DexTreeRow } from '../components/dex-tree-row/DexTreeRow';

export const dexTreeRowSection = defineGallerySection({
  id: "dex-tree-row",
  title: "Dex Tree Row",
  group: {
    id: "components",
    title: "Components",
  },
  kind: "atom",
  stories: [
    defineGalleryStory({
      id: "dex-tree-row/default",
      title: "Dex Tree Row",
      source: "cart/component-gallery/components/dex-tree-row/DexTreeRow.tsx",
      status: 'ready',
      summary: 'Hierarchical row atom with indentation guides, disclosure state, value, and type badge.',
      tags: ["data-explorer", "atom"],
      variants: [
        {
          id: 'default',
          name: 'Default',
          render: () => <DexTreeRow />,
        },
      ],
    }),
  ],
});
