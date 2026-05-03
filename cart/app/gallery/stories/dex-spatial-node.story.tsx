import { defineGallerySection, defineGalleryStory } from '../types';
import { Box } from '@reactjit/runtime/primitives';
import { DexSpatialNode } from '../components/dex-spatial-node/DexSpatialNode';

export const dexSpatialNodeSection = defineGallerySection({
  id: "dex-spatial-node",
  title: "Dex Spatial Node",
  group: {
    id: "components",
    title: "Components",
  },
  kind: "atom",
  stories: [
    defineGalleryStory({
      id: "dex-spatial-node/default",
      title: "Dex Spatial Node",
      source: "cart/component-gallery/components/dex-spatial-node/DexSpatialNode.tsx",
      status: 'ready',
      summary: 'Absolute-positioned circular node for spatial data maps.',
      tags: ["data-explorer", "atom"],
      variants: [
        {
          id: 'default',
          name: 'Default',
          render: () => (
            <Box style={{ width: 220, height: 150, position: 'relative', backgroundColor: '#0e0b09' }}>
              <DexSpatialNode />
              <DexSpatialNode label="flag" value="true" x={82} y={42} size={52} container={false} selected />
            </Box>
          ),
        },
      ],
    }),
  ],
});
