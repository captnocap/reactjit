// =============================================================================
// useNodeGraph — walks the live React tree, flattens into a list
// =============================================================================
// Reads rootInstances through renderer/hostConfig and produces a flat list of
// GraphNode entries used by TreeView. Each entry carries depth for indented
// rendering, parentId for virtual grouping, childCount for the row affordance,
// handler/render count for badges, and a short propsSummary string.
//
// Polls on setInterval (intervalMs; pass 0 to pause — TimeTravel freezes the
// tree while scrubbing by disabling the poll). The reconciler mutates the
// root list in place so a fresh walk on each tick surfaces tree mutations
// without needing to hook into reconciler events.
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
 * Live view of the React tree. `intervalMs` controls polling cadence;
 * pass 0 to pause (TimeTravel uses this so the tree stays stable while
 * scrubbing). `refresh()` is an imperative escape hatch for callers that
 * want to force a snapshot on a specific event.
 */
export function useNodeGraph(intervalMs: number = 500): {
  snapshot: GraphSnapshot;
  refresh: () => void;
} {
  const [snap, setSnap] = useState(() => snapshot());
  const mounted = useRef(true);

  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  useEffect(() => {
    if (!intervalMs || intervalMs <= 0) return;
    const tick = () => { if (mounted.current) setSnap(snapshot()); };
    const handle = setInterval(tick, intervalMs);
    return () => { try { clearInterval(handle); } catch {} };
  }, [intervalMs]);

  const refresh = () => { if (mounted.current) setSnap(snapshot()); };
  return { snapshot: snap, refresh };
}
