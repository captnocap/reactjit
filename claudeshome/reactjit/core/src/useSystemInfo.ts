/**
 * System information hook — gathers real OS/hardware data across all targets.
 *
 * Love2D/web: uses bridge RPC → Lua gathers from /proc, io.popen, os.getenv
 * Node.js (grid targets): falls back to os module + child_process
 *
 * Every returned section has .toSysLog(path) for structured file logging.
 */

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useBridgeOptional } from './context';
import { useLuaInterval } from './hooks';
import type { IBridge } from './bridge';

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

function withSysLog<T extends Record<string, any>>(
  obj: T,
  logger: (path: string, data: any) => void,
): T & { toSysLog: (path: string) => void } {
  const result = { ...obj } as any;
  result.toSysLog = (path: string) => {
    const clean = { ...obj };
    delete (clean as any).toSysLog;
    logger(path, clean);
  };
  return result;
}

// ── Types ────────────────────────────────────────────────────

export interface MemoryInfo {
  used: number;
  total: number;
  unit: 'GiB' | 'MiB';
  toSysLog: (path: string) => void;
}

export interface UptimeInfo {
  days: number;
  hours: number;
  minutes: number;
  toSysLog: (path: string) => void;
}

export interface SystemInfo {
  os: string;
  kernel: string;
  hostname: string;
  user: string;
  shell: string;
  cpu: string;
  arch: string;
  memory: MemoryInfo;
  uptime: UptimeInfo;
  loading: boolean;
  toSysLog: (path: string) => void;
}

const NOOP_LOG = (_path: string) => {};

const EMPTY: SystemInfo = {
  os: '',
  kernel: '',
  hostname: '',
  user: '',
  shell: '',
  cpu: '',
  arch: '',
  memory: { used: 0, total: 0, unit: 'GiB', toSysLog: NOOP_LOG },
  uptime: { days: 0, hours: 0, minutes: 0, toSysLog: NOOP_LOG },
  loading: true,
  toSysLog: NOOP_LOG,
};

// ── Formatting helpers ───────────────────────────────────────

export function formatUptime(u: { days: number; hours: number; minutes: number }): string {
  const parts: string[] = [];
  if (u.days > 0) parts.push(`${u.days} day${u.days !== 1 ? 's' : ''}`);
  if (u.hours > 0) parts.push(`${u.hours} hour${u.hours !== 1 ? 's' : ''}`);
  if (u.minutes > 0) parts.push(`${u.minutes} min${u.minutes !== 1 ? 's' : ''}`);
  return parts.join(', ') || '< 1 min';
}

export function formatBytes(bytes: number): string {
  const gib = bytes / (1024 * 1024 * 1024);
  if (gib >= 1) return `${gib.toFixed(1)} GiB`;
  const mib = bytes / (1024 * 1024);
  return `${mib.toFixed(0)} MiB`;
}

export function formatMemory(m: { used: number; total: number; unit: string }): string {
  return `${m.used.toFixed(1)} ${m.unit} / ${m.total.toFixed(1)} ${m.unit}`;
}

// ── Node.js fallback (grid targets) ─────────────────────────

function getSystemInfoNode(logger: (path: string, data: any) => void): SystemInfo | null {
  if (!_require) return null;
  try {
    const os = _require('os');
    const cpus = os.cpus();
    const cpuModel = (cpus[0]?.model || 'unknown')
      .replace(/\(R\)/g, '')
      .replace(/\(TM\)/g, '')
      .replace(/CPU\s+/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    const totalBytes = os.totalmem();
    const freeBytes = os.freemem();
    const totalGiB = totalBytes / (1024 * 1024 * 1024);
    const usedGiB = (totalBytes - freeBytes) / (1024 * 1024 * 1024);

    const uptimeSecs = os.uptime();
    const days = Math.floor(uptimeSecs / 86400);
    const hours = Math.floor((uptimeSecs % 86400) / 3600);
    const minutes = Math.floor((uptimeSecs % 3600) / 60);

    let distro = `${os.type()} ${os.release()}`;
    try {
      const cp = _require('child_process');
      const release = cp.execSync('cat /etc/os-release', { encoding: 'utf-8' });
      const match = release.match(/PRETTY_NAME="(.+?)"/);
      if (match) distro = match[1];
    } catch {}

    const shell = (process.env.SHELL || 'unknown').split('/').pop() || 'unknown';
    const cpu = `${cpuModel} (${cpus.length} cores)`;
    const arch = os.arch();
    const kernel = os.release();
    const hostname = os.hostname();
    const user = os.userInfo().username;
    const memory = { used: usedGiB, total: totalGiB, unit: 'GiB' as const };
    const uptime = { days, hours, minutes };

    return {
      os: distro,
      kernel,
      hostname,
      user,
      shell,
      cpu,
      arch,
      memory: withSysLog(memory, logger),
      uptime: withSysLog(uptime, logger),
      loading: false,
      toSysLog: (path: string) => logger(path, {
        os: distro, kernel, hostname, user, shell, cpu, arch, memory, uptime,
      }),
    };
  } catch {
    return null;
  }
}

// ── Hook ─────────────────────────────────────────────────────

/**
 * Returns real system information (OS, CPU, memory, uptime, etc.).
 * Every sub-object has .toSysLog(path) for structured file logging.
 *
 * @param refreshInterval - ms between re-polls for dynamic fields (memory, uptime).
 *   Defaults to 0 (no refresh — fetches once on mount).
 *
 * @example
 * const info = useSystemInfo(5000);
 * info.cpu                               // "AMD Ryzen 9 7950X (32 cores)"
 * info.memory.toSysLog('/tmp/mem.log')   // log memory snapshot
 * info.toSysLog('/tmp/sys.log')          // log everything
 */
export function useSystemInfo(refreshInterval: number = 0): SystemInfo {
  const bridge = useBridgeOptional();
  const [info, setInfo] = useState<SystemInfo>(EMPTY);
  const mountedRef = useRef(true);

  const logger = useMemo(() => makeSysLogger(bridge), [bridge]);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const fetchData = useCallback(() => {
    if (!mountedRef.current) return;

    if (!bridge) {
      const nodeInfo = getSystemInfoNode(logger);
      if (nodeInfo) setInfo(nodeInfo);
      return;
    }

    bridge.rpc<any>('sys:info').then((raw) => {
      if (!mountedRef.current) return;
      setInfo({
        os: raw.os,
        kernel: raw.kernel,
        hostname: raw.hostname,
        user: raw.user,
        shell: raw.shell,
        cpu: raw.cpu,
        arch: raw.arch,
        memory: withSysLog(raw.memory, logger),
        uptime: withSysLog(raw.uptime, logger),
        loading: false,
        toSysLog: (path: string) => logger(path, raw),
      });
    }).catch(() => {});
  }, [bridge, logger]);

  // Initial fetch
  useEffect(() => { fetchData(); }, [fetchData]);

  // Polling driven by Lua-side timer (bridge mode) or stays as one-shot (no bridge)
  useLuaInterval(bridge && refreshInterval > 0 ? refreshInterval : null, fetchData);

  return info;
}
