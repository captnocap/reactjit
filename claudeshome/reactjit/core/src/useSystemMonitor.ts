/**
 * Comprehensive system monitoring hook — htop/nvtop level data.
 *
 * Returns per-core CPU usage, detailed memory breakdown, process list,
 * GPU stats, network I/O rates, disk I/O rates, and task counts.
 *
 * Each section carries a .toSysLog(path) method for structured logging.
 */

import { useState, useEffect, useRef, useMemo } from 'react';
import { useBridgeOptional } from './context';
import type { IBridge } from './bridge';

// ── Types ────────────────────────────────────────────────────

export interface CoreInfo {
  id: number;
  usage: number;
  user: number;
  system: number;
  iowait: number;
  toSysLog: (path: string) => void;
}

export interface CpuInfo {
  cores: CoreInfo[];
  total: number;
  loadAvg: [number, number, number];
  toSysLog: (path: string) => void;
}

export interface DetailedMemory {
  total: number;
  used: number;
  free: number;
  available: number;
  buffers: number;
  cached: number;
  swap: { total: number; used: number };
  unit: 'GiB';
  toSysLog: (path: string) => void;
}

export interface ProcessInfo {
  user: string;
  pid: number;
  cpu: number;
  mem: number;
  vsz: number;
  rss: number;
  tty: string;
  stat: string;
  command: string;
}

export interface TaskCounts {
  total: number;
  running: number;
  sleeping: number;
  stopped: number;
  zombie: number;
  toSysLog: (path: string) => void;
}

export interface GpuInfo {
  name: string;
  vendor: 'nvidia' | 'amd';
  utilization: number;
  memUsed: number;
  memTotal: number;
  memUnit: string;
  temperature: number;
  power: number;
  toSysLog: (path: string) => void;
}

export interface NetworkInterface {
  name: string;
  rxBytes: number;
  txBytes: number;
  rxRate: number;
  txRate: number;
  toSysLog: (path: string) => void;
}

export interface DiskDevice {
  name: string;
  readRate: number;
  writeRate: number;
  reads: number;
  writes: number;
  toSysLog: (path: string) => void;
}

export interface SystemMonitor {
  cpu: CpuInfo;
  memory: DetailedMemory;
  processes: ProcessInfo[];
  tasks: TaskCounts;
  gpu: GpuInfo[] | null;
  network: NetworkInterface[];
  disk: DiskDevice[];
  loading: boolean;
  toSysLog: (path: string) => void;
}

// ── SysLog helper ────────────────────────────────────────────

function makeSysLogger(bridge: IBridge | null, _req: ((m: string) => any) | null) {
  return function sysLog(path: string, data: any) {
    const line = JSON.stringify({ ...data, _ts: new Date().toISOString() });
    if (bridge) {
      bridge.rpc('sys:log', { path, data: line });
    } else if (_req) {
      try {
        const fs = _req('fs');
        fs.appendFileSync(path, line + '\n');
      } catch { /* silent */ }
    }
  };
}

function attachSysLog<T extends Record<string, any>>(
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

function attachSysLogToArray<T extends Record<string, any>>(
  arr: T[],
  logger: (path: string, data: any) => void,
): (T & { toSysLog: (path: string) => void })[] {
  return arr.map(item => attachSysLog(item, logger));
}

// ── Dynamic require (esbuild-safe) ──────────────────────────

const _require: ((m: string) => any) | null = (() => {
  try { return new Function('return require')() as (m: string) => any; }
  catch { return null; }
})();

// ── Formatting helpers ───────────────────────────────────────

export function formatRate(bytesPerSec: number): string {
  if (bytesPerSec >= 1024 * 1024 * 1024) return `${(bytesPerSec / (1024 * 1024 * 1024)).toFixed(1)} GB/s`;
  if (bytesPerSec >= 1024 * 1024) return `${(bytesPerSec / (1024 * 1024)).toFixed(1)} MB/s`;
  if (bytesPerSec >= 1024) return `${(bytesPerSec / 1024).toFixed(1)} KB/s`;
  return `${bytesPerSec} B/s`;
}

export function formatTotalBytes(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
}

// ── Empty state ──────────────────────────────────────────────

const NOOP_LOG = (_path: string) => {};

const EMPTY: SystemMonitor = {
  cpu: { cores: [], total: 0, loadAvg: [0, 0, 0], toSysLog: NOOP_LOG },
  memory: { total: 0, used: 0, free: 0, available: 0, buffers: 0, cached: 0, swap: { total: 0, used: 0 }, unit: 'GiB', toSysLog: NOOP_LOG },
  processes: [],
  tasks: { total: 0, running: 0, sleeping: 0, stopped: 0, zombie: 0, toSysLog: NOOP_LOG },
  gpu: null,
  network: [],
  disk: [],
  loading: true,
  toSysLog: NOOP_LOG,
};

// ── Hook ─────────────────────────────────────────────────────

/**
 * Comprehensive system monitoring — htop/nvtop level data.
 *
 * @param interval — ms between refreshes. Defaults to 1000.
 * @param opts.processLimit — max processes to return. Defaults to 20.
 *
 * @example
 * const sys = useSystemMonitor(1000);
 * sys.cpu.cores.map(c => c.usage)   // per-core CPU %
 * sys.memory.used                   // GiB used
 * sys.processes[0].command          // top process
 * sys.gpu?.[0].temperature          // GPU temp
 * sys.cpu.toSysLog('/tmp/cpu.log')  // log CPU data
 */
export function useSystemMonitor(
  interval: number = 1000,
  opts?: { processLimit?: number },
): SystemMonitor {
  const bridge = useBridgeOptional();
  const [data, setData] = useState<SystemMonitor>(EMPTY);
  const mountedRef = useRef(true);
  const processLimit = opts?.processLimit ?? 20;

  const logger = useMemo(
    () => makeSysLogger(bridge, _require),
    [bridge],
  );

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    if (!bridge) return;

    let cancelled = false;

    function fetch() {
      bridge!.rpc<any>('sys:monitor', { processLimit }).then((raw) => {
        if (cancelled || !mountedRef.current) return;

        const cpu = attachSysLog(
          { ...raw.cpu, cores: attachSysLogToArray(raw.cpu?.cores || [], logger) },
          logger,
        ) as CpuInfo;

        const memory = attachSysLog(raw.memory || EMPTY.memory, logger) as DetailedMemory;
        const tasks = attachSysLog(raw.tasks || EMPTY.tasks, logger) as TaskCounts;
        const network = attachSysLogToArray(raw.network || [], logger) as NetworkInterface[];
        const disk = attachSysLogToArray(raw.disk || [], logger) as DiskDevice[];
        const gpu = raw.gpu ? attachSysLogToArray(raw.gpu, logger) as GpuInfo[] : null;

        setData({
          cpu,
          memory,
          processes: raw.processes || [],
          tasks,
          gpu,
          network,
          disk,
          loading: false,
          toSysLog: (path: string) => logger(path, {
            cpu: raw.cpu,
            memory: raw.memory,
            processes: raw.processes,
            tasks: raw.tasks,
            gpu: raw.gpu,
            network: raw.network,
            disk: raw.disk,
          }),
        });
      }).catch(() => {});
    }

    fetch();
    const id = setInterval(fetch, interval);
    return () => { cancelled = true; clearInterval(id); };
  }, [bridge, interval, processLimit, logger]);

  return data;
}
