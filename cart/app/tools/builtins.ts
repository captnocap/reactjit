// Built-in tools that ship with cart/app's foundation.
//
// Registered exactly once per process via registerBuiltinTools() —
// called from the cart entry. Cart-specific extensions (sweatshop's
// goal/task helpers, etc.) live elsewhere and call register() on top
// of these.
//
// Tool naming conventions:
//   - lowercase-dashed (matches our entity names)
//   - `*-entity` for the generic CRUD wrappers; the entity name is an
//     argument so we don't have to hardcode 87 separate tools.
//
// Permission scopes per tool (used by checkPermission via scopeOf):
//   - navigate / getRoute  → path string (or '*' for getRoute)
//   - list-tools / list-entities → '*' (introspection, no per-target gate)
//   - *-entity              → entity name (e.g., 'task', 'settings')

import { busEmit } from '@reactjit/runtime/hooks/useIFTTT';
import { ensureBootstrapped } from '../db/bootstrap';
import { changes, exec, query } from '../db/connections';
import { bucketFor, ENTITY_TO_BUCKET } from '../db/registry';
import { ident, lit, tableName, val } from '../db/sql';
import { listTools, register } from './registry';
import { activeGrants } from './permissions';
import type { Tool } from './types';

// ── route awareness ──────────────────────────────────────────────────

const navigate: Tool<{ path: string }, { path: string }> = {
  name: 'navigate',
  description: 'Navigate the app to a route. Use this to open a section, page, or activity for the user.',
  argsSchema: '{ path: string }  // e.g. "/settings", "/activity/sweatshop"',
  scopeOf: (args) => args?.path ?? '/',
  handler: ({ path }) => {
    if (typeof path !== 'string' || !path.startsWith('/')) {
      throw new Error('navigate: path must start with /');
    }
    busEmit('app:navigate', path);
    return { path };
  },
};

// route lookup is read-only ambient state. We expose it as a tool so
// the model can `getRoute` between turns rather than relying solely on
// the `[Context: …]` prefix the provider injects.
let _currentRouteRef: { current: string } = { current: '/' };
export function setRouteRef(ref: { current: string }): void {
  _currentRouteRef = ref;
}

const getRoute: Tool<Record<string, never>, { path: string }> = {
  name: 'getRoute',
  description: "Read the user's currently active route.",
  argsSchema: '{}',
  scopeOf: () => '*',
  handler: () => ({ path: _currentRouteRef.current }),
};

// ── introspection ────────────────────────────────────────────────────

const listToolsTool: Tool<Record<string, never>, {
  tools: Array<{ name: string; description: string; argsSchema: string }>;
  grants: Array<{ tool: string; scope: string; granted_at: string }>;
}> = {
  name: 'list-tools',
  description: 'Catalog of every tool the assistant can call, plus the user grants currently in effect.',
  argsSchema: '{}',
  scopeOf: () => '*',
  handler: () => ({
    tools: listTools().map(t => ({
      name: t.name,
      description: t.description,
      argsSchema: t.argsSchema,
    })),
    grants: activeGrants().map(g => ({
      tool: g.tool, scope: g.scope, granted_at: g.granted_at,
    })),
  }),
};

const listEntitiesTool: Tool<Record<string, never>, {
  entities: Array<{ name: string; bucket: string }>;
}> = {
  name: 'list-entities',
  description: 'Every data shape registered in this cart (the names usable as the `name` arg of *-entity tools).',
  argsSchema: '{}',
  scopeOf: () => '*',
  handler: () => ({
    entities: Object.entries(ENTITY_TO_BUCKET).map(([name, bucket]) => ({ name, bucket })),
  }),
};

// ── generic CRUD ─────────────────────────────────────────────────────
//
// Mirrors cart/app/db/useCRUD's API but as plain async functions —
// the tool handler can't host a hook. Same JSONB-blob storage; same
// id-as-text PK. We DO NOT validate against a schema here (the
// useCRUD hook does), trusting that the model's call shape matches
// the entity's expected fields. The tool result echoes the row back so
// the model sees what landed.

interface CRUDListArgs {
  name: string;
  query?: {
    where?: Record<string, any>;
    orderBy?: string;
    order?: 'asc' | 'desc';
    limit?: number;
    offset?: number;
  };
}

function _resolve(name: string): { bucket: ReturnType<typeof bucketFor>; t: string } {
  // bucketFor throws a useful error when the entity isn't registered.
  const bucket = bucketFor(name);
  return { bucket, t: ident(tableName(name)) };
}

function _matchesWhere(item: any, where: Record<string, any>): boolean {
  for (const [field, condition] of Object.entries(where)) {
    const v = item[field];
    if (typeof condition !== 'object' || condition === null) {
      if (v !== condition) return false;
      continue;
    }
    for (const [op, expected] of Object.entries(condition as any)) {
      switch (op) {
        case '$eq': if (v !== expected) return false; break;
        case '$ne': if (v === expected) return false; break;
        case '$gt': if (!(v > expected)) return false; break;
        case '$gte': if (!(v >= expected)) return false; break;
        case '$lt': if (!(v < expected)) return false; break;
        case '$lte': if (!(v <= expected)) return false; break;
        case '$in':
          if (!Array.isArray(expected) || !expected.includes(v)) return false;
          break;
        case '$contains':
          if (typeof v === 'string') { if (!v.includes(expected as any)) return false; }
          else if (Array.isArray(v)) { if (!v.includes(expected as any)) return false; }
          else return false;
          break;
      }
    }
  }
  return true;
}

