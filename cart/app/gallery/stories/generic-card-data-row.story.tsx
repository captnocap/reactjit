import { defineGallerySection, defineGalleryStory } from '../types';
import { GenericCardDataRow } from '../components/generic-card/GenericCardDataRow';

export const genericCardDataRowSection = defineGallerySection({
  id: "generic-card-data-row",
  title: "Generic Card Data Row",
  group: {
    id: "cards-tiles",
    title: "Cards & Tiles",
  },
  kind: "atom",
  stories: [
    defineGalleryStory({
      id: "generic-card-data-row/default",
      title: "Generic Card Data Row",
      source: "cart/component-gallery/components/generic-card/GenericCardDataRow.tsx",
      status: 'ready',
      summary: 'Single indexed data row with tone-based value coloring.',
      tags: ['card', 'row', 'atom'],
      variants: [
        {
          id: 'default',
          name: 'Default',
          render: () => <GenericCardDataRow />,
        },
        {
          id: 'warm',
          name: 'Warm',
          render: () => <GenericCardDataRow index={1} row={{ label: 'Queue depth', value: 'High', tone: 'warm' }} />,
        },
      ],
    }),
  ],
});
