# V8 Postgres Pipeline

Last updated: 2026-05-04

This document traces the Postgres path end to end: build-time gates, JS API,
V8 host bindings, Zig pool/server lifecycle, SQL execution, JSON result
serialization, shipping, and the higher-level cart/database consumers.

## Source Map

| Layer | Files | Role |
| --- | --- | --- |
| Build gates | `build.zig`, `v8_app.zig`, `scripts/ship` | Decide whether `__pg_*` host functions are registered and shipped. |
| Runtime FFI | `runtime/ffi.ts` | Optional host-call helpers and JSON parsing. |
| Public JS API | `runtime/hooks/pg.ts`, `runtime/hooks/usePostgres.ts` | Functional API, OO wrapper, and React hook. |
| V8 bridge | `framework/v8_bindings_pg.zig` | Converts V8 arguments to Zig strings/ints and registers globals. |
| Postgres core | `framework/pg.zig` | Owns pools, embedded server startup, `exec`, `queryJson`, and `changes`. |
| Dev/shipping | `scripts/dev`, `scripts/stage-pg-bundle`, `scripts/ship` | Prewarms embedded Postgres in dev and packages the server binaries. |
| App DB wrapper | `cart/app/db/*.ts` | Bucket databases, JSONB CRUD schema, bootstrap, SQL escaping. |
| Vector store | `runtime/hooks/embed.ts`, `framework/embed.zig` | Uses the same default Postgres pool for pgvector-backed embeddings. |

## Executive Flow

1. A cart imports `runtime/hooks/pg.ts`, `runtime/hooks/usePostgres.ts`, or a
   higher-level wrapper that depends on them.
2. `scripts/ship` sees that dependency and builds with `-Dhas-pg=true`.
   `-Dhas-embed=true` also implies `has-pg` because the embedding store uses
   pgvector through `framework/pg.zig`.
3. `v8_app.zig` imports `framework/v8_bindings_pg.zig` only when
   `build_options.has_pg` is true. Otherwise `registerPg` is an empty stub.
4. During host startup, the V8 ingredient table registers the optional `pg`
   ingredient by calling `registerPg`, which installs five globals:
   `__pg_connect`, `__pg_close`, `__pg_exec`, `__pg_query_json`,
   `__pg_changes`.
5. JS calls `pg.connect(uri)` or `usePostgres({ uri })`.
6. The TS API calls `globalThis.__pg_connect(uri)` through `callHost`.
7. The V8 callback copies the URI into Zig memory and calls
   `framework/pg.zig`'s `connect(uri)`.
8. `connect` reuses a cached pool for the same URI if one exists. Otherwise it
   allocates one of 31 usable handle slots.
9. Empty URI means framework-owned embedded Postgres. Explicit URI means
   `pg.Pool.initUri`.
10. Embedded Postgres first tries the live unix socket. If unavailable, it
    initializes the data dir, spawns `postgres`, and waits until the socket
    accepts a connection.
11. JS calls `pg.exec` or `pg.query`. SQL crosses as a string. The `paramsJson`
    argument also crosses as a string but is currently ignored by Zig.
12. `exec` returns `true` or `false` and records the affected-row count for
    `changes`.
13. `queryJson` serializes all selected rows into one JSON array string.
14. `runtime/ffi.ts` parses that string through `callHostJson`, returning
    `T[]` to the cart.

## Build And Registration

### `build.zig`

`build.zig` defines:

```text
-Dhas-pg     Register __pg_* bindings.
-Dhas-embed  Register __embed_* bindings; implies Postgres at runtime.
```

The `pg` Zig dependency is cheap and may be present in the build graph even
when `-Dhas-pg=false`; the flag controls whether V8 host functions are exposed.

### `v8_app.zig`

`v8_app.zig` gates the binding import:

```zig
const HAS_PG = if (@hasDecl(build_options, "has_pg")) build_options.has_pg else false;
const v8_bindings_pg = if (HAS_PG) @import("framework/v8_bindings_pg.zig") else struct {
    pub fn registerPg(_: anytype) void {}
};
```

The ingredient table contains:

```zig
.{ .name = "pg", .required = false, .grep_prefix = "__pg_", .reg_fn = "registerPg", .mod = v8_bindings_pg },
```

So the `pg` ingredient is optional. When the flag is absent, calls through the
JS helpers degrade through fallback values instead of throwing.

### `scripts/ship`

`scripts/ship` asks the dependency resolver whether the cart references
Postgres hooks. If `WANT_PG=1` or `WANT_EMBED=1`, it passes:

```text
-Dhas-pg=true
```

It also reports the trigger as:

