import { defineGallerySection, defineGalleryStory } from '../types';
import { AstQuilt, AstTile } from '../components/ast-quilt/AstQuilt';

export const astQuiltSection = defineGallerySection({
  id: 'ast-quilt',
  title: 'AST Quilt',
  stories: [
    defineGalleryStory({
      id: 'ast-quilt/default',
      title: 'AST Quilt',
      source: 'cart/component-gallery/components/ast-quilt/AstQuilt.tsx',
      status: 'ready',
      summary: 'Animated treemap mural ported from the SDL/Lua AST viewer into a deterministic Effect surface.',
      tags: ['effect', 'art', 'treemap', 'syntax'],
      variants: [
        {
          id: 'default',
          name: 'Quilt',
          render: () => <AstQuilt />,
        },
        {
          id: 'single-tile',
          name: 'Single Tile',
          render: () => <AstTile tileIndex={17} />,
        },
      ],
    }),
  ],
});
