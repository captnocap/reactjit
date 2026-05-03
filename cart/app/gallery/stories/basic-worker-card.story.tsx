import { defineGallerySection, defineGalleryStory } from '../types';
import { BasicWorkerCard } from '../components/basic-worker-card/BasicWorkerCard';

export const basicWorkerCardSection = defineGallerySection({
  id: "basic-worker-card",
  title: "Basic Worker Card",
  group: {
    id: "compositions",
    title: "Compositions",
  },
  kind: "atom",
  stories: [
    defineGalleryStory({
      id: "basic-worker-card/default",
      title: "Basic Worker Card",
      source: "cart/component-gallery/components/basic-worker-card/BasicWorkerCard.tsx",
      status: 'ready',
      tags: ["worker", "chat", "card"],
      variants: [
        {
          id: 'default',
          name: 'Default',
          render: () => <BasicWorkerCard />,
        },
      ],
    }),
  ],
});
