import { defineGallerySection, defineGalleryStory } from '../types';
import { GenericCard } from '../components/generic-card/GenericCard';

export const genericCardSection = defineGallerySection({
  id: 'generic-card',
  title: 'Generic Card',
  group: {
    id: 'compositions',
    title: 'Compositions',
  },
  kind: 'top-level',
  composedOf: [
    'cart/component-gallery/components/generic-card/GenericCardShell.tsx',
    'cart/component-gallery/components/generic-card/GenericCardHeader.tsx',
    'cart/component-gallery/components/generic-card/GenericCardTitleBlock.tsx',
    'cart/component-gallery/components/generic-card/GenericCardSketchPanel.tsx',
    'cart/component-gallery/components/generic-card/GenericCardMetricBar.tsx',
    'cart/component-gallery/components/generic-card/GenericCardDataRow.tsx',
  ],
  stories: [
    defineGalleryStory({
      id: 'generic-card/default',
      title: 'Generic Card',
      source: 'cart/component-gallery/components/generic-card/GenericCard.tsx',
      status: 'ready',
      summary: 'Card composition rebuilt from shell, header, title, sketch, metric, and data-row atoms.',
      tags: ['card', 'composition', 'shell'],
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
