import { defineGalleryDataStory, defineGallerySection } from '../types';
import { workingMemoryMockData, workingMemoryReferences, workingMemorySchema } from '../data/working-memory';

export const workingMemorySection = defineGallerySection({
  id: "working-memory",
  title: "Working Memory",
  group: {
    id: "data-shapes",
    title: "Data Shapes",
  },
  kind: 'atom',
  stories: [
    defineGalleryDataStory({
      id: "working-memory/catalog",
      title: "Working Memory",
      source: "cart/component-gallery/data/working-memory.ts",
      format: 'data',
      status: 'draft',
      tags: ["memory", "attention", "worker"],
      storage: ["json-file"],
      references: workingMemoryReferences,
      schema: workingMemorySchema,
      mockData: workingMemoryMockData,
    }),
  ],
});
