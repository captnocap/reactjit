import { defineGalleryDataStory, defineGallerySection } from '../types';
import { providerMockData, providerReferences, providerSchema } from '../data/provider';

export const providerSection = defineGallerySection({
  id: "provider",
  title: "Provider",
  group: {
    id: "data-shapes",
    title: "Data Shapes",
  },
  kind: 'atom',
  stories: [
    defineGalleryDataStory({
      id: "provider/catalog",
      title: "Provider",
      source: "cart/component-gallery/data/provider.ts",
      format: 'data',
      status: 'draft',
      tags: ["catalog", "connection"],
      storage: ["json-file"],
      references: providerReferences,
      schema: providerSchema,
      mockData: providerMockData,
    }),
  ],
});
