import { defineGalleryDataStory, defineGallerySection } from '../types';
import { planMockData, planReferences, planSchema } from '../data/plan';

export const planSection = defineGallerySection({
  id: "plan",
  title: "Plan",
  group: {
    id: "data-shapes",
    title: "Data Shapes",
  },
  kind: 'atom',
  stories: [
    defineGalleryDataStory({
      id: "plan/catalog",
      title: "Plan",
      source: "cart/component-gallery/data/plan.ts",
      format: 'data',
      status: 'draft',
      tags: ["plan", "intent", "project"],
      storage: ["json-file"],
      references: planReferences,
      schema: planSchema,
      mockData: planMockData,
    }),
  ],
});
