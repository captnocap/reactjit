import { defineGallerySection, defineGalleryStory } from '../types';
import { VerticalNotchFader } from '../components/controls-specimen/VerticalNotchFader';

export const verticalNotchFaderSection = defineGallerySection({
  id: 'vertical-notch-fader',
  title: 'Vertical Notch Fader',
  stories: [
    defineGalleryStory({
      id: 'vertical-notch-fader/default',
      title: 'Vertical Notch Fader',
      source: 'cart/component-gallery/components/controls-specimen/VerticalNotchFader.tsx',
      status: 'ready',
      summary: 'Discrete vertical fader made from stacked notch cells with optional peak caps.',
      tags: ['controls', 'fader', 'atom'],
      variants: [
        {
          id: 'left',
          name: 'Left',
          render: () => <VerticalNotchFader active={9} label="L" />,
        },
        {
          id: 'meter',
          name: 'Meter',
          render: () => <VerticalNotchFader active={10} label="M" />,
        },
      ],
    }),
  ],
});
