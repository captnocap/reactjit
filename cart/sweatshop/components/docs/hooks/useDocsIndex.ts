const React: any = require('react');
const { useCallback, useEffect, useMemo, useState } = React;

import { readFile } from '../../../host';

const host: any = globalThis as any;

export type DocsFrontmatter = Record<string, string>;

export type DocsHeading = {
  id: string;
  level: number;
  line: number;
  text: string;
};

export type DocsFileRecord = {
  path: string;
  name: string;
  title: string;
  excerpt: string;
  body: string;
  frontmatter: DocsFrontmatter;
  headings: DocsHeading[];
  mtimeMs: number;
};

export type DocsTreeNode = {
  kind: 'dir' | 'file';
  name: string;
  path: string;
  children: DocsTreeNode[];
  file?: DocsFileRecord;
};

export type DocsSearchHit = {
  path: string;
  title: string;
  snippet: string;
  score: number;
  file: DocsFileRecord;
};

export type DocsIndex = {
  rootPath: string;
  files: DocsFileRecord[];
  tree: DocsTreeNode[];
  revision: number;
  lastScannedAt: number;
  refresh: () => void;
  search: (query: string, limit?: number) => DocsSearchHit[];
  watchAvailable: boolean;
};

function fsScandir(path: string): string[] {
  try {
    if (typeof host.__fs_scandir !== 'function') return [];
    const out = host.__fs_scandir(path);
    return Array.isArray(out) ? out.map((entry: any) => String(entry)) : [];
  } catch {
    return [];
  }
}

function fsStat(path: string): { size?: number; mtimeMs?: number; isDir?: boolean } | null {
  try {
    if (typeof host.__fs_stat_json !== 'function') return null;
    const raw = host.__fs_stat_json(path);
    return raw ? JSON.parse(String(raw)) : null;
  } catch {
    return null;
  }
}

