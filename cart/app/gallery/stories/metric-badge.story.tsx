import { defineGallerySection, defineGalleryStory } from '../types';
import { MetricBadge } from '../components/controls-specimen/MetricBadge';

export const metricBadgeSection = defineGallerySection({
  id: 'metric-badge',
  title: 'Metric Badge',
  stories: [
    defineGalleryStory({
      id: 'metric-badge/default',
      title: 'Metric Badge',
      source: 'cart/component-gallery/components/controls-specimen/MetricBadge.tsx',
      status: 'ready',
      summary: 'Framed metric readout with label block, accent value, and optional unit.',
      tags: ['controls', 'badge', 'atom'],
      variants: [
        {
          id: 'cpu',
          name: 'CPU',
          render: () => <MetricBadge label="cpu" value="62" unit="%" />,
        },
        {
          id: 'latency',
          name: 'Latency',
          render: () => <MetricBadge label="lat" value="118" unit="ms" />,
        },
      ],
    }),
  ],
});
