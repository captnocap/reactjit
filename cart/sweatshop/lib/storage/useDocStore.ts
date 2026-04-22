const React: any = require('react');
const { useMemo, useEffect, useState, useCallback } = React;

import { DocStore } from './doc-store';
import type { DocStoreOptions } from './doc-store';

export interface DocStoreHandle {
  get(collection: string, id: string): Promise<any | null>;
  set(collection: string, id: string, data: any): Promise<void>;
  delete(collection: string, id: string): Promise<boolean>;
  list(collection: string): Promise<any[]>;
}

/** Hook wrapping DocStore with a version bump for reactive re-query. */
export function useDocStore(options?: DocStoreOptions) {
  const store = useMemo(() => new DocStore(options), [options?.dbPath]);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    return () => { store.close(); };
  }, [store]);

  const bump = useCallback(() => setVersion(v => v + 1), []);

  const get = useCallback(async (collection: string, id: string) => {
    return store.get(collection, id);
  }, [store]);

  const set = useCallback(async (collection: string, id: string, data: any) => {
    await store.set(collection, id, data);
    bump();
  }, [store, bump]);

  const del = useCallback(async (collection: string, id: string) => {
    const ok = await store.delete(collection, id);
    if (ok) bump();
    return ok;
  }, [store, bump]);

  const list = useCallback(async (collection: string) => {
    return store.list(collection);
  }, [store]);

  return { store, get, set, delete: del, list, version, bump };
}
