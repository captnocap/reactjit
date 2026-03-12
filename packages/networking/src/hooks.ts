/**
 * React hooks for game server management.
 *
 * All state lives in Lua — these hooks poll via RPC and dispatch commands.
 */

import { useState, useCallback, useRef } from 'react';
import { useLoveRPC, useLuaInterval, useLuaQuery } from '@reactjit/core';
import type {
  ServerState,
  ServerStatus,
  Player,
  ServerLog,
  UseGameServerResult,
  UsePlayerListResult,
  UseServerStatusResult,
  UseServerLogsResult,
} from './types';

// ============================================================================
// useGameServer — full server management
// ============================================================================

/**
 * Full game server lifecycle + status + RCON control.
 *
 * Polls server status every 2.3s and logs every 1.7s (staggered intervals).
 *
 * @example
 * const server = useGameServer();
 * server.rcon('sv_maxrate 128');
 * server.kick('griefer123', 'no griefing');
 * server.changeMap('de_inferno');
 */
export function useGameServer(): UseGameServerResult {
  const [state, setState] = useState<ServerState>('stopped');
  const [status, setStatus] = useState<ServerStatus | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [logs, setLogs] = useState<ServerLog[]>([]);
  const [maps, setMaps] = useState<string[]>([]);

  const statusRpc = useLoveRPC('gameserver:status');
  const playersRpc = useLoveRPC('gameserver:players');
  const logsRpc = useLoveRPC('gameserver:logs');
  const rconRpc = useLoveRPC('gameserver:rcon');
  const controlRpc = useLoveRPC('gameserver:control');
  const mapsRpc = useLoveRPC('gameserver:maps');

  // Refs for callbacks to avoid stale closures in interval handlers
  const statusRpcRef = useRef(statusRpc);
  const playersRpcRef = useRef(playersRpc);
  const logsRpcRef = useRef(logsRpc);
  const mapsRpcRef = useRef(mapsRpc);
  statusRpcRef.current = statusRpc;
  playersRpcRef.current = playersRpc;
  logsRpcRef.current = logsRpc;
  mapsRpcRef.current = mapsRpc;

  // Initial maps fetch — fires once on mount
  const { data: initialMaps } = useLuaQuery<{ maps: string[] }>('gameserver:maps', {}, []);
  const initialMapsRef = useRef(false);
  if (initialMaps?.maps?.length && !initialMapsRef.current) {
    initialMapsRef.current = true;
    setMaps(initialMaps.maps);
  }

  const isActive = state === 'installing' || state === 'starting' || state === 'stopping';

  // Poll status — adaptive: 500ms during active states, 2300ms when idle
  useLuaInterval(isActive ? 500 : 2300, () => {
    statusRpcRef.current({}).then((res: any) => {
      if (res) {
        setState(res.state || 'stopped');
        if (res.status) setStatus(res.status);
      }
    }).catch(() => {});
  });

  // Poll players (3100ms — staggered)
  useLuaInterval(3100, () => {
    playersRpcRef.current({}).then((res: any) => {
      if (res && res.players) setPlayers(res.players);
    }).catch(() => {});
  });

  // Poll maps (10s — only needs to run once after install, then rarely)
  useLuaInterval(10000, () => {
    mapsRpcRef.current({}).then((res: any) => {
      if (res && res.maps && res.maps.length > 0) setMaps(res.maps);
    }).catch(() => {});
  });

  // Poll logs — adaptive: 300ms during active states, 1700ms when idle
  useLuaInterval(isActive ? 300 : 1700, () => {
    logsRpcRef.current({}).then((res: any) => {
      if (res && res.logs) setLogs(res.logs);
    }).catch(() => {});
  });

  // Apply immediate state from control responses (no waiting for next poll)
  const applySnapshot = useCallback((res: any) => {
    if (!res) return;
    if (res.state) setState(res.state);
    if (res.status) setStatus(res.status);
    if (res.logs) setLogs(res.logs);
  }, []);

  const rcon = useCallback((command: string) => {
    rconRpc({ command });
  }, [rconRpc]);

  const start = useCallback(async () => {
    setState('starting');
    try {
      const res = await controlRpc({ action: 'start' });
      applySnapshot(res);
    } catch (_) {}
  }, [controlRpc, applySnapshot]);

  const stop = useCallback(async () => {
    setState('stopping');
    try {
      const res = await controlRpc({ action: 'stop' });
      applySnapshot(res);
    } catch (_) {}
  }, [controlRpc, applySnapshot]);

  const install = useCallback(async () => {
    setState('installing');
    try {
      const res = await controlRpc({ action: 'install' });
      applySnapshot(res);
    } catch (_) {}
  }, [controlRpc, applySnapshot]);

  const kick = useCallback((playerName: string, reason?: string) => {
    rconRpc({ command: `kick "${playerName}" ${reason || ''}`.trim() });
  }, [rconRpc]);

  const ban = useCallback((playerName: string, reason?: string) => {
    rconRpc({ command: `ban "${playerName}" ${reason || ''}`.trim() });
  }, [rconRpc]);

  const changeMap = useCallback((map: string) => {
    rconRpc({ command: `changelevel ${map}` });
  }, [rconRpc]);

  const say = useCallback((message: string) => {
    rconRpc({ command: `say ${message}` });
  }, [rconRpc]);

  return { state, status, players, logs, maps, rcon, start, stop, install, kick, ban, changeMap, say };
}

// ============================================================================
// usePlayerList — just the player list
// ============================================================================

/**
 * Poll just the player list for a running game server.
 *
 * @example
 * const { players, count, maxPlayers } = usePlayerList();
 */
export function usePlayerList(): UsePlayerListResult {
  const [players, setPlayers] = useState<Player[]>([]);
  const [maxPlayers, setMaxPlayers] = useState(0);
  const playersRpc = useLoveRPC('gameserver:players');

  useLuaInterval(2700, () => {
    playersRpc({}).then((res: any) => {
      if (res) {
        if (res.players) setPlayers(res.players);
        if (res.maxPlayers) setMaxPlayers(res.maxPlayers);
      }
    }).catch(() => {});
  });

  return { players, count: players.length, maxPlayers };
}

// ============================================================================
// useServerStatus — just the server status
// ============================================================================

/**
 * Poll just the server status.
 *
 * @example
 * const { online, playerCount, map } = useServerStatus();
 */
export function useServerStatus(): UseServerStatusResult {
  const [status, setStatus] = useState<ServerStatus | null>(null);
  const statusRpc = useLoveRPC('gameserver:status');

  useLuaInterval(3500, () => {
    statusRpc({}).then((res: any) => {
      if (res && res.status) setStatus(res.status);
    }).catch(() => {});
  });

  return {
    status,
    online: status?.online ?? false,
    playerCount: status?.players ?? 0,
    map: status?.map ?? null,
  };
}

// ============================================================================
// useServerLogs — just the logs
// ============================================================================

/**
 * Poll server logs.
 *
 * @example
 * const { logs, clear } = useServerLogs();
 */
export function useServerLogs(): UseServerLogsResult {
  const [logs, setLogs] = useState<ServerLog[]>([]);
  const controlRpc = useLoveRPC('gameserver:control');
  const logsRpc = useLoveRPC('gameserver:logs');

  useLuaInterval(1900, () => {
    logsRpc({}).then((res: any) => {
      if (res && res.logs) setLogs(res.logs);
    }).catch(() => {});
  });

  const clear = useCallback(() => {
    controlRpc({ action: 'clear_logs' });
    setLogs([]);
  }, [controlRpc]);

  return { logs, clear };
}
