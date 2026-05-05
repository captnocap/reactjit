import { Box } from '@reactjit/runtime/primitives';
import { defineGallerySection, defineGalleryStory } from '../types';
import { DocumentViewer } from '../components/document-viewer/DocumentViewer';

export const documentViewerSection = defineGallerySection({
  id: 'document-viewer',
  title: 'Document Viewer',
  group: {
    id: 'compositions',
    title: 'Compositions',
  },
  kind: 'top-level',
  composedOf: [
    'cart/app/gallery/components/document-viewer/DocumentPage.tsx',
    'cart/app/gallery/components/document-viewer/DocumentToolbar.tsx',
    'cart/app/gallery/components/document-viewer/DocumentOutline.tsx',
    'cart/app/gallery/components/document-viewer/DocumentBlock.tsx',
  ],
  stories: [
    defineGalleryStory({
      id: 'document-viewer/default',
      title: 'Document Viewer',
      source: 'cart/app/gallery/components/document-viewer/DocumentViewer.tsx',
      status: 'draft',
      variants: [
        {
          id: 'large',
          name: 'Large (with outline)',
          render: () => (
            <Box style={{ width: 760, height: 520 }}>
              <DocumentViewer />
            </Box>
          ),
        },
        {
          id: 'small',
          name: 'Small (collapsed)',
          render: () => (
            <Box style={{ width: 360, height: 480 }}>
              <DocumentViewer />
            </Box>
          ),
        },
        {
          id: 'fluid',
          name: 'Fluid (fills slot)',
          render: () => (
            <Box style={{ width: '100%', height: 460 }}>
              <DocumentViewer />
            </Box>
          ),
        },
      ],
    }),
  ],
});