```text
pg: runtime/hooks/pg.ts or runtime/hooks/usePostgres.ts
```

If `<repo>/.pg-bundle` exists, `scripts/ship` packages it into the shipped
payload under `pg/`. A shipped app without a bundle can still work on systems
where `framework/pg.zig` can find compatible Postgres binaries and share files.

## JavaScript API Surface

### `runtime/ffi.ts`

Postgres uses the generic optional-host helpers:

```ts
hasHost(name): boolean
callHost<T>(name, fallback, ...args): T
callHostJson<T>(name, fallback, ...args): T
```

`callHost` returns the fallback when the host function is missing or throws.
`callHostJson` calls a host function expecting a JSON string, parses it, and
returns the fallback on missing host, null return, thrown error, or invalid
JSON.

This means the public Postgres API is intentionally non-throwing at this layer:

| Failure | JS return |
| --- | --- |
| Missing `__pg_connect` | `connect()` returns `0`; `isAvailable()` is `false`. |
| Failed connect | `connect()` returns `0`. |
| Failed exec | `exec()` returns `false`. |
| Failed query | `query()` returns `[]`. |
| Failed changes lookup | `changes()` returns `0`. |

### `runtime/hooks/pg.ts`

Exports:

```ts
export type PgHandle = number;

export function isAvailable(): boolean;
export function connect(uri = ''): PgHandle;
export function close(handle: PgHandle): void;
export function exec(handle: PgHandle, sql: string, params: any[] = []): boolean;
export function query<T = Record<string, any>>(handle: PgHandle, sql: string, params: any[] = []): T[];
export function changes(handle: PgHandle): number;

export class Pg {
  static open(uri = ''): Pg | null;
  exec(sql: string, params?: any[]): boolean;
  query<T = Record<string, any>>(sql: string, params?: any[]): T[];
  changes(): number;
  close(): void;
}
```

Semantics:

- `uri === ''` connects to the framework-owned embedded Postgres.
- Non-empty `uri` connects to an external/system Postgres through
  `pg.Pool.initUri`.
- Handles are numeric slot indexes owned by `framework/pg.zig`; `0` is failure
  and invalid.
- The same URI reuses the same Zig-side pool handle until it is closed.
- `query` always materializes the full result into a JS array.

Important mismatch: the header comment in `runtime/hooks/pg.ts` says `params`
are bound to typed Postgres parameters. The current V8/Zig implementation does
not do that. `params` is accepted and forwarded as JSON only to preserve the
future API shape; `framework/pg.zig` ignores it.

### `runtime/hooks/usePostgres.ts`

Exports:

```ts
export interface UsePostgresOpts {
  uri?: string;
}

export function usePostgres(opts?: UsePostgresOpts): {
  ready: boolean;
  error: string | null;
  query<T = Record<string, any>>(sql: string, params?: any[]): T[];
  exec(sql: string, params?: any[]): boolean;
  changes(): number;
};
```

Lifecycle:

1. On mount, check `pg.isAvailable()`.
2. Call `pg.connect(opts.uri ?? '')`.
3. Store the handle in a ref and set `ready=true`.
4. On unmount, call `pg.close(handle)`.

Because Zig pools are cached by URI and `close` has no reference count, be
careful using `usePostgres` from multiple components with the same URI. One
component unmounting can close a pool that another component still expects.
Cart-level shared connection managers should open once and avoid per-component
close behavior.

## V8 Host API Surface

`framework/v8_bindings_pg.zig` registers:

| Host function | Args | Return | Zig target |
| --- | --- | --- | --- |
| `__pg_connect` | `(uri: string)` | `number` handle or `0` | `fpg.connect(uri)` |
| `__pg_close` | `(handle: number)` | `void` | `fpg.close(handle)` |
| `__pg_exec` | `(handle, sql, paramsJson)` | `boolean` | `fpg.exec(handle, sql, paramsJson)` |
| `__pg_query_json` | `(handle, sql, paramsJson)` | `string` JSON rows | `fpg.queryJson(allocator, handle, sql, paramsJson)` |
| `__pg_changes` | `(handle)` | `number` | `fpg.changes(handle)` |

Argument conversion:

- `argStringAlloc` converts V8 values to UTF-8 strings using
  `toString(ctx)` and `writeUtf8`.
- `argI32` converts handles with `toI32(ctx)`.
- Strings are allocated with `std.heap.page_allocator` in the binding layer and
  freed after the call.
- Query JSON returned from `framework/pg.zig` is allocated with the binding
  allocator, passed to V8 as a string, then freed.

Error behavior at this layer:

