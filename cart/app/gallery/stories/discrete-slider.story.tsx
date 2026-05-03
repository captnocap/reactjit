import { defineGallerySection, defineGalleryStory } from '../types';
import { DiscreteSlider } from '../components/controls-specimen/DiscreteSlider';

export const discreteSliderSection = defineGallerySection({
  id: 'discrete-slider',
  title: 'Discrete Slider',
  stories: [
    defineGalleryStory({
      id: 'discrete-slider/default',
      title: 'Discrete Slider',
      source: 'cart/component-gallery/components/controls-specimen/DiscreteSlider.tsx',
      status: 'ready',
      summary: 'Quantized horizontal slider with optional slot cells and ruler ticks.',
      tags: ['controls', 'slider', 'atom'],
      variants: [
        {
          id: 'ten-step',
          name: '10 Step',
          render: () => <DiscreteSlider steps={10} active={4} />,
        },
        {
          id: 'slot',
          name: 'Segmented Slot',
          render: () => <DiscreteSlider steps={8} active={5} slot={true} />,
        },
        {
          id: 'ruler',
          name: 'With Ruler',
          render: () => <DiscreteSlider steps={16} active={7} ruler={true} />,
        },
      ],
    }),
  ],
});
