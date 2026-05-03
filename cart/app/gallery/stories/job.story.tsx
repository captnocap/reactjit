import { defineGalleryDataStory, defineGallerySection } from '../types';
import { jobMockData, jobReferences, jobSchema } from '../data/job';

export const jobSection = defineGallerySection({
  id: "job",
  title: "Job",
  group: {
    id: "data-shapes",
    title: "Data Shapes",
  },
  kind: 'atom',
  stories: [
    defineGalleryDataStory({
      id: "job/catalog",
      title: "Job",
      source: "cart/component-gallery/data/job.ts",
      format: 'data',
      status: 'draft',
      tags: ["data"],
      storage: ["sqlite-document"],
      references: jobReferences,
      schema: jobSchema,
      mockData: jobMockData,
    }),
  ],
});
