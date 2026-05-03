import { defineGallerySection, defineGalleryStory } from '../types';
import { DexTableExplorer } from '../components/dex-table-explorer/DexTableExplorer';

export const dexTableExplorerSection = defineGallerySection({
  id: "dex-table-explorer",
  title: "Dex Table Explorer",
  group: {
    id: "compositions",
    title: "Compositions",
  },
  kind: "top-level",
  composedOf: [
    "cart/component-gallery/components/dex-frame/DexFrame.tsx",
    "cart/component-gallery/components/dex-search-bar/DexSearchBar.tsx",
    "cart/component-gallery/components/dex-breadcrumbs/DexBreadcrumbs.tsx",
    "cart/component-gallery/components/dex-table-cell/DexTableCell.tsx",
    "cart/component-gallery/components/dex-spark-histogram/DexSparkHistogram.tsx",
  ],
  stories: [
    defineGalleryStory({
      id: "dex-table-explorer/default",
      title: "Dex Table Explorer",
      source: "cart/component-gallery/components/dex-table-explorer/DexTableExplorer.tsx",
      status: 'ready',
      summary: 'Table data explorer composed from frame, search, breadcrumbs, fixed cells, and column histograms.',
      tags: ["data-explorer", "table", "composition"],
      variants: [
        {
          id: 'default',
          name: 'Default',
          render: () => <DexTableExplorer />,
        },
        {
          id: 'narrow',
          name: 'Narrow',
          render: () => <DexTableExplorer width={350} />,
        },
      ],
    }),
  ],
});