const listEntity: Tool<CRUDListArgs, { rows: any[] }> = {
  name: 'list-entity',
  description: 'List rows of a registered entity. Use list-entities first to discover names.',
  argsSchema: '{ name: string, query?: { where?, orderBy?, order?, limit?, offset? } }',
  scopeOf: (args) => args?.name ?? '*',
  handler: async ({ name, query: q }) => {
    if (!name) throw new Error('list-entity: name required');
    await ensureBootstrapped();
    const { bucket, t } = _resolve(name);
    const rows = query<{ data: any }>(bucket, `SELECT data FROM ${t}`).map(r =>
      typeof r.data === 'string' ? JSON.parse(r.data) : r.data,
    );
    let out = rows;
    if (q?.where) out = out.filter(it => _matchesWhere(it, q.where!));
    if (q?.orderBy) {
      const f = q.orderBy;
      const dir = q.order === 'desc' ? -1 : 1;
      out = out.slice().sort((a, b) => {
        if (a[f] < b[f]) return -1 * dir;
        if (a[f] > b[f]) return 1 * dir;
        return 0;
      });
    }
    if (q?.offset) out = out.slice(q.offset);
    if (q?.limit != null) out = out.slice(0, q.limit);
    return { rows: out };
  },
};

const readEntity: Tool<{ name: string; id: string }, { row: any | null }> = {
  name: 'read-entity',
  description: 'Fetch a single row by id from a registered entity.',
  argsSchema: '{ name: string, id: string }',
  scopeOf: (args) => args?.name ?? '*',
  handler: async ({ name, id }) => {
    if (!name || !id) throw new Error('read-entity: name and id required');
    await ensureBootstrapped();
    const { bucket, t } = _resolve(name);
    const rows = query<{ data: any }>(bucket, `SELECT data FROM ${t} WHERE id = ${lit(id)} LIMIT 1`);
    if (rows.length === 0) return { row: null };
    const d = typeof rows[0].data === 'string' ? JSON.parse(rows[0].data) : rows[0].data;
    return { row: d };
  },
};

const createEntity: Tool<{ name: string; data: any }, { id: string; row: any }> = {
  name: 'create-entity',
  description: 'Insert a new row. If `data.id` is omitted, one is generated.',
  argsSchema: '{ name: string, data: object }',
  scopeOf: (args) => args?.name ?? '*',
  handler: async ({ name, data }) => {
    if (!name) throw new Error('create-entity: name required');
    if (!data || typeof data !== 'object') throw new Error('create-entity: data must be an object');
    await ensureBootstrapped();
    const { bucket, t } = _resolve(name);
    const id = (data.id as string | undefined) ?? `${name}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
    const row = { ...data, id };
    const sql =
      `INSERT INTO ${t} (id, data) VALUES (${val(id)}, ${val(row)}) ` +
      `ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()`;
    if (!exec(bucket, sql)) throw new Error(`create-entity: insert ${name}/${id} failed`);
    return { id, row };
  },
};

const updateEntity: Tool<{ name: string; id: string; patch: any }, { row: any }> = {
  name: 'update-entity',
  description: 'Patch an existing row. Merges `patch` into the existing JSONB blob.',
  argsSchema: '{ name: string, id: string, patch: object }',
  scopeOf: (args) => args?.name ?? '*',
  handler: async ({ name, id, patch }) => {
    if (!name || !id) throw new Error('update-entity: name and id required');
    if (!patch || typeof patch !== 'object') throw new Error('update-entity: patch must be an object');
    await ensureBootstrapped();
    const { bucket, t } = _resolve(name);
    const existing = query<{ data: any }>(bucket, `SELECT data FROM ${t} WHERE id = ${lit(id)} LIMIT 1`);
    if (existing.length === 0) throw new Error(`update-entity: ${name}/${id} not found`);
    const cur = typeof existing[0].data === 'string' ? JSON.parse(existing[0].data) : existing[0].data;
    const merged = { ...cur, ...patch, id };
    const sql = `UPDATE ${t} SET data = ${val(merged)}, updated_at = NOW() WHERE id = ${lit(id)}`;
    if (!exec(bucket, sql)) throw new Error(`update-entity: ${name}/${id} failed`);
    if (changes(bucket) === 0) throw new Error(`update-entity: ${name}/${id} affected zero rows`);
    return { row: merged };
  },
};

const deleteEntity: Tool<{ name: string; id: string }, { id: string }> = {
  name: 'delete-entity',
  description: 'Delete a row by id. Irreversible.',
  argsSchema: '{ name: string, id: string }',
  scopeOf: (args) => args?.name ?? '*',
  handler: async ({ name, id }) => {
    if (!name || !id) throw new Error('delete-entity: name and id required');
    await ensureBootstrapped();
    const { bucket, t } = _resolve(name);
    if (!exec(bucket, `DELETE FROM ${t} WHERE id = ${lit(id)}`)) {
      throw new Error(`delete-entity: ${name}/${id} failed`);
    }
    return { id };
  },
};

// ── registration ─────────────────────────────────────────────────────

let _registered = false;
export function registerBuiltinTools(): void {
  if (_registered) return;
  _registered = true;
  register(navigate);
  register(getRoute);
  register(listToolsTool);
  register(listEntitiesTool);
  register(listEntity);
  register(readEntity);
  register(createEntity);
  register(updateEntity);
  register(deleteEntity);
}
