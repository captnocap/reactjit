import { defineGallerySection, defineGalleryStory } from '../types';
import { BipolarSlider } from '../components/controls-specimen/BipolarSlider';

export const bipolarSliderSection = defineGallerySection({
  id: 'bipolar-slider',
  title: 'Bipolar Slider',
  stories: [
    defineGalleryStory({
      id: 'bipolar-slider/default',
      title: 'Bipolar Slider',
      source: 'cart/component-gallery/components/controls-specimen/BipolarSlider.tsx',
      status: 'ready',
      summary: 'Centered horizontal slider that fills positive and negative ranges from zero.',
      tags: ['controls', 'slider', 'atom'],
      variants: [
        {
          id: 'positive',
          name: 'Positive',
          render: () => <BipolarSlider value={65} width={240} />,
        },
        {
          id: 'negative',
          name: 'Negative',
          render: () => <BipolarSlider value={32} width={240} />,
        },
      ],
    }),
  ],
});
