// Tool-permission grant store. Persisted to the `user` bucket so a
// grant survives session resets but doesn't cross user identities.
//
// Wildcard matching:
//   tool:  exact OR '*' (any tool)
//   scope: exact, '*' (any), OR `prefix*` (prefix match — used for
//          path-shaped scopes like `/settings/*`).
//
// Lookups are sync against an in-memory mirror. Mutations write through
// to pg and update the mirror. The mirror loads lazily on first
// check/grant call and can be force-reloaded via `reloadGrants()`.

import * as React from 'react';
import * as pgConn from '../db/connections';
import { ensureBootstrapped } from '../db/bootstrap';
import { ident, lit, tableName, val } from '../db/sql';
import type { ToolPermission, ToolScope } from './types';

const TABLE = ident(tableName('tool-permission'));

let _grants: ToolPermission[] = [];
let _loaded = false;
let _loadingPromise: Promise<void> | null = null;

const _subs = new Set<() => void>();
function _notify(): void { for (const s of _subs) s(); }
function _subscribe(fn: () => void): () => void {
  _subs.add(fn);
  return () => { _subs.delete(fn); };
}
function _getGrants(): ToolPermission[] { return _grants; }

function _readFromPg(): ToolPermission[] {
  const rows = pgConn.query<{ data: any }>(
    'user',
    `SELECT data FROM ${TABLE}`,
  );
  return rows.map(r => {
    const d = typeof r.data === 'string' ? JSON.parse(r.data) : r.data;
    return d as ToolPermission;
  });
}

function _writeToPg(g: ToolPermission): void {
  const sql =
    `INSERT INTO ${TABLE} (id, data) VALUES (${val(g.id)}, ${val(g)}) ` +
    `ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()`;
  if (!pgConn.exec('user', sql)) {
    throw new Error(`tool-permission: persist ${g.id} failed`);
  }
}

function _deleteFromPg(id: string): void {
  pgConn.exec('user', `DELETE FROM ${TABLE} WHERE id = ${lit(id)}`);
}

/** Lazy load. Idempotent; safe to await many times. */
export async function ensureGrantsLoaded(): Promise<void> {
  if (_loaded) return;
  if (_loadingPromise) return _loadingPromise;
  _loadingPromise = (async () => {
    try {
      await ensureBootstrapped();
      _grants = _readFromPg();
      _loaded = true;
      _notify();
    } finally {
      _loadingPromise = null;
    }
  })();
  return _loadingPromise;
}

export function reloadGrants(): void {
  _grants = _readFromPg();
  _notify();
}

/** True iff the grant covers the call. Wildcards described above. */
function matchesGrant(grant: ToolPermission, call: ToolScope): boolean {
  if (grant.tool !== '*' && grant.tool !== call.tool) return false;
  if (grant.scope === '*' || grant.scope === call.scope) return true;
  if (grant.scope.endsWith('*')) {
    const prefix = grant.scope.slice(0, -1);
    return call.scope.startsWith(prefix);
  }
  return false;
}

function _isExpired(g: ToolPermission, now: Date): boolean {
  if (!g.expires_at) return false;
  return new Date(g.expires_at) <= now;
}

/** Sync check. Returns false (deny) if grants haven't loaded yet —
 *  callers should `await ensureGrantsLoaded()` once at startup so this
 *  is fast and accurate from then on. */
export function checkPermission(call: ToolScope): boolean {
  const now = new Date();
  for (const g of _grants) {
    if (_isExpired(g, now)) continue;
    if (matchesGrant(g, call)) return true;
  }
  return false;
}

export interface GrantOptions {
  expires_at?: string | null;
  note?: string;
}

/** Persist a new grant. The mirror updates immediately so subsequent
 *  checkPermission calls see it. Re-granting the same (tool, scope)
 *  pair is allowed — it produces a new row with a fresh granted_at; the
 *  caller can then revoke older rows if they want a single source of
 *  truth, but for now we keep them all (audit trail). */
export async function grantPermission(call: ToolScope, opts: GrantOptions = {}): Promise<ToolPermission> {
  await ensureGrantsLoaded();
  const id = `tpm_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
  const grant: ToolPermission = {
    id,
    tool: call.tool,
    scope: call.scope,
    granted_at: new Date().toISOString(),
    expires_at: opts.expires_at ?? null,
    note: opts.note,
  };
  _writeToPg(grant);
  _grants = [..._grants, grant];
  _notify();
  return grant;
}

/** Drop a single grant by id. Used by future "revoke" UI. */
export async function revokePermission(id: string): Promise<void> {
  await ensureGrantsLoaded();
  _deleteFromPg(id);
  _grants = _grants.filter(g => g.id !== id);
  _notify();
}

/** All currently-active grants (newest first). Used by `list-tools`
 *  to surface "what does the assistant currently have access to" in
 *  the system-prompt context. */
export function activeGrants(): ToolPermission[] {
  const now = new Date();
  return _grants
    .filter(g => !_isExpired(g, now))
    .slice()
    .sort((a, b) => b.granted_at.localeCompare(a.granted_at));
}

/** Hook — reactive view of activeGrants for UI surfaces. */
export function useGrants(): ToolPermission[] {
  React.useEffect(() => { void ensureGrantsLoaded(); }, []);
  return React.useSyncExternalStore(_subscribe, _getGrants, _getGrants);
}
