import { useCallback, useEffect, useRef, useState } from 'react';
import {
  classifyFile,
  dirStats,
  formatSize,
  indexDeep,
  scan,
  type DirStats,
  type MediaFile,
  type MediaType,
} from './media';

type ScanOptions = {
  dir: string | null;
  recursive?: boolean;
  maxDepth?: number;
  kinds?: MediaType[];
};

type StatsOptions = {
  dir: string | null;
  recursive?: boolean;
  maxDepth?: number;
};

type IndexOptions = {
  dir: string | null;
  recursive?: boolean;
  maxDepth?: number;
  indexArchives?: boolean;
  archivePattern?: string;
  kinds?: MediaType[];
};

type QueryOptions = {
  dir: string | null;
  source?: 'scan' | 'index';
  recursive?: boolean;
  maxDepth?: number;
  indexArchives?: boolean;
  archivePattern?: string;
  text?: string;
  kinds?: MediaType[];
  minSize?: number;
  maxSize?: number;
  orderBy?: 'name' | 'size' | 'mtime' | 'type';
  order?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
};

function filterKinds(items: MediaFile[], kinds?: MediaType[]): MediaFile[] {
  if (!kinds || kinds.length === 0) return items;
  const allow = new Set(kinds);
  return items.filter((f) => allow.has(f.type));
}

function queryItems(items: MediaFile[], options: QueryOptions): MediaFile[] {
  let out = items;

  if (options.text && options.text.trim()) {
    const q = options.text.trim().toLowerCase();
    out = out.filter((f) =>
      f.name.toLowerCase().includes(q) ||
      f.path.toLowerCase().includes(q),
    );
  }
  out = filterKinds(out, options.kinds);

  if (options.minSize != null) out = out.filter((f) => f.size >= options.minSize!);
  if (options.maxSize != null) out = out.filter((f) => f.size <= options.maxSize!);

  const orderBy = options.orderBy ?? 'name';
  const order = options.order === 'desc' ? -1 : 1;
  out = [...out].sort((a, b) => {
    let av: string | number = '';
    let bv: string | number = '';
    if (orderBy === 'name') { av = a.name.toLowerCase(); bv = b.name.toLowerCase(); }
    else if (orderBy === 'size') { av = a.size; bv = b.size; }
    else if (orderBy === 'mtime') { av = a.mtime ?? 0; bv = b.mtime ?? 0; }
    else { av = a.type; bv = b.type; }
    if (av < bv) return -1 * order;
    if (av > bv) return 1 * order;
    return 0;
  });

  const offset = options.offset ?? 0;
  const limited = offset > 0 ? out.slice(offset) : out;
  if (options.limit == null) return limited;
  return limited.slice(0, options.limit);
}

