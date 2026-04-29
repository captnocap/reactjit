import { defineGallerySection, defineGalleryStory } from '../types';
import { Canvas } from '@reactjit/runtime/primitives';
import { DexCanvasEdge } from '../components/dex-canvas-edge/DexCanvasEdge';

export const dexCanvasEdgeSection = defineGallerySection({
  id: "dex-canvas-edge",
  title: "Dex Canvas Edge",
  group: {
    id: "controls",
    title: "Controls & Cards",
  },
  kind: "atom",
  stories: [
    defineGalleryStory({
      id: "dex-canvas-edge/default",
      title: "Dex Canvas Edge",
      source: "cart/component-gallery/components/dex-canvas-edge/DexCanvasEdge.tsx",
      status: 'ready',
      summary: 'Canvas path edge atom for pannable spatial maps.',
      tags: ["card", "graph", "data", "motion"],
      variants: [
        {
          id: 'default',
          name: 'Default',
          render: () => (
            <Canvas style={{ width: 220, height: 150, backgroundColor: '#0e0b09' }}>
              <DexCanvasEdge x1={32} y1={96} x2={176} y2={42} weight={0.7} hot />
            </Canvas>
          ),
        },
      ],
    }),
  ],
});
