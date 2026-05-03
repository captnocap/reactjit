import { defineGallerySection, defineGalleryStory } from '../types';
import { VerticalStripFader } from '../components/controls-specimen/VerticalStripFader';

export const verticalStripFaderSection = defineGallerySection({
  id: 'vertical-strip-fader',
  title: 'Vertical Strip Fader',
  stories: [
    defineGalleryStory({
      id: 'vertical-strip-fader/default',
      title: 'Vertical Strip Fader',
      source: 'cart/component-gallery/components/controls-specimen/VerticalStripFader.tsx',
      status: 'ready',
      summary: 'Channel-strip style vertical fader with interior slot ticks and framed thumb.',
      tags: ['controls', 'fader', 'atom'],
      variants: [
        {
          id: 'trim',
          name: 'Trim',
          render: () => <VerticalStripFader value={72} label="−3" />,
        },
        {
          id: 'unity',
          name: 'Unity',
          render: () => <VerticalStripFader value={55} label="0dB" />,
        },
      ],
    }),
  ],
});
