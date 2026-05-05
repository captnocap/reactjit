// =============================================================================
// FILE INDEXER — workspace file indexing with metadata + embedding stubs
// =============================================================================

const host: any = globalThis;

const STORE_INDEX_KEY = 'sweatshop.fileIndex';
const STORE_AUTO_REINDEX_KEY = 'sweatshop.indexer.autoReindex';
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
  content?: string;
  symbols?: IndexSymbol[];
  embeddings?: number[];
  metadata: {
    language: string;
    lineCount: number;
    lastModified: number;
  };
}

export interface IndexSymbol {
  name: string;
  kind: 'function' | 'class';
  lineNumber: number;
}

export interface IndexedSymbolSelection extends IndexSymbol {
  path: string;
  columnNumber: number;
}

export interface IndexSearchHit {
  path: string;
  lineNumber: number;
  snippet: string;
  matchKind: 'content' | 'path' | 'symbol';
  symbols: IndexSymbol[];
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

export interface IndexDirectory {
  path: string;
  included: boolean;
}

export type IndexAutoReindexMode = 'off' | '15m' | '1h' | 'on-save';

export interface IndexAutoReindexConfig {
  mode: IndexAutoReindexMode;
  lastAutoReindexAt: number;
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

function isSearchableText(path: string): boolean {
  const ext = path.split('.').pop()?.toLowerCase() || '';
  return ['ts', 'tsx', 'js', 'jsx', 'json', 'md', 'txt', 'css', 'html', 'xml', 'yml', 'yaml', 'sh', 'zig', 'lua', 'py', 'rs', 'go', 'c', 'cpp', 'h', 'hpp'].includes(ext);
}

function clampSnippet(text: string, maxLen: number = 160): string {
  const trimmed = text.trim();
  if (trimmed.length <= maxLen) return trimmed;
  return trimmed.slice(0, maxLen - 1).trimEnd() + '…';
}

function wordAt(text: string, columnNumber: number): { word: string; startColumn: number; endColumn: number } | null {
  if (!text) return null;
  const idx = Math.max(0, Math.min(text.length - 1, columnNumber - 1));
  const isWord = (ch: string) => /[A-Za-z0-9_$]/.test(ch);
  let start = idx;
  while (start >= 0 && isWord(text[start])) start--;
  let end = idx;
  while (end < text.length && isWord(text[end])) end++;
  if (start === end) return null;
  const word = text.slice(start + 1, end);
  if (!word) return null;
  return {
    word,
    startColumn: start + 2,
    endColumn: end,
  };
}

function extractSymbols(content: string): IndexSymbol[] {
  const lines = content.split('\n');
  const out: IndexSymbol[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const patterns: Array<{ kind: IndexSymbol['kind']; regex: RegExp }> = [
      { kind: 'class', regex: /^\s*(?:export\s+)?class\s+([A-Za-z_$][\w$]*)\b/ },
      { kind: 'function', regex: /^\s*(?:export\s+)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(/ },
      { kind: 'function', regex: /^\s*(?:export\s+)?(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?(?:function\b|\([^)]*\)\s*=>|[A-Za-z_$][\w$]*\s*=>)/ },
    ];
    for (const pattern of patterns) {
      const match = line.match(pattern.regex);
      if (!match) continue;
      const name = match[1];
      const key = `${pattern.kind}:${name}`;
      if (seen.has(key)) break;
      seen.add(key);
      out.push({ name, kind: pattern.kind, lineNumber: i + 1 });
      break;
    }
  }
  return out;
}

function buildSearchHit(file: IndexedFile, query: string): IndexSearchHit {
  const content = file.content || '';
  const lines = content ? content.split('\n') : [];
  const lowerQuery = query.toLowerCase().trim();
  const terms = lowerQuery.split(/\s+/).filter(Boolean);
  const symbols = file.symbols || [];
  const pathLower = file.path.toLowerCase();

  if (!terms.length) {
    return {
      path: file.path,
      lineNumber: 1,
      snippet: lines.length > 0 ? clampSnippet(lines[0]) : file.path,
      matchKind: 'path',
      symbols,
    };
  }

  for (const symbol of symbols) {
    const symbolLower = symbol.name.toLowerCase();
    if (terms.some((term) => symbolLower.includes(term))) {
      return {
        path: file.path,
        lineNumber: symbol.lineNumber,
        snippet: `symbol ${symbol.kind} ${symbol.name}`,
        matchKind: 'symbol',
        symbols,
      };
    }
  }

  let bestLineNumber = 1;
  let bestSnippet = file.path;
  let bestKind: IndexSearchHit['matchKind'] = 'path';
  let bestScore = pathLower.includes(lowerQuery) ? terms.length : 0;

  if (bestScore > 0) {
    bestSnippet = file.path;
    bestKind = 'path';
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineLower = line.toLowerCase();
    let score = 0;
    for (const term of terms) {
      if (lineLower.includes(term)) score++;
    }
    if (score > bestScore) {
      bestScore = score;
      bestLineNumber = i + 1;
      bestSnippet = clampSnippet(line);
      bestKind = 'content';
    }
  }

  return {
    path: file.path,
    lineNumber: bestLineNumber,
    snippet: bestSnippet,
    matchKind: bestKind,
    symbols,
  };
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

function normalizeDir(path: string): string {
  return path.replace(/^\.?\//, '').replace(/\/+$/, '');
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

function loadJson<T>(key: string, fallback: T): T {
  const raw = storeGet(key);
  if (!raw) return fallback;
  try { return JSON.parse(raw) as T; } catch { return fallback; }
}

function saveJson(key: string, value: any): void {
  storeSet(key, JSON.stringify(value));
}

function loadAutoReindexConfig(): IndexAutoReindexConfig {
  return loadJson<IndexAutoReindexConfig>(STORE_AUTO_REINDEX_KEY, {
    mode: 'off',
    lastAutoReindexAt: 0,
  });
}

function saveAutoReindexConfig(config: IndexAutoReindexConfig): void {
  saveJson(STORE_AUTO_REINDEX_KEY, config);
}

function listWorkspaceDirectories(workDir: string): string[] {
  const defaultExcludes = DEFAULT_EXCLUDES.map((dir) => `-not -path "*/${shellQuote(dir)}/*"`).join(' ');
  const findOut = execCmd(`find "${shellQuote(workDir)}" -type d ${defaultExcludes} 2>/dev/null`);
  const dirs = new Set<string>();
  const root = workDir.endsWith('/') ? workDir : `${workDir}/`;
  for (const line of findOut.split('\n')) {
    const abs = line.trim();
    if (!abs) continue;
    if (!abs.startsWith(root)) continue;
    const rel = normalizeDir(abs.slice(root.length));
    if (!rel) continue;
    const parts = rel.split('/');
    let prefix = '';
    for (const part of parts) {
      prefix = prefix ? `${prefix}/${part}` : part;
      if (prefix === '.git' || prefix.startsWith('.git/')) break;
      if (prefix === 'node_modules' || prefix.startsWith('node_modules/')) break;
      if (prefix === '.zig-cache' || prefix.startsWith('.zig-cache/')) break;
      if (prefix === 'zig-out' || prefix.startsWith('zig-out/')) break;
      if (prefix === 'dist' || prefix.startsWith('dist/')) break;
      if (prefix === '.cache' || prefix.startsWith('.cache/')) break;
      dirs.add(prefix);
    }
  }
  return Array.from(dirs).sort((a, b) => a.localeCompare(b));
}

const STORE_DIR_RULES_KEY = 'sweatshop.indexer.dirRules';

function loadDirRules(): Record<string, boolean> {
  return loadJson<Record<string, boolean>>(STORE_DIR_RULES_KEY, {});
}

function saveDirRules(rules: Record<string, boolean>): void {
  saveJson(STORE_DIR_RULES_KEY, rules);
}

function excludedPatternsFromRules(rules: Record<string, boolean>): string {
  const parts: string[] = DEFAULT_EXCLUDES.map((dir) => `-not -path "*/${shellQuote(dir)}/*"`);
  for (const [dir, included] of Object.entries(rules)) {
    if (included !== false) continue;
    const normalized = normalizeDir(dir);
    if (!normalized) continue;
    parts.push(`-not -path "*/${shellQuote(normalized)}/*"`);
  }
  return parts.join(' ');
}

export function listIndexDirectories(workDir: string): IndexDirectory[] {
  const dirs = listWorkspaceDirectories(workDir);
  const rules = loadDirRules();
  return dirs.map((path) => ({
    path,
    included: rules[path] !== false,
  }));
}

export function setDirectoryIncluded(dir: string, included: boolean): void {
  const rules = loadDirRules();
  rules[normalizeDir(dir)] = included;
  saveDirRules(rules);
}

export function toggleDirectoryIncluded(dir: string): boolean {
  const normalized = normalizeDir(dir);
  const rules = loadDirRules();
  const next = !(rules[normalized] !== false);
  rules[normalized] = next;
  saveDirRules(rules);
  return next;
}

export function getDirectoryIncluded(dir: string): boolean {
  const key = normalizeDir(dir);
  if (!key) return true;
  const rules = loadDirRules();
  return rules[key] !== false;
}

export function getStaleIndexCount(workDir: string): number {
  const root = workDir.endsWith('/') ? workDir : `${workDir}/`;
  let stale = 0;
  for (const entry of loadIndex()) {
    if (!entry.path.startsWith(root)) continue;
    const stat = fsStat(entry.path);
    if (!stat) continue;
    if (stat.mtimeMs > entry.indexedAt) stale++;
  }
  return stale;
}

export function getIndexAutoReindexConfig(): IndexAutoReindexConfig {
  return loadAutoReindexConfig();
}

export function getIndexAutoReindexMode(): IndexAutoReindexMode {
  return loadAutoReindexConfig().mode;
}

export function setIndexAutoReindexMode(mode: IndexAutoReindexMode): void {
  const cfg = loadAutoReindexConfig();
  cfg.mode = mode;
  saveAutoReindexConfig(cfg);
}

export function markAutoReindexRun(): void {
  const cfg = loadAutoReindexConfig();
  cfg.lastAutoReindexAt = Date.now();
  saveAutoReindexConfig(cfg);
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
  const searchable = isSearchableText(path) && content.length <= 250000;
  return {
    path,
    contentHash: hashContent(content),
    indexedAt: Date.now(),
    tokenCount: estimateTokens(content),
    content: searchable ? content : undefined,
    symbols: searchable ? extractSymbols(content) : [],
    metadata: {
      language: langFromPath(path),
      lineCount: content.split('\n').length,
      lastModified: stat?.mtimeMs || Date.now(),
    },
  };
}

export async function indexWorkspace(workDir: string, options?: { exclude?: string[] }): Promise<IndexStats> {
  const rules = loadDirRules();
  for (const dir of options?.exclude || []) {
    rules[normalizeDir(dir)] = false;
  }
  const excludes = excludedPatternsFromRules(rules);
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
  const q = query.trim();
  if (!q) return loadIndex();
  const lower = q.toLowerCase();
  const terms = lower.split(/\s+/).filter(Boolean);
  const index = loadIndex();
  const scored = index
    .map((file) => {
      const pathLower = file.path.toLowerCase();
      const content = file.content || '';
      const contentLower = content.toLowerCase();
      const symbolMatches = (file.symbols || []).filter((symbol) =>
        symbol.name.toLowerCase().includes(lower) || terms.some((term) => symbol.name.toLowerCase().includes(term))
      );
      let score = 0;
      if (pathLower.includes(lower)) score += 3;
      for (const term of terms) {
        if (pathLower.includes(term)) score += 2;
        if (contentLower.includes(term)) score += 1;
        if ((file.symbols || []).some((symbol) => symbol.name.toLowerCase().includes(term))) score += 2;
      }
      if (symbolMatches.length > 0) score += 5;
      const hit = buildSearchHit(file, q);
      return { file, score, hit };
    })
    .filter((entry) => entry.score > 0 || entry.hit.matchKind !== 'path' || entry.hit.snippet !== entry.file.path);

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.file.path.localeCompare(b.file.path);
  });

  return scored.map((entry) => entry.file);
}

export function searchIndexHits(query: string): IndexSearchHit[] {
  const q = query.trim();
  const index = loadIndex();
  if (!q) return index.map((file) => buildSearchHit(file, q));
  const lower = q.toLowerCase();
  const terms = lower.split(/\s+/).filter(Boolean);
  return index
    .map((file) => {
      const hit = buildSearchHit(file, q);
      const pathLower = hit.path.toLowerCase();
      const snippetLower = hit.snippet.toLowerCase();
      const symbolScore = hit.symbols.some((symbol) => symbol.name.toLowerCase().includes(lower))
        ? 3
        : 0;
      let score = symbolScore;
      if (hit.matchKind === 'symbol') score += 6;
      if (hit.matchKind === 'content') score += 4;
      if (hit.matchKind === 'path') score += 2;
      for (const term of terms) {
        if (pathLower.includes(term)) score += 2;
        if (snippetLower.includes(term)) score += 1;
      }
      return { hit, score };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.hit.path.localeCompare(b.hit.path);
    })
    .map((entry) => entry.hit);
}

export function getIndexedSymbolAtLocation(path: string, lineNumber: number, columnNumber: number): IndexedSymbolSelection | null {
  const index = loadIndex();
  const file = index.find((entry) => entry.path === path || entry.path.endsWith('/' + path));
  if (!file) return null;
  const content = file.content || getFileContent(file.path);
  const lines = content.split('\n');
  const line = lines[lineNumber - 1];
  if (!line) return null;

  const extracted = wordAt(line, columnNumber);
  const candidateName = extracted?.word || file.symbols?.find((sym) => sym.lineNumber === lineNumber)?.name || '';
  if (!candidateName) return null;

  const matches = (file.symbols || []).filter((sym) => sym.name === candidateName);
  const preferred = matches.find((sym) => sym.lineNumber === lineNumber) || matches[0];
  const column = extracted?.startColumn || (line.indexOf(candidateName) >= 0 ? line.indexOf(candidateName) + 1 : columnNumber);
  if (!preferred) {
    const kind = line.includes('class ' + candidateName) ? 'class' : 'function';
    return {
      path: file.path,
      name: candidateName,
      kind,
      lineNumber,
      columnNumber: column,
    };
  }
  return {
    path: file.path,
    name: preferred.name,
    kind: preferred.kind,
    lineNumber: preferred.lineNumber,
    columnNumber: lineNumber === preferred.lineNumber ? column : (line.indexOf(preferred.name) >= 0 ? line.indexOf(preferred.name) + 1 : column),
  };
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
