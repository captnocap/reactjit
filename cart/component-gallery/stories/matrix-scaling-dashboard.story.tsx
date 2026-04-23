import { defineGallerySection, defineGalleryStory } from '../types';
import { MatrixScalingDashboard } from '../components/matrix-scaling-dashboard/MatrixScalingDashboard';

export const matrixScalingDashboardSection = defineGallerySection({
  id: 'matrix-scaling-dashboard',
  title: 'Matrix Scaling Dashboard',
  stories: [
    defineGalleryStory({
      id: 'matrix-scaling-dashboard/default',
      title: 'Matrix Scaling Dashboard',
      source: 'cart/component-gallery/components/matrix-scaling-dashboard/MatrixScalingDashboard.tsx',
      status: 'ready',
      summary: 'A shared seeded automaton rendered into six fixed-resolution pixel buffers.',
      tags: ['effect', 'simulation', 'pixel', 'dashboard'],
      variants: [
        {
          id: 'default',
          name: 'Default',
          summary: 'Projects one 256x256 logical matrix into 512px through 16px surfaces.',
          render: () => <MatrixScalingDashboard />,
        },
      ],
    }),
  ],
});
