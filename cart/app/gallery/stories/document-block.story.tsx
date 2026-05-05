import { classifiers as S } from '@reactjit/core';
import { Box } from '@reactjit/runtime/primitives';
import { defineGallerySection, defineGalleryStory } from '../types';
import { DocumentBlock } from '../components/document-viewer/DocumentBlock';

export const documentBlockSection = defineGallerySection({
  id: 'document-block',
  title: 'Document Block',
  stories: [
    defineGalleryStory({
      id: 'document-block/default',
      title: 'Document Block',
      source: 'cart/app/gallery/components/document-viewer/DocumentBlock.tsx',
      status: 'draft',
      summary: 'Renders one document block: heading, paragraph, list, quote, code, or divider.',
      tags: ['panel'],
      variants: [
        {
          id: 'comfortable',
          name: 'Comfortable',
          render: () => (
            <Box style={{ width: 460, height: 520 }}>
              <S.DocPage>
                <S.DocPageContent>
                  <DocumentBlock
                    block={{ type: 'heading', level: 1, id: 'h1', text: 'Heading One' }}
                    size="comfortable"
                  />
                  <DocumentBlock
                    block={{
                      type: 'paragraph',
                      text:
                        'A paragraph reads at body size with relaxed leading. The block component is unaware of its siblings; it just takes a block prop.',
                    }}
                    size="comfortable"
                  />
                  <DocumentBlock
                    block={{ type: 'list', items: ['One', 'Two', 'Three'], ordered: true }}
                    size="comfortable"
                  />
                  <DocumentBlock
                    block={{ type: 'quote', text: 'A block should know less than the document.', attribution: 'margin note' }}
                    size="comfortable"
                  />
                  <DocumentBlock
                    block={{ type: 'code', code: 'const x = 1;\nconst y = 2;', lang: 'ts' }}
                    size="comfortable"
                  />
                </S.DocPageContent>
              </S.DocPage>
            </Box>
          ),
        },
        {
          id: 'compact',
          name: 'Compact',
          render: () => (
            <Box style={{ width: 280, height: 360 }}>
              <S.DocPage>
                <S.DocPageContent>
                  <DocumentBlock
                    block={{ type: 'heading', level: 2, id: 'h2', text: 'Compact heading' }}
                    size="compact"
                  />
                  <DocumentBlock
                    block={{
                      type: 'paragraph',
                      text: 'At small sizes, type and padding tighten so a paragraph still reads cleanly.',
                    }}
                    size="compact"
                  />
                  <DocumentBlock
                    block={{ type: 'code', code: 'fit({ w: 320 })', lang: 'ts' }}
                    size="compact"
                  />
                </S.DocPageContent>
              </S.DocPage>
            </Box>
          ),
        },
      ],
    }),
  ],
});
