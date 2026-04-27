import { classifiers as S } from '@reactjit/core';
import type { DocumentModel, DocumentSize } from './documentViewerShared';

export type DocumentPageHeaderProps = {
  document: DocumentModel;
  size: DocumentSize;
};

export function DocumentPageHeader({ document, size: _size }: DocumentPageHeaderProps) {
  return (
    <S.StackX3>
      <S.DocTitle>{document.title}</S.DocTitle>
      {document.subtitle ? <S.DocSubtitle>{document.subtitle}</S.DocSubtitle> : null}
      {document.author || document.date ? (
        <S.InlineX3>
          {document.author ? <S.DocMeta>{document.author.toUpperCase()}</S.DocMeta> : null}
          {document.author && document.date ? <S.DocMeta>·</S.DocMeta> : null}
          {document.date ? <S.DocMeta>{document.date}</S.DocMeta> : null}
        </S.InlineX3>
      ) : null}
      <S.DocPaperRule />
    </S.StackX3>
  );
}
