import { defineGalleryDataStory, defineGallerySection } from '../types';
import { interpretationMockData, interpretationReferences, interpretationSchema } from '../data/interpretation';

export const interpretationSection = defineGallerySection({
  id: "interpretation",
  title: "Interpretation",
  group: {
    id: "data-shapes",
    title: "Data Shapes",
  },
  kind: 'atom',
  stories: [
    defineGalleryDataStory({
      id: "interpretation/catalog",
      title: "Interpretation",
      source: "cart/component-gallery/data/interpretation.ts",
      format: 'data',
      status: 'draft',
      tags: ["data"],
      storage: ["sqlite-document"],
      references: interpretationReferences,
      schema: interpretationSchema,
      mockData: interpretationMockData,
    }),
  ],
});
