import { defineGallerySection, defineGalleryStory } from '../types';
import { StatusBadge } from '../components/controls-specimen/StatusBadge';

export const statusBadgeSection = defineGallerySection({
  id: "status-badge",
  title: "Status Badge",
  stories: [
    defineGalleryStory({
      id: "status-badge/default",
      title: "Status Badge",
      source: "cart/component-gallery/components/controls-specimen/StatusBadge.tsx",
      status: 'ready',
      summary: 'Design-system badge atom with outline, solid, LED, pill, and dot treatments.',
      tags: ['controls', 'badge', 'status', 'atom'],
      variants: [
        {
          id: 'outline',
          name: 'Outline',
          render: () => <StatusBadge label="RUNNING" tone="accent" />,
        },
        {
          id: 'solid',
          name: 'Solid',
          render: () => <StatusBadge label="READY" tone="ok" variant="solid" />,
        },
        {
          id: 'led',
          name: 'LED',
          render: () => <StatusBadge label="ACTIVE" tone="accent" variant="led" />,
        },
        {
          id: 'pill',
          name: 'Pill',
          render: () => <StatusBadge label="verified" tone="ok" variant="pill" />,
        },
        {
          id: 'dot',
          name: 'Dot',
          render: () => <StatusBadge label="degraded" tone="warn" variant="dot" />,
        },
      ],
    }),
  ],
});
