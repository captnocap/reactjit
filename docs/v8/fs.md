# Filesystem Hook Pipeline (V8 Runtime)

The filesystem surface in the V8 runtime is a set of synchronous host functions
plus a few React hooks layered on top. It is not browser `File`, `FileReader`,
`localStorage`, IndexedDB, or `fetch`. Cart code calls TypeScript wrappers in
`runtime/hooks`; those wrappers call Zig-registered globals on `globalThis`; the
Zig side performs `std.fs.cwd()` I/O or polls framework modules.

There are four related surfaces:

- `runtime/hooks/fs.ts`: direct synchronous file helpers.
- `runtime/hooks/useFileContent.ts`: large-file content handles for `TextEditor`.
- `runtime/hooks/useFileWatch.ts`: poll-based file/directory watchers.
- `runtime/hooks/useFileDrop.ts`: SDL file-drop notifications.

`runtime/hooks/media.ts` and `useMedia.ts` are filesystem-adjacent and use
`__fs_media_*` host functions from the same V8 FS binding module. See
`docs/v8/usemedia.md` for the collapsed media API.

## Public API

Import the direct helpers:

```ts
import { fs } from '@reactjit/runtime/hooks';

const text = fs.readFile('/tmp/config.json');
const ok = fs.writeFile('/tmp/config.json', text ?? '{}');
```

Or import from the module directly:

```ts
import { readFile, writeFile, stat } from '@reactjit/runtime/hooks/fs';
```

Direct helper surface:

```ts
type FsStat = {
  size: number;
  mtimeMs: number;
  isDir: boolean;
};

function readFile(path: string): string | null;
function writeFile(path: string, content: string): boolean;
function exists(path: string): boolean;
function listDir(path: string): string[];
function mkdir(path: string): boolean;
function remove(path: string): boolean;
function stat(path: string): FsStat | null;
```

Large-file editor content:

```ts
import { useFileContent } from '@reactjit/runtime/hooks/useFileContent';
import { TextEditor } from '@reactjit/runtime/primitives';

const handle = useFileContent(path);

<TextEditor contentHandle={handle} value="" />
```

File watcher:

```ts
import { useFileWatch } from '@reactjit/runtime/hooks';

useFileWatch('./src', (event) => {
  if (event.type === 'modified') reload();
}, {
  recursive: true,
  pattern: '*.tsx',
  intervalMs: 200,
});
```

File drop:

```ts
import { useFileDrop } from '@reactjit/runtime/hooks/useFileDrop';

useFileDrop((path) => {
  openFile(path);
});
```

## Host Globals

Direct FS helpers in `fs.ts` call these globals through `runtime/ffi.ts`:

```text
__fs_read(path)            -> string | null
__fs_write(path, content)  -> boolean
__fs_exists(path)          -> boolean
__fs_list_json(path)       -> JSON string: string[]
__fs_mkdir(path)           -> boolean
__fs_remove(path)          -> boolean
__fs_stat_json(path)       -> JSON string: FsStat | null
```

Legacy/global compatibility functions are also registered:

```text
__fs_readfile(path)        -> string, empty string on error
__fs_writefile(path, data) -> 0 on success, -1 on error
__fs_deletefile(path)      -> 0 on success, -1 on error
__fs_scandir(path)         -> JS array of names
```

Core FS-related globals:

```text
__hostLoadFileToBuffer(path)    -> numeric content handle, 0 on failure
__hostReleaseFileBuffer(handle) -> void

__fswatchAdd(path, recursive, intervalMs, pattern) -> watcher id, -1 on failure
__fswatchRemove(id)                           -> void
__fswatchDrain()                              -> JSON event array

__filedropSeq()       -> monotonic drop counter
__filedropLastPath()  -> latest dropped path string
```

Media globals registered by the FS binding:

```text
__fs_media_scan_json(dir, recursive, maxDepth)
__fs_media_stats_json(dir, recursive, maxDepth)
__fs_media_index_json(dir, recursive, maxDepth, indexArchives, archivePattern)
```

## Binding Registration

V8 app startup uses the `INGREDIENTS` table in `v8_app.zig`.

`core` is always registered:

```zig
.{ .name = "core", .required = true, .reg_fn = "registerCore", .mod = v8_bindings_core },
```

Core owns `__hostLoadFileToBuffer`, `__hostReleaseFileBuffer`,
`__fswatchAdd`, `__fswatchRemove`, `__fswatchDrain`, `__filedropLastPath`, and
`__filedropSeq`.

The direct FS module is source-gated:

```zig
.{ .name = "fs", .required = false, .grep_prefix = "__fs_", .reg_fn = "registerFs", .mod = v8_bindings_fs },
```

When the bundle references `__fs_` globals, `scripts/ship` enables the FS
ingredient and `v8_bindings_fs.registerFs` registers the direct FS and media
host functions.

## Direct FS Flow

### 1. Cart code calls a wrapper