- Bad handle to `exec` returns `false`.
- Bad handle to `query` returns `"[]"`.
- Missing SQL argument returns `false` or `"[]"`.
- `fpg.queryJson` error returns `"[]"`.
- No detailed error object crosses into JS.

`tickDrain()` exists for ingredient parity but is a no-op. There is no async
Postgres drain loop today; every Postgres call is synchronous on the JS turn.

## Zig Core: `framework/pg.zig`

### Handles And Pools

The module owns:

```zig
const max_handles: usize = 32;

const Slot = struct {
    pool: ?*pg.Pool,
    uri: []u8,
    last_changes: i64,
};
```

Slot `0` is the invalid sentinel returned to JS on failure. Slots `1..31` can
hold pools. A slot is keyed by its exact URI string, and `connect(uri)` returns
an existing slot if the URI is already open.

Each pool is initialized with size `16`. Embedded Postgres is spawned with
`max_connections=300` because multiple bucket databases and embedding workers
can open separate 16-connection pools in one process.

### Default Embedded Connection

The empty URI uses these constants:

```text
data dir : $HOME/.cache/reactjit-embed/embed-pg
socket   : $HOME/.cache/reactjit-embed/embed-pg-sock/.s.PGSQL.5432
role     : embed
database : embed_bench
auth     : trust
network  : unix socket only, listen_addresses=
```

`connectDefault` flow:

1. Build the socket path and data dir from `$HOME`.
2. Try `pg.Pool.init` against the live socket.
3. If that fails, run `initdb` if the data dir is not initialized.
4. Spawn embedded `postgres`.
5. Poll for readiness by repeatedly opening a real pool to the socket for up
   to 30 seconds.

Readiness is not based on socket-file existence. It requires the server to
accept a connection, which avoids stale socket false positives.

### External URI Connection

Non-empty URI uses:

```zig
const parsed = std.Uri.parse(uri) catch return error.ConnectFailed;
return pg.Pool.initUri(a, parsed, .{ .size = 16, .timeout = 10_000 });
```

The URI must be compatible with Zig `std.Uri` and the `pg` package's
`Pool.initUri`. Some libpq-style query parameters may not be accepted.

### Binary And Share Resolution

For embedded startup, `framework/pg.zig` needs `postgres`, `initdb`, and the
Postgres `share` tree. It resolves a bundle root in this order:

1. `RJIT_PG_BUNDLE`
2. `<exe-dir>/.pg-bundle`
3. `<exe-dir>/../.pg-bundle`
4. `<exe-dir>/../../.pg-bundle`
5. `<exe-dir>/pg`

Then it falls back to system paths:

```text
/usr/lib/postgresql/{17,16,15,14}/bin
/opt/homebrew/opt/postgresql@{17,16,15}/bin
/opt/homebrew/bin
/usr/local/bin
/usr/bin
```

The share tree is resolved similarly, preferring bundled
`share/postgresql` and then common system share directories.

When a share tree is found, `PGSHAREDIR` is set for `initdb` and `postgres`.

### Initdb

`runInitdb` is idempotent. It checks for `PG_VERSION` in the data dir and skips
if present. Otherwise it runs:

```text
initdb -D <data_dir> -U embed -A trust -E UTF8 --locale=C --no-sync
```

stdout is ignored and stderr is inherited so initialization failures are visible
in the host terminal.

### Spawn

`spawnEmbeddedPostgres`:

1. Ensures data and socket directories exist.
2. Checks `postmaster.pid`; deletes it only when the PID is not live.
3. Never deletes socket files, because removing a live server's socket would
   strand the process.
4. Runs:

```text
postgres -D <data_dir> -k <socket_dir> -c listen_addresses= -c max_connections=300
```

The child stdio is ignored and the process is left detached.

### Close

`close(handle)` deinitializes the pool, frees the URI string, and clears the
slot. There is no reference count. If several JS owners share a URI and one
calls `close`, the shared pool slot is invalidated for all of them.

### Exec

```zig
pub fn exec(handle: usize, sql: []const u8, _: []const u8) bool
```

Behavior:

- Looks up the pool by handle.
- Calls `pool.exec(sql, .{})`.
- Stores affected row count in `slots[handle].last_changes`.
- Returns `true` on success and `false` on invalid handle or query failure.

The third argument is currently ignored. No parameters are bound.

### Changes

```zig
pub fn changes(handle: usize) i64
```

Returns the affected-row count from the last successful `exec` on that handle,
or `0` for invalid handles.

### Query JSON

```zig
pub fn queryJson(out_alloc, handle, sql, _: []const u8) ![]u8
```

Behavior:

