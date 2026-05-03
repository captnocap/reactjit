import { defineGallerySection, defineGalleryStory } from '../types';
import { TabularHierarchy } from '../components/controls-specimen/TabularHierarchy';

export const tabularHierarchySection = defineGallerySection({
  id: 'tabular-hierarchy',
  title: 'Tabular Hierarchy',
  stories: [
    defineGalleryStory({
      id: 'tabular-hierarchy/default',
      title: 'Tabular Hierarchy',
      source: 'cart/component-gallery/components/controls-specimen/TabularHierarchy.tsx',
      status: 'ready',
      summary: 'Hierarchical metadata block with rotated row heads and current-row emphasis.',
      tags: ['controls', 'mixed-axis', 'atom'],
      variants: [
        {
          id: 'default',
          name: 'Default',
          render: () => <TabularHierarchy />,
        },
        {
          id: 'deploy',
          name: 'Deploy',
          render: () => (
            <TabularHierarchy
              rows={[
                { label: 'ENV', value: 'production' },
                { label: 'HOST', value: 'worker-g12' },
                { label: 'SHA', value: '4ab1d92' },
                { label: 'RUN', value: '#9138 · 2m04s', current: true },
              ]}
            />
          ),
        },
      ],
    }),
  ],
});
