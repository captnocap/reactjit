import { defineGallerySection, defineGalleryStory } from '../types';
import { SegmentedControl } from '../components/controls-specimen/SegmentedControl';

export const segmentedControlSection = defineGallerySection({
  id: 'segmented-control',
  title: 'Segmented Control',
  stories: [
    defineGalleryStory({
      id: 'segmented-control/default',
      title: 'Segmented Control',
      source: 'cart/component-gallery/components/controls-specimen/SegmentedControl.tsx',
      status: 'ready',
      summary: 'Segmented selection control for compact mode and range switches.',
      tags: ['controls', 'selection', 'atom'],
      variants: [
        {
          id: 'range',
          name: 'Range',
          render: () => <SegmentedControl options={['DAY', 'WEEK', 'MONTH', 'YEAR']} active={1} />,
        },
        {
          id: 'sort',
          name: 'Sort',
          render: () => <SegmentedControl options={['ASC', 'DESC']} active={0} />,
        },
      ],
    }),
  ],
});
