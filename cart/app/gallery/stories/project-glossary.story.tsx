import { defineGalleryDataStory, defineGallerySection } from '../types';
import { projectGlossaryMockData, projectGlossaryReferences, projectGlossarySchema } from '../data/project-glossary';

export const projectGlossarySection = defineGallerySection({
  id: "project-glossary",
  title: "Project Glossary",
  group: {
    id: "data-shapes",
    title: "Data Shapes",
  },
  kind: 'atom',
  stories: [
    defineGalleryDataStory({
      id: "project-glossary/catalog",
      title: "Project Glossary",
      source: "cart/component-gallery/data/project-glossary.ts",
      format: 'data',
      status: 'draft',
      tags: ["data"],
      storage: ["sqlite-document"],
      references: projectGlossaryReferences,
      schema: projectGlossarySchema,
      mockData: projectGlossaryMockData,
    }),
  ],
});