1. Looks up the pool by handle.
2. Calls `pool.queryOpts(sql, .{}, .{ .column_names = true })`.
3. Builds a JSON array string.
4. Emits each row as an object keyed by Postgres column name.
5. Returns an owned JSON string to the V8 binding.

Column value encoding tries these types in order:

1. `?i64`
2. `?f64`
3. `?bool`
4. `?[]const u8`

If none decode, the value is emitted as `null`. Text-like values are JSON
escaped strings. Numeric and boolean values are JSON primitives.

The whole result set is serialized into memory before JS receives it. Large
queries must paginate in SQL.

## Dev And Shipping Pipeline

### `scripts/stage-pg-bundle`

This script stages a local system Postgres install into:

```text
<repo>/.pg-bundle/
```

It copies:

```text
bin/postgres
bin/initdb
bin/pg_ctl
share/postgresql/
lib/postgresql/vector.so   # optional, required for pgvector embeddings
```

It writes `.pg-bundle/.stamp` with the source signature and is idempotent when
the detected source has not changed.

Run this when you want dev and shipped apps to avoid relying on a system
Postgres installation at runtime.

### `scripts/dev`

The dev launcher prewarms embedded Postgres before starting the app. This
exists because `pg.connect('')` is synchronous; otherwise the first React tick
that touches Postgres pays the cold `initdb` or server-start cost.

Dev prewarm:

1. Resolve `.pg-bundle` first, then system Postgres.
2. Check `pg_ctl -D <data_dir> status`.
3. Clear stale `postmaster.pid` only if the PID is dead.
4. Initialize the data dir on first run.
5. Start with:

```text
pg_ctl -D <data_dir> -l <data_dir>/pg.log \
  -o "-k <socket_dir> -c listen_addresses= -c max_connections=300" \
  -w start
```

The Zig-side auto-spawn path remains the fallback for shipped apps and any
launch path that does not use `scripts/dev`.

### `scripts/ship`

When Postgres is enabled and `.pg-bundle` exists, the bundle is included in the
self-extracting shipped app under `pg/`. `framework/pg.zig` checks that path as
one of its bundle-relative locations.

## Cart App DB Layer

The active app has a higher-level database layer in `cart/app/db`.

### Connection Manager

`cart/app/db/connections.ts` wraps `runtime/hooks/pg.ts` and manages bucket
connections.

Notable behavior:

- It calls `pg.connect('')` first to ensure the default embedded cluster is
  running.
- It constructs bucket URIs using the full encoded socket file path because
  the current URI parser path does not accept all libpq query parameter forms.
- It intentionally keeps handles open because `pg.close()` has no reference
  counting and pools are shared by URI.
- It exposes `query`, `exec`, and `changes` helpers for bucket/entity code.

Some comments in this area say `framework/pg.zig` does not run `initdb`. That
is stale for the current source: `connectDefault` does run `initdb` when
`PG_VERSION` is missing.

### Bootstrap

`cart/app/db/bootstrap.ts` ensures the DB shape exists:

1. Opens the cluster/default DB.
2. Creates missing bucket databases.
3. Creates missing entity tables.

The tables store records as JSONB blobs with metadata columns.

### SQL Escaping

`cart/app/db/sql.ts` contains literal and identifier escaping helpers because
the raw Postgres API does not bind parameters yet.

This is the correct current pattern for dynamic values:

- Use identifier escaping for table/column names.
- Use literal escaping for strings.
- Serialize objects to JSON and cast/use JSONB intentionally.
- Do not rely on the `params` array in `pg.exec` or `pg.query`.

### CRUD

`cart/app/db/useCRUD.ts` provides a Postgres-backed CRUD hook compatible with
the local-store style API.

Storage model:

```sql
id TEXT PRIMARY KEY,
data JSONB,
created_at TIMESTAMP,
updated_at TIMESTAMP
```

Filtering, sorting, and pagination are mostly performed in JS after SELECT,
so callers should be careful with large tables until those operations move
deeper into SQL.

## Pgvector Consumer

The embedding API has a vector store path in:

```text
runtime/hooks/embed.ts
framework/embed.zig
```

It does not start or own a separate Postgres server. `framework/embed.zig`
calls:

```zig
const pool = fpg.defaultPool() orelse return error.PoolUnavailable;
```

`defaultPool()` calls `connect("")` and returns the shared embedded pool. This
means embedding upserts/searches and ad-hoc `pg.connect('')` users share the
same framework-owned embedded cluster.

The vector store:

- Creates one table per model slug, named `chunks_<sanitized_slug>`.
- Uses a `vector(<dim>)` column.
- Creates a source index and best-effort HNSW indexes.
- Upserts by constructing SQL literals itself.
- Searches with `ORDER BY vector <=> '<array>'::vector`.

