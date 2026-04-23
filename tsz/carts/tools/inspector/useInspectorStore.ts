// =============================================================================
// useInspectorStore — shared state for the standalone Inspector tools app
// =============================================================================
// Module-scope store + subscribe pattern so every panel (TreeView, PropEditor,
// EventLog, TimeTravel) sees the same state. Persistent settings (tab
// visibility, recording flag, buffer size, time-travel flag) round-trip
// through __store_* under sweatshop.inspector.*; the event ring buffer and
// time-travel cursor are in-memory session state.
// =============================================================================

const React: any = require('react');
const { useEffect, useState } = React;

const host: any = globalThis;
const storeGet = typeof host.__store_get === 'function' ? host.__store_get : (_: string) => null;
const storeSet = typeof host.__store_set === 'function' ? host.__store_set : (_: string, __: string) => {};

const KEY = 'sweatshop.inspector';

function sget(path: string, fallback: any): any {
  try {
    const raw = storeGet(KEY + '.' + path);
    if (raw === null || raw === undefined || raw === '') return fallback;
    if (typeof fallback === 'boolean') return raw === 'true' || raw === '1';
    if (typeof fallback === 'number') { const n = Number(raw); return isNaN(n) ? fallback : n; }
    return String(raw);
  } catch { return fallback; }
}
function sset(path: string, value: any) {
  try { storeSet(KEY + '.' + path, String(value)); } catch {}
}

// ── Types ────────────────────────────────────────────────────────────────────

export type TabId = 'tree' | 'props' | 'events' | 'timetravel';

export interface InspectorEvent {
  id: number;
  ts: number;
  hook: string;         // 'useState' | 'useEffect' | 'custom' | ...
  nodeId: number | null;
  delta: string;
}

export interface InspectorState {
  activeTab: TabId;
  showTabs: Record<TabId, boolean>;
  recordEnabled: boolean;
  eventBuffer: number;
  timeTravelEnabled: boolean;
  selectedNodeId: number | null;
  eventFilter: string;
  events: InspectorEvent[];
  timeCursor: number;   // -1 = live-tail; otherwise an index into events
}

// ── Initial state (hydrated from __store_*) ─────────────────────────────────

const state: InspectorState = {
  activeTab:        sget('activeTab', 'tree') as TabId,
  showTabs: {
    tree:       sget('show.tree', true),
    props:      sget('show.props', true),
    events:     sget('show.events', true),
    timetravel: sget('show.timetravel', true),
  },
  recordEnabled:     sget('record.enabled', true),
  eventBuffer:       sget('record.buffer', 500),
  timeTravelEnabled: sget('timetravel.enabled', true),
  selectedNodeId:    null,
  eventFilter:       '',
  events:            [],
  timeCursor:        -1,
};

let nextEventId = 1;
const listeners = new Set<() => void>();

function emit() { listeners.forEach((fn) => { try { fn(); } catch {} }); }

// ── Mutators (all route through emit so subscribers re-render) ──────────────

export function setActiveTab(tab: TabId) {
  state.activeTab = tab;
  sset('activeTab', tab);
  emit();
}
export function setTabVisible(tab: TabId, visible: boolean) {
  state.showTabs[tab] = visible;
  sset('show.' + tab, visible);
  emit();
}
export function setRecordEnabled(v: boolean) {
  state.recordEnabled = v;
  sset('record.enabled', v);
  emit();
}
export function setEventBuffer(n: number) {
  const clamped = Math.max(10, Math.min(5000, Math.round(n)));
  state.eventBuffer = clamped;
  sset('record.buffer', clamped);
  trimBuffer();
  emit();
}
export function setTimeTravelEnabled(v: boolean) {
  state.timeTravelEnabled = v;
  sset('timetravel.enabled', v);
  if (!v) state.timeCursor = -1;
  emit();
}
export function setSelectedNodeId(id: number | null) {
  state.selectedNodeId = id;
  emit();
}
export function setEventFilter(filter: string) {
  state.eventFilter = filter;
  emit();
}
export function setTimeCursor(idx: number) {
  const max = state.events.length - 1;
  state.timeCursor = idx < 0 ? -1 : Math.min(idx, max);
  emit();
}

// ── Event ring buffer ───────────────────────────────────────────────────────

function trimBuffer() {
  if (state.events.length > state.eventBuffer) {
    state.events = state.events.slice(state.events.length - state.eventBuffer);
  }
}

export function pushEvent(hook: string, nodeId: number | null, delta: string) {
  if (!state.recordEnabled) return;
  state.events.push({ id: nextEventId++, ts: Date.now(), hook, nodeId, delta });
  trimBuffer();
  if (state.timeCursor !== -1) {
    // Live-tail: stay anchored to the end while cursor is pinned.
    state.timeCursor = state.events.length - 1;
  }
  emit();
}
export function clearEvents() {
  state.events = [];
  state.timeCursor = -1;
  emit();
}

// ── React hook wrapper ──────────────────────────────────────────────────────

export function useInspectorStore(): InspectorState {
  const [, setTick] = useState(0);
  useEffect(() => {
    const fn = () => setTick((t: number) => t + 1);
    listeners.add(fn);
    return () => { listeners.delete(fn); };
  }, []);
  return state;
}
