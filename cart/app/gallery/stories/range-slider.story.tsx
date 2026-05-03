import { defineGallerySection, defineGalleryStory } from '../types';
import { RangeSlider } from '../components/controls-specimen/RangeSlider';

export const rangeSliderSection = defineGallerySection({
  id: "range-slider",
  title: "Range Slider",
  stories: [
    defineGalleryStory({
      id: "range-slider/default",
      title: "Range Slider",
      source: "cart/component-gallery/components/controls-specimen/RangeSlider.tsx",
      status: 'ready',
      summary: 'Dual-thumb window slider used in the specimen’s range controls.',
      tags: ['controls', 'slider', 'range', 'atom'],
      variants: [
        {
          id: 'window',
          name: 'Window',
          render: () => <RangeSlider low={28} high={74} width={240} />,
        },
        {
          id: 'focus',
          name: 'Focus',
          render: () => <RangeSlider low={12} high={42} width={240} />,
        },
      ],
    }),
  ],
});
