import type {
  MermaidDiagram,
  MermaidDirection,
  MermaidEdge,
  MermaidNode,
  MermaidShape,
} from './parser';

export type MermaidLayoutNode = MermaidNode & {
  x: number;
  y: number;
  width: number;
  height: number;
  layer: number;
};

export type MermaidLayoutEdge = MermaidEdge & {
  points: Array<{ x: number; y: number }>;
  labelX: number;
  labelY: number;
};

export type MermaidLayoutDiagram = MermaidDiagram & {
  nodes: MermaidLayoutNode[];
  edges: MermaidLayoutEdge[];
  width: number;
  height: number;
  padding: number;
};

const NODE_GAP = 36;
const LAYER_GAP = 92;
const PADDING = 72;

function measureNode(node: MermaidNode): { width: number; height: number } {
  const lines = (node.label || '').split('\n');
  const longest = lines.reduce((max, line) => Math.max(max, line.length), 0);
  const width = Math.max(92, Math.min(280, 28 + longest * 7.4));
  const height = Math.max(48, Math.min(120, 28 + lines.length * 18));

  switch (node.shape as MermaidShape) {
    case 'circle':
      return { width: Math.max(width, height), height: Math.max(width, height) };
    case 'diamond':
      return { width: Math.max(width, 112), height: Math.max(height, 72) };
    case 'subroutine':
      return { width: Math.max(width, 120), height: Math.max(height, 56) };
    case 'stadium':
    case 'round':
      return { width: Math.max(width, 100), height: Math.max(height, 52) };
    default:
      return { width, height };
  }
}

function buildAdjacency(diagram: MermaidDiagram) {
  const order = new Map<string, number>();
  diagram.nodes.forEach((node, idx) => order.set(node.id, idx));

  const outgoing = new Map<string, MermaidEdge[]>();
  const incoming = new Map<string, MermaidEdge[]>();
  for (const node of diagram.nodes) {
    outgoing.set(node.id, []);
    incoming.set(node.id, []);
  }
  for (const edge of diagram.edges) {
    if (!outgoing.has(edge.from) || !incoming.has(edge.to)) continue;
    outgoing.get(edge.from)!.push(edge);
    incoming.get(edge.to)!.push(edge);
  }
  return { order, outgoing, incoming };
}

function assignLayers(diagram: MermaidDiagram): Map<string, number> {
  const { order, outgoing, incoming } = buildAdjacency(diagram);
  const indegree = new Map<string, number>();
  for (const node of diagram.nodes) {
    indegree.set(node.id, (incoming.get(node.id) || []).length);
  }

  const layers = new Map<string, number>();
  const queue = diagram.nodes
    .filter((node) => (indegree.get(node.id) || 0) === 0)
    .sort((a, b) => (order.get(a.id) || 0) - (order.get(b.id) || 0));

  while (queue.length > 0) {
    const node = queue.shift()!;
    const layer = layers.get(node.id) || 0;
    for (const edge of outgoing.get(node.id) || []) {
      const next = layers.get(edge.to);
      const proposed = layer + 1;
      if (next == null || proposed > next) layers.set(edge.to, proposed);

      const nextIndegree = (indegree.get(edge.to) || 0) - 1;
      indegree.set(edge.to, nextIndegree);
      if (nextIndegree === 0) {
        queue.push(diagram.nodes.find((candidate) => candidate.id === edge.to)!);
        queue.sort((a, b) => (order.get(a.id) || 0) - (order.get(b.id) || 0));
      }
    }
  }

  for (const node of diagram.nodes) {
    if (!layers.has(node.id)) layers.set(node.id, 0);
  }

  return layers;
}

function invertLayers(layers: Map<string, number>): Map<string, number> {
  let maxLayer = 0;
  for (const layer of layers.values()) maxLayer = Math.max(maxLayer, layer);
  const inverted = new Map<string, number>();
  for (const [id, layer] of layers.entries()) {
    inverted.set(id, maxLayer - layer);
  }
  return inverted;
}

function anchorFor(direction: MermaidDirection, node: MermaidLayoutNode, side: 'from' | 'to') {
  const cx = node.x + node.width / 2;
  const cy = node.y + node.height / 2;
  if (direction === 'TD') {
    return side === 'from'
      ? { x: cx, y: node.y + node.height }
      : { x: cx, y: node.y };
  }
  if (direction === 'BT') {
    return side === 'from'
      ? { x: cx, y: node.y }
      : { x: cx, y: node.y + node.height };
  }
  if (direction === 'LR') {
    return side === 'from'
      ? { x: node.x + node.width, y: cy }
      : { x: node.x, y: cy };
  }
  return side === 'from'
    ? { x: node.x, y: cy }
    : { x: node.x + node.width, y: cy };
}

