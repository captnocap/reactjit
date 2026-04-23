import { Box, Col, Pressable, Row, Text } from '../../../../runtime/primitives';
import { COLORS, TOKENS } from '../../theme';
import type { McpClientRecord } from '../../lib/mcp-server';

function fmtTime(ts: number): string {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
}

export function ClientList(props: {
  clients: McpClientRecord[];
  onDisconnect?: (id: string) => void;
}) {
  return (
    <Col style={{ gap: 6 }}>
      <Text fontSize={10} color={COLORS.purple} style={{ letterSpacing: 0.6, fontWeight: 'bold' }}>CLIENTS</Text>
      {props.clients.length ? props.clients.map((client) => (
        <Row key={client.id} style={{ alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: 8, borderWidth: 1, borderColor: COLORS.border, borderRadius: TOKENS.radiusSm, backgroundColor: COLORS.panelAlt }}>
          <Col style={{ gap: 2, flexGrow: 1, flexBasis: 0 }}>
            <Text fontSize={10} color={COLORS.textBright} style={{ fontFamily: TOKENS.fontMono, fontWeight: 'bold' }}>{client.label}</Text>
            <Text fontSize={9} color={COLORS.textDim}>{`${client.transport} · last seen ${fmtTime(client.lastSeenAt)}`}</Text>
          </Col>
          <Pressable onPress={() => props.onDisconnect?.(client.id)}>
            <Box style={{ paddingLeft: 8, paddingRight: 8, paddingTop: 4, paddingBottom: 4, borderRadius: TOKENS.radiusXs, borderWidth: 1, borderColor: COLORS.borderSoft, backgroundColor: COLORS.panelBg }}>
              <Text fontSize={9} color={COLORS.red} style={{ fontWeight: 'bold' }}>disconnect</Text>
            </Box>
          </Pressable>
        </Row>
      )) : (
        <Box style={{ padding: 10, borderWidth: 1, borderColor: COLORS.borderSoft, borderRadius: TOKENS.radiusSm, backgroundColor: COLORS.panelBg }}>
          <Text fontSize={9} color={COLORS.textDim}>No connected MCP clients yet.</Text>
        </Box>
      )}
    </Col>
  );
}
