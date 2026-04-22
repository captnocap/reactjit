// React hook wrapping the persistence layer for snapshots. The index (array of
// SnapshotMeta) stays tiny so listing stays fast; individual bodies live under
// per-id keys so loading one doesn't parse them all.

const React: any = require('react');
const { useState, useCallback, useEffect } = React;

import { capture, restore, type CaptureOptions, type RestoreOptions, type RestoreResult, type Snapshot, type SnapshotMeta } from './SnapshotEngine';

const INDEX_KEY = 'sweatshop.snapshots.index.v1';
const BODY_PREFIX = 'sweatshop.snapshots.body.';

function storeGet(key: string): string | null {
  try {
    const g: any = globalThis as any;
    if (typeof g.__store_get === 'function') return g.__store_get(key);
    if (typeof g.localStorage !== 'undefined') return g.localStorage.getItem(key);
  } catch (_) {}
  return null;
}

function storeSet(key: string, value: string): void {
  try {
    const g: any = globalThis as any;
    if (typeof g.__store_set === 'function') { g.__store_set(key, value); return; }
    if (typeof g.localStorage !== 'undefined') { g.localStorage.setItem(key, value); return; }
  } catch (_) {}
}

function storeDel(key: string): void {
  try {
    const g: any = globalThis as any;
    if (typeof g.__store_del === 'function') { g.__store_del(key); return; }
    if (typeof g.localStorage !== 'undefined') { g.localStorage.removeItem(key); return; }
  } catch (_) {}
}

function readIndex(): SnapshotMeta[] {
  const raw = storeGet(INDEX_KEY);
  if (!raw) return [];
  try { const parsed = JSON.parse(raw); return Array.isArray(parsed) ? parsed : []; } catch (_) { return []; }
}

function writeIndex(entries: SnapshotMeta[]): void {
  storeSet(INDEX_KEY, JSON.stringify(entries));
}

function writeBody(id: string, snap: Snapshot): void {
  storeSet(BODY_PREFIX + id, JSON.stringify(snap));
}

function readBody(id: string): Snapshot | null {
  const raw = storeGet(BODY_PREFIX + id);
  if (!raw) return null;
  try { return JSON.parse(raw) as Snapshot; } catch (_) { return null; }
}

export interface SnapshotsApi {
  index: SnapshotMeta[];
  reload: () => void;
  create: (opts?: CaptureOptions) => SnapshotMeta;
  rename: (id: string, name: string) => void;
  remove: (id: string) => void;
  load: (id: string) => Snapshot | null;
  restoreById: (id: string, opts?: RestoreOptions) => RestoreResult | null;
  clearAll: () => void;
  trim: (maxRetained: number, onlyAuto?: boolean) => void;
}

export function useSnapshots(): SnapshotsApi {
  const [index, setIndex] = useState<SnapshotMeta[]>(() => readIndex());

  const reload = useCallback(() => { setIndex(readIndex()); }, []);

  const create = useCallback((opts?: CaptureOptions): SnapshotMeta => {
    const snap = capture(opts);
    writeBody(snap.meta.id, snap);
    const next = [snap.meta, ...readIndex()];
    writeIndex(next);
    setIndex(next);
    return snap.meta;
  }, []);

  const rename = useCallback((id: string, name: string) => {
    const next = readIndex().map((m) => m.id === id ? { ...m, name } : m);
    writeIndex(next);
    setIndex(next);
    const body = readBody(id);
    if (body) writeBody(id, { ...body, meta: { ...body.meta, name } });
  }, []);

  const remove = useCallback((id: string) => {
    storeDel(BODY_PREFIX + id);
    const next = readIndex().filter((m) => m.id !== id);
    writeIndex(next);
    setIndex(next);
  }, []);

  const load = useCallback((id: string) => readBody(id), []);

  const restoreById = useCallback((id: string, opts?: RestoreOptions): RestoreResult | null => {
    const body = readBody(id);
    if (!body) return null;
    return restore(body, opts);
  }, []);

  const clearAll = useCallback(() => {
    const cur = readIndex();
    cur.forEach((m) => storeDel(BODY_PREFIX + m.id));
    writeIndex([]);
    setIndex([]);
  }, []);

  const trim = useCallback((maxRetained: number, onlyAuto?: boolean) => {
    const cur = readIndex();
    const keep: SnapshotMeta[] = [];
    const drop: SnapshotMeta[] = [];
    let kept = 0;
    for (const m of cur) {
      if (onlyAuto && !m.auto) { keep.push(m); continue; }
      if (kept < maxRetained) { keep.push(m); kept++; }
      else drop.push(m);
    }
    if (drop.length === 0) return;
    drop.forEach((m) => storeDel(BODY_PREFIX + m.id));
    writeIndex(keep);
    setIndex(keep);
  }, []);

  // Cheap cross-tab reload — re-read index on window focus.
  useEffect(() => {
    const g: any = globalThis as any;
    const target = typeof g.window !== 'undefined' ? g.window : null;
    if (!target || !target.addEventListener) return;
    const h = () => reload();
    target.addEventListener('focus', h);
    return () => { try { target.removeEventListener('focus', h); } catch (_) {} };
  }, [reload]);

  return { index, reload, create, rename, remove, load, restoreById, clearAll, trim };
}
