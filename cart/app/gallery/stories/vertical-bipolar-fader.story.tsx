import { defineGallerySection, defineGalleryStory } from '../types';
import { VerticalBipolarFader } from '../components/controls-specimen/VerticalBipolarFader';

export const verticalBipolarFaderSection = defineGallerySection({
  id: 'vertical-bipolar-fader',
  title: 'Vertical Bipolar Fader',
  stories: [
    defineGalleryStory({
      id: 'vertical-bipolar-fader/default',
      title: 'Vertical Bipolar Fader',
      source: 'cart/component-gallery/components/controls-specimen/VerticalBipolarFader.tsx',
      status: 'ready',
      summary: 'Centered vertical fader for positive and negative offset trims.',
      tags: ['controls', 'fader', 'atom'],
      variants: [
        {
          id: 'positive',
          name: 'Positive',
          render: () => <VerticalBipolarFader value={72} label="+22" />,
        },
        {
          id: 'negative',
          name: 'Negative',
          render: () => <VerticalBipolarFader value={28} label="−22" />,
        },
      ],
    }),
  ],
});
