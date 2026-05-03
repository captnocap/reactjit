import { defineGallerySection, defineGalleryStory } from '../types';
import { VerticalThinFader } from '../components/controls-specimen/VerticalThinFader';

export const verticalThinFaderSection = defineGallerySection({
  id: 'vertical-thin-fader',
  title: 'Vertical Thin Fader',
  stories: [
    defineGalleryStory({
      id: 'vertical-thin-fader/default',
      title: 'Vertical Thin Fader',
      source: 'cart/component-gallery/components/controls-specimen/VerticalThinFader.tsx',
      status: 'ready',
      summary: 'Hairline vertical fader with a flat cap and labeled channel footer.',
      tags: ['controls', 'fader', 'atom'],
      variants: [
        {
          id: 'a',
          name: 'A',
          render: () => <VerticalThinFader value={72} label="A" />,
        },
        {
          id: 'b',
          name: 'B',
          render: () => <VerticalThinFader value={40} label="B" />,
        },
      ],
    }),
  ],
});
