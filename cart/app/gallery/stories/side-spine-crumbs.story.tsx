import { defineGallerySection, defineGalleryStory } from '../types';
import { SideSpineCrumbs } from '../components/controls-specimen/SideSpineCrumbs';

export const sideSpineCrumbsSection = defineGallerySection({
  id: 'side-spine-crumbs',
  title: 'Side Spine Crumbs',
  stories: [
    defineGalleryStory({
      id: 'side-spine-crumbs/default',
      title: 'Side Spine Crumbs',
      source: 'cart/component-gallery/components/controls-specimen/SideSpineCrumbs.tsx',
      status: 'ready',
      summary: 'Nested breadcrumb card with a rotated spine label and typographic path markers.',
      tags: ['controls', 'mixed-axis', 'atom'],
      variants: [
        {
          id: 'default',
          name: 'Default',
          render: () => <SideSpineCrumbs />,
        },
        {
          id: 'logs',
          name: 'Logs',
          render: () => <SideSpineCrumbs spineLabel="LOG · FS" crumbs={['var', 'logs', 'workers', 'W·02 · events.log']} />,
        },
      ],
    }),
  ],
});
