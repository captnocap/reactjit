import { defineGallerySection, defineGalleryStory } from '../types';
import { LadderTrail } from '../components/controls-specimen/LadderTrail';

export const ladderTrailSection = defineGallerySection({
  id: "ladder-trail",
  title: "Ladder Trail",
  stories: [
    defineGalleryStory({
      id: "ladder-trail/default",
      title: "Ladder Trail",
      source: "cart/component-gallery/components/controls-specimen/LadderTrail.tsx",
      status: 'ready',
      summary: 'Vertical breadcrumb / chronology atom used in the mixed-axis specimen section.',
      tags: ['controls', 'breadcrumbs', 'trail', 'atom'],
      variants: [
        {
          id: 'default',
          name: 'Default',
          render: () => <LadderTrail />,
        },
      ],
    }),
  ],
});
