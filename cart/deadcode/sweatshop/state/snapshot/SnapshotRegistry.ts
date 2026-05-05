// Registry of state contributors. Panels/features call registerSlice at
// module init; the engine iterates the registry on capture/restore.
//
// Kept intentionally module-scoped (not React context) so any module can
// participate without threading providers through the tree — snapshots are
// app-global by nature, contributors are too.

export interface SnapshotSlice<T = any> {
  id: string;
  label?: string;
  category?: string;   // grouping hint for the panel UI (theme / layout / history / ...)
  version?: number;    // contributor's schema version; passed to restore so migrations can branch
  capture: () => T;
  restore: (data: T, meta: { version?: number }) => void;
  describe?: (data: T) => string;  // optional one-liner for diff hover
}

const _slices: Map<string, SnapshotSlice<any>> = new Map();
const _listeners: Set<() => void> = new Set();

function notify() { _listeners.forEach((fn) => { try { fn(); } catch (_) {} }); }

export function registerSlice<T>(slice: SnapshotSlice<T>): () => void {
  if (_slices.has(slice.id)) {
    // Overwriting is OK (hot reload replaces the contributor) — warn in dev.
    try { (globalThis as any).console?.warn?.('[snapshot] overwriting slice', slice.id); } catch (_) {}
  }
  _slices.set(slice.id, slice);
  notify();
  return () => { _slices.delete(slice.id); notify(); };
}

export function unregisterSlice(id: string): void {
  _slices.delete(id);
  notify();
}

export function getSlice(id: string): SnapshotSlice | undefined {
  return _slices.get(id);
}

export function listSlices(): SnapshotSlice[] {
  return Array.from(_slices.values());
}

export function subscribe(fn: () => void): () => void {
  _listeners.add(fn);
  return () => { _listeners.delete(fn); };
}

// Convenience: register several slices and get a single disposer.
export function registerSlices(slices: SnapshotSlice[]): () => void {
  const disposers = slices.map(registerSlice);
  return () => disposers.forEach((d) => d());
}

// Default categorization fallback for slices that don't declare one.
export function categoryOf(slice: SnapshotSlice): string {
  if (slice.category) return slice.category;
  if (slice.id.startsWith('theme'))    return 'theme';
  if (slice.id.startsWith('layout'))   return 'layout';
  if (slice.id.startsWith('panel'))    return 'panels';
  if (slice.id.startsWith('history'))  return 'history';
  if (slice.id.startsWith('cockpit'))  return 'cockpit';
  if (slice.id.startsWith('terminal')) return 'terminal';
  if (slice.id.startsWith('editor'))   return 'editor';
  return 'other';
}
