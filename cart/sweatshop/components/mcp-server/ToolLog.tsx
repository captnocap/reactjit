import { Box, Col, Text } from '../../../../runtime/primitives';
import { COLORS, TOKENS } from '../../theme';
import type { McpCallLogEntry } from '../../lib/mcp-server';

function fmtTime(ts: number): string {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
}

function preview(value: any): string {
  try {
    const text = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
    return text.length > 360 ? text.slice(0, 360) + '…' : text;
  } catch (_e) {
    return String(value);
  }
}

export function ToolLog(props: { calls: McpCallLogEntry[] }) {
  return (
    <Col style={{ gap: 6 }}>
      <Text fontSize={10} color={COLORS.purple} style={{ letterSpacing: 0.6, fontWeight: 'bold' }}>CALL LOG</Text>
      {props.calls.length ? props.calls.map((call) => (
        <Box key={call.id} style={{ padding: 8, gap: 4, borderWidth: 1, borderColor: call.error ? COLORS.red : COLORS.border, borderRadius: TOKENS.radiusSm, backgroundColor: COLORS.panelAlt }}>
          <Text fontSize={9} color={COLORS.textDim} style={{ fontFamily: TOKENS.fontMono }}>{fmtTime(call.time)} · {call.tool}</Text>
          <Text fontSize={9} color={COLORS.textBright} style={{ fontFamily: TOKENS.fontMono, whiteSpace: 'pre-wrap' }}>{preview(call.args)}</Text>
          {call.error ? <Text fontSize={9} color={COLORS.red} style={{ fontFamily: TOKENS.fontMono }}>error: {call.error}</Text> : <Text fontSize={9} color={COLORS.green} style={{ fontFamily: TOKENS.fontMono }}>result: {preview(call.result)}</Text>}
        </Box>
      )) : <Box style={{ padding: 10, borderWidth: 1, borderColor: COLORS.borderSoft, borderRadius: TOKENS.radiusSm, backgroundColor: COLORS.panelBg }}><Text fontSize={9} color={COLORS.textDim}>No tool calls yet.</Text></Box>}
    </Col>
  );
}
