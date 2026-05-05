
import type { SplitNode } from './SplitLayoutEngine';

const STORAGE_KEY = 'sweatshop.splitEditor.layout';

export function useSplitPersist() {
  const saveLayout = useCallback((tree: SplitNode) => {
    try {
      const host: any = globalThis;
      const json = JSON.stringify(tree);
      if (typeof host.__store_set === 'function') {
        host.__store_set(STORAGE_KEY, json);
      } else if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, json);
      }
    } catch {}
  }, []);

  const loadLayout = useCallback((): SplitNode | null => {
    try {
      const host: any = globalThis;
      let raw: string | null = null;
      if (typeof host.__store_get === 'function') {
        raw = host.__store_get(STORAGE_KEY);
      } else if (typeof localStorage !== 'undefined') {
        raw = localStorage.getItem(STORAGE_KEY);
      }
      if (raw) return JSON.parse(raw);
    } catch {}
    return null;
  }, []);

  return { saveLayout, loadLayout };
}
