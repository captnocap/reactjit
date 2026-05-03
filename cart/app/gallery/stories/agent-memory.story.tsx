import { defineGalleryDataStory, defineGallerySection } from '../types';
import { agentMemoryMockData, agentMemoryReferences, agentMemorySchema } from '../data/agent-memory';

export const agentMemorySection = defineGallerySection({
  id: "agent-memory",
  title: "Agent Memory",
  group: {
    id: "data-shapes",
    title: "Data Shapes",
  },
  kind: 'atom',
  stories: [
    defineGalleryDataStory({
      id: "agent-memory/catalog",
      title: "Agent Memory",
      source: "cart/component-gallery/data/agent-memory.ts",
      format: 'data',
      status: 'draft',
      tags: ["memory", "identity"],
      storage: ["atomic-file-to-db"],
      references: agentMemoryReferences,
      schema: agentMemorySchema,
      mockData: agentMemoryMockData,
    }),
  ],
});
