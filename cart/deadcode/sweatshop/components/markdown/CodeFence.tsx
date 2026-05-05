
import { Box, Col, Pressable, Row, Text } from '@reactjit/runtime/primitives';
import { COLORS, TOKENS } from '../../theme';
import { copyToClipboard } from '../agent/clipboard';
import { editorTokenTone, tokenizeLine } from '../../utils';

function renderHighlightedLine(line: string, language: string, fontSize: number) {
  const tokens = tokenizeLine(line, { inImportSpecifiers: language === 'ts' || language === 'tsx' || language === 'jsx' || language === 'js' });
  return tokens.map((token, index) => (
    <Text key={index} fontSize={fontSize} color={editorTokenTone(token.kind)} style={{ fontFamily: 'monospace' }}>
      {token.text}
    </Text>
  ));
}

export function CodeFence(props: { language: string; content: string; fontSize?: number }) {
  const fontSize = props.fontSize ?? 11;
  const lines = (props.content || '').split('\n');

  return (
    <Col style={{ gap: 6, borderRadius: TOKENS.radiusMd, borderWidth: 1, borderColor: COLORS.borderSoft, backgroundColor: COLORS.panelAlt, overflow: 'hidden' }}>
      <Row style={{ alignItems: 'center', justifyContent: 'space-between', paddingLeft: 10, paddingRight: 10, paddingTop: 8, paddingBottom: 8, borderBottomWidth: 1, borderColor: COLORS.borderSoft }}>
        <Text fontSize={9} color={COLORS.textDim} style={{ fontWeight: 'bold', letterSpacing: 1 }}>{String(props.language || 'text').toUpperCase()}</Text>
        <Pressable onPress={() => copyToClipboard(props.content || '')} style={{ paddingLeft: 8, paddingRight: 8, paddingTop: 4, paddingBottom: 4, borderRadius: TOKENS.radiusSm, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelBg }}>
          <Text fontSize={9} color={COLORS.textBright}>Copy</Text>
        </Pressable>
      </Row>
      <Col style={{ gap: 0, paddingLeft: 10, paddingRight: 10, paddingTop: 8, paddingBottom: 8 }}>
        {lines.map((line, index) => (
          <Row key={index} style={{ gap: 8, alignItems: 'flex-start' }}>
            <Text fontSize={9} color={COLORS.textDim} style={{ fontFamily: 'monospace', width: 28, textAlign: 'right' }}>
              {String(index + 1).padStart(3, ' ')}
            </Text>
            <Row style={{ flexWrap: 'wrap', flexShrink: 1, gap: 0, minWidth: 0 }}>
              {renderHighlightedLine(line, props.language, fontSize)}
            </Row>
          </Row>
        ))}
      </Col>
    </Col>
  );
}
