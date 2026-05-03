import { defineGallerySection, defineGalleryStory } from '../types';
import { DiodeSelector } from '../components/controls-specimen/DiodeSelector';

export const diodeSelectorSection = defineGallerySection({
  id: 'diode-selector',
  title: 'Diode Selector',
  stories: [
    defineGalleryStory({
      id: 'diode-selector/default',
      title: 'Diode Selector',
      source: 'cart/component-gallery/components/controls-specimen/DiodeSelector.tsx',
      status: 'ready',
      summary: 'Numeric diode bank selector with LED pips and active frame tint.',
      tags: ['controls', 'selection', 'atom'],
      variants: [
        {
          id: 'tiers',
          name: 'Tiers',
          render: () => (
            <DiodeSelector
              active={1}
              options={[
                { number: '01', label: 'TIER' },
                { number: '02', label: 'TIER' },
                { number: '03', label: 'TIER' },
                { number: '04', label: 'TIER' },
              ]}
            />
          ),
        },
      ],
    }),
  ],
});
