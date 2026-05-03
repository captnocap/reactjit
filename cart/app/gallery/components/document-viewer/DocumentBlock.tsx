import { classifiers as S } from '@reactjit/core';
import { CodeBlock } from '../code-block/CodeBlock';
import type { DocumentBlock as Block, DocumentSize } from './documentViewerShared';

export type DocumentBlockProps = {
  block: Block;
  size: DocumentSize;
  onHeadingLayout?: (id: string, y: number) => void;
};

export function DocumentBlock({ block, size: _size, onHeadingLayout }: DocumentBlockProps) {
  if (block.type === 'heading') {
    const onLayout = (rect: any) => {
      const y = typeof rect?.y === 'number' ? rect.y : typeof rect?.top === 'number' ? rect.top : null;
      if (y !== null) onHeadingLayout?.(block.id, y);
    };

    if (block.level === 1) {
      return (
        <S.StackX3 onLayout={onLayout}>
          <S.DocH1>{block.text}</S.DocH1>
          <S.DocPaperRule />
        </S.StackX3>
      );
    }
    if (block.level === 2) {
      return <S.DocH2 onLayout={onLayout}>{block.text}</S.DocH2>;
    }
    return <S.DocH3 onLayout={onLayout}>{block.text}</S.DocH3>;
  }

  if (block.type === 'paragraph') {
    return <S.DocBodyText>{block.text}</S.DocBodyText>;
  }

  if (block.type === 'list') {
    return (
      <S.StackX2>
        {block.items.map((item, index) => (
          <S.InlineX3 key={index}>
            <S.DocBodyDim>{block.ordered ? `${index + 1}.` : '•'}</S.DocBodyDim>
            <S.DocBodyText>{item}</S.DocBodyText>
          </S.InlineX3>
        ))}
      </S.StackX2>
    );
  }

  if (block.type === 'quote') {
    return (
      <S.DocQuoteRow>
        <S.DocQuoteBar />
        <S.StackX2>
          <S.DocQuoteText>{block.text}</S.DocQuoteText>
          {block.attribution ? <S.DocAttribution>{`— ${block.attribution}`}</S.DocAttribution> : null}
        </S.StackX2>
      </S.DocQuoteRow>
    );
  }

  if (block.type === 'code') {
    const lang = (block.lang === 'tsx' || block.lang === 'ts' || block.lang === 'js' ||
                  block.lang === 'json' || block.lang === 'zig' || block.lang === 'python' ||
                  block.lang === 'shell' || block.lang === 'text')
      ? block.lang
      : 'text';
    return (
      <CodeBlock
        row={{
          id: `doc-code-${block.code.length}`,
          title: block.title || 'Snippet',
          filename: block.filename,
          language: lang,
          code: block.code,
          showLineNumbers: true,
          wrap: true,
        }}
      />
    );
  }

  if (block.type === 'divider') {
    return <S.DocPaperRule />;
  }

  return null;
}
