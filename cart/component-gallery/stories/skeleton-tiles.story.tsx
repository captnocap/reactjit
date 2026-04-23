import { defineGallerySection, defineGalleryStory } from '../types';
import { SkeletonTiles } from '../components/skeleton-tiles/SkeletonTiles';

export const skeletonTilesSection = defineGallerySection({
  id: 'skeleton-tiles',
  title: 'Skeleton Tiles',
  stories: [
    defineGalleryStory({
      id: 'skeleton-tiles/default',
      title: 'Skeleton Tiles',
      source: 'cart/component-gallery/components/skeleton-tiles/SkeletonTiles.tsx',
      status: 'ready',
      variants: [
        {
          id: 'default',
          name: 'Default',
          render: () => <SkeletonTiles />,
        },
        {
          id: 'compact',
          name: 'Compact',
          render: () => <SkeletonTiles size="compact" />,
        },
      ],
    }),
  ],
});
