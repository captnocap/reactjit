import { useState, useRef, useCallback } from 'react';
import { useLoveRPC, useLuaInterval, useMount } from '@reactjit/core';

// ── Types ────────────────────────────────────────────────────────────────────────

export interface ServerInfo {
  name: string;
  cwd: string;
  scripts: Record<string, string>;
  status: 'stopped' | 'running' | 'crashed' | 'starting' | 'stopping' | 'failed' | 'unknown';
  port: number | null;
  configPort: number | null;
  pid: number | null;
  uptime: number | null;
  exitCode: number | null;
  autostart: boolean;
  pinned: boolean;
  crashCount: number;
}

export interface LogEntry {
  time: string;
  text: string;
}

export interface AuditEntry {
  time: string;
  event: string;
  server: string;
  actor: string;
}

export interface DaemonStatus {
  running: boolean;
  reachable?: boolean;
  pid?: number | null;
  pidAlive?: boolean;
  ok?: boolean;
  error?: string;
}

// Sort: pinned alpha first, then rest alpha
export function sortServers(list: ServerInfo[]): ServerInfo[] {
  const pinned = list.filter(s => s.pinned).sort((a, b) => a.name.localeCompare(b.name));
  const rest   = list.filter(s => !s.pinned).sort((a, b) => a.name.localeCompare(b.name));
  return [...pinned, ...rest];
}

// ── useProcessManager ────────────────────────────────────────────────────────────

export function useProcessManager() {
  const [servers, setServers] = useState<ServerInfo[]>([]);
  const [daemonOnline, setDaemonOnline] = useState(true);

  const rpcCached  = useLoveRPC<ServerInfo[]>('pm:listCached');
  const rpcList    = useLoveRPC<ServerInfo[]>('pm:list');
  const rpcStart   = useLoveRPC('pm:start');
  const rpcStop    = useLoveRPC('pm:stop');
  const rpcRestart = useLoveRPC('pm:restart');
  const rpcAdd     = useLoveRPC('pm:add');
  const rpcRemove  = useLoveRPC('pm:remove');
  const rpcRename  = useLoveRPC('pm:rename');
  const rpcPin     = useLoveRPC('pm:pin');
  const rpcUnpin   = useLoveRPC('pm:unpin');

  const listRef   = useRef(rpcList);
  const cachedRef = useRef(rpcCached);
  listRef.current   = rpcList;
  cachedRef.current = rpcCached;

  // Load cached config on mount so sidebar isn't empty before daemon responds
  useMount(() => {
    cachedRef.current().then(result => {
      if (Array.isArray(result) && result.length > 0) {
        setServers(sortServers(result));
      }
    }).catch(() => {});
  });

  // Live poll — 2s is plenty for a server list
  useLuaInterval(2000, () => {
    listRef.current().then(result => {
      const list = Array.isArray(result) ? result : [];
      setServers(sortServers(list));
      setDaemonOnline(true);
    }).catch(() => {
      setDaemonOnline(false);
    });
  });

  const startServer = useCallback(async (name: string, script?: string) => {
    return rpcStart({ name, script });
  }, [rpcStart]);

  const stopServer = useCallback(async (name: string) => {
    return rpcStop({ name });
  }, [rpcStop]);

  const restartServer = useCallback(async (name: string) => {
    return rpcRestart({ name });
  }, [rpcRestart]);

  const addServer = useCallback(async (opts: {
    name?: string; cwd: string; scripts?: Record<string, string>;
    port?: number; env?: Record<string, string>; autostart?: boolean;
  }) => {
    return rpcAdd(opts);
  }, [rpcAdd]);

  const removeServer = useCallback(async (name: string) => {
    return rpcRemove({ name });
  }, [rpcRemove]);

  const renameServer = useCallback(async (name: string, newName: string) => {
    return rpcRename({ name, newName });
  }, [rpcRename]);

  const pinServer = useCallback(async (name: string) => {
    return rpcPin({ name });
  }, [rpcPin]);

  const unpinServer = useCallback(async (name: string) => {
    return rpcUnpin({ name });
  }, [rpcUnpin]);

  return {
    servers, daemonOnline,
    startServer, stopServer, restartServer,
    addServer, removeServer, renameServer,
    pinServer, unpinServer,
  };
}

