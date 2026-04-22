const React: any = require('react');
const { useState, useEffect, useCallback } = React;

import { SQLiteDB } from './sqlite';

export interface MigrationRecord {
  version: number;
  name: string;
  applied_at: string;
}

export interface UseMigrationsOptions {
  db: SQLiteDB;
  migrations: Array<{ version: number; name: string; sql: string }>;
}

/** Run version-stamped migrations against a SQLiteDB. */
export function useMigrations(options: UseMigrationsOptions) {
  const { db, migrations } = options;
  const [currentVersion, setCurrentVersion] = useState(0);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const run = useCallback(async () => {
    setError(null);
    try {
      await db.exec(`
        CREATE TABLE IF NOT EXISTS _migrations (
          version INTEGER PRIMARY KEY,
          name TEXT,
          applied_at TEXT DEFAULT (datetime('now'))
        )
      `);

      const rows = await db.query<{ version: number }>(
        'SELECT version FROM _migrations ORDER BY version DESC LIMIT 1'
      );
      let version = rows.length > 0 ? rows[0].version : 0;

      for (const m of migrations) {
        if (m.version > version) {
          await db.exec(m.sql);
          await db.exec(
            'INSERT INTO _migrations (version, name) VALUES (?, ?)',
            [m.version, m.name]
          );
          version = m.version;
        }
      }

      setCurrentVersion(version);
      setReady(true);
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)));
      setReady(false);
    }
  }, [db, migrations]);

  useEffect(() => {
    run();
  }, [run]);

  return { currentVersion, ready, error, rerun: run };
}
