import { useState, useEffect, useRef, useCallback } from 'react';
import { useLoveRPC } from '@reactjit/core';

// ── Types ───────────────────────────────────────────────────────────────────────

export interface ServerInfo {
  name: string;
  cwd: string;
  scripts: Record<string, string>;
  status: 'stopped' | 'running' | 'crashed' | 'starting';
  port: number | null;
  configPort: number | null;
  pid: number | null;
  uptime: number | null;
  exitCode: number | null;
  autostart: boolean;
}

export interface LogEntry {
  time: string;
  text: string;
}

// ── useProcessManager ───────────────────────────────────────────────────────────

export function useProcessManager() {
  const [servers, setServers] = useState<ServerInfo[]>([]);
  const rpcList = useLoveRPC<ServerInfo[]>('pm:list');
  const rpcStart = useLoveRPC('pm:start');
  const rpcStop = useLoveRPC('pm:stop');
  const rpcRestart = useLoveRPC('pm:restart');
  const rpcAdd = useLoveRPC('pm:add');
  const rpcRemove = useLoveRPC('pm:remove');

  const listRef = useRef(rpcList);
  listRef.current = rpcList;

  useEffect(() => {
    const poll = async () => {
      try {
        const result = await listRef.current();
        // Bridge converts empty Lua tables {} to JS objects, not arrays.
        setServers(Array.isArray(result) ? result : []);
      } catch (_) {}
    };
    poll();
    const id = setInterval(poll, 1000);
    return () => clearInterval(id);
  }, []);

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

  return { servers, startServer, stopServer, restartServer, addServer, removeServer };
}

// ── useServerLogs ───────────────────────────────────────────────────────────────

export function useServerLogs(name: string | null) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const rpcLogs = useLoveRPC<{ lines: LogEntry[] }>('pm:logs');
  const rpcRef = useRef(rpcLogs);
  rpcRef.current = rpcLogs;

  useEffect(() => {
    if (!name) { setLogs([]); return; }
    const poll = async () => {
      try {
        const result = await rpcRef.current({ name, lines: 200 });
        // Bridge converts empty Lua tables {} to JS objects, not arrays.
        // Always guard with Array.isArray to prevent .map() TypeError.
        const lines = result?.lines;
        setLogs(Array.isArray(lines) ? lines : []);
      } catch (_) {}
    };
    poll();
    const id = setInterval(poll, 500);
    return () => clearInterval(id);
  }, [name]);

  return logs;
}

// ── Formatting helpers ──────────────────────────────────────────────────────────

export function formatUptime(seconds: number | null): string {
  if (seconds == null) return '--';
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m}m`;
}
