// =============================================================================
// FILE INDEXER — workspace file indexing with metadata + embedding stubs
// =============================================================================

const host: any = globalThis;

const STORE_INDEX_KEY = 'cursor-ide.fileIndex';
const DEFAULT_EXCLUDES = ['.git', 'node_modules', '.zig-cache', 'zig-out', 'dist', '.cache'];

function storeGet(key: string): string | null {
  try { return host.__store_get(key); } catch { return null; }
}
function storeSet(key: string, value: string): void {
  try { host.__store_set(key, value); } catch {}
}
function fsRead(path: string): string {
  try { const out = host.__fs_read(path); return typeof out === 'string' ? out : ''; } catch { return ''; }
}
function fsStat(path: string): any {
  try { return JSON.parse(host.__fs_stat_json(path) || 'null'); } catch { return null; }
}
function execCmd(cmd: string): string {
  try { const out = host.__exec(cmd); return typeof out === 'string' ? out : ''; } catch { return ''; }
}

// ── Types ────────────────────────────────────────────────────────────────────

export interface IndexedFile {
  path: string;
  contentHash: string;
  indexedAt: number;
  tokenCount: number;
  embeddings?: number[];
  metadata: {
    language: string;
    lineCount: number;
    lastModified: number;
  };
}

export interface IndexStats {
  totalFiles: number;
  totalTokens: number;
  lastIndexedAt: number;
  languages: Record<string, number>;
}

export interface IndexProgress {
  active: boolean;
  workDir: string;
  totalFiles: number;
  scannedFiles: number;
  currentFile: string;
  startedAt: number;
  updatedAt: number;
  rate: number;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function hashContent(content: string): string {
  let h = 0;
  for (let i = 0; i < content.length; i++) {
    h = ((h << 5) - h + content.charCodeAt(i)) | 0;
  }
  return h.toString(16);
}

function estimateTokens(content: string): number {
  return Math.ceil(content.length / 4);
}

const LANG_MAP: Record<string, string> = {
  ts: 'typescript', tsx: 'typescript', js: 'javascript', jsx: 'javascript',
  py: 'python', rs: 'rust', go: 'go', zig: 'zig', lua: 'lua',
  c: 'c', cpp: 'cpp', h: 'c', hpp: 'cpp',
  md: 'markdown', json: 'json', yaml: 'yaml', yml: 'yaml',
  css: 'css', html: 'html', xml: 'xml', sh: 'bash',
};

function langFromPath(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase() || '';
  return LANG_MAP[ext] || 'unknown';
}

function shellQuote(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\$/g, '\\$');
}

let currentProgress: IndexProgress = {
  active: false,
  workDir: '',
  totalFiles: 0,
  scannedFiles: 0,
  currentFile: '',
  startedAt: 0,
  updatedAt: 0,
  rate: 0,
};

function updateProgress(next: Partial<IndexProgress>): void {
  currentProgress = { ...currentProgress, ...next };
}

function sleep0(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

export function getIndexProgress(): IndexProgress {
  return { ...currentProgress };
}

// ── Core API ─────────────────────────────────────────────────────────────────

export function loadIndex(): IndexedFile[] {
  const raw = storeGet(STORE_INDEX_KEY);
  if (!raw) return [];
  try { return JSON.parse(raw); } catch { return []; }
}

export function saveIndex(index: IndexedFile[]): void {
  storeSet(STORE_INDEX_KEY, JSON.stringify(index));
}

export function getIndexStats(): IndexStats {
  const index = loadIndex();
  const languages: Record<string, number> = {};
  let totalTokens = 0;
  for (const f of index) {
    totalTokens += f.tokenCount;
    languages[f.metadata.language] = (languages[f.metadata.language] || 0) + 1;
  }
  return {
    totalFiles: index.length,
    totalTokens,
    lastIndexedAt: index.length > 0 ? Math.max(...index.map(f => f.indexedAt)) : 0,
    languages,
  };
}

export function indexFile(path: string): IndexedFile | null {
  const content = fsRead(path);
  if (!content) return null;
  const stat = fsStat(path);
  return {
    path,
    contentHash: hashContent(content),
    indexedAt: Date.now(),
    tokenCount: estimateTokens(content),
    metadata: {
      language: langFromPath(path),
      lineCount: content.split('\n').length,
      lastModified: stat?.mtimeMs || Date.now(),
    },
  };
}

export async function indexWorkspace(workDir: string, options?: { exclude?: string[] }): Promise<IndexStats> {
  const exclude = new Set([
    ...DEFAULT_EXCLUDES,
    ...(options?.exclude || []),
  ]);
  const excludes = Array.from(exclude).map((e) => `-not -path "*/${shellQuote(e)}/*"`).join(' ');
  const findOut = execCmd(`find "${shellQuote(workDir)}" -type f ${excludes} 2>/dev/null`);
  const paths = findOut.split('\n').filter((p) => p.trim());

  const existing = new Map(loadIndex().map(f => [f.path, f]));
  const updated: IndexedFile[] = [];
  const startedAt = Date.now();

  updateProgress({
    active: true,
    workDir,
    totalFiles: paths.length,
    scannedFiles: 0,
    currentFile: '',
    startedAt,
    updatedAt: startedAt,
    rate: 0,
  });

  for (let i = 0; i < paths.length; i++) {
    const path = paths[i];
    const stat = fsStat(path);
    const prev = existing.get(path);
    if (prev && stat && prev.metadata.lastModified >= stat.mtimeMs) {
      updated.push(prev);
    } else {
      const indexed = indexFile(path);
      if (indexed) updated.push(indexed);
    }

    const now = Date.now();
    const scannedFiles = i + 1;
    const elapsedSeconds = Math.max((now - startedAt) / 1000, 0.001);
    updateProgress({
      active: true,
      workDir,
      totalFiles: paths.length,
      scannedFiles,
      currentFile: path,
      updatedAt: now,
      rate: scannedFiles / elapsedSeconds,
    });

    if (scannedFiles % 24 === 0) {
      await sleep0();
    }
  }

  saveIndex(updated);
  const stats = getIndexStats();
  updateProgress({
    active: false,
    workDir,
    totalFiles: stats.totalFiles,
    scannedFiles: stats.totalFiles,
    currentFile: '',
    updatedAt: Date.now(),
    rate: 0,
  });
  return stats;
}

export function searchIndex(query: string): IndexedFile[] {
  const index = loadIndex();
  const q = query.toLowerCase();
  return index.filter(f => f.path.toLowerCase().includes(q));
}

export function removeFromIndex(path: string): void {
  saveIndex(loadIndex().filter(f => f.path !== path));
}

export function clearIndex(): void {
  saveIndex([]);
  updateProgress({
    active: false,
    workDir: '',
    totalFiles: 0,
    scannedFiles: 0,
    currentFile: '',
    startedAt: 0,
    updatedAt: Date.now(),
    rate: 0,
  });
}

export function getFileContent(path: string): string {
  return fsRead(path);
}
