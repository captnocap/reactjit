import { Box } from '@reactjit/runtime/primitives';
import { defineGallerySection, defineGalleryStory } from '../types';
import { DocumentToolbar } from '../components/document-viewer/DocumentToolbar';

export const documentToolbarSection = defineGallerySection({
  id: 'document-toolbar',
  title: 'Document Toolbar',
  stories: [
    defineGalleryStory({
      id: 'document-toolbar/default',
      title: 'Document Toolbar',
      source: 'cart/component-gallery/components/document-viewer/DocumentToolbar.tsx',
      status: 'draft',
      summary: 'Top strip with title, active section, outline toggle and zoom controls.',
      tags: ['header', 'panel'],
      variants: [
        {
          id: 'comfortable',
          name: 'Comfortable',
          render: () => (
            <Box style={{ width: 520 }}>
              <DocumentToolbar
                title="On the Shape of Documents"
                activeSection="Introduction"
                size="comfortable"
                outlineVisible
                canToggleOutline
                zoomPct={100}
              />
            </Box>
          ),
        },
        {
          id: 'compact',
          name: 'Compact',
          render: () => (
            <Box style={{ width: 300 }}>
              <DocumentToolbar
                title="On the Shape of Documents"
                size="compact"
                outlineVisible={false}
                canToggleOutline={false}
                zoomPct={100}
              />
            </Box>
          ),
        },
      ],
    }),
  ],
});
