
import { Box, Canvas, Col, Graph, Pressable, Row, ScrollView, Text } from '../../../../runtime/primitives';
import { COLORS, TOKENS, fileTone, inferFileType } from '../../theme';
import { Icon } from '../icons';
import type { GraphLayoutMode } from './GraphControls';
import type { ImportGraph, ImportGraphEdge, ImportGraphNode } from './useImportGraph';

type LayoutNode = ImportGraphNode & { x: number; y: number; w: number; h: number };
type LayoutEdge = ImportGraphEdge & { ax: number; ay: number; bx: number; by: number };

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function scaleSize(node: ImportGraphNode): { w: number; h: number } {
  const base = node.depth === 0 ? 220 : node.local ? 182 : 170;
  const labelWidth = 52 + node.label.length * 7;
  const w = clamp(Math.max(base, labelWidth), 140, 260);
  const h = node.depth === 0 ? 74 : node.local ? 64 : 58;
  return { w, h };
}

function centerBounds(nodes: LayoutNode[]): { minX: number; minY: number; maxX: number; maxY: number } {
  let minX = 0;
  let minY = 0;
  let maxX = 0;
  let maxY = 0;
  for (const node of nodes) {
    minX = Math.min(minX, node.x - node.w / 2);
    minY = Math.min(minY, node.y - node.h / 2);
    maxX = Math.max(maxX, node.x + node.w / 2);
    maxY = Math.max(maxY, node.y + node.h / 2);
  }
  return { minX, minY, maxX, maxY };
}

function normalizeLayout(nodes: LayoutNode[], padX: number, padY: number): LayoutNode[] {
  if (nodes.length === 0) return nodes;
  const bounds = centerBounds(nodes);
  const shiftX = padX - bounds.minX;
  const shiftY = padY - bounds.minY;
  return nodes.map((node) => ({ ...node, x: node.x + shiftX, y: node.y + shiftY }));
}

function layerDepth(node: ImportGraphNode): number {
  return Math.max(0, Number(node.depth || 0));
}

function treeLayout(nodes: ImportGraphNode[], edges: ImportGraphEdge[]): { nodes: LayoutNode[]; edges: LayoutEdge[]; width: number; height: number } {
  const grouped = new Map<number, ImportGraphNode[]>();
  const byId = new Map<string, ImportGraphNode>();
  for (const node of nodes) {
    byId.set(node.id, node);
    const depth = layerDepth(node);
    const list = grouped.get(depth) || [];
    list.push(node);
    grouped.set(depth, list);
  }

  const levels = Array.from(grouped.keys()).sort((a, b) => a - b);
  const horizontalGap = 34;
  const verticalGap = 90;
  const basePadX = 60;
  const basePadY = 56;
  const laidOut: LayoutNode[] = [];
  let widest = 0;

  for (const depth of levels) {
    const row = grouped.get(depth) || [];
    const sized = row.map((node) => ({ node, ...scaleSize(node) })).sort((a, b) => a.node.label.localeCompare(b.node.label));
    const totalWidth = sized.reduce((sum, item) => sum + item.w, 0) + Math.max(0, sized.length - 1) * horizontalGap;
    widest = Math.max(widest, totalWidth);
    let cursor = 0;
    for (const item of sized) {
      laidOut.push({
        ...item.node,
        w: item.w,
        h: item.h,
        x: cursor + item.w / 2,
        y: basePadY + depth * verticalGap + item.h / 2,
      });
      cursor += item.w + horizontalGap;
    }
  }

  const root = laidOut.find((node) => node.depth === 0);
  const rootWidth = root ? root.w : 0;
  const shiftX = Math.max(basePadX, (widest - rootWidth) / 2 + basePadX);
  const normalized = normalizeLayout(laidOut, shiftX, basePadY);
  const bounds = centerBounds(normalized);
  const edgeLookup = new Map<string, LayoutNode>();
  for (const node of normalized) edgeLookup.set(node.id, node);
  const edgeNodes = edges.flatMap((edge) => {
    const from = edgeLookup.get(edge.from);
    const to = edgeLookup.get(edge.to);
    if (!from || !to) return [];
    return [{ ...edge, ax: from.x, ay: from.y, bx: to.x, by: to.y }];
  });
  return {
    nodes: normalized,
    edges: edgeNodes,
    width: Math.max(640, Math.ceil(bounds.maxX - bounds.minX + 120)),
    height: Math.max(420, Math.ceil(bounds.maxY - bounds.minY + 120)),
  };
}

