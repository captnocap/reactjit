import { Box, Col, Row, Text } from '@reactjit/runtime/primitives';
import { COLORS, TOKENS } from '../../theme';
import { copyToClipboard } from '../agent/clipboard';
import { HoverPressable } from '../shared';
import type { GameServerRecord } from './hooks/useServerList';

function Tag(props: { label: string; tone?: string }) {
  return (
    <Box style={{
      paddingLeft: 6, paddingRight: 6, paddingTop: 3, paddingBottom: 3,
      borderRadius: TOKENS.radiusSm, borderWidth: 1,
      borderColor: props.tone || COLORS.border,
      backgroundColor: COLORS.panelAlt,
    }}>
      <Text fontSize={8} color={props.tone || COLORS.textDim} style={{ fontWeight: 'bold' }}>{props.label}</Text>
    </Box>
  );
}

export function ServerRow(props: {
  server: GameServerRecord;
  selected?: boolean;
  onPress: (server: GameServerRecord) => void;
  onPin: (server: GameServerRecord) => void;
  pinned?: boolean;
}) {
  const s = props.server;
  const join = s.joinCommand || `connect ${s.address}`;
  return (
    <HoverPressable
      onPress={() => {
        copyToClipboard(join);
        props.onPress(s);
      }}
      style={{
        padding: 10,
        borderRadius: TOKENS.radiusMd,
        borderWidth: 1,
        borderColor: props.selected ? COLORS.blue : COLORS.border,
        backgroundColor: props.selected ? COLORS.blueDeep : COLORS.panelBg,
        gap: 8,
      }}
    >
      <Row style={{ alignItems: 'center', gap: 8 }}>
        <Col style={{ flexGrow: 1, flexBasis: 0, gap: 2 }}>
          <Text fontSize={11} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>{s.name || s.address}</Text>
          <Text fontSize={9} color={COLORS.textDim}>{s.address}</Text>
        </Col>
        <Text fontSize={10} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>{s.map || 'unknown map'}</Text>
      </Row>
      <Row style={{ alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <Text fontSize={9} color={COLORS.textDim}>{s.players}/{s.maxPlayers}</Text>
        <Text fontSize={9} color={COLORS.textDim}>{s.ping == null ? 'ping pending' : `${s.ping} ms`}</Text>
        {s.secure ? <Tag label="secure" tone={COLORS.green} /> : null}
        {s.passwordProtected ? <Tag label="password" tone={COLORS.orange} /> : null}
        {s.tags.slice(0, 4).map((tag) => <Tag key={tag} label={tag} />)}
        <Box style={{ flexGrow: 1 }} />
        <HoverPressable onPress={() => { copyToClipboard(join); props.onPress(s); }} style={{
          paddingLeft: 8, paddingRight: 8, paddingTop: 5, paddingBottom: 5,
          borderRadius: TOKENS.radiusSm, borderWidth: 1,
          borderColor: COLORS.blue, backgroundColor: COLORS.blueDeep,
        }}>
          <Text fontSize={9} color={COLORS.blue} style={{ fontWeight: 'bold' }}>Connect</Text>
        </HoverPressable>
        <HoverPressable onPress={() => props.onPin(s)} style={{
          paddingLeft: 8, paddingRight: 8, paddingTop: 5, paddingBottom: 5,
          borderRadius: TOKENS.radiusSm, borderWidth: 1,
          borderColor: props.pinned ? COLORS.yellow : COLORS.border,
          backgroundColor: props.pinned ? COLORS.yellowDeep : COLORS.panelAlt,
        }}>
          <Text fontSize={9} color={props.pinned ? COLORS.yellow : COLORS.textDim} style={{ fontWeight: 'bold' }}>{props.pinned ? 'Pinned' : 'Pin'}</Text>
        </HoverPressable>
      </Row>
    </HoverPressable>
  );
}
