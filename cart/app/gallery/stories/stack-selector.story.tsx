import { defineGallerySection, defineGalleryStory } from '../types';
import { StackSelector } from '../components/controls-specimen/StackSelector';

export const stackSelectorSection = defineGallerySection({
  id: 'stack-selector',
  title: 'Stack Selector',
  stories: [
    defineGalleryStory({
      id: 'stack-selector/default',
      title: 'Stack Selector',
      source: 'cart/component-gallery/components/controls-specimen/StackSelector.tsx',
      status: 'ready',
      summary: 'Stacked card selector with inline radio marker and trailing cost readout.',
      tags: ['controls', 'selection', 'atom'],
      variants: [
        {
          id: 'models',
          name: 'Models',
          render: () => (
            <StackSelector
              active={1}
              options={[
                { label: 'haiku · 1.4k', cost: '$0.01' },
                { label: 'sonnet · 18k', cost: '$0.06' },
                { label: 'opus · 42k', cost: '$0.22' },
              ]}
            />
          ),
        },
      ],
    }),
  ],
});
