import { defineGallerySection, defineGalleryStory } from '../types';
import { BrailleGraph } from '../components/braille-graph/BrailleGraph';

export const brailleGraphSection = defineGallerySection({
  id: 'braille-graph',
  title: 'Braille Graph',
  stories: [
    defineGalleryStory({
      id: 'braille-graph/default',
      title: 'Braille Graph',
      source: 'cart/component-gallery/components/braille-graph/BrailleGraph.tsx',
      status: 'ready',
      variants: [
        { id: 'sine', name: 'Sine', render: () => <BrailleGraph data={{ mode: 'sine' }} /> },
        { id: 'ripple', name: 'Ripple', render: () => <BrailleGraph data={{ mode: 'ripple' }} /> },
        { id: 'noise', name: 'Noise', render: () => <BrailleGraph data={{ mode: 'noise' }} /> },
        { id: 'lissajous', name: 'Lissajous', render: () => <BrailleGraph data={{ mode: 'lissajous' }} /> },
      ],
    }),
  ],
});
