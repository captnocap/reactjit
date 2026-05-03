import { defineGallerySection, defineGalleryStory } from '../types';
import { AxisReadout } from '../components/controls-specimen/AxisReadout';

export const axisReadoutSection = defineGallerySection({
  id: "axis-readout",
  title: "Axis Readout",
  stories: [
    defineGalleryStory({
      id: "axis-readout/default",
      title: "Axis Readout",
      source: "cart/component-gallery/components/controls-specimen/AxisReadout.tsx",
      status: 'ready',
      summary: 'Vertical axis title plus horizontal bars readout from the marginalia page.',
      tags: ['controls', 'axis', 'mixed-axis', 'atom'],
      variants: [
        {
          id: 'default',
          name: 'Default',
          render: () => <AxisReadout />,
        },
      ],
    }),
  ],
});
