/**
 * usePostgres — open a Postgres connection (or pool) once, share the handle
 * across the cart, free it on unmount.
 *
 *   const { ready, query, exec } = usePostgres();
 *   const rows = query('SELECT id FROM chunks LIMIT 5');
 *
 * No URI = framework's embedded postgres (auto-spawned, unix socket).
 * Pass an explicit URI for a remote / system postgres.
 *
 * The framework spawns its own postgres on first connect:
 *   data dir : ~/.cache/reactjit-embed/embed-pg/
 *   socket   : ~/.cache/reactjit-embed/embed-pg-sock/.s.PGSQL.5432
 *   role/db  : embed / embed_bench (trust auth, local-only)
 *
 * Exists primarily so embedding-hook + RAG carts have a clean DB surface
 * without each one re-implementing connect/close lifecycle. For ad-hoc
 * queries from anywhere in the cart, the bare functional API in `pg.ts`
 * is fine — it's the same handle either way.
 */

import { useEffect, useRef, useState } from 'react';
import * as pg from './pg';

export interface UsePostgresOpts {
  /**
   * Connection URI. Empty string = framework's embedded postgres (default).
   * Pass `'postgres://user:pass@host:port/db'` for a remote target.
   */
  uri?: string;
}

export function usePostgres(opts: UsePostgresOpts = {}) {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const handleRef = useRef<pg.PgHandle>(0);

  useEffect(() => {
    if (!pg.isAvailable()) {
      setError('pg host bindings not registered (framework/v8_bindings_pg.zig)');
      return;
    }
    const h = pg.connect(opts.uri ?? '');
    if (h === 0) {
      setError('failed to connect to postgres');
      return;
    }
    handleRef.current = h;
    setReady(true);
    return () => {
      if (handleRef.current) pg.close(handleRef.current);
      handleRef.current = 0;
      setReady(false);
    };
  }, [opts.uri]);

  function query<T = Record<string, any>>(sql: string, params: any[] = []): T[] {
    if (!handleRef.current) return [];
    return pg.query<T>(handleRef.current, sql, params);
  }

  function exec(sql: string, params: any[] = []): boolean {
    if (!handleRef.current) return false;
    return pg.exec(handleRef.current, sql, params);
  }

  function changes(): number {
    if (!handleRef.current) return 0;
    return pg.changes(handleRef.current);
  }

  return { ready, error, query, exec, changes };
}
