import { memo } from 'react';
import { Col, Row, Box, Text } from '../../../../runtime/primitives';
import { COLORS } from '../../theme';

export interface CodeGutterProps {
  lineCount: number;
  cursorLine?: number;
  fontSize?: number;
  foldedLines?: Set<number>;
  onToggleFold?: (line: number) => void;
  foldableLines?: Set<number>;
}

export const CodeGutter = memo(function CodeGutter(props: CodeGutterProps) {
  const { lineCount, cursorLine = 1, fontSize = 13, foldedLines, onToggleFold, foldableLines } = props;
  const lineHeight = fontSize + 5;
  const gutterWidth = 48;

  return (
    <Col style={{ width: gutterWidth, backgroundColor: COLORS.panelRaised, borderRightWidth: 1, borderColor: COLORS.borderSoft }}>
      {Array.from({ length: lineCount }, (_, i) => {
        const line = i + 1;
        const isActive = line === cursorLine;
        const isFolded = foldedLines?.has(line);
        const isFoldable = foldableLines?.has(line);
        return (
          <Row
            key={line}
            style={{
              height: lineHeight,
              alignItems: 'center',
              paddingRight: 6,
              paddingLeft: 4,
              backgroundColor: isActive ? 'rgba(100,149,237,0.12)' : 'transparent',
            }}
          >
            {isFoldable && onToggleFold && (
              <Box style={{ width: 10, alignItems: 'center', justifyContent: 'center' }} onPress={() => onToggleFold(line)}>
                <Text fontSize={8} color={COLORS.textDim}>{isFolded ? '▸' : '▾'}</Text>
              </Box>
            )}
            {!isFoldable && <Box style={{ width: 10 }} />}
            <Text
              fontSize={fontSize - 2}
              color={isActive ? COLORS.blue : COLORS.textDim}
              style={{ fontFamily: 'monospace', textAlign: 'right', flexGrow: 1 }}
            >
              {line}
            </Text>
          </Row>
        );
      })}
    </Col>
  );
});
