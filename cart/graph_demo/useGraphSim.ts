const React: any = require('react');
const { useCallback, useEffect, useMemo, useRef, useState } = React;

import type { EdgeDensity, GraphLayoutMode, ColorMode, DemoGraph, DemoNode, LayoutResult, NodeCount, Position } from './LayoutEngine';
import {
  buildDemoGraph,
  collectNeighborhood,
  findNodesByQuery,
  layoutGraph,
  subtreeTranslate,
} from './LayoutEngine';

const host: any = globalThis as any;

export type GraphCamera = {
  x: number;
  y: number;
  zoom: number;
};

export type GraphSim = {
  graph: DemoGraph;
  layout: LayoutResult;
  positions: Map<string, Position>;
  selectedId: string | null;
  selectedNode: DemoNode | null;
  neighborhood: Set<string> | null;
  searchQuery: string;
  searchResults: DemoNode[];
  camera: GraphCamera;
  layoutMode: GraphLayoutMode;
  nodeCount: NodeCount;
  edgeDensity: EdgeDensity;
  colorMode: ColorMode;
  animate: boolean;
  pulseId: string | null;
  setLayoutMode: (mode: GraphLayoutMode) => void;
  setNodeCount: (count: NodeCount) => void;
  setEdgeDensity: (density: EdgeDensity) => void;
  setColorMode: (mode: ColorMode) => void;
  setAnimate: (next: boolean) => void;
  setSearchQuery: (next: string) => void;
  selectNode: (id: string | null) => void;
  focusNode: (id: string) => void;
  moveNode: (id: string, gx: number, gy: number) => void;
  clearSelection: () => void;
};

function clonePositions(src: Map<string, Position>): Map<string, Position> {
  const out = new Map<string, Position>();
  for (const [id, pos] of src) out.set(id, { x: pos.x, y: pos.y });
  return out;
}

function focusCameraFor(node: DemoNode, positions: Map<string, Position>): GraphCamera {
  const pos = positions.get(node.id) || { x: 0, y: 0 };
  const zoom = node.depth === 0 ? 1.05 : 1.2;
  return { x: pos.x, y: pos.y, zoom };
}

function usePulseTimeout() {
  const timerRef = useRef<any>(null);
  const clearTimer = useCallback(() => {
    if (timerRef.current == null) return;
    clearTimeout(timerRef.current);
    timerRef.current = null;
  }, []);

  const arm = useCallback((id: string | null, setPulseId: (next: string | null) => void) => {
    clearTimer();
    setPulseId(id);
    if (!id) return;
    timerRef.current = setTimeout(() => {
      setPulseId(null);
      timerRef.current = null;
    }, 1100);
  }, [clearTimer]);

  useEffect(() => () => clearTimer(), [clearTimer]);

  return { arm };
}

