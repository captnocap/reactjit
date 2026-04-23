// Streaming search hook. Drives result list incrementally so huge repos don't
// block the UI — the host provider yields files one at a time, each scan runs
// through requestIdleCallback-style setTimeout chunks, and callers see results
// populate via setResults.


export type SearchMode = 'literal' | 'regex' | 'word';

export interface SearchOptions {
  query: string;
  mode: SearchMode;
  caseSensitive: boolean;
  include?: string[];        // glob patterns
  exclude?: string[];
  scope: SearchScope;
  customGlob?: string;
  selection?: { path: string; from: number; to: number } | null;
  openFiles?: string[];
  currentFile?: string | null;
  maxResults?: number;
}

export type SearchScope = 'currentFile' | 'openFiles' | 'selection' | 'directory' | 'customGlob';

export interface FileSource {
  path: string;
  lines: string[];
}

export interface SearchMatch {
  path: string;
  line: number;        // 1-indexed
  col: number;         // 1-indexed
  length: number;
  text: string;        // the matching line itself
  before: string[];    // up to N context lines above
  after: string[];     // up to N context lines below
}

export interface SearchProvider {
  (opts: SearchOptions, onFile: (f: FileSource) => void, signal: { cancelled: boolean }): Promise<void> | void;
}

function buildRegex(opts: SearchOptions): RegExp | null {
  const { query, mode, caseSensitive } = opts;
  if (!query) return null;
  const flags = 'g' + (caseSensitive ? '' : 'i');
  try {
    if (mode === 'regex') return new RegExp(query, flags);
    const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (mode === 'word') return new RegExp('\\b' + escaped + '\\b', flags);
    return new RegExp(escaped, flags);
  } catch (_) { return null; }
}

function scanFile(file: FileSource, re: RegExp, cap: number, ctx: number): SearchMatch[] {
  const out: SearchMatch[] = [];
  for (let i = 0; i < file.lines.length; i++) {
    const line = file.lines[i];
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(line))) {
      out.push({
        path: file.path,
        line: i + 1,
        col: m.index + 1,
        length: m[0].length,
        text: line,
        before: file.lines.slice(Math.max(0, i - ctx), i),
        after: file.lines.slice(i + 1, Math.min(file.lines.length, i + 1 + ctx)),
      });
      if (out.length >= cap) return out;
      if (m[0].length === 0) re.lastIndex++;
    }
  }
  return out;
}

export interface SearchEngineState {
  matches: SearchMatch[];
  running: boolean;
  scannedFiles: number;
  totalMatches: number;
  error: string | null;
  truncated: boolean;
}

export interface SearchEngineApi extends SearchEngineState {
  run: (opts: SearchOptions) => void;
  cancel: () => void;
  reset: () => void;
}

export function useSearchEngine(provider: SearchProvider): SearchEngineApi {
  const [state, setState] = useState<SearchEngineState>({
    matches: [], running: false, scannedFiles: 0, totalMatches: 0, error: null, truncated: false,
  });
  const signalRef = useRef<{ cancelled: boolean }>({ cancelled: false });

  const reset = useCallback(() => {
    signalRef.current.cancelled = true;
    setState({ matches: [], running: false, scannedFiles: 0, totalMatches: 0, error: null, truncated: false });
  }, []);

  const cancel = useCallback(() => {
    signalRef.current.cancelled = true;
    setState((s: SearchEngineState) => ({ ...s, running: false }));
  }, []);

  const run = useCallback((opts: SearchOptions) => {
    signalRef.current.cancelled = true;
    const signal = { cancelled: false };
    signalRef.current = signal;
    const re = buildRegex(opts);
    if (!re) {
      setState({ matches: [], running: false, scannedFiles: 0, totalMatches: 0, error: opts.query ? 'invalid regex' : null, truncated: false });
      return;
    }
    const cap = opts.maxResults ?? 5000;
    setState({ matches: [], running: true, scannedFiles: 0, totalMatches: 0, error: null, truncated: false });
    const onFile = (f: FileSource) => {
      if (signal.cancelled) return;
      const hits = scanFile(f, re, cap, 2);
      setState((prev: SearchEngineState) => {
        if (signal.cancelled) return prev;
        const nextMatches = prev.matches.length >= cap ? prev.matches : prev.matches.concat(hits).slice(0, cap);
        return {
          ...prev,
          matches: nextMatches,
          scannedFiles: prev.scannedFiles + 1,
          totalMatches: prev.totalMatches + hits.length,
          truncated: prev.totalMatches + hits.length > cap,
        };
      });
    };
    try {
      const maybe = provider(opts, onFile, signal);
      if (maybe && typeof (maybe as any).then === 'function') {
        (maybe as Promise<void>).then(
          () => { if (!signal.cancelled) setState((s: SearchEngineState) => ({ ...s, running: false })); },
          (err: any) => setState((s: SearchEngineState) => ({ ...s, running: false, error: String(err && err.message || err) })),
        );
      } else {
        setState((s: SearchEngineState) => ({ ...s, running: false }));
      }
    } catch (err: any) {
      setState((s: SearchEngineState) => ({ ...s, running: false, error: String(err && err.message || err) }));
    }
  }, [provider]);

  return { ...state, run, cancel, reset };
}
