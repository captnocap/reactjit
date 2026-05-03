import { defineGallerySection, defineGalleryStory } from '../types';
import { DexBreadcrumbs } from '../components/dex-breadcrumbs/DexBreadcrumbs';

export const dexBreadcrumbsSection = defineGallerySection({
  id: "dex-breadcrumbs",
  title: "Dex Breadcrumbs",
  group: {
    id: "components",
    title: "Components",
  },
  kind: "atom",
  stories: [
    defineGalleryStory({
      id: "dex-breadcrumbs/default",
      title: "Dex Breadcrumbs",
      source: "cart/component-gallery/components/dex-breadcrumbs/DexBreadcrumbs.tsx",
      status: 'ready',
      summary: 'Compact path crumb row for selected data locations.',
      tags: ["data-explorer", "atom"],
      variants: [
        {
          id: 'default',
          name: 'Default',
          render: () => <DexBreadcrumbs />,
        },
      ],
    }),
  ],
});
