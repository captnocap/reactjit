import { Box, Col, Pressable, Row, Text } from '../../../../runtime/primitives';
import { COLORS, TOKENS } from '../../theme';
import type { McpCallLogEntry, ToolDef } from '../../lib/mcp-server';

function preview(value: any): string {
  try {
    const text = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
    return text.length > 420 ? text.slice(0, 420) + '…' : text;
  } catch (_e) {
    return String(value);
  }
}

export function ToolCard(props: {
  tool: ToolDef;
  recentCalls: McpCallLogEntry[];
  onCall?: () => void;
}) {
  return (
    <Box style={{ padding: 10, gap: 8, borderWidth: 1, borderColor: COLORS.border, borderRadius: TOKENS.radiusSm, backgroundColor: COLORS.panelAlt }}>
      <Row style={{ alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <Col style={{ gap: 2, flexGrow: 1, flexBasis: 0 }}>
          <Text fontSize={11} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>{props.tool.name}</Text>
          <Text fontSize={9} color={COLORS.textDim}>{props.tool.description}</Text>
        </Col>
        {props.onCall ? <Pressable onPress={props.onCall}><Box style={{ paddingLeft: 8, paddingRight: 8, paddingTop: 4, paddingBottom: 4, borderRadius: TOKENS.radiusXs, borderWidth: 1, borderColor: COLORS.blue, backgroundColor: COLORS.blueDeep }}><Text fontSize={9} color={COLORS.blue} style={{ fontWeight: 'bold' }}>call</Text></Box></Pressable> : null}
      </Row>
      <Box style={{ padding: 8, borderWidth: 1, borderColor: COLORS.borderSoft, borderRadius: TOKENS.radiusXs, backgroundColor: COLORS.panelBg }}>
        <Text fontSize={9} color={COLORS.textDim} style={{ fontFamily: TOKENS.fontMono }}>inputSchema</Text>
        <Text fontSize={9} color={COLORS.text} style={{ fontFamily: TOKENS.fontMono, whiteSpace: 'pre-wrap' }}>{preview(props.tool.inputSchema)}</Text>
      </Box>
      <Col style={{ gap: 4 }}>
        <Text fontSize={9} color={COLORS.textDim} style={{ fontWeight: 'bold' }}>recent invocations</Text>
        {props.recentCalls.length ? props.recentCalls.slice(0, 3).map((call) => (
          <Box key={call.id} style={{ padding: 6, borderRadius: TOKENS.radiusXs, borderWidth: 1, borderColor: COLORS.borderSoft, backgroundColor: COLORS.panelBg }}>
            <Text fontSize={9} color={call.error ? COLORS.red : COLORS.textBright} style={{ fontFamily: TOKENS.fontMono }}>{call.error ? `error: ${call.error}` : preview(call.result)}</Text>
          </Box>
        )) : <Text fontSize={9} color={COLORS.textDim}>No calls yet.</Text>}
      </Col>
    </Box>
  );
}