`scripts/stage-pg-bundle` tries to include `vector.so`. The share tree must
also include the extension SQL/control files for pgvector to be usable.

## Public Contract

### Stable Today

- `pg.isAvailable()` detects whether the build registered Postgres.
- `pg.connect('')` opens the embedded local cluster.
- `pg.connect(uri)` opens an explicit Postgres URI.
- `pg.exec(handle, sql)` runs DDL/write SQL.
- `pg.query<T>(handle, sql)` returns all selected rows as `T[]`.
- `pg.changes(handle)` returns affected rows from the last `exec`.
- `usePostgres` opens on mount and closes on unmount.
- The default embedded cluster is local-only socket Postgres with trust auth.

### Not Stable Or Not Implemented Yet

- Parameter binding is not implemented. `paramsJson` is ignored in Zig.
- No async Postgres API exists. `tickDrain` is empty.
- Detailed errors are not propagated into JS.
- Pool close is not reference-counted.
- Handles are capped at 31 concurrent URI slots.
- Result streaming is not implemented; query results are serialized wholesale.

## Review Notes

### 1. `params` documentation is wrong at the TS surface

`runtime/hooks/pg.ts` documents typed parameter binding, but
`framework/v8_bindings_pg.zig` explicitly says `paramsJson` is reserved for a
future upgrade and ignored. `framework/pg.zig` also names the third argument
`_` in both `exec` and `queryJson`.

Impact: callers that pass user-controlled values in `params` are not protected.
Use `cart/app/db/sql.ts` escaping helpers or implement real parameter binding
before exposing this as a general SQL API.

### 2. `usePostgres` can close shared URI pools too early

`framework/pg.zig` reuses a pool slot for identical URI strings. `usePostgres`
closes its handle on unmount. If two components mount the same URI and one
unmounts, it can deinitialize the shared pool out from under the other.

Impact: app-level connection managers should own Postgres handles. Component
hooks should either use a shared manager or the Zig layer should gain reference
counts.

### 3. Query errors collapse to empty arrays

`__pg_query_json` returns `"[]"` for invalid handles, bad SQL, query errors,
and empty result sets. `callHostJson` also returns `[]` for invalid JSON.

Impact: callers cannot distinguish "no rows" from "query failed" without
external logging.

### 4. The API is synchronous

Startup, connect, exec, query, and JSON serialization all happen on the JS
turn. `scripts/dev` mitigates cold embedded startup by prewarming Postgres, but
large queries or first-run shipped app startup can still block rendering.

### 5. Large result sets have a high memory cost

Rows are materialized by `pg.zig`, serialized into one JSON string, copied into
V8, parsed into JS objects, then returned as an array.

Impact: use `LIMIT`, keyset pagination, or specialized query APIs for large
tables.

### 6. Stale cart comments should be corrected

Some `cart/app/db` comments say the framework will not run `initdb`. Current
`framework/pg.zig` does run `initdb` when the embedded data dir lacks
`PG_VERSION`.

## Minimal Examples

### Raw API

```ts
import * as pg from '../../runtime/hooks/pg';

const h = pg.connect('');
if (!h) throw new Error('postgres unavailable');

pg.exec(h, 'CREATE TABLE IF NOT EXISTS notes (id TEXT PRIMARY KEY, body TEXT)');
pg.exec(h, "INSERT INTO notes (id, body) VALUES ('a', 'hello') ON CONFLICT (id) DO UPDATE SET body = excluded.body");

const rows = pg.query<{ id: string; body: string }>(h, 'SELECT id, body FROM notes ORDER BY id LIMIT 20');
```

### Hook API

```tsx
import { usePostgres } from '../../runtime/hooks/usePostgres';

export function NotesCount() {
  const db = usePostgres();
  if (!db.ready) return <Text>{db.error ?? 'loading'}</Text>;

  const rows = db.query<{ count: number }>('SELECT COUNT(*)::bigint AS count FROM notes');
  return <Text>{String(rows[0]?.count ?? 0)}</Text>;
}
```

### Current Dynamic SQL Pattern

```ts
import { lit, ident } from './db/sql';

const table = ident('notes');
const id = lit(userSuppliedId);
const rows = query(`SELECT data FROM ${table} WHERE id = ${id} LIMIT 1`);
```

Do not write this expecting binding to happen:

```ts
pg.query(h, 'SELECT data FROM notes WHERE id = $1', [userSuppliedId]);
```

The `$1` will reach Postgres unresolved because the params array is currently
ignored.