`runtime/hooks/fs.ts` wraps every host call through `runtime/ffi.ts`:

```ts
export function readFile(path: string): string | null {
  return callHost<string | null>('__fs_read', null, path);
}

export function stat(path: string): FsStat | null {
  return callHostJson<FsStat | null>('__fs_stat_json', null, path);
}
```

`callHost` returns the fallback if the host function is unavailable or throws.
`callHostJson` calls a host function that returns a JSON string, then parses it
or returns the fallback.

### 2. V8 host binding receives JS arguments

`framework/v8_bindings_fs.zig` converts V8 arguments to Zig strings with
`argStringAlloc`, performs the operation, and writes the return value back with
`setString`, `setBool`, `setNumber`, or `setNull`.

Direct FS implementation details:

- `__fs_read` uses `std.fs.cwd().readFileAlloc(..., 16 * 1024 * 1024)`.
- `__fs_write` creates parent directories if the path contains `/`, then creates
  or truncates the file.
- `__fs_exists` uses `std.fs.cwd().statFile`.
- `__fs_list_json` opens a directory with iteration and returns JSON names.
- `__fs_mkdir` calls `std.fs.cwd().makePath`.
- `__fs_remove` stats the path; directories use `deleteDir`, all other kinds use
  `deleteFile`.
- `__fs_stat_json` returns size, mtime in milliseconds, and directory flag.

### 3. Result returns synchronously to JS

All direct helpers are synchronous. The current frame is blocked until the I/O
finishes. This is acceptable for small local files and short directory listings;
large reads or deep scans should be delayed behind a timer or routed through a
purpose-built handle/index surface.

## Large File Content Flow

`useFileContent` exists to avoid serializing large editor contents through React
props and JSON mutation batches.

### 1. Hook loads a path after render

`runtime/hooks/useFileContent.ts` runs an effect whenever `path` changes:

```ts
const handle = globalThis.__hostLoadFileToBuffer(path);
setHandle(handle);
```

Invalid app sentinel paths like `__landing__` and `__settings__` return handle 0.

### 2. Core binding stores bytes in Zig

`framework/v8_bindings_core.zig:hostLoadFileToBuffer` reads the file with:

```zig
std.fs.cwd().readFileAlloc(std.heap.c_allocator, path, 64 * 1024 * 1024)
```

It stores the allocated byte slice in `g_content_store: AutoHashMap(u32, []u8)`
and returns the numeric handle. Handle ids increment from 1.

### 3. `TextEditor` receives only the handle

`TextEditor` is a normal primitive. When V8 applies props in `v8_app.zig`,
`contentHandle` is recognized for input-like nodes:

```zig
if (contentStoreGet(handle)) |buf| syncInputValue(node, buf);
```

The node text points at the Zig-owned buffer, so the file body does not cross
the JS bridge as a `value` string.

### 4. Cleanup releases the handle

The hook cleanup calls:

```ts
globalThis.__hostReleaseFileBuffer(handle);
```

The core binding removes the handle from `g_content_store` and frees the buffer.
The design assumes one `TextEditor` reader per handle. Load twice if the same
file needs to be displayed by multiple independent editors.

## File Watch Flow

`useFileWatch` bridges a poll-based watcher in `framework/fswatch.zig`. It does
not use inotify, kqueue, or FSEvents.

### 1. Hook registers a watcher

`useFileWatch(path, handler, opts)` stores the latest handler in a ref and calls
`attachWatcher` from an effect.

`attachWatcher` calls:

```ts
const id = globalThis.__fswatchAdd(
  path,
  opts.recursive ? 1 : 0,
  opts.intervalMs ?? 1000,
  opts.pattern ?? '',
);
```

If the id is non-negative, the JS singleton stores `id -> listener` and starts a
single `setInterval(..., 100)` drain timer for the whole app.

### 2. Zig creates a watcher slot

`framework/v8_bindings_core.zig:hostFswatchAdd` calls
`fswatch.addWatcher`.

Watcher limits and behavior:

- `MAX_WATCHERS = 8`.
- `MAX_FILES = 512` entries per snapshot.
- `MAX_EVENTS = 64` queued events.
- `interval_ms` is clamped to a minimum of 100ms.
- Recursive directory scanning uses `Dir.walk`.
- Directories are excluded from snapshots; file entries are tracked.
- `pattern` supports simple glob `*` and `?`.
- Exclude support exists in `fswatch.zig`, but the current JS binding does not
  expose exclude lists.

When added, the watcher detects whether the path is a directory and builds an
initial snapshot. Initial state does not emit events.

### 3. Engine ticks watchers every frame

`framework/engine.zig` calls:

```zig
fswatch.tick(dt_ms);
```

Each active watcher accumulates elapsed time. When its interval passes, it builds
a new snapshot and merge-diffs it against the previous sorted snapshot.

Event types:

```ts
type FileWatchEvent = {
  watcherId: number;
  type: 'created' | 'modified' | 'deleted';
  path: string;
  size: number;
  mtimeNs: number;
};
```

