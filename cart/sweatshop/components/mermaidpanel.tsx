const React: any = require('react');
const { useMemo, useState } = React;

import { Box, Col, Pressable, Row, Text, TextArea } from '../../../runtime/primitives';
import { COLORS, TOKENS } from '../theme';
import { layoutMermaidDiagram } from '../mermaid/layout';
import { parseMermaid } from '../mermaid/parser';
import { MermaidRenderer } from '../mermaid/renderer';

const DEFAULT_SOURCE = `flowchart TD
  A[Box] --> B{Diamond}
  B -- yes --> C((Circle))
  B -- no --> D[(Round)]
  C ==> E==text==> F[File]
  subgraph Example
    D --> G[Inside]
  end`;

type MermaidPanelProps = {
  widthBand?: string;
  source?: string;
  title?: string;
  onClose?: () => void;
};

export function MermaidPanel(props: MermaidPanelProps) {
  const compactBand = props.widthBand === 'narrow' || props.widthBand === 'widget' || props.widthBand === 'minimum';
  const [source, setSource] = useState(props.source || DEFAULT_SOURCE);

  const diagram = useMemo(() => parseMermaid(source), [source]);
  const layout = useMemo(() => layoutMermaidDiagram(diagram), [diagram]);

  return (
    <Col style={{ width: '100%', height: '100%', backgroundColor: COLORS.panelBg, borderLeftWidth: 1, borderColor: COLORS.border }}>
      <Row style={{ alignItems: 'center', justifyContent: 'space-between', paddingLeft: 12, paddingRight: 12, paddingTop: 10, paddingBottom: 10, borderBottomWidth: 1, borderColor: COLORS.borderSoft }}>
        <Col style={{ gap: 2 }}>
          <Text fontSize={13} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>
            {props.title || 'Mermaid'}
          </Text>
          <Text fontSize={10} color={COLORS.textDim}>
            Flowchart preview built on Canvas
          </Text>
        </Col>
        <Row style={{ gap: 6, alignItems: 'center' }}>
          <Text fontSize={10} color={COLORS.textDim}>
            {diagram.nodes.length} nodes / {diagram.edges.length} edges
          </Text>
          {props.onClose ? (
            <Pressable onPress={props.onClose} style={{ paddingLeft: 8, paddingRight: 8, paddingTop: 5, paddingBottom: 5, borderRadius: TOKENS.radiusLg, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelAlt }}>
              <Text fontSize={10} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>Close</Text>
            </Pressable>
          ) : null}
        </Row>
      </Row>

      <Row style={{ flexGrow: 1, flexBasis: 0, minHeight: 0, flexDirection: compactBand ? 'column' : 'row' }}>
        <Col style={{ flexGrow: compactBand ? 0 : 0.42, flexBasis: 0, minHeight: 0, borderRightWidth: compactBand ? 0 : 1, borderBottomWidth: compactBand ? 1 : 0, borderColor: COLORS.borderSoft }}>
          <Box style={{ padding: 10, borderBottomWidth: 1, borderColor: COLORS.borderSoft }}>
            <Text fontSize={10} color={COLORS.textDim} style={{ fontWeight: 'bold' }}>Mermaid source</Text>
          </Box>
          <Box style={{ flexGrow: 1, flexBasis: 0, minHeight: 0, padding: 10 }}>
            <TextArea
              value={source}
              onChange={setSource}
              fontSize={11}
              color={COLORS.textBright}
              style={{
                width: '100%',
                height: '100%',
                minHeight: 280,
                padding: 12,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: COLORS.border,
                backgroundColor: COLORS.panelRaised,
              }}
            />
          </Box>
        </Col>

        <Col style={{ flexGrow: 1, flexBasis: 0, minHeight: 0 }}>
          <Box style={{ padding: 10, borderBottomWidth: 1, borderColor: COLORS.borderSoft }}>
            <Text fontSize={10} color={COLORS.textDim} style={{ fontWeight: 'bold' }}>Preview</Text>
          </Box>
          <Box style={{ flexGrow: 1, flexBasis: 0, minHeight: 0 }}>
            <MermaidRenderer layout={layout} />
          </Box>
        </Col>
      </Row>
    </Col>
  );
}