function normalizePath(path: string): string {
  return String(path || '').replace(/\/+/g, '/').replace(/^\.\//, '');
}

function joinPath(base: string, name: string): string {
  const cleanBase = normalizePath(base);
  const cleanName = String(name || '').replace(/^\/+/, '');
  if (!cleanBase || cleanBase === '.') return cleanName;
  if (cleanBase.endsWith('/')) return cleanBase + cleanName;
  return `${cleanBase}/${cleanName}`;
}

function basename(path: string): string {
  const clean = normalizePath(path).replace(/\/$/, '');
  const idx = clean.lastIndexOf('/');
  return idx >= 0 ? clean.slice(idx + 1) : clean;
}

function shouldSkipDir(name: string): boolean {
  return ['.git', 'node_modules', '.zig-cache', 'zig-out', 'dist', '.cache', '.turbo', 'out', 'build'].includes(name);
}

function slugify(text: string): string {
  const slug = String(text || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
  return slug || 'section';
}

function parseFrontmatter(source: string): { frontmatter: DocsFrontmatter; body: string } {
  const text = String(source || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  if (!text.startsWith('---\n')) return { frontmatter: {}, body: text };
  const end = text.indexOf('\n---', 4);
  if (end < 0) return { frontmatter: {}, body: text };
  const block = text.slice(4, end);
  const body = text.slice(end + 4).replace(/^\s*\n/, '');
  const frontmatter: DocsFrontmatter = {};
  for (const line of block.split('\n')) {
    const idx = line.indexOf(':');
    if (idx < 0) continue;
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim().replace(/^['"]|['"]$/g, '');
    if (key) frontmatter[key] = value;
  }
  return { frontmatter, body };
}

function extractHeadings(body: string): DocsHeading[] {
  const headings: DocsHeading[] = [];
  for (const [index, line] of body.split('\n').entries()) {
    const match = line.trim().match(/^(#{1,6})\s+(.*)$/);
    if (!match) continue;
    const text = match[2].trim();
    headings.push({ id: slugify(text), level: match[1].length, line: index + 1, text });
  }
  return headings;
}

function extractTitle(path: string, frontmatter: DocsFrontmatter, body: string, headings: DocsHeading[]): string {
  const fmTitle = String(frontmatter.title || '').trim();
  if (fmTitle) return fmTitle;
  if (headings[0]?.text) return headings[0].text;
  const firstLine = body.split('\n').find((line) => line.trim().length > 0) || '';
  const heading = firstLine.trim().replace(/^#{1,6}\s+/, '');
  if (heading) return heading;
  return basename(path) || path;
}

function extractExcerpt(body: string): string {
  const lines = body.split('\n').map((line) => line.trim()).filter(Boolean);
  return lines[0] || '';
}

function readDocsFile(path: string): DocsFileRecord | null {
  const source = readFile(path);
  if (!source) return null;
  const stat = fsStat(path);
  const { frontmatter, body } = parseFrontmatter(source);
  const headings = extractHeadings(body);
  return {
    path,
    name: basename(path),
    title: extractTitle(path, frontmatter, body, headings),
    excerpt: extractExcerpt(body),
    body,
    frontmatter,
    headings,
    mtimeMs: Number(stat?.mtimeMs || 0),
  };
}

function scanMarkdownFiles(rootPath: string): DocsFileRecord[] {
  const out: DocsFileRecord[] = [];
  const stack: string[] = [rootPath];
  while (stack.length > 0) {
    const dir = stack.pop() || rootPath;
    const entries = fsScandir(dir).sort((a, b) => a.localeCompare(b));
    for (const entry of entries) {
      if (entry === '.' || entry === '..') continue;
      const fullPath = normalizePath(joinPath(dir, entry));
      const stat = fsStat(fullPath);
      if (!stat) continue;
      if (stat.isDir) {
        if (shouldSkipDir(entry)) continue;
        stack.push(fullPath);
        continue;
      }
      if (!/\.md$/i.test(entry)) continue;
      const file = readDocsFile(fullPath);
      if (file) out.push(file);
    }
  }
  return out.sort((a, b) => a.path.localeCompare(b.path));
}

function buildTree(files: DocsFileRecord[]): DocsTreeNode[] {
  const root = new Map<string, DocsTreeNode>();
  const nodes: DocsTreeNode[] = [];

  const ensureDir = (path: string, name: string, parent: DocsTreeNode[] | null): DocsTreeNode => {
    const key = normalizePath(path) || '.';
    let node = root.get(key);
    if (!node) {
      node = { kind: 'dir', name, path: key, children: [] };
      root.set(key, node);
      if (parent) parent.push(node);
    }
    return node;
  };

  for (const file of files) {
    const parts = file.path.split('/').filter(Boolean);
    let parentChildren = nodes;
    let currentPath = '';
    for (let i = 0; i < parts.length - 1; i++) {
      currentPath = currentPath ? `${currentPath}/${parts[i]}` : parts[i];
      const dirNode = ensureDir(currentPath, parts[i], parentChildren);
      parentChildren = dirNode.children;
    }
    parentChildren.push({ kind: 'file', name: file.name, path: file.path, children: [], file });
  }

  const sortNodes = (list: DocsTreeNode[]) => {
    list.sort((a, b) => {
      if (a.kind !== b.kind) return a.kind === 'dir' ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    for (const node of list) if (node.kind === 'dir') sortNodes(node.children);
  };

  sortNodes(nodes);
  return nodes;
}

function snippetFor(file: DocsFileRecord, terms: string[]): string {
  const lines = file.body.split('\n');
  const lowerTerms = terms.map((term) => term.toLowerCase()).filter(Boolean);
  for (const line of lines) {
    const lower = line.toLowerCase();
    if (lowerTerms.some((term) => lower.includes(term))) return line.trim().slice(0, 180);
  }
  return file.excerpt.slice(0, 180);
}

function scoreFile(file: DocsFileRecord, query: string): DocsSearchHit | null {
  const terms = String(query || '').toLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) {
    return { path: file.path, title: file.title, snippet: file.excerpt || file.path, score: 1, file };
  }
  const haystack = `${file.title}\n${file.path}\n${file.body}`.toLowerCase();
  let score = 0;
  for (const term of terms) if (haystack.includes(term)) score += term.length;
  if (score === 0) return null;
  return { path: file.path, title: file.title, snippet: snippetFor(file, terms), score, file };
}

function detectWatchSupport(): boolean {
  return typeof host.__fs_watch === 'function';
}

export function useDocsIndex(rootPath: string = '.'): DocsIndex {
  const [files, setFiles] = useState<DocsFileRecord[]>([]);
  const [revision, setRevision] = useState(0);
  const [lastScannedAt, setLastScannedAt] = useState(0);
  const [watchAvailable] = useState(() => detectWatchSupport());

  const refresh = useCallback(() => {
    const next = scanMarkdownFiles(rootPath);
    setFiles(next);
    setRevision((value) => value + 1);
    setLastScannedAt(Date.now());
  }, [rootPath]);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 5000);
    return () => clearInterval(id);
  }, [refresh]);

  const tree = useMemo(() => buildTree(files), [files]);
  const search = useCallback((query: string, limit: number = 40) => {
    const hits = files
      .map((file) => scoreFile(file, query))
      .filter((hit): hit is DocsSearchHit => !!hit)
      .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title) || a.path.localeCompare(b.path));
    return hits.slice(0, Math.max(1, limit));
  }, [files]);

  return { rootPath, files, tree, revision, lastScannedAt, refresh, search, watchAvailable };
}

export function docsSelectionOrder(files: DocsFileRecord[]): string[] {
  const preferred = ['README.md', 'AGENTS.md', 'CLAUDE.md', 'docs/README.md'];
  const matches = new Set(files.map((file) => normalizePath(file.path)));
  const ordered: string[] = [];
  for (const want of preferred) for (const file of files) if (normalizePath(file.path).endsWith(want) && !ordered.includes(file.path)) ordered.push(file.path);
  for (const file of files) if (!ordered.includes(file.path)) ordered.push(file.path);
  return ordered;
}

export function docsPreferredFile(files: DocsFileRecord[]): DocsFileRecord | null {
  const order = docsSelectionOrder(files);
  const lookup = new Map(files.map((file) => [file.path, file]));
  for (const path of order) {
    const file = lookup.get(path);
    if (file) return file;
  }
  return files[0] || null;
}
