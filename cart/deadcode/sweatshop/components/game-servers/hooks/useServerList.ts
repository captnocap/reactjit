import { useCallback, useEffect, useMemo, useState } from 'react';
import { protocolBanner, socketSupport, type SocketProtocol } from '../../../lib/game-servers/support';
import { getGameDefinition } from '../../../lib/game-servers/catalog';

export type ServerFiltersState = {
  region: string;
  map: string;
  mode: string;
  playerRange: string;
  secure: 'any' | 'secure' | 'insecure';
  passwordProtected: 'any' | 'yes' | 'no';
  tags: string;
};

export type GameServerRecord = {
  address: string;
  name: string;
  map: string;
  players: number;
  maxPlayers: number;
  ping: number | null;
  tags: string[];
  region?: string;
  mode?: string;
  secure?: boolean;
  passwordProtected?: boolean;
  protocol: SocketProtocol;
  gameId: string;
  playersList?: Array<{ name: string; score?: number; duration?: number }>;
  rules?: Record<string, string>;
  joinCommand: string;
};

export type ServerListState = {
  available: boolean;
  banner: string;
  hostFns: string[];
  protocols: SocketProtocol[];
  loading: boolean;
  refreshedAt: number | null;
  servers: GameServerRecord[];
  refresh: () => void;
};

function normalizeFilters(filters: ServerFiltersState): ServerFiltersState {
  return {
    region: filters.region || 'any',
    map: filters.map || '',
    mode: filters.mode || '',
    playerRange: filters.playerRange || 'any',
    secure: filters.secure || 'any',
    passwordProtected: filters.passwordProtected || 'any',
    tags: filters.tags || '',
  };
}

export function useServerList(gameId: string, filters: ServerFiltersState): ServerListState {
  const game = getGameDefinition(gameId);
  const protocol: SocketProtocol = game.protocol;
  const support = socketSupport(protocol);
  const [refreshCount, setRefreshCount] = useState(0);
  const [refreshedAt, setRefreshedAt] = useState<number | null>(null);

  const protocols = useMemo(() => {
    const next: SocketProtocol[] = [protocol];
    if (gameId === 'minecraft' || gameId === 'terraria') return next;
    return next;
  }, [gameId, protocol]);

  const refresh = useCallback(() => {
    setRefreshCount((value) => value + 1);
    setRefreshedAt(Date.now());
  }, []);

  useEffect(() => {
    setRefreshedAt(null);
    setRefreshCount(0);
  }, [gameId]);

  return {
    available: support.available,
    banner: support.available ? 'socket bindings present' : protocolBanner(protocols),
    hostFns: support.present,
    protocols,
    loading: support.available && refreshCount > 0,
    refreshedAt,
    servers: [],
    refresh,
  };
}

