// CodeLineNumber — gallery atom bound to the `CodeLine` data shape.
//
// Source of truth: cart/component-gallery/data/code-line.ts

import { classifiers as S } from '@reactjit/core';
import { Text } from '../../../../runtime/primitives';
import type { CodeLine } from '../../data/code-line';

export type CodeLineNumberProps = {
  row: CodeLine;
};

export function CodeLineNumber({ row }: CodeLineNumberProps) {
  const LineNumber = S.CodeLineNumber || Text;
  return <LineNumber>{String(row.lineNumber).padStart(2, ' ')}</LineNumber>;
}
