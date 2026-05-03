import { defineGallerySection, defineGalleryStory } from '../types';
import { DexTreeExplorer } from '../components/dex-tree-explorer/DexTreeExplorer';

export const dexTreeExplorerSection = defineGallerySection({
  id: "dex-tree-explorer",
  title: "Dex Tree Explorer",
  group: {
    id: "compositions",
    title: "Compositions",
  },
  kind: "top-level",
  composedOf: [
    "cart/component-gallery/components/dex-frame/DexFrame.tsx",
    "cart/component-gallery/components/dex-search-bar/DexSearchBar.tsx",
    "cart/component-gallery/components/dex-breadcrumbs/DexBreadcrumbs.tsx",
    "cart/component-gallery/components/dex-tree-row/DexTreeRow.tsx",
    "cart/component-gallery/components/dex-type-badge/DexTypeBadge.tsx",
  ],
  stories: [
    defineGalleryStory({
      id: "dex-tree-explorer/default",
      title: "Dex Tree Explorer",
      source: "cart/component-gallery/components/dex-tree-explorer/DexTreeExplorer.tsx",
      status: 'ready',
      summary: 'Tree data explorer composed from the shared explorer frame, search strip, breadcrumbs, hierarchical rows, and type badges.',
      tags: ["data-explorer", "tree", "composition"],
      variants: [
        {
          id: 'default',
          name: 'Default',
          render: () => <DexTreeExplorer />,
        },
        {
          id: 'narrow',
          name: 'Narrow',
          render: () => <DexTreeExplorer width={350} />,
        },
      ],
    }),
  ],
});
