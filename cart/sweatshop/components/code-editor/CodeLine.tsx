import { memo } from 'react';
import { Row, Box, Text } from '../../../../runtime/primitives';
import { editorTokenTone } from '../../utils';
import { Token } from './languages/ts';

export interface CodeLineProps {
  lineNumber: number;
  text: string;
  tokens?: Token[];
  fontSize?: number;
  showLineNumber?: boolean;
  isActive?: boolean;
  onFoldToggle?: (line: number) => void;
  isFoldable?: boolean;
  isFolded?: boolean;
}

export const CodeLine = memo(function CodeLine(props: CodeLineProps) {
  const { lineNumber, tokens = [], fontSize = 13, showLineNumber = true, isActive = false } = props;
  const lineHeight = fontSize + 5;

  return (
    <Row style={{ height: lineHeight, alignItems: 'flex-start', backgroundColor: isActive ? 'rgba(100,149,237,0.15)' : 'transparent' }}>
      {showLineNumber && (
        <Box style={{ width: 48, paddingRight: 8, alignItems: 'flex-end', justifyContent: 'center' }}>
          <Text fontSize={fontSize - 2} color={'#6b7280'} style={{ fontFamily: 'monospace' }}>
            {lineNumber}
          </Text>
        </Box>
      )}
      <Row style={{ flexGrow: 1, flexShrink: 1 }}>
        {tokens.length > 0 ? (
          tokens.map((tok, i) => (
            <Text key={i} fontSize={fontSize} color={editorTokenTone(tok.kind)} style={{ fontFamily: 'monospace', whiteSpace: 'pre' }}>
              {tok.text}
            </Text>
          ))
        ) : (
          <Text fontSize={fontSize} color={editorTokenTone('text')} style={{ fontFamily: 'monospace', whiteSpace: 'pre' }}>
            {props.text}
          </Text>
        )}
      </Row>
    </Row>
  );
});
