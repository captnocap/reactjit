import { defineGalleryDataStory, defineGallerySection } from '../types';
import { barrierMockData, barrierReferences, barrierSchema } from '../data/barrier';

export const barrierSection = defineGallerySection({
  id: "barrier",
  title: "Barrier",
  group: {
    id: "data-shapes",
    title: "Data Shapes",
  },
  kind: 'atom',
  stories: [
    defineGalleryDataStory({
      id: "barrier/catalog",
      title: "Barrier",
      source: "cart/component-gallery/data/barrier.ts",
      format: 'data',
      status: 'draft',
      tags: ["data"],
      storage: ["sqlite-document"],
      references: barrierReferences,
      schema: barrierSchema,
      mockData: barrierMockData,
    }),
  ],
});
