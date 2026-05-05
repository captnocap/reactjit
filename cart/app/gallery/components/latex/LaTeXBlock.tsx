import { Box, Col, Row, Text } from '@reactjit/runtime/primitives';
import { renderMathTree } from './mathRender';
import { useLaTeXParse } from './useLaTeXParse';

export type LaTeXBlockProps = {
  source: string;
  fontSize?: number;
  color?: string;
  numbered?: boolean;
  equationNumber?: string | number;
  style?: any;
};

export function LaTeXBlock({
  source,
  fontSize = 18,
  color = 'theme:ink',
  numbered = false,
  equationNumber,
  style,
}: LaTeXBlockProps) {
  const nodes = useLaTeXParse(source);
  return (
    <Box style={{ width: '100%', ...style }}>
      <Row style={{ width: '100%', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <Col style={{ flexGrow: 1, flexBasis: 0, minWidth: 0, alignItems: 'flex-start' }}>
          {renderMathTree(nodes, { fontSize, color, inline: false })}
        </Col>
        {numbered ? (
          <Text style={{ color: 'theme:inkDimmer', fontSize: Math.max(11, Math.round(fontSize * 0.8)), paddingLeft: 8 }}>
            {equationNumber == null ? '' : `(${equationNumber})`}
          </Text>
        ) : null}
      </Row>
    </Box>
  );
}

export default LaTeXBlock;
