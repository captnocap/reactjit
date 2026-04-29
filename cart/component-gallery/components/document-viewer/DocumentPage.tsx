import { classifiers as S } from '@reactjit/core';
import { ScrollView } from '@reactjit/runtime/primitives';
import { DocumentBlock } from './DocumentBlock';
import { DocumentPageHeader } from './DocumentPageHeader';
import type { DocumentModel, DocumentSize } from './documentViewerShared';

export type DocumentPageProps = {
  document: DocumentModel;
  size: DocumentSize;
  scroll?: boolean;
  scrollY?: number;
  onScroll?: (payload: any) => void;
  onContentLayout?: (y: number) => void;
  onHeadingLayout?: (id: string, y: number) => void;
};

export function DocumentPage({
  document,
  size,
  scroll = true,
  scrollY,
  onScroll,
  onContentLayout,
  onHeadingLayout,
}: DocumentPageProps) {
  const content = (
    <S.DocPageContent
      onLayout={(rect: any) => {
        const y = typeof rect?.y === 'number' ? rect.y : typeof rect?.top === 'number' ? rect.top : null;
        if (y !== null) onContentLayout?.(y);
      }}
    >
      <DocumentPageHeader document={document} size={size} />
      {document.blocks.map((block, index) => (
        <DocumentBlock key={index} block={block} size={size} onHeadingLayout={onHeadingLayout} />
      ))}
    </S.DocPageContent>
  );

  return (
    <S.DocPage>
      {scroll ? (
        <ScrollView
          style={{ flexGrow: 1, width: '100%' }}
          showScrollbar={false}
          scrollY={scrollY}
          onScroll={onScroll}
        >
          {content}
        </ScrollView>
      ) : (
        content
      )}
    </S.DocPage>
  );
}
