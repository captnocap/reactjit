import { defineGallerySection, defineGalleryStory } from '../types';
import { Box } from '@reactjit/runtime/primitives';
import { classifiers as S } from '@reactjit/core';
import { DexGraphNode } from '../components/dex-graph-node/DexGraphNode';

export const dexGraphNodeSection = defineGallerySection({
  id: "dex-graph-node",
  title: "Dex Graph Node",
  group: {
    id: "components",
    title: "Components",
  },
  kind: "atom",
  stories: [
    defineGalleryStory({
      id: "dex-graph-node/default",
      title: "Dex Graph Node",
      source: "cart/component-gallery/components/dex-graph-node/DexGraphNode.tsx",
      status: 'ready',
      summary: 'Graph primitive node atom rendered as a path circle.',
      tags: ["data-explorer", "graph", "atom"],
      variants: [
        {
          id: 'default',
          name: 'Default',
          render: () => (
            <Box style={{ width: 180, height: 110, backgroundColor: '#0e0b09' }}>
              <S.BareGraph>
                <DexGraphNode x={68} y={54} r={16} selected />
                <DexGraphNode x={118} y={54} r={12} color="#6aa390" />
              </S.BareGraph>
            </Box>
          ),
        },
      ],
    }),
  ],
});
