import { defineGallerySection, defineGalleryStory } from '../types';
import { GenericCard } from '../components/generic-card/GenericCard';

export const genericCardSection = defineGallerySection({
  id: 'generic-card',
  title: 'Generic Card',
  stories: [
    defineGalleryStory({
      id: 'generic-card/default',
      title: 'Generic Card',
      source: 'cart/component-gallery/components/generic-card/GenericCard.tsx',
      status: 'ready',
      variants: [
        {
          id: 'default',
          name: 'Default',
          render: () => <GenericCard />,
        },
      ],
    }),
  ],
});
