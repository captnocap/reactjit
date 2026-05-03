import { defineGallerySection, defineGalleryStory } from '../types';
import { MeterSlider } from '../components/controls-specimen/MeterSlider';

export const meterSliderSection = defineGallerySection({
  id: 'meter-slider',
  title: 'Meter Slider',
  stories: [
    defineGalleryStory({
      id: 'meter-slider/default',
      title: 'Meter Slider',
      source: 'cart/component-gallery/components/controls-specimen/MeterSlider.tsx',
      status: 'ready',
      summary: 'In-bar numeric slider readout with quarter markers and accent or warning fill.',
      tags: ['controls', 'slider', 'atom'],
      variants: [
        {
          id: 'accent',
          name: 'Accent',
          render: () => <MeterSlider value={68} label="068 · IOPS" width={240} />,
        },
        {
          id: 'warn',
          name: 'Warn',
          render: () => <MeterSlider value={34} label="034 · Q·DEPTH" tone="warn" width={240} />,
        },
      ],
    }),
  ],
});
