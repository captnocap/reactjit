import { defineGallerySection, defineGalleryStory } from '../types';
import { ContourMap } from '../components/contour-map/ContourMap';

export const contourMapSection = defineGallerySection({
  id: 'contour-map',
  title: 'Contour Map',
  stories: [
    defineGalleryStory({
      id: 'contour-map/default',
      title: 'Contour Map',
      source: 'cart/component-gallery/components/contour-map/ContourMap.tsx',
      status: 'draft',
      variants: [
        {
          id: 'default',
          name: 'Default',
          render: () => <ContourMap />,
        },
      ],
    }),
  ],
});
