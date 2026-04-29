import { Box } from '@reactjit/runtime/primitives';

export interface SelectionRange {
  startLine: number;
  startCol: number;
  endLine: number;
  endCol: number;
}

export interface CodeSelectionProps {
  selection: SelectionRange;
  fontSize?: number;
  lineHeight?: number;
  charWidth?: number;
  color?: string;
}

export const CodeSelection = memo(function CodeSelection(props: CodeSelectionProps) {
  const { selection, fontSize = 13, lineHeight = 18, charWidth = 8, color = 'rgba(100,149,237,0.25)' } = props;
  const { startLine, startCol, endLine, endCol } = selection;
  const blocks: { top: number; left: number; width: number; height: number }[] = [];

  for (let line = startLine; line <= endLine; line++) {
    const top = (line - 1) * lineHeight;
    const isFirst = line === startLine;
    const isLast = line === endLine;
    let left = 0;
    let width = 9999;
    if (isFirst) left = startCol * charWidth;
    if (isLast && endLine === startLine) width = (endCol - startCol) * charWidth;
    else if (isLast) width = endCol * charWidth;
    blocks.push({ top, left, width, height: lineHeight });
  }

  return (
    <>
      {blocks.map((b, i) => (
        <Box key={i} style={{ position: 'absolute', top: b.top, left: b.left, width: b.width, height: b.height, backgroundColor: color }} />
      ))}
    </>
  );
});
