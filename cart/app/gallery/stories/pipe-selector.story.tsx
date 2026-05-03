import { defineGallerySection, defineGalleryStory } from '../types';
import { PipeSelector } from '../components/controls-specimen/PipeSelector';

export const pipeSelectorSection = defineGallerySection({
  id: 'pipe-selector',
  title: 'Pipe Selector',
  stories: [
    defineGalleryStory({
      id: 'pipe-selector/default',
      title: 'Pipe Selector',
      source: 'cart/component-gallery/components/controls-specimen/PipeSelector.tsx',
      status: 'ready',
      summary: 'Vertical selector with pipe spine, active tick, and compact status pip.',
      tags: ['controls', 'selection', 'atom'],
      variants: [
        {
          id: 'streams',
          name: 'Streams',
          render: () => (
            <PipeSelector
              active={1}
              options={[
                'context · kernel',
                'tool invocations',
                'worker streams',
                'file edits',
                'git audit',
              ]}
            />
          ),
        },
      ],
    }),
  ],
});
