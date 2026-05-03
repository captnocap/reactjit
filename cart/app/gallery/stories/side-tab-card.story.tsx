import { defineGallerySection, defineGalleryStory } from '../types';
import { SideTabCard } from '../components/controls-specimen/SideTabCard';

export const sideTabCardSection = defineGallerySection({
  id: 'side-tab-card',
  title: 'Side Tab Card',
  stories: [
    defineGalleryStory({
      id: 'side-tab-card/default',
      title: 'Side Tab Card',
      source: 'cart/component-gallery/components/controls-specimen/SideTabCard.tsx',
      status: 'ready',
      summary: 'Mixed-axis readout card with a vertical spine tab and horizontal value block.',
      tags: ['controls', 'badge', 'mixed-axis', 'atom'],
      variants: [
        {
          id: 'focus',
          name: 'Focus',
          render: () => <SideTabCard spine="WORKER" title="focus" value="W·02" sub="4m 12s" />,
        },
        {
          id: 'alert',
          name: 'Alert',
          render: () => <SideTabCard spine="ALERT" tone="flag" title="code" value="E·142" sub="ret × 3" />,
        },
      ],
    }),
  ],
});