export function useGraphSim() {
  const [layoutMode, setLayoutMode] = useState<GraphLayoutMode>('force');
  const [nodeCount, setNodeCount] = useState<NodeCount>(100);
  const [edgeDensity, setEdgeDensity] = useState<EdgeDensity>('medium');
  const [colorMode, setColorMode] = useState<ColorMode>('degree');
  const [animate, setAnimate] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [camera, setCamera] = useState<GraphCamera>({ x: 0, y: 0, zoom: 0.92 });
  const [pulseId, setPulseId] = useState<string | null>(null);

  const graph = useMemo(() => buildDemoGraph(nodeCount, edgeDensity), [nodeCount, edgeDensity]);
  const layout = useMemo(() => layoutGraph(graph, layoutMode), [graph, layoutMode]);
  const searchResults = useMemo(() => findNodesByQuery(graph, searchQuery).slice(0, 12), [graph, searchQuery]);
  const selectedNode = selectedId ? graph.byId.get(selectedId) || null : null;
  const neighborhood = selectedId ? collectNeighborhood(graph, selectedId) : null;

  const positionsRef = useRef<Map<string, Position>>(clonePositions(layout.positions));
  const targetsRef = useRef<Map<string, Position>>(clonePositions(layout.positions));
  const versionRef = useRef(0);
  const [renderVersion, setRenderVersion] = useState(0);
  const pulseHelper = usePulseTimeout();

  const invalidate = useCallback(() => {
    versionRef.current += 1;
    setRenderVersion(versionRef.current);
  }, []);

  useEffect(() => {
    const nextTargets = clonePositions(layout.positions);
    const previous = positionsRef.current;
    const nextPositions = new Map<string, Position>();
    for (const [id, pos] of nextTargets) {
      const prev = previous.get(id);
      if (animate && prev) nextPositions.set(id, { x: prev.x, y: prev.y });
      else nextPositions.set(id, { x: pos.x, y: pos.y });
    }
    positionsRef.current = nextPositions;
    targetsRef.current = nextTargets;
    if (!animate) invalidate();
  }, [animate, invalidate, layout]);

  useEffect(() => {
    if (selectedId && !graph.byId.has(selectedId)) {
      setSelectedId(null);
    }
  }, [graph, selectedId]);

  useEffect(() => {
    if (!animate) return;
    const raf = typeof host.requestAnimationFrame === 'function' ? host.requestAnimationFrame.bind(host) : null;
    const cancel = typeof host.cancelAnimationFrame === 'function' ? host.cancelAnimationFrame.bind(host) : null;
    let frame: any = null;
    let stopped = false;

    const tick = () => {
      if (stopped) return;
      let moved = false;
      const current = positionsRef.current;
      const target = targetsRef.current;
      for (const [id, tp] of target) {
        const cp = current.get(id);
        if (!cp) {
          current.set(id, { x: tp.x, y: tp.y });
          moved = true;
          continue;
        }
        const dx = tp.x - cp.x;
        const dy = tp.y - cp.y;
        const dist = Math.abs(dx) + Math.abs(dy);
        if (dist > 0.15) {
          cp.x += dx * 0.18;
          cp.y += dy * 0.18;
          moved = true;
        } else if (cp.x !== tp.x || cp.y !== tp.y) {
          cp.x = tp.x;
          cp.y = tp.y;
          moved = true;
        }
      }
      if (moved) invalidate();
      frame = raf ? raf(tick) : setTimeout(tick, 16);
    };

    frame = raf ? raf(tick) : setTimeout(tick, 16);
    return () => {
      stopped = true;
      if (frame != null) {
        if (cancel) cancel(frame);
        else clearTimeout(frame);
      }
    };
  }, [animate, invalidate, layoutMode, nodeCount, edgeDensity]);

  const selectNode = useCallback((id: string | null) => {
    if (!id) {
      setSelectedId(null);
      return;
    }
    setSelectedId((prev) => (prev === id ? null : id));
  }, []);

  const focusNode = useCallback((id: string) => {
    const node = graph.byId.get(id);
    if (!node) return;
    setSelectedId(id);
    setCamera(focusCameraFor(node, positionsRef.current));
    pulseHelper.arm(id, setPulseId);
  }, [graph, pulseHelper]);

  const moveNode = useCallback((id: string, gx: number, gy: number) => {
    const current = positionsRef.current.get(id);
    if (!current) return;
    const nextPositions = subtreeTranslate(graph, positionsRef.current, id, gx, gy);
    const nextTargets = subtreeTranslate(graph, targetsRef.current, id, gx, gy);
    positionsRef.current = nextPositions;
    targetsRef.current = nextTargets;
    invalidate();
  }, [graph, invalidate]);

  const clearSelection = useCallback(() => {
    setSelectedId(null);
    setPulseId(null);
  }, []);

  return {
    graph,
    layout,
    positions: positionsRef.current,
    selectedId,
    selectedNode,
    neighborhood,
    searchQuery,
    searchResults,
    camera,
    layoutMode,
    nodeCount,
    edgeDensity,
    colorMode,
    animate,
    pulseId,
    setLayoutMode,
    setNodeCount,
    setEdgeDensity,
    setColorMode,
    setAnimate: (next: boolean) => setAnimate(next),
    setSearchQuery,
    selectNode,
    focusNode,
    moveNode,
    clearSelection,
  } as GraphSim & { renderVersion: number };
}
