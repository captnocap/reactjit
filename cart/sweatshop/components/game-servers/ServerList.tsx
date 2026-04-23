const React: any = require('react');

import { Box, Col, Row, ScrollView, Text } from '../../../../runtime/primitives';
import { COLORS, TOKENS } from '../../theme';
import { HoverPressable } from '../shared';
import { ServerRow } from './ServerRow';
import type { GameServerRecord, ServerFiltersState } from './hooks/useServerList';

const ROW_HEIGHT = 92;
const VIEWPORT_HEIGHT = 540;
const OVERSCAN = 4;

function passesFilters(server: GameServerRecord, filters: ServerFiltersState): boolean {
  if (filters.region !== 'any' && (server.region || '').toLowerCase() !== filters.region) return false;
  if (filters.map.trim() && !server.map.toLowerCase().includes(filters.map.trim().toLowerCase())) return false;
  if (filters.mode.trim() && !((server.mode || '').toLowerCase().includes(filters.mode.trim().toLowerCase()) || server.tags.join(' ').toLowerCase().includes(filters.mode.trim().toLowerCase()))) return false;
  if (filters.tags.trim()) {
    const chunks = filters.tags.split(/[,\s]+/).filter(Boolean);
    for (const tag of chunks) {
      if (!server.tags.join(' ').toLowerCase().includes(tag.toLowerCase())) return false;
    }
  }
  if (filters.secure === 'secure' && !server.secure) return false;
  if (filters.secure === 'insecure' && server.secure) return false;
  if (filters.passwordProtected === 'yes' && !server.passwordProtected) return false;
  if (filters.passwordProtected === 'no' && server.passwordProtected) return false;
  const players = server.players;
  if (filters.playerRange === '0-8' && players > 8) return false;
  if (filters.playerRange === '8-16' && (players < 8 || players > 16)) return false;
  if (filters.playerRange === '16-32' && (players < 16 || players > 32)) return false;
  if (filters.playerRange === '32+' && players < 32) return false;
  return true;
}

export function ServerList(props: {
  servers: GameServerRecord[];
  filters: ServerFiltersState;
  available: boolean;
  banner: string;
  hostFns: string[];
  selectedAddress?: string;
  pinnedAddresses: Set<string>;
  onSelect: (server: GameServerRecord) => void;
  onPin: (server: GameServerRecord) => void;
  onRefresh: () => void;
}) {
  const [scrollY, setScrollY] = React.useState(0);
  const rows = React.useMemo(() => props.servers.filter((server) => passesFilters(server, props.filters)), [props.servers, props.filters]);
  const startIndex = Math.max(0, Math.floor(scrollY / ROW_HEIGHT) - OVERSCAN);
  const endIndex = Math.min(rows.length, Math.ceil((scrollY + VIEWPORT_HEIGHT) / ROW_HEIGHT) + OVERSCAN);
  const window = rows.slice(startIndex, endIndex);
  const topSpacer = startIndex * ROW_HEIGHT;
  const bottomSpacer = Math.max(0, (rows.length - endIndex) * ROW_HEIGHT);

  return (
    <Col style={{ gap: 10, flexGrow: 1, minHeight: 0 }}>
      <Row style={{ alignItems: 'center', gap: 8 }}>
        <Text fontSize={10} color={COLORS.textDim} style={{ letterSpacing: 1.1, fontWeight: 'bold' }}>SERVERS</Text>
        <Box style={{ flexGrow: 1 }} />
        <HoverPressable onPress={props.onRefresh} style={{
          paddingLeft: 10, paddingRight: 10, paddingTop: 5, paddingBottom: 5,
          borderRadius: TOKENS.radiusSm, borderWidth: 1, borderColor: COLORS.blue,
          backgroundColor: COLORS.blueDeep,
        }}>
          <Text fontSize={9} color={COLORS.blue} style={{ fontWeight: 'bold' }}>Refresh</Text>
        </HoverPressable>
      </Row>
      {!props.available ? (
        <Box style={{ padding: 12, borderRadius: TOKENS.radiusMd, borderWidth: 1, borderColor: COLORS.orange, backgroundColor: COLORS.orangeDeep, gap: 4 }}>
          <Text fontSize={11} color={COLORS.orange} style={{ fontWeight: 'bold' }}>Live server queries need socket host bindings</Text>
          <Text fontSize={9} color={COLORS.textDim}>{props.banner}</Text>
          <Text fontSize={9} color={COLORS.textDim}>Protocols requested by this cart: {props.hostFns.length ? props.hostFns.join(', ') : 'none detected'}</Text>
        </Box>
      ) : null}
      <ScrollView
        showScrollbar={true}
        style={{ flexGrow: 1, flexBasis: 0, minHeight: 0 }}
        onScroll={(payload: any) => {
          const next = typeof payload?.scrollY === 'number' ? payload.scrollY : 0;
          if (Math.abs(next - scrollY) >= ROW_HEIGHT / 2) setScrollY(next);
        }}
      >
        <Col style={{ gap: 8 }}>
          {topSpacer > 0 ? <Box style={{ height: topSpacer }} /> : null}
          {window.length === 0 ? (
            <Box style={{ padding: 14, borderRadius: TOKENS.radiusMd, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelBg, gap: 4 }}>
              <Text fontSize={11} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>{props.available ? 'No live servers matched the current filters' : 'No live servers can be queried yet'}</Text>
              <Text fontSize={9} color={COLORS.textDim}>{props.available ? 'Widen the filter set or refresh the query.' : 'Pinned servers still work, and the browser will start querying once bindings land.'}</Text>
            </Box>
          ) : null}
          {window.map((server) => (
            <ServerRow
              key={server.address}
              server={server}
              selected={props.selectedAddress === server.address}
              pinned={props.pinnedAddresses.has(server.address)}
              onPress={props.onSelect}
              onPin={props.onPin}
            />
          ))}
          {bottomSpacer > 0 ? <Box style={{ height: bottomSpacer }} /> : null}
        </Col>
      </ScrollView>
    </Col>
  );
}

