const React: any = require('react');

export type GraphLayoutMode = 'force' | 'tree-down' | 'tree-left' | 'radial' | 'circular' | 'grid';
export type EdgeDensity = 'sparse' | 'medium' | 'dense' | 'complete';
export type ColorMode = 'degree' | 'cluster' | 'depth' | 'random';
export type NodeCount = 10 | 50 | 100 | 500 | 1000 | 5000;

export interface DemoEdge {
  from: string;
  to: string;
  kind: 'tree' | 'cross';
}

export interface DemoNode {
  id: string;
  label: string;
  parentId: string | null;
  children: string[];
  depth: number;
  cluster: number;
  degree: number;
  randomKey: number;
  weight: number;
}

export interface DemoGraph {
  rootId: string;
  nodes: DemoNode[];
  edges: DemoEdge[];
  byId: Map<string, DemoNode>;
  children: Map<string, string[]>;
  parent: Map<string, string | null>;
}

export interface Position {
  x: number;
  y: number;
}

export interface LayoutResult {
  positions: Map<string, Position>;
  bounds: { minX: number; minY: number; maxX: number; maxY: number };
  width: number;
  height: number;
}

type RNG = {
  next(): number;
  float(): number;
  int(max: number): number;
  pick<T>(list: T[]): T;
};

