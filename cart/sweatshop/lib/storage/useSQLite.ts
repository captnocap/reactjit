const React: any = require('react');
const { useMemo, useEffect } = React;

import { SQLiteDB, type SQLiteOptions } from './sqlite';

/** Open a SQLite database and keep it alive for the component lifetime. */
export function useSQLite(options?: SQLiteOptions): SQLiteDB {
  const db = useMemo(() => new SQLiteDB(options), [options?.dbPath]);

  useEffect(() => {
    return () => { db.close(); };
  }, [db]);

  return db;
}
