// Cartridge loader — read a guest bundle off disk, eval it inside the host's
// V8 context, return the exported root component.
//
// Why eval and not import: V8 in this host has no ESM module loader wired up.
// Bundles are pre-built IIFE blobs. Eval runs them in the calling scope so
// the cartridge_entry can stash its App into a slot we control.
//
// Why slots: a future caller may load multiple cartridges concurrently. Each
// load creates a fresh slot object, sets globalThis.__cartridgeLoadSlot to
// it, evals, then reads slot.App. The cartridge_entry assigns into that slot
// by closure-of-globalThis-pointer.

import { readFile, stat } from './hooks/fs';

type Loaded = {
  path: string;
  mtimeMs: number;
  Component: any;
};

const cache = new Map<string, Loaded>();

function trace(...args: any[]): void {
  if ((globalThis as any).__TRACE_CARTRIDGE) {
    try { console.log('[cartridge]', ...args); } catch {}
  }
}

export function loadCartridge(path: string): any {
  trace('loadCartridge enter', path);
  const st = stat(path);
  if (!st) {
    console.error('[cartridge] not found:', path);
    return null;
  }
  trace('stat ok', path, 'mtime=', st.mtimeMs, 'size=', (st as any).size);
  const hit = cache.get(path);
  if (hit && hit.mtimeMs === st.mtimeMs) {
    trace('cache hit', path);
    return hit.Component;
  }

  const src = readFile(path);
  if (!src) {
    console.error('[cartridge] read failed:', path);
    return null;
  }
  trace('readFile ok', path, 'bytes=', src.length);

  const slot: { App: any } = { App: null };
  const g: any = globalThis as any;
  const prev = g.__cartridgeLoadSlot;
  g.__cartridgeLoadSlot = slot;
  try {
    // Indirect eval — runs the bundle's IIFE at global scope. The bundle's
    // top-level statements execute, the cartridge_entry runs last and writes
    // slot.App.
    trace('eval start', path);
    (0, eval)(src);
    trace('eval done', path, 'slot.App is', slot.App ? 'set' : 'NULL');
  } catch (e: any) {
    console.error('[cartridge] eval failed:', path, e?.message || e, e?.stack || '');
    g.__cartridgeLoadSlot = prev;
    return null;
  }
  g.__cartridgeLoadSlot = prev;

  if (!slot.App) {
    console.error('[cartridge] bundle did not register a component:', path);
    return null;
  }
  const loaded: Loaded = { path, mtimeMs: st.mtimeMs, Component: slot.App };
  cache.set(path, loaded);
  trace('loadCartridge return component', path);
  return slot.App;
}

export function evictCartridge(path: string): void {
  cache.delete(path);
}

export function cacheSize(): number {
  return cache.size;
}
