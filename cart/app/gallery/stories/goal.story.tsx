import { defineGalleryDataStory, defineGallerySection } from '../types';
import { goalMockData, goalReferences, goalSchema } from '../data/goal';

export const goalSection = defineGallerySection({
  id: "goal",
  title: "Goal",
  group: {
    id: "data-shapes",
    title: "Data Shapes",
  },
  kind: 'atom',
  stories: [
    defineGalleryDataStory({
      id: "goal/catalog",
      title: "Goal",
      source: "cart/component-gallery/data/goal.ts",
      format: 'data',
      status: 'draft',
      tags: ["data"],
      storage: ["sqlite-document"],
      references: goalReferences,
      schema: goalSchema,
      mockData: goalMockData,
    }),
  ],
});
