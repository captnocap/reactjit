import { defineGalleryDataStory, defineGallerySection } from '../types';
import { researchMockData, researchReferences, researchSchema } from '../data/research';

export const researchSection = defineGallerySection({
  id: "research",
  title: "Research",
  group: {
    id: "data-shapes",
    title: "Data Shapes",
  },
  kind: 'atom',
  stories: [
    defineGalleryDataStory({
      id: "research/catalog",
      title: "Research",
      source: "cart/component-gallery/data/research.ts",
      format: 'data',
      status: 'draft',
      tags: ["research", "inquiry", "findings"],
      storage: ["sqlite-document"],
      references: researchReferences,
      schema: researchSchema,
      mockData: researchMockData,
    }),
  ],
});
