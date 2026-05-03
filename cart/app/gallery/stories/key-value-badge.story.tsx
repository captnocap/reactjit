import { defineGallerySection, defineGalleryStory } from '../types';
import { KeyValueBadge } from '../components/controls-specimen/KeyValueBadge';

export const keyValueBadgeSection = defineGallerySection({
  id: 'key-value-badge',
  title: 'Key Value Badge',
  stories: [
    defineGalleryStory({
      id: 'key-value-badge/default',
      title: 'Key Value Badge',
      source: 'cart/component-gallery/components/controls-specimen/KeyValueBadge.tsx',
      status: 'ready',
      summary: 'Split badge with a solid key tab and inline value readout.',
      tags: ['controls', 'badge', 'atom'],
      variants: [
        {
          id: 'pid',
          name: 'PID',
          render: () => <KeyValueBadge label="PID" value="0482" tone="accent" />,
        },
        {
          id: 'error',
          name: 'Error',
          render: () => <KeyValueBadge label="ERR" value="E·142" tone="flag" />,
        },
      ],
    }),
  ],
});
