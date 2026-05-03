import { defineGallerySection, defineGalleryStory } from '../types';
import { TelemetryStats } from '../components/generic-chat-card/TelemetryStats';

export const telemetryStatsSection = defineGallerySection({
  id: 'telemetry-stats',
  title: 'Telemetry Stats',
  stories: [
    defineGalleryStory({
      id: 'telemetry-stats/default',
      title: 'Telemetry Stats',
      source: 'cart/component-gallery/components/generic-chat-card/TelemetryStats.tsx',
      status: 'ready',
      summary: 'Compact monospace runtime readout atom used in the chat card telemetry bar.',
      tags: ['chat', 'console', 'telemetry'],
      variants: [
        {
          id: 'evaluating',
          name: 'Evaluating',
          render: () => <TelemetryStats state="evaluating_plan" time="14:24" />,
        },
        {
          id: 'streaming',
          name: 'Streaming',
          render: () => <TelemetryStats state="streaming_patch" time="03:17" />,
        },
      ],
    }),
  ],
});
