const React: any = require('react');
const { useMemo } = React;

import { readFile } from '../../host';
import { baseName, fileGlyph, fileTone, inferFileType, stripDotSlash } from '../../theme';

export type ImportGraphNode = {
  id: string;
  path: string;
  label: string;
  shape: string;
  tone: string;
  glyph: string;
  ext: string;
  depth: number;
  local: boolean;
  imported: number;
};

export type ImportGraphEdge = {
  from: string;
  to: string;
  label: string;
  style: 'solid' | 'dashed';
};

export type ImportGraph = {
  rootId: string;
  rootPath: string;
  nodes: ImportGraphNode[];
  edges: ImportGraphEdge[];
  extOptions: string[];
};

const IMPORT_PATTERNS = [
  /\bimport\s+(?:type\s+)?(?:[\w*\s{},$]+\s+from\s+)?['"]([^'"]+)['"]/g,
  /\bexport\s+(?:type\s+)?(?:[\w*\s{},$]+\s+from\s+)?['"]([^'"]+)['"]/g,
  /\brequire\(\s*['"]([^'"]+)['"]\s*\)/g,
  /\bimport\(\s*['"]([^'"]+)['"]\s*\)/g,
];

function stripComments(source: string): string {
  return String(source || '')
    .replace(/\/\*[\s\S]*?\*\//g, '\n')
    .replace(/^\s*\/\/.*$/gm, '');
}

function splitExt(path: string): string {
  const name = baseName(path);
  const dot = name.lastIndexOf('.');
  return dot >= 0 ? name.slice(dot + 1).toLowerCase() : '';
}

function normalizePath(path: string): string {
  return stripDotSlash(String(path || '').replace(/\\/g, '/'));
}

function dirname(path: string): string {
  const clean = normalizePath(path);
  const idx = clean.lastIndexOf('/');
  return idx >= 0 ? clean.slice(0, idx) : '';
}

function joinPath(dir: string, file: string): string {
  const cleanDir = normalizePath(dir);
  const cleanFile = normalizePath(file);
  if (!cleanDir) return cleanFile;
  if (!cleanFile) return cleanDir;
  return cleanDir + '/' + cleanFile;
}

function unique(list: string[]): string[] {
  const seen: Record<string, number> = {};
  const out: string[] = [];
  for (const item of list) {
    const key = normalizePath(item);
    if (!key || seen[key]) continue;
    seen[key] = 1;
    out.push(key);
  }
  return out;
}

function extractImports(source: string): string[] {
  const out: string[] = [];
  const cleaned = stripComments(source);
  for (const pattern of IMPORT_PATTERNS) {
    pattern.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(cleaned))) {
      if (match[1]) out.push(match[1]);
    }
  }
  return unique(out);
}

function candidatePaths(basePath: string, spec: string): string[] {
  const clean = normalizePath(spec);
  if (!clean) return [];
  if (/^[a-z]+:\/\//i.test(clean)) return [];
  if (!clean.startsWith('.') && !clean.startsWith('/')) return [clean];

  const dir = dirname(basePath);
  const joined = clean.startsWith('/') ? clean.slice(1) : joinPath(dir, clean);
  const root = normalizePath(joined);
  const out = [root];
  if (/\.[a-z0-9]+$/i.test(root)) return unique(out);

  const exts = ['tsx', 'ts', 'jsx', 'js', 'json'];
  for (const ext of exts) out.push(root + '.' + ext);
  for (const ext of exts) out.push(root + '/index.' + ext);
  return unique(out);
}

function resolveImport(basePath: string, spec: string): { path: string; local: boolean } {
  const candidates = candidatePaths(basePath, spec);
  for (const candidate of candidates) {
    const text = readFile(candidate);
    if (typeof text === 'string' && text.length > 0) return { path: candidate, local: true };
  }
  return { path: normalizePath(spec), local: false };
}

function nodeIdFor(path: string): string {
  return normalizePath(path) || '__graph-root__';
}

function makeNode(path: string, depth: number, local: boolean, imported: number): ImportGraphNode {
  const clean = normalizePath(path);
  const ext = local ? splitExt(clean) : clean.includes('/') ? splitExt(clean) : 'external';
  const type = local ? inferFileType(clean) : 'question-mark';
  return {
    id: nodeIdFor(clean),
    path: clean,
    label: local ? baseName(clean) || clean : clean,
    shape: depth === 0 ? 'root' : local ? type : 'external',
    tone: depth === 0 ? fileTone('workspace') : local ? fileTone(type) : fileTone('dir'),
    glyph: depth === 0 ? fileGlyph('workspace') : local ? fileGlyph(type) : '??',
    ext,
    depth,
    local,
    imported,
  };
}

function buildGraph(currentFilePath: string, sourceText: string, maxDepth: number): ImportGraph {
  const rootPath = normalizePath(currentFilePath || '');
  const rootSource = String(sourceText || '');
  const nodes: ImportGraphNode[] = [];
  const edges: ImportGraphEdge[] = [];
  const seen = new Map<string, number>();
  const extSet = new Set<string>();
  const queue: Array<{ path: string; source: string; depth: number; imported: number }> = [
    { path: rootPath, source: rootSource, depth: 0, imported: 0 },
  ];

  while (queue.length > 0) {
    const item = queue.shift();
    if (!item) continue;
    const id = nodeIdFor(item.path);
    if (seen.has(id)) continue;
    seen.set(id, item.depth);
    nodes.push(makeNode(item.path, item.depth, true, item.imported));

    const imports = extractImports(item.source);
    for (const spec of imports) {
      const resolved = resolveImport(item.path, spec);
      const targetId = nodeIdFor(resolved.path);
      const label = normalizePath(spec);
      edges.push({ from: id, to: targetId, label, style: resolved.local ? 'solid' : 'dashed' });
      if (resolved.local) {
        const ext = splitExt(resolved.path);
        if (ext) extSet.add(ext);
        if (item.depth + 1 <= maxDepth) {
          const nextSource = readFile(resolved.path);
          queue.push({ path: resolved.path, source: nextSource || '', depth: item.depth + 1, imported: item.imported + 1 });
        }
      } else {
        if (!seen.has(targetId)) {
          nodes.push(makeNode(resolved.path, item.depth + 1, false, item.imported + 1));
        }
      }
    }
  }

  if (rootPath) {
    const rootExt = splitExt(rootPath);
    if (rootExt) extSet.add(rootExt);
  }

  return {
    rootId: nodeIdFor(rootPath),
    rootPath,
    nodes,
    edges,
    extOptions: Array.from(extSet).sort(),
  };
}

export function useImportGraph(currentFilePath: string, sourceText: string, maxDepth = 2): ImportGraph {
  return useMemo(() => buildGraph(currentFilePath, sourceText, maxDepth), [currentFilePath, sourceText, maxDepth]);
}
