import { defineGallerySection, defineGalleryStory } from '../types';
import { Text } from '@reactjit/runtime/primitives';
import { DexFrame } from '../components/dex-frame/DexFrame';

export const dexFrameSection = defineGallerySection({
  id: "dex-frame",
  title: "Dex Frame",
  group: {
    id: "components",
    title: "Components",
  },
  kind: "atom",
  stories: [
    defineGalleryStory({
      id: "dex-frame/default",
      title: "Dex Frame",
      source: "cart/component-gallery/components/dex-frame/DexFrame.tsx",
      status: 'ready',
      summary: 'Bordered explorer panel frame with fixed header and optional footer slots.',
      tags: ["data-explorer", "atom"],
      variants: [
        {
          id: 'default',
          name: 'Default',
          render: () => (
            <DexFrame id="A.0" title="explorer frame" footer={<Text style={{ color: '#7a6e5d', fontSize: 9 }}>footer slot</Text>}>
              <Text style={{ color: '#b8a890', fontSize: 12, padding: 12 }}>content slot</Text>
            </DexFrame>
          ),
        },
      ],
    }),
  ],
});