function radialLayout(nodes: ImportGraphNode[], edges: ImportGraphEdge[]): { nodes: LayoutNode[]; edges: LayoutEdge[]; width: number; height: number } {
  const grouped = new Map<number, ImportGraphNode[]>();
  for (const node of nodes) {
    const depth = layerDepth(node);
    const list = grouped.get(depth) || [];
    list.push(node);
    grouped.set(depth, list);
  }

  const laidOut: LayoutNode[] = [];
  const levels = Array.from(grouped.keys()).sort((a, b) => a - b);
  const ringGap = 148;
  for (const depth of levels) {
    const row = grouped.get(depth) || [];
    const ring = row.map((node) => ({ node, ...scaleSize(node) })).sort((a, b) => a.node.label.localeCompare(b.node.label));
    if (depth === 0) {
      const root = ring[0];
      if (root) laidOut.push({ ...root.node, w: root.w, h: root.h, x: 0, y: 0 });
      continue;
    }
    const radius = depth * ringGap;
    const step = (Math.PI * 2) / Math.max(1, ring.length);
    const offset = -Math.PI / 2;
    ring.forEach((item, index) => {
      const angle = offset + step * index;
      laidOut.push({
        ...item.node,
        w: item.w,
        h: item.h,
        x: Math.cos(angle) * radius,
        y: Math.sin(angle) * radius,
      });
    });
  }

  const normalized = normalizeLayout(laidOut, 80, 80);
  const bounds = centerBounds(normalized);
  const lookup = new Map<string, LayoutNode>();
  for (const node of normalized) lookup.set(node.id, node);
  const edgeNodes = edges.flatMap((edge) => {
    const from = lookup.get(edge.from);
    const to = lookup.get(edge.to);
    if (!from || !to) return [];
    return [{ ...edge, ax: from.x, ay: from.y, bx: to.x, by: to.y }];
  });
  return {
    nodes: normalized,
    edges: edgeNodes,
    width: Math.max(640, Math.ceil(bounds.maxX - bounds.minX + 160)),
    height: Math.max(420, Math.ceil(bounds.maxY - bounds.minY + 160)),
  };
}

function forceLayout(nodes: ImportGraphNode[], edges: ImportGraphEdge[]): { nodes: LayoutNode[]; edges: LayoutEdge[]; width: number; height: number } {
  const sized = nodes.map((node, index) => ({
    ...node,
    ...scaleSize(node),
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    seed: index,
  }));
  const root = sized.find((node) => node.depth === 0);
  const ring = sized.filter((node) => node.depth > 0);
  const radius = 140;
  ring.forEach((node, index) => {
    const angle = (Math.PI * 2 * index) / Math.max(1, ring.length);
    node.x = Math.cos(angle) * radius;
    node.y = Math.sin(angle) * radius;
  });
  if (root) {
    root.x = 0;
    root.y = 0;
  }

  const edgePairs = edges
    .map((edge) => ({ edge, from: sized.find((node) => node.id === edge.from), to: sized.find((node) => node.id === edge.to) }))
    .filter((item) => item.from && item.to) as Array<{ edge: ImportGraphEdge; from: any; to: any }>;

  for (let iter = 0; iter < 36; iter += 1) {
    for (let i = 0; i < sized.length; i += 1) {
      for (let j = i + 1; j < sized.length; j += 1) {
        const a = sized[i];
        const b = sized[j];
        let dx = b.x - a.x;
        let dy = b.y - a.y;
        let dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const minDist = (a.w + b.w) * 0.45;
        const repulse = Math.max(0, minDist - dist) * 0.02;
        dx /= dist;
        dy /= dist;
        a.vx -= dx * repulse;
        a.vy -= dy * repulse;
        b.vx += dx * repulse;
        b.vy += dy * repulse;
      }
    }

    for (const pair of edgePairs) {
      const a = pair.from;
      const b = pair.to;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const target = 180;
      const pull = (dist - target) * 0.008;
      const nx = dx / dist;
      const ny = dy / dist;
      a.vx += nx * pull;
      a.vy += ny * pull;
      b.vx -= nx * pull;
      b.vy -= ny * pull;
    }

    for (const node of sized) {
      if (node.depth === 0) continue;
      node.vx *= 0.86;
      node.vy *= 0.86;
      node.x += node.vx;
      node.y += node.vy;
    }
  }

  const normalized = normalizeLayout(sized, 120, 100);
  const bounds = centerBounds(normalized);
  const lookup = new Map<string, LayoutNode>();
  for (const node of normalized) lookup.set(node.id, node);
  const edgeNodes = edges.flatMap((edge) => {
    const from = lookup.get(edge.from);
    const to = lookup.get(edge.to);
    if (!from || !to) return [];
    return [{ ...edge, ax: from.x, ay: from.y, bx: to.x, by: to.y }];
  });
  return {
    nodes: normalized,
    edges: edgeNodes,
    width: Math.max(640, Math.ceil(bounds.maxX - bounds.minX + 180)),
    height: Math.max(420, Math.ceil(bounds.maxY - bounds.minY + 180)),
  };
}

function filterGraph(graph: ImportGraph, filterExt: string): { nodes: ImportGraphNode[]; edges: ImportGraphEdge[] } {
  const wanted = String(filterExt || 'all').toLowerCase().replace(/^\./, '') || 'all';
  if (wanted === 'all') return { nodes: graph.nodes, edges: graph.edges };
  const visible = new Set<string>();
  for (const node of graph.nodes) {
    if (node.depth === 0 || (node.local && String(node.ext || '').toLowerCase() === wanted)) {
      visible.add(node.id);
    }
  }
  const nodes = graph.nodes.filter((node) => visible.has(node.id));
  const edges = graph.edges.filter((edge) => visible.has(edge.from) && visible.has(edge.to));
  return { nodes, edges };
}

