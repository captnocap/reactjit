/**
 * Live port monitoring hook with process kill capability.
 *
 * Shows all listening TCP/UDP ports with their PIDs and process names.
 * Provides a kill(pid) function to terminate processes.
 */

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useBridgeOptional } from './context';
import { useLuaInterval } from './hooks';
import type { IBridge } from './bridge';

// ── Types ────────────────────────────────────────────────────

export interface PortInfo {
  port: number;
  host: string;
  pid: number;
  process: string;
  protocol: 'tcp' | 'udp';
  state: string;
  toSysLog: (path: string) => void;
}

export interface PortMonitor {
  list: PortInfo[];
  loading: boolean;
  kill: (pid: number, signal?: string) => Promise<boolean>;
  toSysLog: (path: string) => void;
}

// ── Dynamic require (esbuild-safe) ──────────────────────────

const _require: ((m: string) => any) | null = (() => {
  try { return new Function('return require')() as (m: string) => any; }
  catch { return null; }
})();

// ── SysLog helper ────────────────────────────────────────────

function makeSysLogger(bridge: IBridge | null) {
  return function sysLog(path: string, data: any) {
    const line = JSON.stringify({ ...data, _ts: new Date().toISOString() });
    if (bridge) {
      bridge.rpc('sys:log', { path, data: line });
    } else if (_require) {
      try {
        const fs = _require('fs');
        fs.appendFileSync(path, line + '\n');
      } catch { /* silent */ }
    }
  };
}

// ── Hook ─────────────────────────────────────────────────────

const NOOP_LOG = (_path: string) => {};

/**
 * Monitor open ports and kill processes.
 *
 * @param interval — ms between refreshes. Defaults to 2000.
 *
 * @example
 * const ports = usePorts(2000);
 * ports.list.map(p => `${p.port} ${p.process} (${p.pid})`)
 * ports.kill(1234)           // SIGTERM
 * ports.kill(1234, 'KILL')   // SIGKILL
 */
export function usePorts(interval: number = 2000): PortMonitor {
  const bridge = useBridgeOptional();
  const [list, setList] = useState<PortInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const mountedRef = useRef(true);

  const logger = useMemo(() => makeSysLogger(bridge), [bridge]);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const fetchData = useCallback(() => {
    if (!bridge || !mountedRef.current) return;

    bridge.rpc<any[]>('sys:ports').then((raw) => {
      if (!mountedRef.current) return;
      const ports: PortInfo[] = (raw || []).map((p: any) => ({
        ...p,
        toSysLog: (path: string) => logger(path, p),
      }));
      setList(ports);
      setLoading(false);
    }).catch(() => {});
  }, [bridge, logger]);

  // Initial fetch
  useEffect(() => { fetchData(); }, [fetchData]);

  // Polling driven by Lua-side timer
  useLuaInterval(bridge ? interval : null, fetchData);

  const kill = useCallback(async (pid: number, signal?: string): Promise<boolean> => {
    if (!bridge) return false;
    try {
      const result = await bridge.rpc<boolean>('sys:kill', { pid, signal: signal || 'TERM' });
      return !!result;
    } catch {
      return false;
    }
  }, [bridge]);

  return {
    list,
    loading,
    kill,
    toSysLog: (path: string) => logger(path, { ports: list.map(p => ({ port: p.port, host: p.host, pid: p.pid, process: p.process, protocol: p.protocol })) }),
  };
}
