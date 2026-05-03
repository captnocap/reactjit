import { defineGallerySection, defineGalleryStory } from '../types';
import { HairlineSlider } from '../components/controls-specimen/HairlineSlider';

export const hairlineSliderSection = defineGallerySection({
  id: "hairline-slider",
  title: "Hairline Slider",
  stories: [
    defineGalleryStory({
      id: "hairline-slider/default",
      title: "Hairline Slider",
      source: "cart/component-gallery/components/controls-specimen/HairlineSlider.tsx",
      status: 'ready',
      summary: 'Single-pixel rail slider with square thumb from the controls specimen.',
      tags: ['controls', 'slider', 'atom'],
      variants: [
        {
          id: 'gain',
          name: 'Gain',
          render: () => <HairlineSlider value={62} width={240} />,
        },
        {
          id: 'trim',
          name: 'Trim',
          render: () => <HairlineSlider value={28} width={240} />,
        },
      ],
    }),
  ],
});
