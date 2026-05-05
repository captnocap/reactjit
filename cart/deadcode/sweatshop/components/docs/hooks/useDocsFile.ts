import { useEffect, useMemo, useState } from 'react';
import { readFile } from '../../../host';

const host: any = globalThis as any;

export type DocsFileSnapshot = {
  path: string;
  source: string;
  mtimeMs: number;
  exists: boolean;
};

function fsStat(path: string): { mtimeMs?: number } | null {
  try {
    if (typeof host.__fs_stat_json !== 'function') return null;
    const raw = host.__fs_stat_json(path);
    return raw ? JSON.parse(String(raw)) : null;
  } catch {
    return null;
  }
}

function loadFile(path: string): DocsFileSnapshot {
  const clean = String(path || '').trim();
  if (!clean) return { path: '', source: '', mtimeMs: 0, exists: false };
  const source = readFile(clean);
  const stat = fsStat(clean);
  return {
    path: clean,
    source,
    mtimeMs: Number(stat?.mtimeMs || 0),
    exists: !!stat,
  };
}

export function useDocsFile(path: string, revision: number) {
  const [snapshot, setSnapshot] = useState<DocsFileSnapshot>(() => loadFile(path));

  useEffect(() => {
    setSnapshot(loadFile(path));
  }, [path, revision]);

  const reload = useMemo(() => () => setSnapshot(loadFile(path)), [path]);

  return { ...snapshot, reload };
}
