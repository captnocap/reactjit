import { defineGallerySection, defineGalleryStory } from '../types';
import { ProjectionSurfaceWall } from '../components/sweatshop-matrix-display/ProjectionSurfaceWall';

export const sweatshopMatrixDisplaySection = defineGallerySection({
  id: 'sweatshop-matrix-display',
  title: 'Projection Surface',
  stories: [
    defineGalleryStory({
      id: 'sweatshop-matrix-display/default',
      title: 'Projection Surface',
      source: 'cart/component-gallery/components/sweatshop-matrix-display/ProjectionSurfaceWall.tsx',
      status: 'ready',
      summary: 'Single comparison wall showing each effect type as a cascading size row, with the matrix projection surface folded into the same screen.',
      tags: ['effect', 'matrix', 'braille', 'projection', 'surface'],
      variants: [
        {
          id: 'comparison-wall',
          name: 'Comparison Wall',
          summary: 'Every projection type is shown on one surface as rows of 16x16, 32x32, 64x64, 128x128, and 512x512 outputs.',
          render: () => <ProjectionSurfaceWall />,
        },
      ],
    }),
  ],
});