function routeEdge(direction: MermaidDirection, from: MermaidLayoutNode, to: MermaidLayoutNode): Array<{ x: number; y: number }> {
  const start = anchorFor(direction, from, 'from');
  const end = anchorFor(direction, to, 'to');
  const points: Array<{ x: number; y: number }> = [start];

  if (direction === 'TD' || direction === 'BT') {
    const midY = (start.y + end.y) / 2;
    points.push({ x: start.x, y: midY });
    points.push({ x: end.x, y: midY });
  } else {
    const midX = (start.x + end.x) / 2;
    points.push({ x: midX, y: start.y });
    points.push({ x: midX, y: end.y });
  }

  points.push(end);
  return points;
}

function layoutLayered(
  diagram: MermaidDiagram,
  layers: Map<string, number>,
  direction: MermaidDirection,
): MermaidLayoutDiagram {
  const order = new Map<string, number>();
  diagram.nodes.forEach((node, idx) => order.set(node.id, idx));

  const layoutNodes: MermaidLayoutNode[] = diagram.nodes.map((node) => {
    const size = measureNode(node);
    return {
      ...node,
      x: 0,
      y: 0,
      width: size.width,
      height: size.height,
      layer: layers.get(node.id) || 0,
    };
  });

  const byId = new Map<string, MermaidLayoutNode>();
  for (const node of layoutNodes) byId.set(node.id, node);

  const groups = new Map<number, MermaidLayoutNode[]>();
  for (const node of layoutNodes) {
    const group = groups.get(node.layer) || [];
    group.push(node);
    groups.set(node.layer, group);
  }

  const sortedLayers = Array.from(groups.keys()).sort((a, b) => a - b);
  const majorSizes = sortedLayers.map((layer) => {
    const group = groups.get(layer) || [];
    const major = group.reduce((sum, node) => sum + (direction === 'TD' || direction === 'BT' ? node.width : node.height), 0);
    const gaps = Math.max(0, group.length - 1) * NODE_GAP;
    return major + gaps;
  });
  const maxMajor = majorSizes.length > 0 ? Math.max(...majorSizes) : 0;
  const layerStep = Math.max(LAYER_GAP, Math.max(...layoutNodes.map((node) => direction === 'TD' || direction === 'BT' ? node.height : node.width), 0) + LAYER_GAP);

  for (const layer of sortedLayers) {
    const group = (groups.get(layer) || []).sort((a, b) => (order.get(a.id) || 0) - (order.get(b.id) || 0));
    const isVertical = direction === 'TD' || direction === 'BT';
    const totalMajor = group.reduce((sum, node) => sum + (isVertical ? node.width : node.height), 0) + Math.max(0, group.length - 1) * NODE_GAP;
    const startMajor = PADDING + Math.max(0, (maxMajor - totalMajor) / 2);

    let cursor = startMajor;
    for (const node of group) {
      if (isVertical) {
        node.x = cursor;
        node.y = PADDING + layer * layerStep;
        cursor += node.width + NODE_GAP;
      } else {
        node.x = PADDING + layer * layerStep;
        node.y = cursor;
        cursor += node.height + NODE_GAP;
      }
    }
  }

  const layoutEdges: MermaidLayoutEdge[] = diagram.edges.map((edge) => {
    const from = byId.get(edge.from);
    const to = byId.get(edge.to);
    if (!from || !to) {
      return {
        ...edge,
        points: [],
        labelX: 0,
        labelY: 0,
      };
    }

    const points = routeEdge(direction, from, to);
    const labelAnchor = points[Math.floor(points.length / 2)] || points[0] || { x: 0, y: 0 };
    return {
      ...edge,
      points,
      labelX: labelAnchor.x,
      labelY: labelAnchor.y,
    };
  });

  const bounds = layoutNodes.reduce(
    (acc, node) => {
      acc.maxX = Math.max(acc.maxX, node.x + node.width);
      acc.maxY = Math.max(acc.maxY, node.y + node.height);
      return acc;
    },
    { maxX: 0, maxY: 0 },
  );

  return {
    kind: diagram.kind,
    direction,
    nodes: layoutNodes,
    edges: layoutEdges,
    width: bounds.maxX + PADDING,
    height: bounds.maxY + PADDING,
    padding: PADDING,
  };
}

export function layoutMermaidDiagram(diagram: MermaidDiagram): MermaidLayoutDiagram {
  if (diagram.nodes.length === 0) {
    return {
      ...diagram,
      nodes: [],
      edges: [],
      width: 0,
      height: 0,
      padding: PADDING,
    };
  }

  const layers = assignLayers(diagram);
  const orientedLayers = diagram.direction === 'BT' || diagram.direction === 'RL' ? invertLayers(layers) : layers;
  return layoutLayered(diagram, orientedLayers, diagram.direction);
}
