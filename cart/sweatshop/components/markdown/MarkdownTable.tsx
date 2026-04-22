
import { Box, Col, Row, Text } from '../../../../runtime/primitives';
import { COLORS, TOKENS } from '../../theme';
import type { MarkdownInlineNode } from './useMarkdownAst';

type RenderInline = (nodes: MarkdownInlineNode[]) => any;

export function MarkdownTable(props: {
  header: MarkdownInlineNode[][];
  rows: MarkdownInlineNode[][][];
  renderInline: RenderInline;
  fontSize?: number;
}) {
  const fontSize = props.fontSize ?? 11;
  const cols = Math.max(props.header.length, ...props.rows.map((row) => row.length), 0);

  return (
    <Col style={{ borderWidth: 1, borderColor: COLORS.borderSoft, borderRadius: TOKENS.radiusMd, overflow: 'hidden', backgroundColor: COLORS.panelAlt }}>
      <Row style={{ backgroundColor: COLORS.panelRaised, borderBottomWidth: 1, borderColor: COLORS.borderSoft }}>
        {Array.from({ length: cols }, (_, index) => (
          <Box key={index} style={{ flexGrow: 1, flexBasis: 0, paddingLeft: 8, paddingRight: 8, paddingTop: 7, paddingBottom: 7, borderRightWidth: index < cols - 1 ? 1 : 0, borderColor: COLORS.borderSoft, minWidth: 90 }}>
            {props.header[index] ? props.renderInline(props.header[index]) : <Text fontSize={fontSize} color={COLORS.textDim}> </Text>}
          </Box>
        ))}
      </Row>
      {props.rows.map((row, rowIndex) => (
        <Row key={rowIndex} style={{ borderBottomWidth: rowIndex < props.rows.length - 1 ? 1 : 0, borderColor: COLORS.borderSoft }}>
          {Array.from({ length: cols }, (_, index) => (
            <Box key={index} style={{ flexGrow: 1, flexBasis: 0, paddingLeft: 8, paddingRight: 8, paddingTop: 7, paddingBottom: 7, borderRightWidth: index < cols - 1 ? 1 : 0, borderColor: COLORS.borderSoft, minWidth: 90 }}>
              {row[index] ? props.renderInline(row[index]) : null}
            </Box>
          ))}
        </Row>
      ))}
    </Col>
  );
}
