import { defineGallerySection, defineGalleryStory } from '../types';
import { KeycapSelector } from '../components/controls-specimen/KeycapSelector';

export const keycapSelectorSection = defineGallerySection({
  id: 'keycap-selector',
  title: 'Keycap Selector',
  stories: [
    defineGalleryStory({
      id: 'keycap-selector/default',
      title: 'Keycap Selector',
      source: 'cart/component-gallery/components/controls-specimen/KeycapSelector.tsx',
      status: 'ready',
      summary: 'Compact keycap-like token selector for multipliers and size presets.',
      tags: ['controls', 'selection', 'atom'],
      variants: [
        {
          id: 'zoom',
          name: 'Zoom',
          render: () => <KeycapSelector options={['1×', '2×', '4×', '8×', '16×']} active={1} />,
        },
        {
          id: 'size',
          name: 'Size',
          render: () => <KeycapSelector options={['S', 'M', 'L', 'XL']} active={2} />,
        },
      ],
    }),
  ],
});