function chooseLayout(nodes: ImportGraphNode[], edges: ImportGraphEdge[], mode: GraphLayoutMode) {
  if (mode === 'radial') return radialLayout(nodes, edges);
  if (mode === 'tree') return treeLayout(nodes, edges);
  return forceLayout(nodes, edges);
}

function renderNodeBody(node: LayoutNode, zoom: number, onOpenPath: (path: string) => void) {
  const isRoot = node.depth === 0;
  const tone = isRoot ? COLORS.blue : node.local ? fileTone(inferFileType(node.path)) : COLORS.textMuted;
  const border = isRoot ? tone : node.local ? tone : COLORS.border;
  const background = isRoot ? COLORS.blueDeep : node.local ? COLORS.panelRaised : COLORS.panelAlt;
  const clickable = node.local && node.path && node.path !== '__graph__';

  const content = (
    <Box style={{
      width: '100%',
      height: '100%',
      borderRadius: isRoot ? TOKENS.radiusLg : TOKENS.radiusMd,
      backgroundColor: background,
      borderWidth: 1,
      borderColor: border,
      paddingLeft: 10,
      paddingRight: 10,
      paddingTop: 8,
      paddingBottom: 8,
      gap: 5,
      opacity: node.local ? 1 : 0.82,
    }}>
      <Row style={{ alignItems: 'center', gap: 6, minWidth: 0 }}>
        <Icon name={isRoot ? 'folder' : node.local ? 'file' : 'question-mark'} size={12} color={tone} />
        <Text fontSize={10} color={COLORS.textBright} style={{ fontWeight: 'bold', flexGrow: 1, flexBasis: 0 }} numberOfLines={1}>
          {node.label}
        </Text>
      </Row>
      <Row style={{ gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
        <Text fontSize={8} color={tone} style={{ fontWeight: 'bold' }}>
          {node.local ? node.ext || 'source' : 'external'}
        </Text>
        {node.depth > 0 ? <Text fontSize={8} color={COLORS.textDim}>depth {node.depth}</Text> : null}
        <Text fontSize={8} color={COLORS.textDim}>{node.imported} deps</Text>
      </Row>
      {!isRoot ? (
        <Text fontSize={8} color={COLORS.textDim} numberOfLines={1}>
          {node.path}
        </Text>
      ) : null}
    </Box>
  );

  return clickable ? (
    <Pressable onPress={() => onOpenPath(node.path)} style={{ width: '100%', height: '100%' }}>
      {content}
    </Pressable>
  ) : content;
}

export function GraphCanvas(props: {
  graph: ImportGraph;
  layout: GraphLayoutMode;
  zoom: number;
  filterExt: string;
  onOpenPath: (path: string) => void;
}) {
  const zoom = Math.max(0.4, Math.min(2.5, props.zoom || 1));
  const layout = useMemo(() => {
    const filtered = filterGraph(props.graph, props.filterExt);
    return chooseLayout(filtered.nodes, filtered.edges, props.layout);
  }, [props.filterExt, props.graph, props.layout]);

  const contentWidth = Math.max(640, Math.ceil(layout.width * zoom));
  const contentHeight = Math.max(420, Math.ceil(layout.height * zoom));

  return (
    <ScrollView showScrollbar={true} style={{ flexGrow: 1, flexBasis: 0, minHeight: 0, backgroundColor: COLORS.panelBg }}>
      <Canvas style={{ width: contentWidth, height: contentHeight, backgroundColor: COLORS.panelBg }}>
        <Graph style={{ position: 'absolute', left: 0, top: 0, width: '100%', height: '100%' }}>
          {layout.edges.map((edge) => (
            <Graph.Path
              key={`${edge.from}-${edge.to}`}
              d={`M ${edge.ax * zoom + 4} ${edge.ay * zoom + 4} L ${edge.bx * zoom + 4} ${edge.by * zoom + 4}`}
              stroke={edge.style === 'solid' ? COLORS.border : COLORS.textDim}
              strokeWidth={edge.style === 'solid' ? 1.6 : 1.2}
              strokeDasharray={edge.style === 'solid' ? undefined : '4 4'}
              fill="none"
            />
          ))}
        </Graph>

        {layout.nodes.map((node) => {
          const w = Math.max(140, Math.round(node.w * zoom));
          const h = Math.max(56, Math.round(node.h * zoom));
          return (
            <Canvas.Node key={node.id} gx={node.x * zoom} gy={node.y * zoom} gw={w} gh={h}>
              {renderNodeBody({ ...node, w, h } as LayoutNode, zoom, props.onOpenPath)}
            </Canvas.Node>
          );
        })}
      </Canvas>
    </ScrollView>
  );
}
