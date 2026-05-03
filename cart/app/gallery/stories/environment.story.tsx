import { defineGalleryDataStory, defineGallerySection } from '../types';
import { environmentMockData, environmentReferences, environmentSchema } from '../data/environment';

export const environmentSection = defineGallerySection({
  id: "environment",
  title: "Environment",
  group: {
    id: "data-shapes",
    title: "Data Shapes",
  },
  kind: 'atom',
  stories: [
    defineGalleryDataStory({
      id: "environment/catalog",
      title: "Environment",
      source: "cart/component-gallery/data/environment.ts",
      format: 'data',
      status: 'draft',
      tags: ["environment", "project", "runtime"],
      storage: ["json-file"],
      references: environmentReferences,
      schema: environmentSchema,
      mockData: environmentMockData,
    }),
  ],
});
