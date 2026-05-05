import { defineGallerySection, defineGalleryStory } from '../types';
import { ConditionalGutters } from '../components/conditional-gutters/ConditionalGutters';

export const conditionalGuttersSection = defineGallerySection({
  id: 'conditional-gutters',
  title: 'Conditional Gutters',
  group: {
    id: 'motion',
    title: 'Motion',
  },
  kind: 'top-level',
  composedOf: [
    'cart/app/gallery/components/conditional-gutters/ConditionalGutter.tsx',
    'cart/app/gallery/components/conditional-gutters/GutterChrome.tsx',
    'cart/app/gallery/components/conditional-gutters/GutterToggle.tsx',
    'cart/app/gallery/components/conditional-gutters/gutterMotion.ts',
  ],
  stories: [
    defineGalleryStory({
      id: 'conditional-gutters/default',
      title: 'Conditional Gutters',
      source: 'cart/app/gallery/components/conditional-gutters/ConditionalGutters.tsx',
      status: 'draft',
      summary: 'Edge-owned layout gutters that animate through app shell close and hide states.',
      tags: ['motion', 'layout', 'shell', 'gutter'],
      variants: [
        {
          id: 'app-shell',
          name: 'App Shell',
          render: () => <ConditionalGutters preset="app-shell" />,
        },
        {
          id: 'all-edges',
          name: 'All Edges',
          render: () => <ConditionalGutters preset="all-edges" />,
        },
        {
          id: 'writer',
          name: 'Writer',
          render: () => <ConditionalGutters preset="writer" />,
        },
      ],
    }),
  ],
});

