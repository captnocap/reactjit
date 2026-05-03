import { defineGallerySection, defineGalleryStory } from '../types';
import { GenericCardTitleBlock } from '../components/generic-card/GenericCardTitleBlock';

export const genericCardTitleBlockSection = defineGallerySection({
  id: "generic-card-title-block",
  title: "Generic Card Title Block",
  group: {
    id: "cards-tiles",
    title: "Cards & Tiles",
  },
  kind: "atom",
  stories: [
    defineGalleryStory({
      id: "generic-card-title-block/default",
      title: "Generic Card Title Block",
      source: "cart/component-gallery/components/generic-card/GenericCardTitleBlock.tsx",
      status: 'ready',
      summary: 'Primary headline plus supporting subtitle block.',
      tags: ['card', 'title', 'atom'],
      variants: [
        {
          id: 'default',
          name: 'Default',
          render: () => <GenericCardTitleBlock />,
        },
        {
          id: 'ops',
          name: 'Ops',
          render: () => (
            <GenericCardTitleBlock
              title="Ops Card"
              subtitle="Supporting detail for an alternate card state."
            />
          ),
        },
      ],
    }),
  ],
});
