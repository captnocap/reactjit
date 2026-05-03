import { defineGallerySection, defineGalleryStory } from '../types';
import { Canvas } from '@reactjit/runtime/primitives';
import { DexCanvasNode } from '../components/dex-canvas-node/DexCanvasNode';

export const dexCanvasNodeSection = defineGallerySection({
  id: "dex-canvas-node",
  title: "Dex Canvas Node",
  group: {
    id: "controls",
    title: "Controls & Cards",
  },
  kind: "atom",
  stories: [
    defineGalleryStory({
      id: "dex-canvas-node/default",
      title: "Dex Canvas Node",
      source: "cart/component-gallery/components/dex-canvas-node/DexCanvasNode.tsx",
      status: 'ready',
      summary: 'Canvas node atom for pannable spatial data bubbles.',
      tags: ["card", "graph", "data"],
      variants: [
        {
          id: 'default',
          name: 'Default',
          render: () => (
            <Canvas style={{ width: 220, height: 150, backgroundColor: '#0e0b09' }}>
              <DexCanvasNode x={42} y={40} label="workers" value="[5]" />
              <DexCanvasNode x={122} y={52} label="routing" value="{3}" selected />
            </Canvas>
          ),
        },
      ],
    }),
  ],
});
