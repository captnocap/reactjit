// =============================================================================
// useNodeGraph — walks the live React tree, flattens into a list
// =============================================================================
// Reads rootInstances through renderer/hostConfig and produces a flat list of
// { id, type, depth, parentId, childCount, hasHandlers, renderCount } entries.
// TreeView renders the list directly; each entry's `depth` drives indentation.
//
// Polls on a timer (config via intervalMs, default 500ms). The reconciler
// mutates the root list in place, so a fresh walk on tick surfaces new /
// removed / updated nodes without needing to hook into reconciler events.
// =============================================================================

const React: any = require('react');
const { useEffect, useState, useRef } = React;

import { getRootInstances, type Instance } from '../../../../renderer/hostConfig';

export interface GraphNode {
  id: number;
  type: string;
  depth: number;
  parentId: number | null;
  childCount: number;
  hasHandlers: boolean;
  renderCount: number;
  // Short single-line summary of props for the row label. Kept cheap; the
  // PropEditor reads the full props object directly from the Instance.
  propsSummary: string;
}

export interface GraphSnapshot {
  nodes: GraphNode[];
  instances: Map<number, Instance>;
  rootIds: number[];
  takenAt: number;
}

function summariseProps(props: Record<string, any>): string {
  const parts: string[] = [];
  for (const k of Object.keys(props || {})) {
    if (k === 'children' || k === 'style') continue;
    const v = (props as any)[k];
    if (typeof v === 'function') continue;
    if (v === null || v === undefined) continue;
    const s = typeof v === 'string' ? JSON.stringify(v) : String(v);
    parts.push(k + '=' + (s.length > 24 ? s.slice(0, 24) + '…' : s));
    if (parts.length >= 3) break;
  }
  return parts.join(' ');
}

function walk(
  instances: Instance[],
  depth: number,
  parentId: number | null,
  out: GraphNode[],
  byId: Map<number, Instance>,
) {
  for (const inst of instances) {
    byId.set(inst.id, inst);
    out.push({
      id: inst.id,
      type: inst.type,
      depth,
      parentId,
      childCount: inst.children ? inst.children.length : 0,
      hasHandlers: !!inst.handlers && Object.keys(inst.handlers).length > 0,
      renderCount: inst.renderCount || 0,
      propsSummary: summariseProps(inst.props || {}),
    });
    if (inst.children && inst.children.length > 0) {
      walk(inst.children, depth + 1, inst.id, out, byId);
    }
  }
}

function snapshot(): GraphSnapshot {
  const roots = getRootInstances();
  const out: GraphNode[] = [];
  const byId = new Map<number, Instance>();
  walk(roots, 0, null, out, byId);
  return {
    nodes: out,
    instances: byId,
    rootIds: roots.map((r: Instance) => r.id),
    takenAt: Date.now(),
  };
}

/**
 * Return a live snapshot of the React tree plus a `refresh()` imperative
 * escape hatch. `intervalMs` controls the poll cadence; pass 0 to disable
 * polling (useful when TimeTravel is active and we don't want the tree to
 * keep mutating under the cursor).
 */
export function useNodeGraph(intervalMs: number = 500): {
  snapshot: GraphSnapshot;
  refresh: () => void;
} {
  const [snap, setSnap] = useState<GraphSnapshot>(() => snapshot());
  const mounted = useRef(true);

  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  useEffect(() => {
    if (!intervalMs || intervalMs <= 0) return;
    const tick = () => {
      if (!mounted.current) return;
      setSnap(snapshot());
    };
    const handle = setInterval(tick, intervalMs);
    return () => { try { clearInterval(handle); } catch {} };
  }, [intervalMs]);

  const refresh = () => { if (mounted.current) setSnap(snapshot()); };
  return { snapshot: snap, refresh };
}
