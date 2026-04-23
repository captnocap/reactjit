// Shared exec helper for browser + android automation. Wraps runtime/hooks/process.execAsync
// and caches which(1) results so probing 'which adb' once per session doesn't
// re-fire for every keystroke.

import { execAsync, type ExecResult } from '../../../../runtime/hooks/process';

export interface ExecProbe { present: boolean; path: string; stderr?: string; }

const _probeCache: Record<string, ExecProbe> = {};

export async function whichAsync(bin: string): Promise<ExecProbe> {
  if (_probeCache[bin]) return _probeCache[bin];
  const res = await execAsync('which ' + shellQuote(bin));
  const path = (res.stdout || '').trim();
  const present = res.code === 0 && path.length > 0;
  const probe: ExecProbe = { present, path };
  _probeCache[bin] = probe;
  return probe;
}

export function invalidateWhich(bin?: string) {
  if (!bin) { for (const k in _probeCache) delete _probeCache[k]; return; }
  delete _probeCache[bin];
}

// POSIX-ish shell escape. Acceptable for constructing argv lines from user text;
// the host drops into /bin/sh -c so the shell tokenizes anyway.
export function shellQuote(s: string): string {
  if (s === '') return "''";
  if (/^[a-zA-Z0-9_@%+=:,./-]+$/.test(s)) return s;
  return "'" + s.replace(/'/g, "'\\''") + "'";
}

// Run and return the full ExecResult. Thin pass-through so callers don't need
// to import from runtime/hooks directly.
export function run(cmd: string): Promise<ExecResult> {
  return execAsync(cmd);
}

// Run with a hard timeout via the shell's `timeout(1)` wrapper when available.
export async function runWithTimeout(cmd: string, seconds: number): Promise<ExecResult> {
  const hasTimeout = (await whichAsync('timeout')).present;
  const wrapped = hasTimeout ? 'timeout ' + seconds + ' ' + cmd : cmd;
  return execAsync(wrapped);
}

// Convenience: base64-decode stdout from binary-producing commands (screencap).
export function base64ToBytes(b64: string): Uint8Array {
  try {
    const g: any = globalThis as any;
    if (typeof g.atob === 'function') {
      const bin = g.atob(b64);
      const out = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
      return out;
    }
  } catch (_) {}
  return new Uint8Array(0);
}
