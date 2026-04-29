import { defineGallerySection, defineGalleryStory } from '../types';
import { Canvas } from '@reactjit/runtime/primitives';
import { DexCanvasRing } from '../components/dex-canvas-ring/DexCanvasRing';

export const dexCanvasRingSection = defineGallerySection({
  id: "dex-canvas-ring",
  title: "Dex Canvas Ring",
  group: {
    id: "controls",
    title: "Controls & Cards",
  },
  kind: "atom",
  stories: [
    defineGalleryStory({
      id: "dex-canvas-ring/default",
      title: "Dex Canvas Ring",
      source: "cart/component-gallery/components/dex-canvas-ring/DexCanvasRing.tsx",
      status: 'ready',
      summary: 'Canvas path ring atom for pannable spatial maps.',
      tags: ["card", "graph", "data", "motion"],
      variants: [
        {
          id: 'default',
          name: 'Default',
          render: () => (
            <Canvas style={{ width: 220, height: 150, backgroundColor: '#0e0b09' }}>
              <DexCanvasRing x={110} y={76} r={58} />
              <DexCanvasRing x={110} y={76} r={28} hot dashed />
            </Canvas>
          ),
        },
      ],
    }),
  ],
});