// ── useServerLogs ────────────────────────────────────────────────────────────────

export function useServerLogs(name: string | null) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const rpcLogs = useLoveRPC<{ lines: LogEntry[] }>('pm:logs');
  const rpcRef = useRef(rpcLogs);
  rpcRef.current = rpcLogs;
  const nameRef = useRef(name);
  nameRef.current = name;

  const [filter, setFilter] = useState('');

  // Only poll when a server is selected — 2s interval, not 500ms
  useLuaInterval(2000, () => {
    const current = nameRef.current;
    if (!current) { setLogs([]); return; }
    rpcRef.current({ name: current, lines: 200 }).then(result => {
      const lines = result?.lines;
      setLogs(Array.isArray(lines) ? lines : []);
    }).catch(() => {});
  });

  const filtered = filter
    ? logs.filter(l => l.text?.toLowerCase().includes(filter.toLowerCase()))
    : logs;

  return { logs: filtered, filter, setFilter };
}

// ── useAuditLog ──────────────────────────────────────────────────────────────────

export function useAuditLog() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const rpc = useLoveRPC<{ entries: AuditEntry[] }>('pm:auditLog');
  const rpcRef = useRef(rpc);
  rpcRef.current = rpc;

  // 5s is fine for audit — it's a historical log, not real-time
  useLuaInterval(5000, () => {
    rpcRef.current({ lines: 200 }).then(result => {
      const list = result?.entries;
      setEntries(Array.isArray(list) ? list : []);
    }).catch(() => {});
  });

  return entries;
}

// ── useReservedPorts ─────────────────────────────────────────────────────────────

export function useReservedPorts() {
  const [ports, setPorts] = useState<number[]>([]);
  const rpcGet = useLoveRPC<{ ports: number[] }>('pm:getReservedPorts');
  const rpcSet = useLoveRPC('pm:setReservedPorts');

  useMount(() => {
    rpcGet().then(r => {
      if (Array.isArray(r?.ports)) setPorts(r.ports);
    }).catch(() => {});
  });

  const setReservedPorts = useCallback(async (newPorts: number[]) => {
    setPorts(newPorts);
    return rpcSet({ ports: newPorts });
  }, [rpcSet]);

  return { ports, setReservedPorts };
}

// ── useDaemonManager ─────────────────────────────────────────────────────────────

export function useDaemonManager() {
  const [daemonRunning, setDaemonRunning] = useState(false);
  const [daemonBusy, setDaemonBusy] = useState(false);

  const rpcStatus = useLoveRPC<DaemonStatus>('pm:daemonStatus');
  const rpcToggle = useLoveRPC<DaemonStatus>('pm:daemonToggle');
  const statusRef = useRef(rpcStatus);
  statusRef.current = rpcStatus;

  // 3s for daemon status — it barely changes
  useLuaInterval(3000, () => {
    statusRef.current().then(result => {
      setDaemonRunning(Boolean(result?.running));
    }).catch(() => {
      setDaemonRunning(false);
    });
  });

  const toggleDaemon = useCallback(async () => {
    if (daemonBusy) return;
    setDaemonBusy(true);
    try {
      const result = await rpcToggle();
      setDaemonRunning(Boolean(result?.running));
    } catch (_) {}
    finally { setDaemonBusy(false); }
  }, [daemonBusy, rpcToggle]);

  return { daemonRunning, daemonBusy, toggleDaemon };
}

// ── Formatting ───────────────────────────────────────────────────────────────────

export function formatUptime(seconds: number | null): string {
  if (seconds == null) return '--';
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m}m`;
}
