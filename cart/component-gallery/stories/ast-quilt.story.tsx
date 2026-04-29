import { defineGallerySection, defineGalleryStory } from '../types';
import { AstBinarySquares, AstBinaryTile, AstQuilt, AstTile } from '../components/ast-quilt/AstQuilt';
import { FileFingerprintWorkbench } from '../components/ast-quilt/FileFingerprintWorkbench';
import {
  AstFingerprintEffect,
  AstFingerprintEffectGrid,
} from '../components/ast-quilt/EffectFromFingerprint';
import { FingerprintEffectWorkbench } from '../components/ast-quilt/FingerprintEffectWorkbench';
import { AST_SAMPLE_FILES } from '../components/ast-quilt/sampleContract';

export const astQuiltSection = defineGallerySection({
  id: 'ast-quilt',
  title: 'AST Quilt',
  stories: [
    defineGalleryStory({
      id: 'ast-quilt/default',
      title: 'AST Quilt',
      source: 'cart/component-gallery/components/ast-quilt/AstQuilt.tsx',
      status: 'ready',
      summary: 'Treemap, binary-square, and gene-driven procedural fingerprint tiles. Same file always lands on the same effect.',
      tags: ['effect', 'fingerprint', 'treemap', 'binary', 'procedural', 'runtime'],
      variants: [
        {
          id: 'default',
          name: 'Quilt',
          render: () => <AstQuilt />,
        },
        {
          id: 'binary-squares',
          name: 'Binary Squares',
          render: () => <AstBinarySquares />,
        },
        {
          id: 'single-tile',
          name: 'Single Tile',
          render: () => <AstTile file={{ ...AST_SAMPLE_FILES[17], selected: true, tagColor: '#6aa390' }} tileIndex={17} />,
        },
        {
          id: 'binary-tile',
          name: 'Binary Tile',
          render: () => <AstBinaryTile file={{ ...AST_SAMPLE_FILES[17], selected: true, tagColor: '#6aa390' }} tileIndex={17} />,
        },
        {
          id: 'random-effect',
          name: 'Random Effect',
          render: () => <AstFingerprintEffect file={AST_SAMPLE_FILES[7]} />,
        },
        {
          id: 'random-effect-grid',
          name: 'Random Effect Grid',
          render: () => <AstFingerprintEffectGrid gridSide={4} />,
        },
        {
          id: 'random-effect-grid-dense',
          name: 'Random Effect Grid (6×6)',
          render: () => <AstFingerprintEffectGrid gridSide={6} />,
        },
        {
          id: 'random-effect-from-file',
          name: 'Random Effect From File',
          render: () => <FingerprintEffectWorkbench initialPath="cart/component-gallery/components/ast-quilt/AstQuilt.tsx" />,
        },
        {
          id: 'from-file',
          name: 'From File',
          render: () => <FileFingerprintWorkbench initialPath="cart/component-gallery/components/ast-quilt/AstQuilt.tsx" />,
        },
        {
          id: 'from-file-binary',
          name: 'From File Binary',
          render: () => (
            <FileFingerprintWorkbench
              initialPath="cart/component-gallery/components/ast-quilt/AstQuilt.tsx"
              previewMode="binary-squares"
            />
          ),
        },
      ],
    }),
  ],
});