export function useMedia() {
  const runScan = useCallback(async (options: ScanOptions): Promise<MediaFile[]> => {
    if (!options.dir) return [];
    return filterKinds(
      scan(options.dir, {
        recursive: options.recursive ?? true,
        maxDepth: options.maxDepth ?? 10,
      }),
      options.kinds,
    );
  }, []);

  const runStats = useCallback(async (options: StatsOptions): Promise<DirStats> => {
    const empty: DirStats = { total: 0, byType: {}, totalSize: 0, largestFile: null };
    if (!options.dir) return empty;
    return dirStats(options.dir, {
      recursive: options.recursive ?? true,
      maxDepth: options.maxDepth ?? 10,
    });
  }, []);

  const runIndex = useCallback(async (options: IndexOptions): Promise<MediaFile[]> => {
    if (!options.dir) return [];
    return filterKinds(
      indexDeep(options.dir, {
        recursive: options.recursive ?? true,
        maxDepth: options.maxDepth ?? 10,
        indexArchives: options.indexArchives ?? true,
        archivePattern: options.archivePattern,
      }),
      options.kinds,
    );
  }, []);

  const runQuery = useCallback(async (options: QueryOptions): Promise<MediaFile[]> => {
    if (!options.dir) return [];
    const source = options.source ?? 'scan';
    const items = source === 'index'
      ? await runIndex({
          dir: options.dir,
          recursive: options.recursive,
          maxDepth: options.maxDepth,
          indexArchives: options.indexArchives,
          archivePattern: options.archivePattern,
        })
      : await runScan({
          dir: options.dir,
          recursive: options.recursive,
          maxDepth: options.maxDepth,
        });
    return queryItems(items, options);
  }, [runIndex, runScan]);

  const useScan = (options: ScanOptions) => {
    const [files, setFiles] = useState<MediaFile[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);
    const [version, setVersion] = useState(0);
    const depsKey = JSON.stringify(options);
    const ref = useRef(options);
    ref.current = options;

    useEffect(() => {
      let cancelled = false;
      setLoading(true);
      setError(null);
      runScan(ref.current)
        .then((next) => { if (!cancelled) setFiles(next); })
        .catch((e) => { if (!cancelled) setError(e instanceof Error ? e : new Error(String(e))); })
        .finally(() => { if (!cancelled) setLoading(false); });
      return () => { cancelled = true; };
    }, [version, depsKey]);

    const rescan = useCallback(() => setVersion((v) => v + 1), []);
    return { files, loading, error, rescan };
  };

  const useStats = (options: StatsOptions) => {
    const [stats, setStats] = useState<DirStats>({ total: 0, byType: {}, totalSize: 0, largestFile: null });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);
    const [version, setVersion] = useState(0);
    const depsKey = JSON.stringify(options);
    const ref = useRef(options);
    ref.current = options;

    useEffect(() => {
      let cancelled = false;
      setLoading(true);
      setError(null);
      runStats(ref.current)
        .then((next) => { if (!cancelled) setStats(next); })
        .catch((e) => { if (!cancelled) setError(e instanceof Error ? e : new Error(String(e))); })
        .finally(() => { if (!cancelled) setLoading(false); });
      return () => { cancelled = true; };
    }, [version, depsKey]);

    const rescan = useCallback(() => setVersion((v) => v + 1), []);
    return { stats, loading, error, rescan };
  };

  const useIndex = (options: IndexOptions) => {
    const [index, setIndex] = useState<MediaFile[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);
    const [version, setVersion] = useState(0);
    const depsKey = JSON.stringify(options);
    const ref = useRef(options);
    ref.current = options;

    useEffect(() => {
      let cancelled = false;
      setLoading(true);
      setError(null);
      runIndex(ref.current)
        .then((next) => { if (!cancelled) setIndex(next); })
        .catch((e) => { if (!cancelled) setError(e instanceof Error ? e : new Error(String(e))); })
        .finally(() => { if (!cancelled) setLoading(false); });
      return () => { cancelled = true; };
    }, [version, depsKey]);

    const rescan = useCallback(() => setVersion((v) => v + 1), []);
    return { index, loading, error, rescan };
  };

  const useQuery = (options: QueryOptions) => {
    const [results, setResults] = useState<MediaFile[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);
    const [version, setVersion] = useState(0);
    const depsKey = JSON.stringify(options);
    const ref = useRef(options);
    ref.current = options;

    useEffect(() => {
      let cancelled = false;
      setLoading(true);
      setError(null);
      runQuery(ref.current)
        .then((next) => { if (!cancelled) setResults(next); })
        .catch((e) => { if (!cancelled) setError(e instanceof Error ? e : new Error(String(e))); })
        .finally(() => { if (!cancelled) setLoading(false); });
      return () => { cancelled = true; };
    }, [version, depsKey]);

    const refetch = useCallback(() => setVersion((v) => v + 1), []);
    return { results, loading, error, refetch };
  };

  return {
    scan: runScan,
    stats: runStats,
    index: runIndex,
    query: runQuery,
    useScan,
    useStats,
    useIndex,
    useQuery,
    classifyFile,
    formatSize,
  };
}
