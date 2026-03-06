/**
 * React hooks for game server management.
 *
 * All state lives in Lua — these hooks poll via RPC and dispatch commands.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useLoveRPC, useLoveEvent } from '@reactjit/core';
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

  const statusRpc = useLoveRPC('gameserver:status');
  const playersRpc = useLoveRPC('gameserver:players');
  const logsRpc = useLoveRPC('gameserver:logs');
  const rconRpc = useLoveRPC('gameserver:rcon');
  const controlRpc = useLoveRPC('gameserver:control');

  const statusRpcRef = useRef(statusRpc);
  const playersRpcRef = useRef(playersRpc);
  const logsRpcRef = useRef(logsRpc);
  statusRpcRef.current = statusRpc;
  playersRpcRef.current = playersRpc;
  logsRpcRef.current = logsRpc;

  // Poll status (2300ms — staggered)
  useEffect(() => {
    const id = setInterval(async () => {
      try {
        const res = await statusRpcRef.current({});
        if (res) {
          setState(res.state || 'stopped');
          if (res.status) setStatus(res.status);
        }
      } catch (_) {}
    }, 2300);
    return () => clearInterval(id);
  }, []);

  // Poll players (3100ms — staggered)
  useEffect(() => {
    const id = setInterval(async () => {
      try {
        const res = await playersRpcRef.current({});
        if (res && res.players) setPlayers(res.players);
      } catch (_) {}
    }, 3100);
    return () => clearInterval(id);
  }, []);

  // Poll logs (1700ms — staggered)
  useEffect(() => {
    const id = setInterval(async () => {
      try {
        const res = await logsRpcRef.current({});
        if (res && res.logs) setLogs(res.logs);
      } catch (_) {}
    }, 1700);
    return () => clearInterval(id);
  }, []);

  const rcon = useCallback((command: string) => {
    rconRpc({ command });
  }, [rconRpc]);

  const start = useCallback(() => {
    controlRpc({ action: 'start' });
  }, [controlRpc]);

  const stop = useCallback(() => {
    controlRpc({ action: 'stop' });
  }, [controlRpc]);

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

  return { state, status, players, logs, rcon, start, stop, kick, ban, changeMap, say };
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
  const playersRpcRef = useRef(playersRpc);
  playersRpcRef.current = playersRpc;

  useEffect(() => {
    const id = setInterval(async () => {
      try {
        const res = await playersRpcRef.current({});
        if (res) {
          if (res.players) setPlayers(res.players);
          if (res.maxPlayers) setMaxPlayers(res.maxPlayers);
        }
      } catch (_) {}
    }, 2700);
    return () => clearInterval(id);
  }, []);

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
  const statusRpcRef = useRef(statusRpc);
  statusRpcRef.current = statusRpc;

  useEffect(() => {
    const id = setInterval(async () => {
      try {
        const res = await statusRpcRef.current({});
        if (res && res.status) setStatus(res.status);
      } catch (_) {}
    }, 3500);
    return () => clearInterval(id);
  }, []);

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
  const logsRpc = useLoveRPC('gameserver:logs');
  const controlRpc = useLoveRPC('gameserver:control');
  const logsRpcRef = useRef(logsRpc);
  logsRpcRef.current = logsRpc;

  useEffect(() => {
    const id = setInterval(async () => {
      try {
        const res = await logsRpcRef.current({});
        if (res && res.logs) setLogs(res.logs);
      } catch (_) {}
    }, 1900);
    return () => clearInterval(id);
  }, []);

  const clear = useCallback(() => {
    controlRpc({ action: 'clear_logs' });
    setLogs([]);
  }, [controlRpc]);

  return { logs, clear };
}
