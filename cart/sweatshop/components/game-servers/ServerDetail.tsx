import { Box, Col, Row, ScrollView, Text } from '@reactjit/runtime/primitives';
import { COLORS, TOKENS } from '../../theme';
import { copyToClipboard } from '../agent/clipboard';
import { HoverPressable } from '../shared';
import { socketSupport, type SocketProtocol } from '../../lib/game-servers/support';
import type { GameServerRecord } from './hooks/useServerList';
import { useServerPing } from './hooks/useServerPing';

export function ServerDetail(props: {
  server: GameServerRecord | null;
  protocol: SocketProtocol;
  onPin: () => void;
  pinned?: boolean;
}) {
  const server = props.server;
  const support = socketSupport(props.protocol);
  const ping = useServerPing(server?.address || '', props.protocol);
  const join = server?.joinCommand || (server ? `connect ${server.address}` : '');
  return (
    <Col style={{ gap: 10, flexGrow: 1, minHeight: 0 }}>
      <Row style={{ alignItems: 'center', gap: 8 }}>
        <Text fontSize={10} color={COLORS.textDim} style={{ letterSpacing: 1.1, fontWeight: 'bold' }}>DETAILS</Text>
        <Box style={{ flexGrow: 1 }} />
        {server ? (
          <HoverPressable onPress={() => copyToClipboard(join)} style={{
            paddingLeft: 10, paddingRight: 10, paddingTop: 5, paddingBottom: 5,
            borderRadius: TOKENS.radiusSm, borderWidth: 1, borderColor: COLORS.blue,
            backgroundColor: COLORS.blueDeep,
          }}>
            <Text fontSize={9} color={COLORS.blue} style={{ fontWeight: 'bold' }}>Copy join</Text>
          </HoverPressable>
        ) : null}
        {server ? (
          <HoverPressable onPress={props.onPin} style={{
            paddingLeft: 10, paddingRight: 10, paddingTop: 5, paddingBottom: 5,
            borderRadius: TOKENS.radiusSm, borderWidth: 1,
            borderColor: props.pinned ? COLORS.yellow : COLORS.border,
            backgroundColor: props.pinned ? COLORS.yellowDeep : COLORS.panelAlt,
          }}>
            <Text fontSize={9} color={props.pinned ? COLORS.yellow : COLORS.textDim} style={{ fontWeight: 'bold' }}>{props.pinned ? 'Pinned' : 'Pin server'}</Text>
          </HoverPressable>
        ) : null}
      </Row>
      {!support.available ? (
        <Box style={{ padding: 12, borderRadius: TOKENS.radiusMd, borderWidth: 1, borderColor: COLORS.orange, backgroundColor: COLORS.orangeDeep, gap: 4 }}>
          <Text fontSize={11} color={COLORS.orange} style={{ fontWeight: 'bold' }}>Protocol bridge pending</Text>
          <Text fontSize={9} color={COLORS.textDim}>{support.banner}</Text>
        </Box>
      ) : null}
      <Box style={{ padding: 12, borderRadius: TOKENS.radiusMd, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelBg, gap: 8, flexGrow: 1, minHeight: 0 }}>
        {server ? (
          <>
            <Col style={{ gap: 2 }}>
              <Text fontSize={13} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>{server.name || server.address}</Text>
              <Text fontSize={9} color={COLORS.textDim}>{server.address}</Text>
            </Col>
            <Row style={{ gap: 10, flexWrap: 'wrap' }}>
              <Text fontSize={10} color={COLORS.textDim}>Map: {server.map || 'unknown'}</Text>
              <Text fontSize={10} color={COLORS.textDim}>Players: {server.players}/{server.maxPlayers}</Text>
              <Text fontSize={10} color={COLORS.textDim}>Ping: {ping.pending ? 'measuring…' : (ping.ping == null ? 'pending' : `${ping.ping}ms`)}</Text>
            </Row>
            <Text fontSize={10} color={COLORS.textDim}>Tags: {server.tags.length ? server.tags.join(', ') : 'none'}</Text>
            <ScrollView style={{ flexGrow: 1, minHeight: 0 }}>
              <Col style={{ gap: 10, paddingBottom: 8 }}>
                <Col style={{ gap: 4 }}>
                  <Text fontSize={10} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>Players</Text>
                  {server.playersList && server.playersList.length > 0 ? server.playersList.map((player, index) => (
                    <Row key={`${player.name}-${index}`} style={{ justifyContent: 'space-between', gap: 8 }}>
                      <Text fontSize={10} color={COLORS.textBright}>{player.name}</Text>
                      <Text fontSize={9} color={COLORS.textDim}>{player.score ?? 0}</Text>
                    </Row>
                  )) : <Text fontSize={9} color={COLORS.textDim}>No player list returned yet.</Text>}
                </Col>
                <Col style={{ gap: 4 }}>
                  <Text fontSize={10} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>Rules</Text>
                  {server.rules && Object.keys(server.rules).length > 0 ? Object.entries(server.rules).slice(0, 16).map(([key, value]) => (
                    <Row key={key} style={{ justifyContent: 'space-between', gap: 8 }}>
                      <Text fontSize={9} color={COLORS.textDim}>{key}</Text>
                      <Text fontSize={9} color={COLORS.textBright}>{value}</Text>
                    </Row>
                  )) : <Text fontSize={9} color={COLORS.textDim}>No rules returned yet.</Text>}
                </Col>
              </Col>
            </ScrollView>
          </>
        ) : (
          <Col style={{ gap: 6 }}>
            <Text fontSize={11} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>Select a server or pin one from Favorites</Text>
            <Text fontSize={9} color={COLORS.textDim}>The browser stays real: no mock servers are shown when the runtime has no socket bridge yet.</Text>
          </Col>
        )}
      </Box>
    </Col>
  );
}
