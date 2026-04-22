// ── Schema (Zod-inspired) ───────────────────────────────
export { z, ValidationError, type Infer, type SafeParseResult } from './schema';
export type { Schema, ValidationIssue } from './schema';

// ── Types ───────────────────────────────────────────────
export type {
  StorageAdapter,
  StorageFormat,
  Query,
  WhereClause,
  ComparisonOp,
  MigrationFn,
  MigrationConfig,
  CRUDHandle,
  CRUDOptions,
} from './types';

// ── SQLite ──────────────────────────────────────────────
export { SQLiteDB, openDB, type SQLiteOptions, type DbHandle } from './sqlite';

// ── DocStore ────────────────────────────────────────────
export { DocStore, type DocStoreOptions } from './doc-store';

// ── Query engine ────────────────────────────────────────
export { applyQuery } from './query';

// ── Migrations ──────────────────────────────────────────
export { createMigratingAdapter, migrateRecord, stampVersion, getLatestVersion } from './migrations';

// ── Format utilities ────────────────────────────────────
export { parseContent, serializeContent, formatExtension, detectFormat } from './format';

// ── Adapters ────────────────────────────────────────────
export { LocalStoreAdapter } from './indexeddb';

// ── Hooks ───────────────────────────────────────────────
export { useSQLite } from './useSQLite';
export { useDocStore, type DocStoreHandle } from './useDocStore';
export { useQuery } from './useQuery';
export { useMigrations, type UseMigrationsOptions } from './useMigrations';
