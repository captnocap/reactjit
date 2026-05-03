import { defineGallerySection, defineGalleryStory } from '../types';
import { DexSearchBar } from '../components/dex-search-bar/DexSearchBar';

export const dexSearchBarSection = defineGallerySection({
  id: "dex-search-bar",
  title: "Dex Search Bar",
  group: {
    id: "components",
    title: "Components",
  },
  kind: "atom",
  stories: [
    defineGalleryStory({
      id: "dex-search-bar/default",
      title: "Dex Search Bar",
      source: "cart/component-gallery/components/dex-search-bar/DexSearchBar.tsx",
      status: 'ready',
      summary: 'Explorer search strip with count and keyboard hint.',
      tags: ["data-explorer", "atom"],
      variants: [
        {
          id: 'default',
          name: 'Default',
          render: () => <DexSearchBar />,
        },
      ],
    }),
  ],
});
