import { defineGallerySection, defineGalleryStory } from '../types';
import { GenericCardHeader } from '../components/generic-card/GenericCardHeader';

export const genericCardHeaderSection = defineGallerySection({
  id: "generic-card-header",
  title: "Generic Card Header",
  group: {
    id: "cards-tiles",
    title: "Cards & Tiles",
  },
  kind: "atom",
  stories: [
    defineGalleryStory({
      id: "generic-card-header/default",
      title: "Generic Card Header",
      source: "cart/component-gallery/components/generic-card/GenericCardHeader.tsx",
      status: 'ready',
      summary: 'Eyebrow metadata row with a trailing score readout.',
      tags: ['card', 'header', 'atom'],
      variants: [
        {
          id: 'default',
          name: 'Default',
          render: () => <GenericCardHeader />,
        },
        {
          id: 'audit',
          name: 'Audit',
          render: () => <GenericCardHeader eyebrow="3 audit  sync  nightly *" score="61%" />,
        },
      ],
    }),
  ],
});
