import { defineGallerySection, defineGalleryStory } from '../types';
import { Box } from '@reactjit/runtime/primitives';
import { classifiers as S } from '@reactjit/core';
import { DexGraphEdge } from '../components/dex-graph-edge/DexGraphEdge';

export const dexGraphEdgeSection = defineGallerySection({
  id: "dex-graph-edge",
  title: "Dex Graph Edge",
  group: {
    id: "components",
    title: "Components",
  },
  kind: "atom",
  stories: [
    defineGalleryStory({
      id: "dex-graph-edge/default",
      title: "Dex Graph Edge",
      source: "cart/app/gallery/components/dex-graph-edge/DexGraphEdge.tsx",
      status: 'ready',
      summary: 'Graph primitive edge atom for similarity and spatial-link surfaces.',
      tags: ["data-explorer", "graph", "atom"],
      variants: [
        {
          id: 'default',
          name: 'Default',
          render: () => (
            <Box style={{ width: 180, height: 110, backgroundColor: 'theme:bg' }}>
              <S.BareGraph>
                <DexGraphEdge x1={24} y1={72} x2={148} y2={34} weight={0.78} hot />
              </S.BareGraph>
            </Box>
          ),
        },
      ],
    }),
  ],
});
