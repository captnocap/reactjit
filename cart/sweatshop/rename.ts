// =============================================================================
// RENAME PREVIEW — symbol lookup, usage grouping, and file-write rename stub
// =============================================================================

const host: any = globalThis;

import { getFileContent, getIndexedSymbolAtLocation, loadIndex, type IndexedSymbolSelection } from './indexer';

function fsWrite(path: string, content: string): boolean {
  try {
    const out = host.__fs_write(path, content);
    return out === true || out === 0;
  } catch {
    return false;
  }
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function clampSnippet(text: string, maxLen: number = 160): string {
  const trimmed = text.trim();
  if (trimmed.length <= maxLen) return trimmed;
  return trimmed.slice(0, maxLen - 1).trimEnd() + '…';
}

export interface RenameSelection extends IndexedSymbolSelection {
  sourceLineText: string;
}

export interface RenameHit {
  id: string;
  path: string;
  lineNumber: number;
  columnNumber: number;
  snippet: string;
  selected: boolean;
  role: 'definition' | 'usage';
}

export interface RenameFileGroup {
  path: string;
  hits: RenameHit[];
}

export interface RenamePreview {
  selection: RenameSelection;
  replacement: string;
  groups: RenameFileGroup[];
  totalHits: number;
  selectedHits: number;
  error?: string;
}

function resolveFileContent(path: string): string {
  const indexed = loadIndex().find((entry) => entry.path === path || entry.path.endsWith('/' + path));
  if (indexed?.content) return indexed.content;
  return getFileContent(path);
}

function resolveLine(path: string, lineNumber: number): string {
  const content = resolveFileContent(path);
  const lines = content.split('\n');
  return lines[lineNumber - 1] || '';
}

function normalizePath(path: string): string {
  return path.replace(/\\/g, '/').replace(/\/+$/, '');
}

function hitId(path: string, lineNumber: number, columnNumber: number): string {
  return `${normalizePath(path)}:${lineNumber}:${columnNumber}`;
}

export function resolveRenameSelection(workDir: string, path: string, lineNumber: number, columnNumber: number): RenameSelection | null {
  const trimmed = path.trim();
  if (!trimmed || lineNumber <= 0 || columnNumber <= 0) return null;
  const candidate = trimmed.startsWith(workDir) ? trimmed : trimmed.startsWith('./') ? trimmed.slice(2) : trimmed;
  const symbol = getIndexedSymbolAtLocation(candidate, lineNumber, columnNumber) || getIndexedSymbolAtLocation(path, lineNumber, columnNumber);
  if (!symbol) return null;
  const sourceLineText = resolveLine(symbol.path, symbol.lineNumber);
  return { ...symbol, sourceLineText };
}

function findWordUsages(path: string, symbolName: string): RenameHit[] {
  const content = resolveFileContent(path);
  if (!content) return [];
  const lines = content.split('\n');
  const pattern = new RegExp(`\\b${escapeRegExp(symbolName)}\\b`, 'g');
  const hits: RenameHit[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    pattern.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(line))) {
      const columnNumber = match.index + 1;
      hits.push({
        id: hitId(path, i + 1, columnNumber),
        path,
        lineNumber: i + 1,
        columnNumber,
        snippet: clampSnippet(line),
        selected: true,
        role: 'usage',
      });
    }
  }

  return hits;
}

export function buildRenamePreview(workDir: string, path: string, lineNumber: number, columnNumber: number, replacement: string): RenamePreview {
  const selection = resolveRenameSelection(workDir, path, lineNumber, columnNumber);
  if (!selection) {
    return {
      selection: {
        path: '',
        name: '',
        kind: 'function',
        lineNumber: 0,
        columnNumber: 0,
        sourceLineText: '',
      },
      replacement,
      groups: [],
      totalHits: 0,
      selectedHits: 0,
      error: 'Could not resolve a symbol at that location.',
    };
  }

  const groups: RenameFileGroup[] = [];
  const index = loadIndex();

  for (const file of index) {
    const hits = findWordUsages(file.path, selection.name).map((hit) => ({
      ...hit,
      role: hit.path === selection.path && hit.lineNumber === selection.lineNumber ? 'definition' as const : 'usage' as const,
    }));
    if (hits.length > 0) groups.push({ path: file.path, hits });
  }

  const totalHits = groups.reduce((sum, group) => sum + group.hits.length, 0);

  return {
    selection,
    replacement,
    groups,
    totalHits,
    selectedHits: totalHits,
  };
}

export function applyRenamePreview(preview: RenamePreview, hitSelection: Record<string, boolean>): { ok: boolean; filesWritten: number; hitsWritten: number; errors: string[] } {
  if (preview.error) {
    return { ok: false, filesWritten: 0, hitsWritten: 0, errors: [preview.error] };
  }

  const errors: string[] = [];
  let filesWritten = 0;
  let hitsWritten = 0;

  for (const group of preview.groups) {
    const selectedHits = group.hits.filter((hit) => hitSelection[hit.id] !== false);
    if (selectedHits.length === 0) continue;

    const content = resolveFileContent(group.path);
    if (!content) {
      errors.push(`Missing file content: ${group.path}`);
      continue;
    }

    const lines = content.split('\n');
    const hitsByLine = new Map<number, RenameHit[]>();
    for (const hit of selectedHits) {
      const list = hitsByLine.get(hit.lineNumber) || [];
      list.push(hit);
      hitsByLine.set(hit.lineNumber, list);
    }

    for (const [lineNumber, hits] of hitsByLine.entries()) {
      hits.sort((a, b) => b.columnNumber - a.columnNumber);
      let line = lines[lineNumber - 1];
      for (const hit of hits) {
        const start = Math.max(0, hit.columnNumber - 1);
        const end = start + preview.selection.name.length;
        if (line.slice(start, end) !== preview.selection.name) {
          continue;
        }
        line = line.slice(0, start) + preview.replacement + line.slice(end);
        hitsWritten++;
      }
      lines[lineNumber - 1] = line;
    }

    if (fsWrite(group.path, lines.join('\n'))) {
      filesWritten++;
    } else {
      errors.push(`Write failed: ${group.path}`);
    }
  }

  return { ok: errors.length === 0, filesWritten, hitsWritten, errors };
}
