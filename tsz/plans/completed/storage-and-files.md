# Storage And File Handling Port Plan

## Goal

Port the mature Love2D storage and filesystem stack into `tsz` without copying the Lua architecture blindly.

The Lua side has a dynamic capability registry, bridge RPC, and JSON-native document flow.
`tsz` has none of those at runtime. It has:

- compile-time codegen in `tsz/compiler/codegen.zig`
- a retained native runtime in `tsz/runtime/`
- scalar/string/array state, not general object state
- narrow FFI support meant for direct C calls, not full database/archive ergonomics

The plan has to preserve behavior where that behavior is solid, but it must remap the surface area to `tsz`-native primitives.

## Lua Reference Implementations

### Persistence

- `love2d/lua/localstore.lua`
  - SQLite-backed namespaced key/value store
  - used by `love2d/packages/core/src/useLocalStore.ts`
  - best reference for "persistent useState"

- `love2d/lua/storage.lua`
  - file CRUD in Love2D save dir
  - JSON, markdown frontmatter, and plain text formats
  - backs `love2d/packages/storage/src/adapters/love2d-files.ts`

- `love2d/lua/sqlite.lua`
  - full SQLite wrapper with prepared statements, binding, retry on BUSY/LOCKED
  - foundation for `localstore`, `docstore`, spellcheck, tile cache

- `love2d/lua/docstore.lua`
  - schema-free document store over SQLite JSON columns
  - Mongo-like query surface: `save/find/findOne/update/remove/count/collections/transaction`

### File Handling

- `love2d/lua/capabilities/filewatcher.lua`
  - poll-based file and directory watcher
  - recursive scan, glob filter, exclude list, interval control
  - emits `onChange` events with `changeType/path/size/mtime`

- `love2d/lua/httpserver.lua`
  - static file serving from OS filesystem
  - directory indexing and cached filtered library index endpoint
  - `indexDirectories()` is the reference for "library browse/index" behavior

- `love2d/lua/archive.lua`
  - libarchive-backed archive inspection
  - robust for `list/readEntry/search/info`
  - important caveat: `extractAll()` is not full extraction yet; it safety-checks paths and reports what would be extracted

### Gating

- `love2d/lua/init.lua`
  - storage-facing modules are permit-gated behind `permit.check("storage")`
  - this matters: `tsz` currently has no equivalent permission boundary

## tsz Reality Check

### What already exists

- `tsz/runtime/state.zig`
  - persistent scalar/string/array state save/restore exists
  - useful as the pattern for `useLocalStore`

- `tsz/runtime/privacy.zig`
  - already uses `std.fs` for real file I/O

- `tsz/runtime/audit.zig`
  - already has a tamper-evident log that sensitive file operations can hook into later

- `tsz/runtime/net/httpserver.zig`
  - already supports static routes and dynamic routes
  - missing Lua's cached library index layer

- `build.zig`
  - already supports linking extra C libraries from `tsz/runtime/ffi_libs.txt`

- `tsz/runtime/net/manager.zig` and `tsz/runtime/net/http.zig`
  - good precedent for background managers that poll each frame and emit events

### Hard constraints

- `.tsz` state is still scalar/string/bool/float/array, not arbitrary JSON objects
- compiler FFI support is too narrow for first-class SQLite or libarchive user APIs
- there is no Love2D-style capability registry for non-visual nodes

Because of that:

- `useLocalStore` ports cleanly now
- raw filesystem APIs port cleanly now
- file watching ports cleanly now
- library indexing ports cleanly now
- archive inspect/read ports cleanly now
- `docstore` does **not** fully port cleanly until `tsz` grows typed object/record support or an explicit JSON value model

## Port Strategy

### Phase 1: Core Filesystem Substrate

Add a small native filesystem layer instead of spreading ad hoc `std.fs` usage everywhere.

New runtime module:

- `tsz/runtime/fs.zig`

Responsibilities:

- app data directory resolution
- path normalization / root confinement
- `stat`, `readText`, `writeText`, `deleteFile`, `makeDir`, `listDir`, `walkDir`
- atomic write helper for persistence
- common error mapping

This module becomes the base for local store, watcher, library indexer, and archive extraction.

### Phase 2: SQLite Foundation + Persistent State

New runtime modules:

- `tsz/runtime/sqlite.zig`
- `tsz/runtime/localstore.zig`

`sqlite.zig` should be a real Zig wrapper over `sqlite3`, modeled on the Lua behavior that matters:

- open/close
- exec/query/scalar
- prepared statement binding
- BUSY/LOCKED retry policy

`localstore.zig` should mirror Lua's namespaced key/value table:

- `(namespace, key) -> JSON/text blob`
- updated timestamp
- single app-local database file

Compiler work:

- add a compiler-recognized `useLocalStore(...)` hook
- support the same value classes `useState` already supports
  - int
  - float
  - bool
  - string
  - integer arrays

Generated behavior:

- create state slot as usual
- load stored value during init
- write through on change, ideally with light debounce/coalescing in the generated loop

This gives `tsz` the most valuable storage win first: preference persistence and restart survival.

### Phase 3: Raw File APIs Before Object CRUD

