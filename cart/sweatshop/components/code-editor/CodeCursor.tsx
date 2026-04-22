import { memo } from 'react';
import { Box } from '../../../../runtime/primitives';

export interface CodeCursorProps {
  line: number;
  column: number;
  fontSize?: number;
  lineHeight?: number;
  charWidth?: number;
  color?: string;
  blink?: boolean;
}

export const CodeCursor = memo(function CodeCursor(props: CodeCursorProps) {
  const { line, column, fontSize = 13, lineHeight = 18, charWidth = 8, color = '#a5d6ff', blink = true } = props;
  const top = (line - 1) * lineHeight;
  const left = column * charWidth;

  return (
    <Box
      style={{
        position: 'absolute',
        top,
        left,
        width: 2,
        height: lineHeight - 2,
        backgroundColor: color,
        opacity: blink ? 0.8 : 1,
      }}
    />
  );
});
