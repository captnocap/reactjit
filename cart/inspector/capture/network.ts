import { NetworkEntry } from '../types';
import { LIMITS } from '../constants';
import { estimateSize } from '../utils';

let netIdSeq = 1;
const listeners = new Set<(entry: NetworkEntry) => void>();
const history: NetworkEntry[] = [];

export function installNetworkCapture() {
  const h = globalThis as any;
  const orig = h.__hostFlush;
  if (typeof orig !== 'function') return;
  h.__hostFlush = (payload: string) => {
    const start = performance.now();
    let cmds: any[] = [];
    try {
      cmds = JSON.parse(payload);
    } catch {}
    const result = orig(payload);
    const entry: NetworkEntry = {
      id: netIdSeq++,
      timestamp: start,
      cmds: Array.isArray(cmds) ? cmds : [cmds],
      count: Array.isArray(cmds) ? cmds.length : 1,
      durationUs: Math.round((performance.now() - start) * 1000),
      sizeEstimate: payload.length,
    };
    history.push(entry);
    if (history.length > LIMITS.maxNetwork) history.shift();
    // Defer listener notification — __hostFlush is called from inside React's
    // commit phase (resetAfterCommit → flushToHost → __hostFlush). Firing
    // subscribers synchronously here means their setState calls happen during
    // commit, which React treats as a nested update and throws
    // "Maximum update depth exceeded" on the next commit. setTimeout(0)
    // queues the notifications to fire in the next tick, outside the commit.
    setTimeout(() => listeners.forEach((fn) => fn(entry)), 0);
    return result;
  };
}

export function subscribeNetwork(fn: (entry: NetworkEntry) => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getNetworkHistory(): NetworkEntry[] {
  return history;
}

export function clearNetwork() {
  history.length = 0;
  listeners.forEach((fn) =>
    fn({ id: -1, timestamp: 0, cmds: [], count: 0 })
  );
}

export function getNetworkStats() {
  const total = history.length;
  const ops: Record<string, number> = {};
  let totalSize = 0;
  for (const e of history) {
    totalSize += e.sizeEstimate || 0;
    for (const c of e.cmds) {
      const op = c?.op || '?';
      ops[op] = (ops[op] || 0) + 1;
    }
  }
  return { total, ops, totalSize };
}