Do **not** port Lua `storage.lua` as object CRUD first. `tsz` cannot consume arbitrary record-shaped JSON cleanly yet.

Instead add first-class file built-ins backed by `fs.zig`:

- `readTextFile(path)`
- `writeTextFile(path, text)`
- `deleteFile(path)`
- `makeDir(path)`
- `listDir(path)`
- `statPath(path)`

Compiler work:

- recognize these built-ins in expression / handler / effect positions
- conditionally import `fs.zig` when used

Optional follow-up:

- add format helpers for JSON/markdown/text in a separate `storage_format.zig`
- but keep them string-based until typed records exist

This gives real file handling immediately without pretending `@reactjit/storage` parity already exists.

### Phase 4: File Watching

New runtime module:

- `tsz/runtime/fswatch.zig`

Implementation choice:

- start with polling, not OS-native watchers

Reason:

- it matches the Lua behavior closely
- cross-platform scope stays sane
- semantics stay stable across Linux/macOS/Windows

Behavior to preserve:

- watch file or directory
- recursive or shallow
- glob filter
- exclude directories
- interval-based scan
- emit created / modified / deleted change records

Surface in `tsz`:

- prefer a compiler-recognized hook, not a fake visual node
- shape should be `useFileWatch(path, options, handler)` or equivalent

Compiler/runtime pattern:

- generate a stable watcher ID
- register watcher at init
- poll manager in the main loop
- dispatch callback when change events arrive

This should reuse the same event-manager style already used by `runtime/net/*.zig`.

### Phase 5: Library Indexing And Static Serving

New runtime module:

- `tsz/runtime/library_index.zig`

Responsibilities:

- walk directories
- collect `name/path/relPath/size/modified/ext/category/dir`
- aggregate totals by category and by directory
- cache last index result
- support filtering by type, directory, and query text

Use existing runtime:

- extend `tsz/runtime/net/httpserver.zig`

Needed additions there:

- cached index payload on the server
- an index route type or equivalent route-side callback
- filtered JSON response generation mirroring Lua's `/api/library`

This work is independent from `FileWatcher`, but they compose well:

- watcher invalidates index
- indexer rebuilds lazily or on demand

### Phase 6: Archive Access

New runtime module:

- `tsz/runtime/archive.zig`

Use libarchive directly in Zig.

Phase 6A:

- `list`
- `readEntry`
- `search`
- `info`

Phase 6B:

- safe extraction

Important:

- do not port Lua's `extractAll()` surface as if it is already complete
- real extraction must rewrite entry paths under an allowed destination root
- absolute paths and `..` traversal must be rejected before writeout

Build work:

- add `archive` system library linkage when used

## Deferred: DocStore

`docstore` is valuable, but it should not be phase one in `tsz`.

Why it should wait:

- `.tsz` does not yet have first-class object literals as runtime values
- state cannot hold arbitrary documents
- query results cannot flow naturally into UI without a typed record layer or JSON decode surface

Recommended order:

1. land `sqlite.zig`
2. land `localstore.zig`
3. land raw filesystem APIs
4. land watcher + library index + archive
5. then add either:
   - typed records in `.tsz`, or
   - explicit JSON string parse/stringify + document helpers
6. only after that, port `docstore.zig`

## Security Boundary

Proper porting needs a `tsz` permission story.

Love2D already gates storage features behind declared capability.
Without an equivalent, `tsz` would silently grant arbitrary filesystem access to every app.

Minimum acceptable phase-one boundary:

- generated app declares whether file access is used
- runtime enforces read/write/watch roots
- archive extraction is confined to an allowed destination root

This can start simple, but it should exist from day one.

## Suggested File Map

- `tsz/runtime/fs.zig`
- `tsz/runtime/sqlite.zig`
- `tsz/runtime/localstore.zig`
- `tsz/runtime/fswatch.zig`
- `tsz/runtime/library_index.zig`
- `tsz/runtime/archive.zig`
- `tsz/compiler/codegen.zig`
- `tsz/runtime/net/httpserver.zig`
- `build.zig`

Later:

- `tsz/runtime/docstore.zig`

## Verification Plan

Add both Zig tests and `.tsz` examples.

Examples:

- `tsz/examples/localstore-demo.tsz`
- `tsz/examples/files-demo.tsz`
- `tsz/examples/filewatch-demo.tsz`
- `tsz/examples/library-demo.tsz`
- `tsz/examples/archive-demo.tsz`

Zig tests:

- sqlite open/query/update/busy retry
- localstore round-trip for every supported state type
- path normalization / traversal rejection
- watcher snapshot diff logic
- library indexing categorization and filters
- archive listing / entry read / unsafe extraction rejection

## Recommended Implementation Order

1. `fs.zig`
2. `sqlite.zig`
3. `localstore.zig` + compiler `useLocalStore`
4. raw file built-ins
5. `fswatch.zig` + compiler hook
6. `library_index.zig` + extend `net/httpserver.zig`
7. `archive.zig`
8. `docstore.zig` only after typed object support exists

This order gets the highest-value storage behavior into `tsz` early, while avoiding a dead-end port of Lua's document APIs into a language/runtime that cannot express them cleanly yet.
