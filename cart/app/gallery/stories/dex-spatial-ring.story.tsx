import { defineGallerySection, defineGalleryStory } from '../types';
import { Box } from '@reactjit/runtime/primitives';
import { classifiers as S } from '@reactjit/core';
import { DexSpatialRing } from '../components/dex-spatial-ring/DexSpatialRing';

export const dexSpatialRingSection = defineGallerySection({
  id: "dex-spatial-ring",
  title: "Dex Spatial Ring",
  group: {
    id: "components",
    title: "Components",
  },
  kind: "atom",
  stories: [
    defineGalleryStory({
      id: "dex-spatial-ring/default",
      title: "Dex Spatial Ring",
      source: "cart/app/gallery/components/dex-spatial-ring/DexSpatialRing.tsx",
      status: 'ready',
      summary: 'Graph primitive ring atom for radial spatial data maps.',
      tags: ["data-explorer", "spatial", "atom"],
      variants: [
        {
          id: 'default',
          name: 'Default',
          render: () => (
            <Box style={{ width: 220, height: 150, backgroundColor: 'theme:bg' }}>
              <S.BareGraph>
                <DexSpatialRing x={110} y={76} r={58} />
                <DexSpatialRing x={110} y={76} r={28} hot dashed />
              </S.BareGraph>
            </Box>
          ),
        },
      ],
    }),
  ],
});
