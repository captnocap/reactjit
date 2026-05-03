import { defineGallerySection, defineGalleryStory } from '../types';
import { DexTableCell } from '../components/dex-table-cell/DexTableCell';

export const dexTableCellSection = defineGallerySection({
  id: "dex-table-cell",
  title: "Dex Table Cell",
  group: {
    id: "components",
    title: "Components",
  },
  kind: "atom",
  stories: [
    defineGalleryStory({
      id: "dex-table-cell/default",
      title: "Dex Table Cell",
      source: "cart/component-gallery/components/dex-table-cell/DexTableCell.tsx",
      status: 'ready',
      summary: 'Fixed-width editable-table cell visual with selected and semantic tone states.',
      tags: ["data-explorer", "atom"],
      variants: [
        {
          id: 'default',
          name: 'Default',
          render: () => <DexTableCell />,
        },
      ],
    }),
  ],
});
