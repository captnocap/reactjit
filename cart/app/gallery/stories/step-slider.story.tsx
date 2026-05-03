import { defineGallerySection, defineGalleryStory } from '../types';
import { StepSlider } from '../components/controls-specimen/StepSlider';

export const stepSliderSection = defineGallerySection({
  id: 'step-slider',
  title: 'Step Slider',
  stories: [
    defineGalleryStory({
      id: 'step-slider/default',
      title: 'Step Slider',
      source: 'cart/component-gallery/components/controls-specimen/StepSlider.tsx',
      status: 'ready',
      summary: 'Named discrete slider with stop markers and active label highlighting.',
      tags: ['controls', 'slider', 'atom'],
      variants: [
        {
          id: 'mode',
          name: 'Mode',
          render: () => <StepSlider labels={['OFF', 'LO', 'MID', 'HI', 'MAX']} active={2} />,
        },
        {
          id: 'size',
          name: 'Size',
          render: () => <StepSlider labels={['S', 'M', 'L', 'XL']} active={3} />,
        },
      ],
    }),
  ],
});
