import { defineGalleryDataStory, defineGallerySection } from '../types';
import { workstreamMockData, workstreamReferences, workstreamSchema } from '../data/workstream';

export const workstreamSection = defineGallerySection({
  id: "workstream",
  title: "Workstream",
  group: {
    id: "data-shapes",
    title: "Data Shapes",
  },
  kind: 'atom',
  stories: [
    defineGalleryDataStory({
      id: "workstream/catalog",
      title: "Workstream",
      source: "cart/component-gallery/data/workstream.ts",
      format: 'data',
      status: 'draft',
      tags: ["data"],
      storage: ["sqlite-document"],
      references: workstreamReferences,
      schema: workstreamSchema,
      mockData: workstreamMockData,
    }),
  ],
});
