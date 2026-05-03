import { defineGallerySection, defineGalleryStory } from '../types';
import { ChronologyTrail } from '../components/controls-specimen/ChronologyTrail';

export const chronologyTrailSection = defineGallerySection({
  id: 'chronology-trail',
  title: 'Chronology Trail',
  stories: [
    defineGalleryStory({
      id: 'chronology-trail/default',
      title: 'Chronology Trail',
      source: 'cart/component-gallery/components/controls-specimen/ChronologyTrail.tsx',
      status: 'ready',
      summary: 'Timestamped trail with left spine ticks for active and flagged events.',
      tags: ['controls', 'mixed-axis', 'atom'],
      variants: [
        {
          id: 'default',
          name: 'Default',
          render: () => <ChronologyTrail />,
        },
        {
          id: 'review',
          name: 'Review',
          render: () => (
            <ChronologyTrail
              events={[
                { ts: '09:12:01', label: 'review · opened' },
                { ts: '09:16:42', label: 'qa · failed', tone: 'flag' },
                { ts: '09:18:10', label: 'fix · running', tone: 'current' },
                { ts: '—', label: 'merge · pending' },
              ]}
            />
          ),
        },
      ],
    }),
  ],
});
