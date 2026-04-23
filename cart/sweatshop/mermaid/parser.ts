export type MermaidDirection = 'TD' | 'BT' | 'LR' | 'RL';

export type MermaidShape =
  | 'rect'
  | 'round'
  | 'stadium'
  | 'diamond'
  | 'circle'
  | 'subroutine'
  | 'subgraph';

export type MermaidNode = {
  id: string;
  label: string;
  shape: MermaidShape;
};

export type MermaidEdgeStyle = 'solid' | 'thick' | 'dashed';

export type MermaidEdge = {
  from: string;
  to: string;
  label: string;
  style: MermaidEdgeStyle;
};

export type MermaidDiagram = {
  kind: 'flowchart' | 'sequence' | 'class' | 'unknown';
  direction: MermaidDirection;
  nodes: MermaidNode[];
  edges: MermaidEdge[];
};

const DIRECTION_RE = /\b(TD|BT|LR|RL)\b/;

function trimCodeFence(source: string): string {
  const text = (source || '').trim();
  if (!text.startsWith('```')) return text;
  const lines = text.split('\n');
  if (lines.length <= 1) return text;
  const start = lines[0].trim().toLowerCase();
  if (!start.startsWith('```')) return text;
  const body = lines.slice(1);
  while (body.length > 0 && body[body.length - 1].trim() === '```') body.pop();
  return body.join('\n').trim();
}

function normalizeStatement(text: string): string {
  return text.trim().replace(/\s+/g, ' ');
}

function baseId(id: string): string {
  return id.replace(/[^\w:-]/g, '');
}

function unquote(text: string): string {
  const trimmed = text.trim();
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith('\'') && trimmed.endsWith('\''))) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function makeNode(id: string, label?: string, shape: MermaidShape = 'rect'): MermaidNode {
  return {
    id,
    label: label && label.length > 0 ? label : id,
    shape,
  };
}

function parseNodeExpr(expr: string, fallbackId?: string): MermaidNode | null {
  const text = expr.trim();
  if (!text) return fallbackId ? makeNode(fallbackId) : null;

  const match = text.match(/^([A-Za-z0-9_:.~-]+)(.*)$/);
  if (!match) {
    const id = fallbackId || baseId(text) || text;
    return makeNode(id, unquote(text));
  }

  const id = match[1];
  const rest = match[2].trim();
  if (!rest) return makeNode(id);

  const shapeCases: Array<{ test: RegExp; shape: MermaidShape; map: (raw: string) => string }> = [
    { test: /^\[\[(.*)\]\]$/, shape: 'subroutine', map: (raw) => raw },
    { test: /^\(\((.*)\)\)$/, shape: 'circle', map: (raw) => raw },
    { test: /^\(\[(.*)\]\)$/, shape: 'stadium', map: (raw) => raw },
    { test: /^\{(.*)\}$/, shape: 'diamond', map: (raw) => raw },
    { test: /^\[(.*)\]$/, shape: 'rect', map: (raw) => raw },
    { test: /^\((.*)\)$/, shape: 'round', map: (raw) => raw },
  ];

  for (const entry of shapeCases) {
    const shaped = rest.match(entry.test);
    if (shaped) {
      return makeNode(id, unquote(entry.map(shaped[1]).trim()), entry.shape);
    }
  }

  return makeNode(id, unquote(rest));
}

function mergeNode(nodes: Map<string, MermaidNode>, node: MermaidNode): void {
  const existing = nodes.get(node.id);
  if (!existing) {
    nodes.set(node.id, node);
    return;
  }

  const shouldReplaceLabel = existing.label === existing.id || existing.label.length === 0;
  const shouldReplaceShape = existing.shape === 'rect' && node.shape !== 'rect';
  nodes.set(node.id, {
    id: node.id,
    label: shouldReplaceLabel ? node.label : existing.label,
    shape: shouldReplaceShape ? node.shape : existing.shape,
  });
}

function findStatementBreak(source: string, start: number): number {
  for (let i = start; i < source.length; i += 1) {
    const ch = source.charAt(i);
    if (ch === '\n' || ch === ';') return i;
  }
  return source.length;
}

function parseEdgeToken(source: string, start: number): { style: MermaidEdgeStyle; label: string; end: number } | null {
  const token = source.slice(start, start + 2);
  if (token === '--') {
    const end = source.indexOf('-->', start + 2);
    if (end < 0) return null;
    return { style: 'solid', label: source.slice(start + 2, end).trim(), end: end + 3 };
  }
  if (token === '==') {
    const end = source.indexOf('==>', start + 2);
    if (end < 0) return null;
    return { style: 'thick', label: source.slice(start + 2, end).trim(), end: end + 3 };
  }
  if (token === '-.') {
    const end = source.indexOf('.->', start + 2);
    if (end < 0) return null;
    return { style: 'dashed', label: source.slice(start + 2, end).trim(), end: end + 3 };
  }
  return null;
}

