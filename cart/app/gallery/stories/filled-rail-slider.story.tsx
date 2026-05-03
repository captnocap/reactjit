import { defineGallerySection, defineGalleryStory } from '../types';
import { FilledRailSlider } from '../components/controls-specimen/FilledRailSlider';

export const filledRailSliderSection = defineGallerySection({
  id: 'filled-rail-slider',
  title: 'Filled Rail Slider',
  stories: [
    defineGalleryStory({
      id: 'filled-rail-slider/default',
      title: 'Filled Rail Slider',
      source: 'cart/component-gallery/components/controls-specimen/FilledRailSlider.tsx',
      status: 'ready',
      summary: 'Horizontal slider with a filled rail and tall bar thumb.',
      tags: ['controls', 'slider', 'atom'],
      variants: [
        {
          id: 'drive',
          name: 'Drive',
          render: () => <FilledRailSlider value={45} width={240} />,
        },
        {
          id: 'bias',
          name: 'Bias',
          render: () => <FilledRailSlider value={82} width={240} />,
        },
      ],
    }),
  ],
});
