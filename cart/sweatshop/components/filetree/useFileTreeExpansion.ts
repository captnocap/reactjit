// ── Persisted Expand/Collapse State ──────────────────────────────────


const host: any = globalThis;
const storeGet = typeof host.__store_get === 'function' ? host.__store_get : (_: string) => null;
const storeSet = typeof host.__store_set === 'function' ? host.__store_set : (_: string, __: string) => {};

const EXPANSION_KEY = 'sweatshop.filetree.expansion';

function loadExpanded(): Set<string> {
  try {
    const raw = storeGet(EXPANSION_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return new Set(parsed);
  } catch {}
  return new Set();
}

function saveExpanded(set: Set<string>) {
  try {
    storeSet(EXPANSION_KEY, JSON.stringify(Array.from(set)));
  } catch {}
}

export interface FileTreeExpansion {
  expandedPaths: Set<string>;
  togglePath: (path: string) => void;
  expandPath: (path: string) => void;
  collapsePath: (path: string) => void;
  expandAll: (paths: string[]) => void;
  collapseAll: () => void;
  isExpanded: (path: string) => boolean;
}

export function useFileTreeExpansion(): FileTreeExpansion {
  const ref = useRef<Set<string>>(loadExpanded());

  const persist = useCallback(() => {
    saveExpanded(ref.current);
  }, []);

  const togglePath = useCallback((path: string) => {
    const next = new Set(ref.current);
    if (next.has(path)) next.delete(path);
    else next.add(path);
    ref.current = next;
    persist();
  }, [persist]);

  const expandPath = useCallback((path: string) => {
    if (ref.current.has(path)) return;
    const next = new Set(ref.current);
    next.add(path);
    ref.current = next;
    persist();
  }, [persist]);

  const collapsePath = useCallback((path: string) => {
    if (!ref.current.has(path)) return;
    const next = new Set(ref.current);
    next.delete(path);
    ref.current = next;
    persist();
  }, [persist]);

  const expandAll = useCallback((paths: string[]) => {
    const next = new Set(ref.current);
    for (const p of paths) next.add(p);
    ref.current = next;
    persist();
  }, [persist]);

  const collapseAll = useCallback(() => {
    ref.current = new Set();
    persist();
  }, [persist]);

  const isExpanded = useCallback((path: string) => ref.current.has(path), []);

  return {
    expandedPaths: ref.current,
    togglePath,
    expandPath,
    collapsePath,
    expandAll,
    collapseAll,
    isExpanded,
  };
}