function parseChainStatement(statement: string, nodes: Map<string, MermaidNode>, edges: MermaidEdge[]): void {
  const text = normalizeStatement(statement);
  if (!text) return;

  let cursor = 0;
  let leftExpr = '';
  let leftNode: MermaidNode | null = null;

  while (cursor < text.length) {
    const nextEdgeIdx = (() => {
      const remaining = text.slice(cursor);
      const candidates = [' --', ' ==', ' -.'];
      let best = -1;
      for (const candidate of candidates) {
        const idx = remaining.indexOf(candidate);
        if (idx >= 0 && (best < 0 || idx < best)) best = idx;
      }
      return best >= 0 ? cursor + best : -1;
    })();

    if (nextEdgeIdx < 0) {
      const tail = text.slice(cursor).trim();
      if (!leftNode) {
        const node = parseNodeExpr(tail);
        if (node) mergeNode(nodes, node);
      } else if (tail) {
        const node = parseNodeExpr(tail);
        if (node) {
          mergeNode(nodes, node);
          leftNode = node;
        }
      }
      break;
    }

    const segment = text.slice(cursor, nextEdgeIdx).trim();
    if (!leftNode) {
      leftExpr = segment;
      leftNode = parseNodeExpr(leftExpr);
      if (leftNode) mergeNode(nodes, leftNode);
    }

    cursor = nextEdgeIdx;
    while (cursor < text.length && text.charAt(cursor) === ' ') cursor += 1;
    const edge = parseEdgeToken(text, cursor);
    if (!edge) {
      const node = parseNodeExpr(text.slice(cursor));
      if (node) mergeNode(nodes, node);
      break;
    }

    cursor = edge.end;
    const nextBreak = (() => {
      const remaining = text.slice(cursor);
      const candidates = [' --', ' ==', ' -.'];
      let best = -1;
      for (const candidate of candidates) {
        const idx = remaining.indexOf(candidate);
        if (idx >= 0 && (best < 0 || idx < best)) best = idx;
      }
      return best >= 0 ? cursor + best : -1;
    })();

    const rightExpr = nextBreak < 0 ? text.slice(cursor).trim() : text.slice(cursor, nextBreak).trim();
    const rightNode = parseNodeExpr(rightExpr);
    if (leftNode && rightNode) {
      mergeNode(nodes, rightNode);
      edges.push({
        from: leftNode.id,
        to: rightNode.id,
        label: edge.label,
        style: edge.style,
      });
    }

    leftNode = rightNode;
    if (leftNode) mergeNode(nodes, leftNode);
    cursor = nextBreak < 0 ? text.length : nextBreak;
  }
}

function parseFlowchart(source: string): MermaidDiagram {
  const nodes = new Map<string, MermaidNode>();
  const edges: MermaidEdge[] = [];
  let direction: MermaidDirection = 'TD';

  const statements = trimCodeFence(source)
    .replace(/\r/g, '\n')
    .split(/\n|;/g)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith('%%'));

  for (const statement of statements) {
    const line = normalizeStatement(statement);
    if (!line) continue;

    const header = line.match(/^(flowchart|graph)\s+(TD|BT|LR|RL)\b/i);
    if (header) {
      direction = header[2].toUpperCase() as MermaidDirection;
      continue;
    }

    if (/^subgraph\b/i.test(line) || /^end\b/i.test(line)) {
      continue;
    }

    if (line.includes('--') || line.includes('==') || line.includes('-.')) {
      parseChainStatement(line, nodes, edges);
      continue;
    }

    const node = parseNodeExpr(line);
    if (node) mergeNode(nodes, node);
  }

  return {
    kind: 'flowchart',
    direction,
    nodes: Array.from(nodes.values()),
    edges,
  };
}

function parseStub(kind: 'sequence' | 'class' | 'unknown', source: string): MermaidDiagram {
  void source;
  return {
    kind,
    direction: 'TD',
    nodes: [],
    edges: [],
  };
}

export function parseMermaid(source: string): MermaidDiagram {
  const text = trimCodeFence(source);
  const firstLine = text.split(/\r?\n/).map((line) => line.trim()).find((line) => line.length > 0) || '';

  if (/^(flowchart|graph)\b/i.test(firstLine)) return parseFlowchart(text);
  if (/^sequenceDiagram\b/i.test(firstLine)) return parseStub('sequence', text);
  if (/^classDiagram\b/i.test(firstLine)) return parseStub('class', text);
  return {
    kind: 'unknown',
    direction: 'TD',
    nodes: [],
    edges: [],
  };
}
