import { defineGalleryDataStory, defineGallerySection } from '../types';
import { roleAssignmentMockData, roleAssignmentReferences, roleAssignmentSchema } from '../data/role-assignment';

export const roleAssignmentSection = defineGallerySection({
  id: "role-assignment",
  title: "Role Assignment",
  group: {
    id: "data-shapes",
    title: "Data Shapes",
  },
  kind: 'atom',
  stories: [
    defineGalleryDataStory({
      id: "role-assignment/catalog",
      title: "Role Assignment",
      source: "cart/component-gallery/data/role-assignment.ts",
      format: 'data',
      status: 'draft',
      tags: ["role", "assignment", "worker"],
      storage: ["sqlite-table"],
      references: roleAssignmentReferences,
      schema: roleAssignmentSchema,
      mockData: roleAssignmentMockData,
    }),
  ],
});
