const React: any = require('react');
const { useCallback, useEffect, useMemo, useState } = React;

import { exec } from '../../../host';

export type ProcessEntry = {
  pid: number;
  cpu: number;
  mem: number;
  command: string;
  source: 'cpu' | 'mem' | 'both';
};

function sh(script: string): string {
  return exec(`sh -lc ${JSON.stringify(script)}`).trim();
}

function parsePsAux(raw: string, source: 'cpu' | 'mem'): ProcessEntry[] {
  const out: ProcessEntry[] = [];
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('USER ')) continue;
    const parts = trimmed.split(/\s+/);
    if (parts.length < 11) continue;
    const pid = Number(parts[1]);
    const cpu = Number(parts[2]);
    const mem = Number(parts[3]);
    const command = parts.slice(10).join(' ');
    if (!Number.isFinite(pid) || !command) continue;
    out.push({
      pid,
      cpu: Number.isFinite(cpu) ? cpu : 0,
      mem: Number.isFinite(mem) ? mem : 0,
      command,
      source,
    });
  }
  return out;
}

function splitFilter(raw: string): string[] {
  return raw.split(',').map((part) => part.trim().toLowerCase()).filter(Boolean);
}

function matchesFilters(command: string, include: string[], exclude: string[]): boolean {
  const needle = command.toLowerCase();
  if (include.length > 0 && !include.some((part) => needle.includes(part))) return false;
  if (exclude.some((part) => needle.includes(part))) return false;
  return true;
}

function collectProcesses(include: string, exclude: string, limit: number): ProcessEntry[] {
  const cpuRaw = sh(`ps aux --sort=-%cpu | sed -n '1,14p'`);
  const memRaw = sh(`ps aux --sort=-%mem | sed -n '1,14p'`);
  const includeFilters = splitFilter(include);
  const excludeFilters = splitFilter(exclude);
  const map = new Map<number, ProcessEntry>();

  for (const entry of [...parsePsAux(cpuRaw, 'cpu'), ...parsePsAux(memRaw, 'mem')]) {
    if (!matchesFilters(entry.command, includeFilters, excludeFilters)) continue;
    const current = map.get(entry.pid);
    if (!current) {
      map.set(entry.pid, entry);
      continue;
    }
    map.set(entry.pid, {
      ...current,
      cpu: Math.max(current.cpu, entry.cpu),
      mem: Math.max(current.mem, entry.mem),
      source: current.source === entry.source ? current.source : 'both',
    });
  }

  return Array.from(map.values())
    .sort((a, b) => b.cpu - a.cpu || b.mem - a.mem || a.command.localeCompare(b.command))
    .slice(0, Math.max(1, limit));
}

export function useProcessList(opts: { intervalMs: number; include: string; exclude: string; limit?: number }) {
  const [processes, setProcesses] = useState<ProcessEntry[]>(() => collectProcesses(opts.include, opts.exclude, opts.limit ?? 5));
  const refresh = useCallback(() => {
    setProcesses(collectProcesses(opts.include, opts.exclude, opts.limit ?? 5));
  }, [opts.include, opts.exclude, opts.limit]);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, Math.max(1000, opts.intervalMs));
    return () => clearInterval(id);
  }, [refresh, opts.intervalMs]);

  const summary = useMemo(() => ({
    cpu: processes[0]?.cpu || 0,
    mem: processes.reduce((sum, entry) => sum + entry.mem, 0),
  }), [processes]);

  return { processes, refresh, summary };
}
