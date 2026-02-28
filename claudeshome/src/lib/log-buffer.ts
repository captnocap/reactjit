/**
 * Module-level console intercept + reactive log buffer.
 * Wrap console.log/warn/error once, notify all React subscribers.
 */

export type LogLevel = 'log' | 'warn' | 'error' | 'info';

export interface LogEntry {
  id: number;
  level: LogLevel;
  text: string;
  ts: number;
}

const MAX = 300;
const entries: LogEntry[] = [];
let nextId = 0;
const subscribers = new Set<(entries: LogEntry[]) => void>();

function push(level: LogLevel, args: any[]) {
  const text = args
    .map(a => {
      if (typeof a === 'string') return a;
      try { return JSON.stringify(a); } catch { return String(a); }
    })
    .join(' ');
  entries.push({ id: nextId++, level, text, ts: Date.now() });
  if (entries.length > MAX) entries.splice(0, entries.length - MAX);
  const snapshot = entries.slice();
  subscribers.forEach(fn => fn(snapshot));
}

// Patch console once
const _log   = console.log.bind(console);
const _warn  = console.warn.bind(console);
const _error = console.error.bind(console);
const _info  = (console.info ?? console.log).bind(console);

console.log   = (...a) => { _log(...a);   push('log',   a); };
console.warn  = (...a) => { _warn(...a);  push('warn',  a); };
console.error = (...a) => { _error(...a); push('error', a); };
console.info  = (...a) => { _info(...a);  push('info',  a); };

export function getEntries() { return entries.slice(); }

export function subscribe(fn: (entries: LogEntry[]) => void): () => void {
  subscribers.add(fn);
  return () => subscribers.delete(fn);
}
