// Capture/restore orchestrator. Iterates the Registry, calls each slice's
// capture(), packages into a Snapshot. Restore does the inverse in one pass
// — slices that error don't block others (best-effort; errors returned).

import { listSlices, getSlice, type SnapshotSlice } from './SnapshotRegistry';

export interface SliceSnapshot {
  data: any;
  version?: number;
  label?: string;
  category?: string;
  bytes?: number;
}

export interface SnapshotMeta {
  id: string;
  name: string;
  t: number;
  bytes: number;
  sliceCount: number;
  auto?: boolean;
}

export interface Snapshot {
  meta: SnapshotMeta;
  slices: Record<string, SliceSnapshot>;
}

export interface CaptureOptions {
  name?: string;
  include?: (sliceId: string) => boolean;  // optional filter; defaults to all
  auto?: boolean;
}

export interface RestoreResult {
  applied: string[];
  missing: string[];   // slices in snapshot with no registered contributor
  errors: { id: string; error: string }[];
}

function uid(): string {
  return 'snap_' + Date.now().toString(36) + '_' + Math.floor(Math.random() * 1e6).toString(36);
}

function estimateBytes(value: any): number {
  try { return JSON.stringify(value).length; } catch (_) { return 0; }
}

export function capture(opts?: CaptureOptions): Snapshot {
  const slices = listSlices();
  const want = opts?.include;
  const out: Record<string, SliceSnapshot> = {};
  let total = 0;
  for (const s of slices) {
    if (want && !want(s.id)) continue;
    let data: any;
    try { data = s.capture(); } catch (err: any) {
      // Skip contributors that throw; don't let one bad slice tank the snapshot.
      try { (globalThis as any).console?.warn?.('[snapshot] capture failed', s.id, err); } catch (_) {}
      continue;
    }
    const bytes = estimateBytes(data);
    total += bytes;
    out[s.id] = { data, version: s.version, label: s.label, category: s.category, bytes };
  }
  const meta: SnapshotMeta = {
    id: uid(),
    name: opts?.name || defaultName(),
    t: Date.now(),
    bytes: total,
    sliceCount: Object.keys(out).length,
    auto: !!opts?.auto,
  };
  return { meta, slices: out };
}

export interface RestoreOptions {
  include?: (sliceId: string) => boolean;
}

export function restore(snapshot: Snapshot, opts?: RestoreOptions): RestoreResult {
  const result: RestoreResult = { applied: [], missing: [], errors: [] };
  const want = opts?.include;
  for (const id in snapshot.slices) {
    if (want && !want(id)) continue;
    const slice: SnapshotSlice | undefined = getSlice(id);
    if (!slice) { result.missing.push(id); continue; }
    try {
      slice.restore(snapshot.slices[id].data, { version: snapshot.slices[id].version });
      result.applied.push(id);
    } catch (err: any) {
      result.errors.push({ id, error: String(err && err.message || err) });
    }
  }
  return result;
}

// Utility: a diff-summary between two snapshots, keyed by slice id.
export type SliceDiffKind = 'same' | 'changed' | 'added' | 'removed';
export interface SliceDiffEntry { id: string; kind: SliceDiffKind; leftBytes?: number; rightBytes?: number; }

export function diff(a: Snapshot, b: Snapshot): SliceDiffEntry[] {
  const out: SliceDiffEntry[] = [];
  const ids = new Set<string>([...Object.keys(a.slices), ...Object.keys(b.slices)]);
  for (const id of ids) {
    const left = a.slices[id];
    const right = b.slices[id];
    if (left && !right) { out.push({ id, kind: 'removed', leftBytes: left.bytes }); continue; }
    if (!left && right) { out.push({ id, kind: 'added', rightBytes: right.bytes }); continue; }
    const same = equal(left.data, right.data);
    out.push({ id, kind: same ? 'same' : 'changed', leftBytes: left.bytes, rightBytes: right.bytes });
  }
  out.sort((x, y) => x.id < y.id ? -1 : x.id > y.id ? 1 : 0);
  return out;
}

function equal(a: any, b: any): boolean {
  if (a === b) return true;
  try { return JSON.stringify(a) === JSON.stringify(b); } catch (_) { return false; }
}

function defaultName(): string {
  const d = new Date();
  const p = (n: number) => n < 10 ? '0' + n : String(n);
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds());
}
