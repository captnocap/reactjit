import { defineGalleryDataStory, defineGallerySection } from '../types';
import { retrievalStrategyMockData, retrievalStrategyReferences, retrievalStrategySchema } from '../data/retrieval-strategy';

export const retrievalStrategySection = defineGallerySection({
  id: "retrieval-strategy",
  title: "Retrieval Strategy",
  group: {
    id: "data-shapes",
    title: "Data Shapes",
  },
  kind: 'atom',
  stories: [
    defineGalleryDataStory({
      id: "retrieval-strategy/catalog",
      title: "Retrieval Strategy",
      source: "cart/component-gallery/data/retrieval-strategy.ts",
      format: 'data',
      status: 'draft',
      tags: ["data"],
      storage: ["json-file"],
      references: retrievalStrategyReferences,
      schema: retrievalStrategySchema,
      mockData: retrievalStrategyMockData,
    }),
  ],
});
