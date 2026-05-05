import { LogEntry } from '../types';
import { LIMITS } from '../constants';

let logIdSeq = 1;
const listeners = new Set<(entry: LogEntry) => void>();
const history: LogEntry[] = [];

function push(level: LogEntry['level'], message: string) {
  const last = history[history.length - 1];
  if (last && last.level === level && last.message === message) {
    last.count += 1;
    // Defer so subscriber setState doesn't run during React's commit phase.
    const snap = last;
    setTimeout(() => listeners.forEach((fn) => fn(snap)), 0);
    return;
  }
  const entry: LogEntry = {
    id: logIdSeq++,
    level,
    message,
    timestamp: performance.now(),
    count: 1,
  };
  history.push(entry);
  if (history.length > LIMITS.maxLogs) history.shift();
  // Same rationale as the coalesce branch above — defer listener notification
  // so subscriber setStates don't land inside React's commit phase.
  setTimeout(() => listeners.forEach((fn) => fn(entry)), 0);
}

export function installConsoleCapture() {
  const h = globalThis as any;
  const orig = h.console || {};
  const wrap = (level: LogEntry['level']) => (...args: any[]) => {
    const msg = args
      .map((a) => {
        if (a == null) return String(a);
        if (typeof a === 'string') return a;
        try {
          return JSON.stringify(a);
        } catch {
          return String(a);
        }
      })
      .join(' ');
    push(level, msg);
    const fn = orig[level];
    if (typeof fn === 'function') fn.apply(orig, args);
  };
  h.console = {
    ...orig,
    log: wrap('log'),
    warn: wrap('warn'),
    error: wrap('error'),
    info: wrap('info'),
    debug: wrap('debug'),
    trace: wrap('trace'),
  };
}

export function subscribeLogs(fn: (entry: LogEntry) => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getLogHistory(): LogEntry[] {
  return history;
}

export function clearLogs() {
  history.length = 0;
  listeners.forEach((fn) =>
    fn({ id: -1, level: 'log', message: '', timestamp: 0, count: 0 })
  );
}
