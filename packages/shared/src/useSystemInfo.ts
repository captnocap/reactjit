/**
 * System information hook — gathers real OS/hardware data across all targets.
 *
 * Love2D/web: uses bridge RPC → Lua gathers from /proc, io.popen, os.getenv
 * Node.js (grid targets): falls back to os module + child_process
 */

import { useState, useEffect, useRef } from 'react';
import { useBridgeOptional } from './context';

// ── Types ────────────────────────────────────────────────────

export interface MemoryInfo {
  used: number;
  total: number;
  unit: 'GiB' | 'MiB';
}

export interface UptimeInfo {
  days: number;
  hours: number;
  minutes: number;
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
}

const EMPTY: SystemInfo = {
  os: '',
  kernel: '',
  hostname: '',
  user: '',
  shell: '',
  cpu: '',
  arch: '',
  memory: { used: 0, total: 0, unit: 'GiB' },
  uptime: { days: 0, hours: 0, minutes: 0 },
  loading: true,
};

// ── Formatting helpers ───────────────────────────────────────

export function formatUptime(u: UptimeInfo): string {
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

export function formatMemory(m: MemoryInfo): string {
  return `${m.used.toFixed(1)} ${m.unit} / ${m.total.toFixed(1)} ${m.unit}`;
}

// ── Node.js fallback (grid targets) ─────────────────────────
// Dynamic require hidden from esbuild's static analysis so IIFE
// bundles (Love2D/QuickJS) don't fail trying to resolve node built-ins.

const _require: ((m: string) => any) | null = (() => {
  try { return new Function('return require')() as (m: string) => any; }
  catch { return null; }
})();

function getSystemInfoNode(): SystemInfo | null {
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

    return {
      os: distro,
      kernel: os.release(),
      hostname: os.hostname(),
      user: os.userInfo().username,
      shell,
      cpu: `${cpuModel} (${cpus.length} cores)`,
      arch: os.arch(),
      memory: { used: usedGiB, total: totalGiB, unit: 'GiB' },
      uptime: { days, hours, minutes },
      loading: false,
    };
  } catch {
    return null;
  }
}

// ── Hook ─────────────────────────────────────────────────────

/**
 * Returns real system information (OS, CPU, memory, uptime, etc.).
 *
 * @param refreshInterval - ms between re-polls for dynamic fields (memory, uptime).
 *   Defaults to 0 (no refresh — fetches once on mount).
 *
 * @example
 * const info = useSystemInfo(5000); // refresh every 5s
 * <Text fontSize={14}>{info.cpu}</Text>
 * <Text fontSize={14}>{formatMemory(info.memory)}</Text>
 * <Text fontSize={14}>{formatUptime(info.uptime)}</Text>
 */
export function useSystemInfo(refreshInterval: number = 0): SystemInfo {
  const bridge = useBridgeOptional();
  const [info, setInfo] = useState<SystemInfo>(EMPTY);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    // No bridge — try Node.js direct gathering
    if (!bridge) {
      const nodeInfo = getSystemInfoNode();
      if (nodeInfo) {
        setInfo(nodeInfo);

        if (refreshInterval > 0) {
          const id = setInterval(() => {
            if (!mountedRef.current) return;
            const fresh = getSystemInfoNode();
            if (fresh) setInfo(fresh);
          }, refreshInterval);
          return () => clearInterval(id);
        }
      }
      return;
    }

    // Bridge available — use RPC
    let cancelled = false;

    function fetch() {
      bridge!.rpc<Omit<SystemInfo, 'loading'>>('sys:info').then((data) => {
        if (!cancelled && mountedRef.current) {
          setInfo({ ...data, loading: false });
        }
      }).catch(() => {
        // RPC failed — leave loading state, don't crash
      });
    }

    fetch();

    if (refreshInterval > 0) {
      const id = setInterval(fetch, refreshInterval);
      return () => { cancelled = true; clearInterval(id); };
    }

    return () => { cancelled = true; };
  }, [bridge, refreshInterval]);

  return info;
}
