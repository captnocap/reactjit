import { defineGallerySection, defineGalleryStory } from '../types';
import { DexSpatialExplorer } from '../components/dex-spatial-explorer/DexSpatialExplorer';

export const dexSpatialExplorerSection = defineGallerySection({
  id: "dex-spatial-explorer",
  title: "Dex Spatial Explorer",
  group: {
    id: "compositions",
    title: "Compositions",
  },
  kind: "top-level",
  composedOf: [
    "cart/component-gallery/components/dex-frame/DexFrame.tsx",
    "cart/component-gallery/components/dex-search-bar/DexSearchBar.tsx",
    "cart/component-gallery/components/dex-breadcrumbs/DexBreadcrumbs.tsx",
    "cart/component-gallery/components/dex-canvas-node/DexCanvasNode.tsx",
    "cart/component-gallery/components/dex-canvas-ring/DexCanvasRing.tsx",
    "cart/component-gallery/components/dex-canvas-edge/DexCanvasEdge.tsx",
  ],
  stories: [
    defineGalleryStory({
      id: "dex-spatial-explorer/default",
      title: "Dex Spatial Explorer",
      source: "cart/component-gallery/components/dex-spatial-explorer/DexSpatialExplorer.tsx",
      status: 'ready',
      summary: 'Spatial data explorer composed from a pannable Canvas: canvas rings, canvas links, and canvas node atoms.',
      tags: ["data-explorer", "spatial", "composition"],
      variants: [
        {
          id: 'default',
          name: 'Default',
          render: () => <DexSpatialExplorer />,
        },
        {
          id: 'narrow',
          name: 'Narrow',
          render: () => <DexSpatialExplorer width={350} />,
        },
      ],
    }),
  ],
});
