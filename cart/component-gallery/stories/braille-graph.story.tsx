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
        {
          id: 'default',
          name: 'Default',
          render: () => <BrailleGraph />,
        },
      ],
    }),
  ],
});
