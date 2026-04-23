const React: any = require('react');
const { useEffect, useMemo, useState } = React;

import { Box, Col, Pressable, Row, ScrollView, Text } from '../../../../runtime/primitives';
import { COLORS } from '../../theme';
import { getDefaultGameId, getGameDefinition } from '../../lib/game-servers/catalog';
import { useFavorites } from './hooks/useFavorites';
import { useServerList, type ServerFiltersState, type GameServerRecord } from './hooks/useServerList';
import { GamePicker } from './GamePicker';
import { FavoritesBar } from './FavoritesBar';
import { ServerFilters } from './ServerFilters';
import { ServerList } from './ServerList';
import { ServerDetail } from './ServerDetail';

const DEFAULT_FILTERS: ServerFiltersState = {
  region: 'any',
  map: '',
  mode: '',
  playerRange: 'any',
  secure: 'any',
  passwordProtected: 'any',
  tags: '',
};

function loadGame(): string {
  try {
    const raw = (globalThis as any).__store_get?.('sweatshop.game-servers.game');
    if (raw) return String(raw);
  } catch {}
  return getDefaultGameId();
}

export function GameServersPanel(props: { title?: string; onClose?: () => void }) {
  const favorites = useFavorites();
  const [gameId, setGameId] = useState<string>(() => loadGame());
  const [filters, setFilters] = useState<ServerFiltersState>(DEFAULT_FILTERS);
  const [selectedAddress, setSelectedAddress] = useState<string | undefined>(undefined);
  const list = useServerList(gameId, filters);
  const game = getGameDefinition(gameId);
  const selected = useMemo<GameServerRecord | null>(() => {
    const live = list.servers.find((server) => server.address === selectedAddress);
    if (live) return live;
    const pinned = favorites.favorites.find((fav) => fav.gameId === gameId && fav.address === selectedAddress);
    return pinned ? { ...pinned, players: pinned.players ?? 0, maxPlayers: pinned.maxPlayers ?? 0, ping: pinned.ping ?? null, tags: pinned.tags || [], protocol: game.protocol, gameId, joinCommand: pinned.joinCommand || `connect ${pinned.address}` } as GameServerRecord : null;
  }, [favorites.favorites, game.protocol, gameId, list.servers, selectedAddress]);

  useEffect(() => {
    try { (globalThis as any).__store_set?.('sweatshop.game-servers.game', gameId); } catch {}
  }, [gameId]);

  useEffect(() => {
    const currentFavorites = favorites.byGame(gameId);
    if (!selectedAddress && currentFavorites.length > 0) setSelectedAddress(currentFavorites[0].address);
  }, [favorites, gameId, selectedAddress]);

  function toggleFavorite(server: GameServerRecord) {
    favorites.toggle({
      gameId,
      address: server.address,
      name: server.name,
      map: server.map,
      players: server.players,
      maxPlayers: server.maxPlayers,
      ping: server.ping,
      tags: server.tags,
      joinCommand: server.joinCommand,
      secure: server.secure,
      passwordProtected: server.passwordProtected,
    });
  }

  const selectedPinned = favorites.favorites.some((fav) => fav.gameId === gameId && fav.address === selectedAddress);

  return (
    <Col style={{ width: '100%', height: '100%', backgroundColor: COLORS.panelBg }}>
      <Row style={{ alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingLeft: 14, paddingRight: 14, paddingTop: 12, paddingBottom: 12, borderBottomWidth: 1, borderColor: COLORS.borderSoft }}>
        <Col style={{ gap: 2, flexGrow: 1, flexBasis: 0 }}>
          <Text fontSize={13} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>{props.title || 'Game Servers'}</Text>
          <Text fontSize={10} color={COLORS.textDim}>Real protocol browser for Valve and TCP-based game servers. Socket bindings are required for live queries.</Text>
        </Col>
        {props.onClose ? (
          <Pressable onPress={props.onClose} style={{ paddingLeft: 8, paddingRight: 8, paddingTop: 4, paddingBottom: 4, borderRadius: 8, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelAlt }}>
            <Text fontSize={10} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>Close</Text>
          </Pressable>
        ) : null}
      </Row>

      <ScrollView style={{ flexGrow: 1, flexBasis: 0, minHeight: 0 }}>
        <Col style={{ padding: 14, gap: 12 }}>
          <GamePicker value={gameId} onChange={(next) => { setGameId(next); setSelectedAddress(undefined); }} />
          <FavoritesBar
            favorites={favorites.byGame(gameId)}
            selectedAddress={selectedAddress}
            onSelect={(fav) => setSelectedAddress(fav.address)}
            onRemove={(fav) => favorites.unpin(fav.gameId, fav.address)}
          />
          <ServerFilters value={filters} onChange={setFilters} />
          <Row style={{ alignItems: 'stretch', gap: 12, flexWrap: 'wrap' }}>
            <Box style={{ flexGrow: 1, flexBasis: 0, minWidth: 420 }}>
              <ServerList
                servers={list.servers}
                filters={filters}
                available={list.available}
                banner={list.banner}
                hostFns={list.hostFns}
                selectedAddress={selectedAddress}
                pinnedAddresses={new Set(favorites.byGame(gameId).map((fav) => fav.address))}
                onSelect={(server) => setSelectedAddress(server.address)}
                onPin={toggleFavorite}
                onRefresh={list.refresh}
              />
            </Box>
            <Box style={{ width: 420, flexShrink: 0, minWidth: 320 }}>
              <ServerDetail
                server={selected}
                protocol={game.protocol}
                onPin={() => selected ? toggleFavorite(selected) : undefined}
                pinned={selectedPinned}
              />
            </Box>
          </Row>
        </Col>
      </ScrollView>
    </Col>
  );
}
