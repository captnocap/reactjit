import { defineGallerySection, defineGalleryStory } from '../types';
import { FileTabCard } from '../components/controls-specimen/FileTabCard';

export const fileTabCardSection = defineGallerySection({
  id: "file-tab-card",
  title: "File Tab Card",
  stories: [
    defineGalleryStory({
      id: "file-tab-card/default",
      title: "File Tab Card",
      source: "cart/component-gallery/components/controls-specimen/FileTabCard.tsx",
      status: 'ready',
      summary: 'Horizontal card with a protruding vertical file tab label.',
      tags: ['controls', 'file-tab', 'mixed-axis', 'atom'],
      variants: [
        {
          id: 'spec',
          name: 'Spec',
          render: () => <FileTabCard />,
        },
        {
          id: 'alert',
          name: 'Alert',
          render: () => (
            <FileTabCard
              leaf="RAT · 02"
              tone="flag"
              title="Rat lock incident review"
              meta={[
                { label: 'OWNER', value: 'safety' },
                { label: 'v', value: '0.4' },
                { label: 'TOUCHED', value: '14:07Z' },
              ]}
            />
          ),
        },
      ],
    }),
  ],
});