`modified` fires when size or mtime differs. `created` and `deleted` come from
path presence in the sorted old/new snapshots.

### 4. JS drains and dispatches events

The singleton drain timer calls `__fswatchDrain()` every 100ms while at least one
listener is registered.

`hostFswatchDrain` drains Zig's pending queue and returns JSON shaped like:

```json
[
  { "w": 0, "t": "modified", "p": "src/app.tsx", "s": 1234, "m": 1777777777777 }
]
```

`useFileWatch.ts` parses the array, looks up `listeners.get(ev.w)`, and calls the
matching handler with the normalized event.

### 5. Cleanup removes the watcher

The effect cleanup calls `__fswatchRemove(id)`, removes the JS listener, and
stops the drain timer when no listeners remain.

## IFTTT FS Sources

`useFileWatch.ts` also registers filesystem triggers with the IFTTT registry:

```text
fs:changed:<path>   -> modified events under <path>
fs:created:<path>   -> created events
fs:deleted:<path>   -> deleted events
fs:any:<path>       -> all event types
```

These use `attachWatcher(path, ..., { recursive: true })`. The IFTTT DSL does
not currently expose `pattern` or `intervalMs`.

## File Drop Flow

`useFileDrop` bridges SDL drop events through `framework/filedrop.zig`.

### 1. Engine receives SDL drop

In `framework/engine.zig`, `SDL_EVENT_DROP_FILE` calls:

```zig
filedrop.dispatch(path, config.root);
system_signals.notifyDrop(path);
```

### 2. `filedrop.dispatch` stores path and wakes React

`framework/filedrop.zig` copies the dropped path into a persistent buffer, stores
it as `last_path`, increments `drop_seq`, calls any Zig subscribers, and then
calls `state.markDirty()`.

### 3. Hook observes the sequence on render

`useFileDrop` stores the baseline sequence on mount. On subsequent renders it
reads:

```ts
const seq = globalThis.__filedropSeq();
const path = globalThis.__filedropLastPath();
```

When the sequence changes, the hook calls the user's handler with the latest
path. This is render-observed state, not an event listener registered from JS.

## Media FS Flow

The media wrappers use the same FS binding module but not `runtime/hooks/fs.ts`.

`runtime/hooks/media.ts` calls:

- `__fs_media_scan_json`
- `__fs_media_stats_json`
- `__fs_media_index_json`

`framework/v8_bindings_fs.zig` recursively walks directories, classifies files by
extension, and returns JSON arrays or stats objects. `indexDeep` currently has
the same filesystem coverage as `scan`; archive expansion options are accepted
by the JS API but ignored in the current V8 implementation.

## Path And Safety Notes

- Direct V8 FS bindings use `std.fs.cwd()` and accept absolute or relative paths.
- Direct V8 FS bindings do not use `framework/fs.zig` path confinement.
- `framework/fs.zig` does provide confined app-data directory helpers, but in
  this V8 path it is used for app data initialization/localstore substrate, not
  for `runtime/hooks/fs.ts` direct file I/O.
- `writeFile` creates missing parent directories and truncates existing files.
- `remove` deletes files or empty directories only; it does not recursively remove
  non-empty directories.
- Direct reads cap at 16 MiB. Content handles cap at 64 MiB.
- Returned file text is treated as UTF-8 JS strings.
- All direct FS and media scans are synchronous from JS's point of view.
- Watch events expose `mtimeNs` as a JSON number. It is useful for equality or
  recency checks, but nanosecond epoch values exceed JavaScript's precise integer
  range.

## Source Map

- `runtime/ffi.ts`: `callHost`, `callHostJson`, fallback behavior, and shared
  event helper conventions.
- `runtime/hooks/fs.ts`: typed direct FS wrappers.
- `runtime/hooks/useFileContent.ts`: React hook for content handles.
- `runtime/hooks/useFileWatch.ts`: React/imperative file watcher API and IFTTT
  source registration.
- `runtime/hooks/useFileDrop.ts`: React hook for dropped file paths.
- `runtime/hooks/media.ts`: filesystem media scan/stat/index wrappers.
- `runtime/hooks/useMedia.ts`: collapsed media hook/query surface.
- `runtime/hooks/index.ts`: public exports.
- `v8_app.zig`: ingredient registration, app-data FS init, and `contentHandle`
  application to input nodes.
- `framework/v8_bindings_fs.zig`: direct FS and media host functions.
- `framework/v8_bindings_core.zig`: content store, filedrop globals, and fswatch
  globals.
- `framework/fswatch.zig`: poll-based watcher implementation.
- `framework/filedrop.zig`: SDL drop storage and subscriber dispatch.
- `framework/fs.zig`: confined app-data filesystem substrate used by localstore
  and other framework modules.
- `framework/engine.zig`: SDL drop dispatch and per-frame `fswatch.tick`.
