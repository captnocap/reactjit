import { defineGallerySection, defineGalleryStory } from '../types';
import { DexHeatCell } from '../components/dex-heat-cell/DexHeatCell';

export const dexHeatCellSection = defineGallerySection({
  id: "dex-heat-cell",
  title: "Dex Heat Cell",
  group: {
    id: "components",
    title: "Components",
  },
  kind: "atom",
  stories: [
    defineGalleryStory({
      id: "dex-heat-cell/default",
      title: "Dex Heat Cell",
      source: "cart/component-gallery/components/dex-heat-cell/DexHeatCell.tsx",
      status: 'ready',
      summary: 'Single similarity heatmap cell with value-derived intensity.',
      tags: ["data-explorer", "atom"],
      variants: [
        {
          id: 'default',
          name: 'Default',
          render: () => <DexHeatCell />,
        },
      ],
    }),
  ],
});
