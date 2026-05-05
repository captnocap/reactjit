import { Box } from '@reactjit/runtime/primitives';
import { defineGallerySection, defineGalleryStory } from '../types';
import { DocumentOutline } from '../components/document-viewer/DocumentOutline';
import {
  collectOutline,
  SAMPLE_DOCUMENT,
} from '../components/document-viewer/documentViewerShared';

const ENTRIES = collectOutline(SAMPLE_DOCUMENT);

export const documentOutlineSection = defineGallerySection({
  id: 'document-outline',
  title: 'Document Outline',
  stories: [
    defineGalleryStory({
      id: 'document-outline/default',
      title: 'Document Outline',
      source: 'cart/app/gallery/components/document-viewer/DocumentOutline.tsx',
      status: 'draft',
      summary: 'Sidebar table of contents listing every heading with active highlight.',
      tags: ['panel', 'selector'],
      variants: [
        {
          id: 'first-active',
          name: 'First Active',
          render: () => (
            <Box style={{ width: 200, height: 320 }}>
              <DocumentOutline entries={ENTRIES} activeId={ENTRIES[0]?.id ?? null} />
            </Box>
          ),
        },
        {
          id: 'mid-active',
          name: 'Mid Active',
          render: () => (
            <Box style={{ width: 200, height: 320 }}>
              <DocumentOutline entries={ENTRIES} activeId={ENTRIES[3]?.id ?? null} />
            </Box>
          ),
        },
      ],
    }),
  ],
});
