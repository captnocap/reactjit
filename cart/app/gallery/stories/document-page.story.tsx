import { Box } from '@reactjit/runtime/primitives';
import { defineGallerySection, defineGalleryStory } from '../types';
import { DocumentPage } from '../components/document-viewer/DocumentPage';
import { SAMPLE_DOCUMENT } from '../components/document-viewer/documentViewerShared';

export const documentPageSection = defineGallerySection({
  id: 'document-page',
  title: 'Document Page',
  stories: [
    defineGalleryStory({
      id: 'document-page/default',
      title: 'Document Page',
      source: 'cart/app/gallery/components/document-viewer/DocumentPage.tsx',
      status: 'draft',
      summary: 'Cream paper surface that hosts heading/paragraph/list/quote/code blocks.',
      tags: ['panel', 'card'],
      variants: [
        {
          id: 'comfortable',
          name: 'Comfortable',
          render: () => (
            <Box style={{ width: 520, height: 460 }}>
              <DocumentPage document={SAMPLE_DOCUMENT} size="comfortable" />
            </Box>
          ),
        },
        {
          id: 'compact',
          name: 'Compact',
          render: () => (
            <Box style={{ width: 320, height: 440 }}>
              <DocumentPage document={SAMPLE_DOCUMENT} size="compact" />
            </Box>
          ),
        },
      ],
    }),
  ],
});
