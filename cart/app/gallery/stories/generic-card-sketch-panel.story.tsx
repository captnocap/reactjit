import { defineGallerySection, defineGalleryStory } from '../types';
import { GenericCardSketchPanel } from '../components/generic-card/GenericCardSketchPanel';

export const genericCardSketchPanelSection = defineGallerySection({
  id: "generic-card-sketch-panel",
  title: "Generic Card Sketch Panel",
  group: {
    id: "cards-tiles",
    title: "Cards & Tiles",
  },
  kind: "atom",
  stories: [
    defineGalleryStory({
      id: "generic-card-sketch-panel/default",
      title: "Generic Card Sketch Panel",
      source: "cart/component-gallery/components/generic-card/GenericCardSketchPanel.tsx",
      status: 'ready',
      summary: 'Monospace schematic panel used as the visual center block of the card.',
      tags: ['card', 'diagram', 'atom'],
      variants: [
        {
          id: 'default',
          name: 'Default',
          render: () => <GenericCardSketchPanel />,
        },
        {
          id: 'compact',
          name: 'Compact',
          render: () => (
            <GenericCardSketchPanel
              lines={[
                '  ┌──┐    ┌──┐  ',
                '  │  └────┘  │  ',
                '  │  sync bus│  ',
                '  └──────────┘  ',
              ]}
            />
          ),
        },
      ],
    }),
  ],
});
