import { defineGallerySection, defineGalleryStory } from '../types';
import { SplineGraph } from '../components/spline-graph/SplineGraph';
import { DEMO_MONTHS, DEMO_TEMPERATURE } from '../lib/chart-utils';

const splineData = DEMO_MONTHS.map((label, i) => ({
  label,
  value: DEMO_TEMPERATURE[i],
}));

export const splineGraphSection = defineGallerySection({
  id: 'spline-graph',
  title: 'Spline Graph',
  stories: [
    defineGalleryStory({
      id: 'spline-graph/default',
      title: 'Spline Graph',
      source: 'cart/component-gallery/components/spline-graph/SplineGraph.tsx',
      status: 'draft',
      variants: [
        {
          id: 'default',
          name: 'Default',
          render: () => <SplineGraph data={splineData} />,
        },
      ],
    }),
  ],
});
