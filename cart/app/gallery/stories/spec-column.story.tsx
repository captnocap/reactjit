import { defineGallerySection, defineGalleryStory } from '../types';
import { SpecColumn } from '../components/controls-specimen/SpecColumn';

export const specColumnSection = defineGallerySection({
  id: 'spec-column',
  title: 'Spec Column',
  stories: [
    defineGalleryStory({
      id: 'spec-column/default',
      title: 'Spec Column',
      source: 'cart/component-gallery/components/controls-specimen/SpecColumn.tsx',
      status: 'ready',
      summary: 'Archival mixed-axis column token for stacked identifiers and status tails.',
      tags: ['controls', 'badge', 'mixed-axis', 'atom'],
      variants: [
        {
          id: 'id',
          name: 'ID',
          render: () => <SpecColumn head="ID" value="0482" tail="SWEATSHOP · CORE" />,
        },
        {
          id: 'priority',
          name: 'Priority',
          render: () => <SpecColumn head="PRI" value="P0" tail="BLOCKING" tone="flag" />,
        },
      ],
    }),
  ],
});
