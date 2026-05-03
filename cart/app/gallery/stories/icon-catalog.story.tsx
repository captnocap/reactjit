import { defineGallerySection, defineGalleryStory } from '../types';
import { IconCatalog } from '../components/icon-catalog/IconCatalog';

export const iconCatalogSection = defineGallerySection({
  id: 'icon-catalog',
  title: 'Icon Catalog',
  group: {
    id: 'systems',
    title: 'Systems & Catalogs',
  },
  kind: 'atom',
  stories: [
    defineGalleryStory({
      id: 'icon-catalog/default',
      title: 'Icon Catalog',
      source: 'cart/component-gallery/components/icon-catalog/IconCatalog.tsx',
      status: 'ready',
      summary: 'Registered runtime icon inventory grouped into the atom gallery for fast scanning.',
      tags: ['panel'],
      variants: [
        {
          id: 'default',
          name: 'Default',
          render: () => <IconCatalog />,
        },
      ],
    }),
  ],
});
