import { defineGallerySection, defineGalleryStory } from '../types';
import { GenericCardMetricBar } from '../components/generic-card/GenericCardMetricBar';

export const genericCardMetricBarSection = defineGallerySection({
  id: "generic-card-metric-bar",
  title: "Generic Card Metric Bar",
  group: {
    id: "cards-tiles",
    title: "Cards & Tiles",
  },
  kind: "atom",
  stories: [
    defineGalleryStory({
      id: "generic-card-metric-bar/default",
      title: "Generic Card Metric Bar",
      source: "cart/component-gallery/components/generic-card/GenericCardMetricBar.tsx",
      status: 'ready',
      summary: 'Single metric row with label, fill rail, and numeric readout.',
      tags: ['card', 'metric', 'atom'],
      variants: [
        {
          id: 'default',
          name: 'Default',
          render: () => <GenericCardMetricBar />,
        },
        {
          id: 'accent',
          name: 'Accent',
          render: () => (
            <GenericCardMetricBar metric={{ label: 'Accent', value: '31%', fill: 0.31, color: '#d26a2a' }} />
          ),
        },
      ],
    }),
  ],
});