function mulberry32(seed: number): RNG {
  let a = seed >>> 0;
  return {
    next() {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
    float() {
      return this.next();
    },
    int(max: number) {
      return max <= 0 ? 0 : Math.floor(this.next() * max);
    },
    pick<T>(list: T[]) {
      return list[this.int(list.length)];
    },
  };
}

const SYLLABLES = [
  'al', 'ar', 'be', 'bor', 'ca', 'cer', 'da', 'den', 'el', 'en',
  'fa', 'fer', 'ga', 'hel', 'io', 'jor', 'ka', 'lor', 'mi', 'nor',
  'or', 'pan', 'qua', 'ril', 'sa', 'tor', 'ul', 'ven', 'wa', 'yor',
  'zen',
];

const CLUSTERS = [
  '#6ed0ff', '#7ee787', '#ffb86b', '#d2a8ff', '#ff7b72', '#79c0ff', '#f2e05a', '#ff6bcb',
];

function labelFor(index: number, cluster: number, depth: number, rng: RNG): string {
  const a = SYLLABLES[(index + cluster * 3 + depth) % SYLLABLES.length];
  const b = SYLLABLES[(index * 7 + cluster + depth * 5) % SYLLABLES.length];
  const c = SYLLABLES[rng.int(SYLLABLES.length)];
  return (a + b + c).replace(/^./, (ch) => ch.toUpperCase());
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function densityBudget(density: EdgeDensity): number {
  if (density === 'sparse') return 1;
  if (density === 'medium') return 2;
  if (density === 'dense') return 4;
  return 8;
}

function densityCrossFactor(density: EdgeDensity): number {
  if (density === 'sparse') return 0.05;
  if (density === 'medium') return 0.12;
  if (density === 'dense') return 0.22;
  return 0.36;
}

export function buildDemoGraph(count: NodeCount, density: EdgeDensity): DemoGraph {
  const rng = mulberry32(0x9a7b3 + count * 13 + density.length * 97);
  const total = Math.max(1, count);
  const nodes: DemoNode[] = [];
  const edges: DemoEdge[] = [];
  const byId = new Map<string, DemoNode>();
  const children = new Map<string, string[]>();
  const parent = new Map<string, string | null>();
  const clusterCount = clamp(Math.round(Math.sqrt(total) / 2), 3, 14);
  const clusterRoots: string[] = [];
  const root: DemoNode = {
    id: 'n0',
    label: 'Atlas',
    parentId: null,
    children: [],
    depth: 0,
    cluster: 0,
    degree: 0,
    randomKey: 0,
    weight: 3,
  };
  nodes.push(root);
  byId.set(root.id, root);
  children.set(root.id, []);
  parent.set(root.id, null);
  clusterRoots.push(root.id);

  const branchFactor = clamp(Math.round(Math.sqrt(total) / 3) + 2, 2, 6);
  for (let i = 1; i < total; i += 1) {
    const parentIndex = Math.floor((i - 1) / branchFactor);
    const parentNode = nodes[parentIndex] || root;
    const cluster = parentNode.depth < 2 ? parentNode.cluster : (rng.float() > 0.7 ? rng.int(clusterCount) : parentNode.cluster);
    const node: DemoNode = {
      id: 'n' + i,
      label: labelFor(i, cluster, parentNode.depth + 1, rng),
      parentId: parentNode.id,
      children: [],
      depth: parentNode.depth + 1,
      cluster,
      degree: 0,
      randomKey: rng.int(10_000),
      weight: 1 + (i % 5 === 0 ? 1 : 0),
    };
    nodes.push(node);
    byId.set(node.id, node);
    parent.set(node.id, parentNode.id);
    if (!children.has(parentNode.id)) children.set(parentNode.id, []);
    children.get(parentNode.id)!.push(node.id);
    children.set(node.id, []);
    edges.push({ from: parentNode.id, to: node.id, kind: 'tree' });
    if (clusterRoots.length < clusterCount && node.depth <= 2 && rng.float() > 0.55) {
      clusterRoots.push(node.id);
    }
  }

  const treeParents = nodes.map((node) => node.parentId).filter(Boolean) as string[];
  const crossPerNode = densityBudget(density);
  const crossChance = densityCrossFactor(density);
  const maxCrossEdges = density === 'complete' ? Math.min(total * 8, 14000) : Math.min(total * (crossPerNode + 1), 7000);
  const existing = new Set<string>();
  for (const edge of edges) existing.add(edge.from + '>' + edge.to);

  let crossCount = 0;
  for (let i = 1; i < nodes.length && crossCount < maxCrossEdges; i += 1) {
    const node = nodes[i];
    const candidateSpan = density === 'complete' ? Math.min(i, 24) : Math.min(i, 8 + crossPerNode * 3);
    for (let j = 0; j < crossPerNode && crossCount < maxCrossEdges; j += 1) {
      if (rng.float() > crossChance && density !== 'complete') continue;
      const back = 1 + rng.int(Math.max(1, candidateSpan));
      const target = nodes[Math.max(0, i - back)];
      if (!target || target.id === node.id || target.id === node.parentId) continue;
      const key = node.id + '>' + target.id;
      if (existing.has(key)) continue;
      existing.add(key);
      edges.push({ from: node.id, to: target.id, kind: 'cross' });
      crossCount += 1;
    }
  }

  for (const node of nodes) {
    node.children = children.get(node.id) || [];
    node.degree = node.children.length + (parent.get(node.id) ? 1 : 0);
  }
  for (const edge of edges) {
    const from = byId.get(edge.from);
    const to = byId.get(edge.to);
    if (from) from.degree += 1;
    if (to) to.degree += 1;
  }

  return { rootId: root.id, nodes, edges, byId, children, parent };
}

function subtreeSizes(graph: DemoGraph): Map<string, number> {
  const sizes = new Map<string, number>();
  const visit = (id: string): number => {
    const cached = sizes.get(id);
    if (cached != null) return cached;
    const kids = graph.children.get(id) || [];
    let total = 1;
    for (const child of kids) total += visit(child);
    sizes.set(id, total);
    return total;
  };
  visit(graph.rootId);
  return sizes;
}

function gatherDepthOrder(graph: DemoGraph): DemoNode[][] {
  const layers: DemoNode[][] = [];
  for (const node of graph.nodes) {
    const layer = layers[node.depth] || [];
    layer.push(node);
    layers[node.depth] = layer;
  }
  return layers.map((layer) => layer.slice().sort((a, b) => a.label.localeCompare(b.label)));
}

function centerPositions(positions: Map<string, Position>): { positions: Map<string, Position>; bounds: { minX: number; minY: number; maxX: number; maxY: number } } {
  let minX = 0;
  let minY = 0;
  let maxX = 0;
  let maxY = 0;
  for (const pos of positions.values()) {
    minX = Math.min(minX, pos.x);
    minY = Math.min(minY, pos.y);
    maxX = Math.max(maxX, pos.x);
    maxY = Math.max(maxY, pos.y);
  }
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const out = new Map<string, Position>();
  for (const [id, pos] of positions) out.set(id, { x: pos.x - cx, y: pos.y - cy });
  return {
    positions: out,
    bounds: {
      minX: minX - cx,
      minY: minY - cy,
      maxX: maxX - cx,
      maxY: maxY - cy,
    },
  };
}

function layoutTreeDown(graph: DemoGraph): Map<string, Position> {
  const sizes = subtreeSizes(graph);
  const positions = new Map<string, Position>();
  const leafGap = 128;
  const depthGap = 110;
  let cursor = 0;
  const place = (id: string): number => {
    const kids = graph.children.get(id) || [];
    if (kids.length === 0) {
      const x = cursor * leafGap;
      cursor += 1;
      const node = graph.byId.get(id)!;
      positions.set(id, { x, y: node.depth * depthGap });
      return x;
    }
    const xs: number[] = [];
    for (const child of kids) xs.push(place(child));
    const x = xs.reduce((sum, v) => sum + v, 0) / xs.length;
    const node = graph.byId.get(id)!;
    positions.set(id, { x, y: node.depth * depthGap });
    return x;
  };
  place(graph.rootId);
  return positions;
}

function layoutTreeLeft(graph: DemoGraph): Map<string, Position> {
  const down = layoutTreeDown(graph);
  const left = new Map<string, Position>();
  for (const [id, pos] of down) left.set(id, { x: pos.y, y: pos.x });
  return left;
}

function layoutRadial(graph: DemoGraph): Map<string, Position> {
  const layers = gatherDepthOrder(graph);
  const positions = new Map<string, Position>();
  const ringGap = 120;
  layers.forEach((layer, depth) => {
    if (depth === 0) {
      const root = layer[0];
      if (root) positions.set(root.id, { x: 0, y: 0 });
      return;
    }
    const radius = depth * ringGap;
    const count = Math.max(1, layer.length);
    layer.forEach((node, index) => {
      const angle = (index / count) * Math.PI * 2 - Math.PI / 2;
      positions.set(node.id, { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius });
    });
  });
  return positions;
}

function layoutCircular(graph: DemoGraph): Map<string, Position> {
  const positions = new Map<string, Position>();
  const nodes = graph.nodes.slice().sort((a, b) => (a.depth - b.depth) || a.label.localeCompare(b.label));
  const outer = Math.max(360, nodes.length * 18);
  positions.set(graph.rootId, { x: 0, y: 0 });
  const ring = nodes.filter((node) => node.id !== graph.rootId);
  const count = Math.max(1, ring.length);
  ring.forEach((node, index) => {
    const angle = (index / count) * Math.PI * 2 - Math.PI / 2;
    const radius = outer * (0.22 + (node.depth / Math.max(1, node.depth + 3)) * 0.58);
    positions.set(node.id, { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius });
  });
  return positions;
}

function layoutGrid(graph: DemoGraph): Map<string, Position> {
  const positions = new Map<string, Position>();
  const nodes = graph.nodes.slice().sort((a, b) => a.depth - b.depth || a.label.localeCompare(b.label));
  const cols = Math.max(1, Math.ceil(Math.sqrt(nodes.length)));
  const gapX = 168;
  const gapY = 96;
  nodes.forEach((node, index) => {
    const col = index % cols;
    const row = Math.floor(index / cols);
    positions.set(node.id, {
      x: (col - cols / 2) * gapX,
      y: (row - Math.ceil(nodes.length / cols) / 2) * gapY,
    });
  });
  return positions;
}

function layoutForce(graph: DemoGraph): Map<string, Position> {
  const positions = layoutTreeDown(graph);
  const nodes = graph.nodes;
  const buckets = new Map<string, string[]>();
  const bucketSize = 160;
  const keyFor = (x: number, y: number) => `${Math.floor(x / bucketSize)}:${Math.floor(y / bucketSize)}`;
  const rebuild = () => {
    buckets.clear();
    for (const node of nodes) {
      const pos = positions.get(node.id);
      if (!pos) continue;
      const key = keyFor(pos.x, pos.y);
      const list = buckets.get(key) || [];
      list.push(node.id);
      buckets.set(key, list);
    }
  };

  const nudges = graph.edges.filter((edge) => edge.kind === 'tree').slice(0, Math.max(1, graph.nodes.length * 2));
  rebuild();
  for (let iter = 0; iter < 36; iter += 1) {
    const next = new Map<string, Position>();
    for (const node of nodes) {
      const pos = positions.get(node.id) || { x: 0, y: 0 };
      let fx = 0;
      let fy = 0;
      const parentId = graph.parent.get(node.id);
      if (parentId) {
        const parent = positions.get(parentId);
        if (parent) {
          fx += (parent.x - pos.x) * 0.015;
          fy += (parent.y - pos.y) * 0.015;
        }
      }
      const neighborKeys = [keyFor(pos.x, pos.y), keyFor(pos.x + bucketSize, pos.y), keyFor(pos.x - bucketSize, pos.y), keyFor(pos.x, pos.y + bucketSize), keyFor(pos.x, pos.y - bucketSize)];
      for (const key of neighborKeys) {
        const ids = buckets.get(key);
        if (!ids) continue;
        for (const otherId of ids) {
          if (otherId === node.id) continue;
          const other = positions.get(otherId);
          if (!other) continue;
          const dx = pos.x - other.x;
          const dy = pos.y - other.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const target = 100 + node.depth * 2;
          const push = Math.max(0, target - dist) * 0.02;
          fx += (dx / dist) * push;
          fy += (dy / dist) * push;
        }
      }
      fx += -pos.x * 0.002;
      fy += -pos.y * 0.002;
      if (node.depth === 0) {
        fx += -pos.x * 0.025;
        fy += -pos.y * 0.025;
      }
      next.set(node.id, {
        x: pos.x + fx,
        y: pos.y + fy,
      });
    }
    for (const edge of nudges) {
      const from = positions.get(edge.from);
      const to = positions.get(edge.to);
      if (!from || !to) continue;
      const dx = to.x - from.x;
      const dy = to.y - from.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const target = edge.kind === 'tree' ? 148 : 200;
      const force = (dist - target) * 0.008;
      const nx = dx / dist;
      const ny = dy / dist;
      const a = next.get(edge.from) || from;
      const b = next.get(edge.to) || to;
      a.x += nx * force;
      a.y += ny * force;
      b.x -= nx * force;
      b.y -= ny * force;
      next.set(edge.from, a);
      next.set(edge.to, b);
    }
    positions.clear();
    for (const [id, pos] of next) positions.set(id, pos);
    rebuild();
  }
  return positions;
}

export function layoutGraph(graph: DemoGraph, mode: GraphLayoutMode): LayoutResult {
  let positions = new Map<string, Position>();
  if (mode === 'tree-down') positions = layoutTreeDown(graph);
  else if (mode === 'tree-left') positions = layoutTreeLeft(graph);
  else if (mode === 'radial') positions = layoutRadial(graph);
  else if (mode === 'circular') positions = layoutCircular(graph);
  else if (mode === 'grid') positions = layoutGrid(graph);
  else positions = layoutForce(graph);
  const centered = centerPositions(positions);
  const width = Math.max(800, Math.ceil(centered.bounds.maxX - centered.bounds.minX + 320));
  const height = Math.max(620, Math.ceil(centered.bounds.maxY - centered.bounds.minY + 260));
  return { positions: centered.positions, bounds: centered.bounds, width, height };
}

export function graphPathFor(edge: DemoEdge, positions: Map<string, Position>): string {
  const from = positions.get(edge.from);
  const to = positions.get(edge.to);
  if (!from || !to) return '';
  return `M ${from.x.toFixed(1)} ${from.y.toFixed(1)} L ${to.x.toFixed(1)} ${to.y.toFixed(1)}`;
}

export function collectDescendants(graph: DemoGraph, id: string): string[] {
  const out: string[] = [];
  const stack = [id];
  while (stack.length > 0) {
    const current = stack.pop()!;
    out.push(current);
    const kids = graph.children.get(current) || [];
    for (let i = kids.length - 1; i >= 0; i -= 1) stack.push(kids[i]);
  }
  return out;
}

export function collectAncestors(graph: DemoGraph, id: string): string[] {
  const out: string[] = [];
  let current: string | null = id;
  while (current) {
    out.push(current);
    current = graph.parent.get(current) || null;
  }
  return out;
}

export function collectNeighborhood(graph: DemoGraph, id: string): Set<string> {
  const out = new Set<string>();
  for (const n of collectDescendants(graph, id)) out.add(n);
  for (const n of collectAncestors(graph, id)) out.add(n);
  for (const edge of graph.edges) {
    if (edge.from === id) out.add(edge.to);
    if (edge.to === id) out.add(edge.from);
  }
  return out;
}

export function findNodesByQuery(graph: DemoGraph, query: string): DemoNode[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [];
  return graph.nodes.filter((node) => node.label.toLowerCase().includes(needle));
}

export function colorForNode(node: DemoNode, mode: ColorMode): string {
  const clusterTone = CLUSTERS[node.cluster % CLUSTERS.length];
  if (mode === 'cluster') return clusterTone;
  if (mode === 'depth') {
    const tones = ['#6ed0ff', '#79c0ff', '#7ee787', '#f2e05a', '#ffb86b', '#ff7b72', '#d2a8ff'];
    return tones[node.depth % tones.length];
  }
  if (mode === 'degree') {
    const idx = clamp(Math.floor(node.degree / 3), 0, CLUSTERS.length - 1);
    return CLUSTERS[idx];
  }
  return CLUSTERS[node.randomKey % CLUSTERS.length];
}

export function iconShapeForNode(node: DemoNode): 'root' | 'hub' | 'branch' | 'leaf' {
  if (node.depth === 0) return 'root';
  if (node.degree >= 6) return 'hub';
  if ((node.children || []).length > 0) return 'branch';
  return 'leaf';
}

export function localOffsetFor(node: DemoNode, positions: Map<string, Position>, parentId: string | null): Position {
  const pos = positions.get(node.id) || { x: 0, y: 0 };
  if (!parentId) return pos;
  const parent = positions.get(parentId) || { x: 0, y: 0 };
  return { x: pos.x - parent.x, y: pos.y - parent.y };
}

export function subtreeTranslate(
  graph: DemoGraph,
  positions: Map<string, Position>,
  id: string,
  nextX: number,
  nextY: number,
): Map<string, Position> {
  const next = new Map(positions);
  const current = next.get(id) || { x: 0, y: 0 };
  const dx = nextX - current.x;
  const dy = nextY - current.y;
  const descendants = collectDescendants(graph, id);
  for (const nodeId of descendants) {
    const pos = next.get(nodeId) || { x: 0, y: 0 };
    next.set(nodeId, { x: pos.x + dx, y: pos.y + dy });
  }
  return next;
}

