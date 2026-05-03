import { defineGallerySection, defineGalleryStory } from '../types';
import { DexGraphExplorer } from '../components/dex-graph-explorer/DexGraphExplorer';

export const dexGraphExplorerSection = defineGallerySection({
  id: "dex-graph-explorer",
  title: "Dex Graph Explorer",
  group: {
    id: "compositions",
    title: "Compositions",
  },
  kind: "top-level",
  composedOf: [
    "cart/component-gallery/components/dex-frame/DexFrame.tsx",
    "cart/component-gallery/components/dex-search-bar/DexSearchBar.tsx",
    "cart/component-gallery/components/dex-breadcrumbs/DexBreadcrumbs.tsx",
    "cart/component-gallery/components/dex-heat-cell/DexHeatCell.tsx",
    "cart/component-gallery/components/dex-canvas-edge/DexCanvasEdge.tsx",
    "cart/component-gallery/components/dex-canvas-node/DexCanvasNode.tsx",
  ],
  stories: [
    defineGalleryStory({
      id: "dex-graph-explorer/default",
      title: "Dex Graph Explorer",
      source: "cart/component-gallery/components/dex-graph-explorer/DexGraphExplorer.tsx",
      status: 'ready',
      summary: 'Similarity network explorer composed from a pannable Canvas plus canvas edge/node atoms and a heatmap side panel.',
      tags: ["data-explorer", "graph", "composition"],
      variants: [
        {
          id: 'default',
          name: 'Default',
          render: () => <DexGraphExplorer />,
        },
        {
          id: 'narrow',
          name: 'Narrow',
          render: () => <DexGraphExplorer width={350} />,
        },
      ],
    }),
  ],
});
