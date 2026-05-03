import { defineGallerySection, defineGalleryStory } from '../types';
import { GlyphStackBadge } from '../components/controls-specimen/GlyphStackBadge';

export const glyphStackBadgeSection = defineGallerySection({
  id: 'glyph-stack-badge',
  title: 'Glyph Stack Badge',
  stories: [
    defineGalleryStory({
      id: 'glyph-stack-badge/default',
      title: 'Glyph Stack Badge',
      source: 'cart/component-gallery/components/controls-specimen/GlyphStackBadge.tsx',
      status: 'ready',
      summary: 'Vertical badge that stacks glyphs upright with optional separator rules.',
      tags: ['controls', 'badge', 'mixed-axis', 'atom'],
      variants: [
        {
          id: 'worker',
          name: 'Worker',
          render: () => <GlyphStackBadge glyphs={['W', '0', '2', 'sep', '●']} accent={true} />,
        },
        {
          id: 'pid',
          name: 'PID',
          render: () => <GlyphStackBadge glyphs={['P', 'I', 'D', 'sep', '4', '8', '2']} />,
        },
      ],
    }),
  ],
});
