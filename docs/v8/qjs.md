# QJS Runtime Pipeline

Last updated: 2026-05-04

QJS is the legacy QuickJS runtime for ReactJIT carts. It is still present and
buildable, but V8 is the product/runtime default used by `scripts/ship` and
`scripts/dev`. Treat QJS as maintenance-only unless a task explicitly targets
it.

The short version:

- `qjs_app.zig` owns the React host node pool and applies mutation batches.
- `framework/qjs_runtime.zig` owns the QuickJS VM and most legacy host globals.
- `framework/qjs_bindings.zig` owns the newer `runtime/hooks/*` host globals.
- The shared `framework/engine.zig` still owns SDL events, layout, GPU paint,
  input, text, canvas, effects, telemetry, and frame timing.
- The same bundled `runtime/index.tsx` bootstraps React, timers, event
  dispatch, FFI listeners, and the reconciler.

## Status

| Path | Status |
| --- | --- |
| `scripts/ship <cart>` | Builds `v8_app.zig` with `-Duse-v8=true`. |
| `scripts/dev` | Builds `v8_app.zig`. |
| direct `zig build app` | Defaults to `qjs_app.zig` unless `-Duse-v8=true` or `-Dapp-source=...` is passed. |
| QJS source | `qjs_app.zig`, `framework/qjs_runtime.zig`, `framework/qjs_bindings.zig`. |

`build.zig` still compiles QuickJS C sources from `love2d/quickjs` into every
app build and exposes `build_options.has_quickjs = true`.

Example direct QJS build:

```sh
zig build app -Dapp-name=mycart -Dapp-source=qjs_app.zig -Doptimize=ReleaseFast
```

That expects a matching `bundle-mycart.js` available to `qjs_app.zig` through
its `@embedFile` path. The modern ship script prepares bundles for V8, so QJS
builds are usually manual/debug paths.

## Source Map

| Layer | Files | Role |
| --- | --- | --- |
| Build selection | `build.zig`, `scripts/ship`, `scripts/dev` | QJS is direct-build default; scripts choose V8. |
| QJS app root | `qjs_app.zig` | Owns node maps, mutation decoder, dev reload tabs, QJS-specific host fns, and `engine.run` config. |
| VM and legacy globals | `framework/qjs_runtime.zig` | Creates QuickJS runtime/context, registers legacy globals, calls/evals JS, dispatches effect renders, ticks QuickJS jobs. |
| Hook bindings | `framework/qjs_bindings.zig` | Registers fs, localstore, crypto, sqlite, http, browser-page, hotstate, env, exit, and async process host functions. |
| C bindings shim | `framework/qjs_c.zig`, `framework/qjs_value.zig` | Shared QuickJS import/value helpers. |
| Shared engine | `framework/engine.zig` | Window, event loop, hit testing, input, layout, paint, telemetry, and calls into `js_vm`. |
| JS runtime bootstrap | `runtime/index.tsx` | Installs shims, timers, React host config transport, dispatch globals, FFI listener bus, and renders `@cart-entry`. |
| Reconciler bridge | `renderer/hostConfig.ts` | Emits JSON mutation commands and handler-name metadata. |
| Runtime hooks | `runtime/hooks/*`, `runtime/ffi.ts` | JS wrappers around QJS/V8 host globals. |

## Build And Startup

`build.zig` chooses the root source this way:

```zig
const use_v8 = b.option(bool, "use-v8", ...) orelse false;
const default_src = if (use_v8) "v8_app.zig" else "qjs_app.zig";
const app_source = b.option([]const u8, "app-source", ...) orelse default_src;
```

For QJS, `qjs_app.zig` embeds:

```zig
const BUNDLE_FILE_NAME = std.fmt.comptimePrint("bundle-{s}.js", .{build_options.app_name});
const BUNDLE_BYTES = @embedFile(BUNDLE_FILE_NAME);
```

Startup flow:

1. `qjs_app.main` creates a general allocator and arena.
2. It initializes the host node maps:
   - `g_node_by_id`
   - `g_children_ids`
   - `g_root_child_ids`
   - `g_input_slot_by_node_id`
   - `g_content_store`
   - `g_pending_flush`
3. In dev mode, it reads `bundle.js` from disk, starts `dev_ipc`, and seeds the
   tab registry.
4. It calls `engine.run` with:
   - `.root = &g_root`
   - `.js_logic = initial_bundle`
   - `.init = appInit`
   - `.tick = appTick`
   - `.borderless = dev/custom chrome`
   - `.set_canvas_node_position = setCanvasNodePosition`
5. `engine.run` initializes text/GPU/input/layout, then calls `js_vm.initVM`.
   With QJS, `js_vm` is `framework/qjs_runtime.zig`.
6. `engine.run` calls `appInit` before evaluating the bundle.
7. `appInit` registers QJS app-specific globals like `__hostFlush`.
8. `engine.run` evaluates `js_logic`, which runs `runtime/index.tsx` and the
   cart entry.
9. The first React commit calls `__hostFlush`, queuing mutation commands.
10. `appTick` drains queued mutations, rebuilds `g_root.children`, and marks
    layout dirty.

## VM Lifecycle

`framework/qjs_runtime.zig:initVM` creates the VM:

```text
JS_NewRuntime()
JS_SetMemoryLimit(256 MB)
JS_SetMaxStackSize(1 MB)
JS_NewContext()
register globals
eval polyfill
eval embedded QJS IFTTT engine
```

`teardownVM` frees only the current QuickJS context/runtime. It is used by
`qjs_app.zig` dev reload before re-evaluating a fresh bundle.

`deinit` is the full shutdown path. It closes Claude/Kimi/local-AI sessions and
then frees the QuickJS context/runtime.

`tick` is called once per engine frame before `qjs_app.appTick`:

```text
qjs_runtime.tick()
-> call globalThis.__zigOS_tick() if present
-> JS_ExecutePendingJob(...) until QuickJS has no pending jobs
```

This is separate from `runtime/index.tsx`'s `__jsTick(now)`, which is called
from `qjs_app.appTick`. QJS therefore has two timer/job hooks:

- `__zigOS_tick`: installed by `qjs_runtime`'s built-in polyfill.
- `__jsTick(now)`: installed by `runtime/index.tsx` and used by the React
  runtime bundle.

## JS Bootstrap

The cart bundle enters through `runtime/index.tsx`.

Bootstrap responsibilities:

1. Predefine no-op `__ifttt_on*` globals.
2. Load React.
3. Patch effect tracking.
4. Load `runtime/hooks/useIFTTT`, which replaces IFTTT no-ops with real
   event-bus handlers.
5. Install no-op `window`, `self`, `document`, and event listener shims.
6. Install console forwarding through `__hostLog`.
7. Install JS timers if the host has not already installed `__zigOS_tick`.
8. Load `react-reconciler`.
9. Expose `__hostModules` for cartridge guests.
10. Configure reconciler transport:

```text
setTransportFlush(cmds)
-> JSON.stringify(cmds)
-> globalThis.__hostFlush(payload)
```

11. Install dispatch globals:
   - `__dispatchEvent`
   - `__dispatchInputChange`
   - `__dispatchInputSubmit`
   - `__dispatchInputFocus`
   - `__dispatchInputBlur`
   - `__dispatchInputKey`
   - `__dispatchRightClick`
   - `__dispatchScroll`
   - `__dispatchCanvasMove`
   - `__dispatchEffectRender`
12. Create the reconciler container and render `App`.

Unlike the V8 path, QJS does not use `__registerDispatch`. The shared
`runtime/index.tsx` probes for it, but QJS normally dispatches by evaluating
stored expressions or calling named globals.

## Mutation Pipeline

React host config emits commands such as:

```text
CREATE
CREATE_TEXT
APPEND
APPEND_TO_ROOT
INSERT_BEFORE
INSERT_BEFORE_ROOT
REMOVE
REMOVE_FROM_ROOT
UPDATE
UPDATE_TEXT
```

End-to-end:

1. React renders a primitive.
2. `renderer/hostConfig.ts` remaps HTML types, strips unsupported HTML props,
   resolves `className` through `tw`, records handler names, and appends a
   command to `pendingCommands`.
3. On commit, `flushToHost` serializes the command batch as JSON.
4. `runtime/index.tsx` calls `globalThis.__hostFlush(payload)`.
5. `qjs_app.host_flush` copies the JSON bytes into `g_pending_flush`.
6. It does not apply the commands immediately, because handlers can flush in
   the middle of an engine frame while the current rendered tree still points
   at arena memory.
7. `qjs_app.appTick` calls `drainPendingFlushes`.
8. `applyCommandBatch` parses the JSON and applies each command.
9. `cleanupDetachedNodes` removes unreachable host nodes and input slots.
10. If dirty, `snapshotRuntimeState` preserves rendered scroll offsets.
11. `rebuildTree` rematerializes `g_root.children` from the stable node maps
    into the arena.
12. `layout.markLayoutDirty()` triggers shared layout/paint work.

The stable host tree lives in heap-allocated `Node` structs keyed by React ids.
The rendered tree is an arena snapshot copied from those stable nodes each
frame that QJS marks dirty.

## Type Defaults

`qjs_app.applyTypeDefaults` recognizes:

| Host type | QJS node effect |
| --- | --- |
| `ScrollView` | `style.overflow = .scroll` |
| `Canvas` | `canvas_type = "canvas"`, `graph_container = true` |
| `Graph` | `graph_container = true` |
| `Canvas.Node`, `Graph.Node` | `canvas_node = true` |
| `Canvas.Path`, `Graph.Path` | `canvas_path = true` |
| `Canvas.Clamp` | `canvas_clamp = true` |
| `Terminal`, `terminal` | `terminal = true` |
| `TextInput`, `TextArea`, `TextEditor` | allocate and register an input slot |

QJS does not have V8's native `Window` / `Notification` host-node opening path.
It still exposes global window functions such as `__openWindow`, but rendering
`<Window>` is not decoded into a child host window by `qjs_app.zig`.

## Prop Decode Surface

QJS `applyProps` is older than V8's decoder. Live top-level props include:

| Prop | Destination |
| --- | --- |
| `fontSize` | `node.font_size` or `terminal_font_size` |
| `terminalFontSize` | `node.terminal_font_size` |
| `color` | `node.text_color` |
| `letterSpacing` | `node.letter_spacing` |
| `lineHeight` | `node.line_height` |
| `numberOfLines` | `node.number_of_lines` |
| `noWrap` | `node.no_wrap` |
| `paintText` | `node.input_paint_text` |
| `colorRows` | `node.input_color_rows` |
| `placeholder` | `node.placeholder` |
| `value` | `node.text`, with input sync |
| `contentHandle` | `node.text` points at Zig content-store bytes |
| `source` | `node.image_src` |
| `renderSrc` | `node.render_src` |
| `href` | `node.href` |
| `tooltip` | `node.tooltip` |
| `hoverable` | `node.hoverable` |
| `debugName` | `node.debug_name` |
| `testID` | `node.test_id` |
| `windowDrag` | `node.window_drag` |
| `windowResize` | `node.window_resize` |
| `gx`, `gy`, `gw`, `gh` | canvas/graph node geometry |
| `d` | SVG path data |
| `stroke` | `node.text_color` for paths |
| `strokeWidth` | `node.canvas_stroke_width` |
| `fill` | `node.canvas_fill_color` |
| `fillEffect` | `node.canvas_fill_effect` |
| `textEffect` | `node.text_effect` |
| `viewX`, `viewY`, `viewZoom` | canvas/graph view fields |
| `name` | `node.effect_name` |
| `background` | `node.effect_background` |
| `shader` | assembled WGSL effect shader |

Notable QJS gaps versus V8:

- no `strokeOpacity`;
- no `fillOpacity`;
- no `gradient`;
- no `flowSpeed`;
- no `inlineGlyphs`;
- no `videoSrc`;
- no `staticSurface*`;
- no `filterName` / `filterIntensity`;
- no `borderDash*` / `borderFlowSpeed`;
- no transition parsing;
- no physics / Scene3D prop surface;
- no V8 ingredient-gated host binding manifest.

The shared engine may support some of those fields, but QJS will not populate
them unless `qjs_app.zig` decodes the prop.

## Style Decode Surface

QJS style decode supports core layout/paint fields:

- width/height/min/max with number or percent strings;
- flex direction/grow/shrink/basis/wrap;
- gap/rowGap/columnGap;
- justify/align fields;
- padding/margin, including `margin: "auto"`;
- display, overflow, textAlign, position, top/left/right/bottom;
- aspectRatio;
- border widths, borderColor, borderRadius and per-corner radii;
- backgroundColor;
- opacity;
- rotation;
- scaleX/scaleY;
- zIndex;
- text style keys inside `style`: `fontSize`, `color`, `letterSpacing`,
  `lineHeight`.

QJS style reset is also older. It resets only the keys listed in
`resetStyleEntry`; fields added later in V8 will remain sticky if QJS never
learned them.

## Event Pipeline

Press/hover/mouse handlers use handler-name metadata from `hostConfig.ts`.
`qjs_app.applyHandlerFlags` installs small Zig-owned expression strings:

```text
onClick/onPress        -> "__dispatchEvent(id,'onClick')"
onMouseDown            -> "__dispatchEvent(id,'onMouseDown')"
onMouseUp              -> "__dispatchEvent(id,'onMouseUp')"
onHoverEnter/MouseEnter -> "__dispatchEvent(id,'onHoverEnter')"
onHoverExit/MouseLeave  -> "__dispatchEvent(id,'onHoverExit')"
```

End-to-end click:

1. Engine hit-tests the rendered node tree.
2. If a hit node has `js_on_press`, engine calls `runJsHandlerExpr`.
3. In QJS mode, `runJsHandlerExpr` wraps the eval with:

```text
js_vm.callGlobal("__beginJsEvent")
js_vm.evalExpr("__dispatchEvent(id,'onClick')")
js_vm.callGlobal("__endJsEvent")
state.markDirty()
```

4. `runtime/index.tsx.__dispatchEvent` looks up the React handler in
   `handlerRegistry`.
5. The handler may call `setState`.
6. React commits and calls `__hostFlush`.
7. QJS queues the batch until `appTick`.

Scroll and right-click handlers are callback-based rather than expression-only:

- `onScroll` sets `node.handlers.on_scroll = qjs_runtime.dispatchPreparedScroll`.
- `onRightClick` / `onContextMenu` sets
  `node.handlers.on_right_click = qjs_runtime.dispatchPreparedRightClick`.
- The engine first calls `qjs_runtime.prepareScrollEvent` or
  `prepareNodeEvent`, then invokes the handler.
- JS reads payload details through `__getPreparedScroll` or
  `__getPreparedRightClick`.

Input handlers are slot-based. `TextInput`, `TextArea`, and `TextEditor` get a
slot in `framework/input.zig`; generated per-slot callbacks call:

- `__dispatchInputChange`
- `__dispatchInputSubmit`
- `__dispatchInputFocus`
- `__dispatchInputBlur`
- `__dispatchInputKey`

QJS also dispatches matching LuaJIT globals when present, because the old
runtime supported additive LuaJIT logic next to QuickJS.

## Effect Render Pipeline

QJS supports `Effect` custom render handlers:

1. `hostConfig.ts` includes `onRender` in handler metadata.
2. `qjs_app.applyHandlerFlags` sets `node.effect_render = qjs_effect_shim`.
3. `framework/effects.zig` calls the render function with an
   `EffectContext`.
4. `qjs_effect_shim` calls `qjs_runtime.dispatchEffectRender`.
5. `dispatchEffectRender` creates a zero-copy QuickJS `ArrayBuffer` over the
   Zig-owned pixel buffer.
6. It calls:

```text
__dispatchEffectRender(id, buffer, w, h, stride, time, dt, mouseX, mouseY, mouseInside, frame)
```

7. `runtime/index.tsx` builds an effect context and invokes the user's
   `onRender`.
8. After the call returns, QJS detaches the ArrayBuffer so JS cannot keep a
   stale reference to Zig memory.

Shader-only effects use a no-op render pointer as a gate so the shared engine
enters the custom effect path. QJS assembles user WGSL by prepending the shared
effect header and `framework/gpu/effect_math.wgsl`.

## Dev Reload And Tabs

When `-Ddev-mode=true`:

- QJS reads `bundle.js` from disk.
- It polls mtime roughly every 16 ticks.
- `dev_ipc` can push named bundles into an in-process tab registry.
- Switching tabs calls `evalActiveTab`.

Reload flow:

```text
clearTreeStateForReload()
-> qjs_runtime.teardownVM()
-> qjs_runtime.initVM()
-> appInit()
-> qjs_runtime.evalScript(activeBundle)
```

`clearTreeStateForReload` deliberately clears `g_root.children` before freeing
node memory, unregisters every input slot, frees pending batches and handler
expression strings, clears node/child maps, clears root ids, resets the arena,
and marks the tree dirty.

Dev chrome is built as native `Node` structs in `buildChromeNode`, then
prepended in `rebuildTree`. Borderless resize edges are appended last so hit
testing sees them first.

## Host Function Surface

QJS has two host binding groups.

### `qjs_app.zig` app-specific globals

| Global | Role |
| --- | --- |
| `__hostFlush(json)` | Queue React mutation batch. |
| `__getInputTextForNode(id)` | Read current input buffer for React input events. |
| `__hostLoadFileToBuffer(path)` | Load file bytes into Zig content store, return handle. |
| `__hostReleaseFileBuffer(handle)` | Free a content-store buffer. |

### `qjs_runtime.zig` legacy globals

Major groups registered by `initVM`:

| Group | Globals |
| --- | --- |
| State | `__setState`, `__setStateString`, `__getState`, `__getStateString`, `__markDirty`, `__luaEval` |
| Logging/eval | `__hostLog`, `__js_eval` |
| Telemetry basics | `getFps`, `getLayoutUs`, `getPaintUs`, `getTickUs` |
| Processes/system | `getProcessesJson`, `getThreadsJson`, `getCoreCount`, `__getpid`, `__getenv` |
| Mouse/keyboard | `getMouseX`, `getMouseY`, `getMouseDown`, `getMouseRightDown`, `isKeyDown` |
| Terminal dock | `__beginTerminalDockResize`, `__endTerminalDockResize`, `__getTerminalDockResizeState` |
| Clipboard | `__clipboard_set`, `__clipboard_get` |
| Canvas controls | `getActiveNode`, `getSelectedNode`, `setFlowEnabled`, `setNodeDim`, `resetNodeDim`, `setPathFlow`, `resetPathFlow` |
| Classifier/theme | `setVariant` |
| Input | `getInputText`, `__setInputText`, `__pollInputSubmit`, `__getPreparedRightClick`, `__getPreparedScroll` |
| Window | `__openWindow`, `__window_close`, `__window_minimize`, `__window_maximize`, `__window_is_maximized`, plus legacy camel-case variants |
| Process/app paths | `__spawn_self`, `__get_app_dir`, `__get_run_path` |
| Telemetry snapshots | `__tel_frame`, `__tel_gpu`, `__tel_nodes`, `__tel_state`, `__tel_system`, `__tel_input`, `__tel_canvas`, `__tel_net`, `__tel_layout`, `__tel_history`, `__tel_node_count`, `__tel_node`, `__tel_node_style`, `__tel_node_box_model` |
| Fetch/PTY/AI | `__fetch`, `__pty_*`, `__claude_*`, `__kimi_*`, `__localai_*` |
| Semantic terminal | `__sem_*` |
| Recording/playback | `__rec_*`, `__play_*` |
| Legacy fs/exec/db | `__fs_scandir`, `__fs_readfile`, `__fs_writefile`, `__fs_deletefile`, `__exec`, `__db_query` |

`qjs_runtime.registerHostFn(name, fn, argc)` is also public so app roots and
other modules can add globals after `initVM`.

### `qjs_bindings.zig` hook globals

`qjs_bindings.registerAll` is called near the end of `qjs_runtime.initVM`.
These names are the newer `runtime/hooks/*` surface:

| Group | Globals |
| --- | --- |
| Filesystem | `__fs_read`, `__fs_write`, `__fs_exists`, `__fs_list_json`, `__fs_mkdir`, `__fs_remove`, `__fs_stat_json` |
| Async process | `__exec_async` |
| Localstore | `__store_get`, `__store_set`, `__store_remove`, `__store_clear`, `__store_keys_json` |
| Crypto | `__crypto_random_b64`, `__crypto_hmac_sha256_b64`, `__crypto_hkdf_sha256_b64`, `__crypto_xchacha_encrypt_b64`, `__crypto_xchacha_decrypt_b64` |
| SQLite | `__sql_open`, `__sql_close`, `__sql_exec`, `__sql_query_json`, `__sql_last_rowid`, `__sql_changes` |
| HTTP/page fetch | `__http_request_sync`, `__http_request_async`, `__browser_page_sync`, `__browser_page_async` |
| Hot state | `__hot_get`, `__hot_set`, `__hot_remove`, `__hot_clear`, `__hot_keys_json` |
| Env/exit | `__env_get`, `__env_set`, `__exit` |

Async completions use the shared JS FFI bus:

```text
qjs_bindings.tickDrain()
-> poll completed workers
-> call globalThis.__ffiEmit(channel, payload)
-> runtime/ffi.ts defers listener callbacks with setTimeout(0)
```

Channels currently include:

- `http:<reqId>`
- `browser-page:<reqId>`
- async process channels emitted by `exec_async`.

WebSocket support in `qjs_bindings.zig` is marked pending; the comments note the
network module needs Zig 0.15 API updates and only plain `ws://` was in scope.

## IFTTT In QJS

QJS has two IFTTT layers:

- `framework/qjs_runtime.zig` embeds an older `JS_IFTTT` string and evaluates
  it during `initVM`.
- `runtime/hooks/useIFTTT.ts` is imported by `runtime/index.tsx` and installs
  the current runtime event-bus shims.

`engine.run` also installs no-op `__ifttt_on*` globals before app init so child
windows or failed/late bundle evals do not spam ReferenceErrors when system
signals fire.

For current behavior, prefer the documented hook pipeline in
`docs/v8/useIFTTT.md`. The embedded QJS `useIFTTT` is legacy compatibility.

## Runtime Limitations And Sharp Edges

- QJS is not the default shipping runtime.
- The QJS prop decoder is behind V8 and misses several modern fields.
- QJS has no V8 ingredient/source-gated binding model; many globals are
  registered unconditionally.
- `__hostFlush` logs every queued batch preview, which can be noisy.
- Mutation batches are JSON parsed with `std.json` per flush, then copied into
  arena snapshots for render.
- Dev reload leaks some mixed-ownership text strings intentionally for safety.
- `qjs_runtime.zig` still contains old comments and legacy SDL painter code
  from earlier runtime shapes; the current app path paints through the shared
  engine/GPU tree.
- `qjs_runtime`'s built-in polyfill and `runtime/index.tsx` both contain timer
  systems. The React runtime usually uses `runtime/index.tsx`'s `__jsTick`; the
  QuickJS job/timer tick remains for legacy globals.
- `strokeOpacity`, `fillOpacity`, gradients, path `flowSpeed`, inline glyphs,
  border dash flow, static surfaces, native window host nodes, video props,
  transitions, physics, and Scene3D are V8-era surfaces unless QJS decode is
  explicitly updated.

## When To Touch QJS

Touch QJS only when:

- fixing a regression in a direct `qjs_app.zig` build;
- keeping legacy carts compiling;
- porting a useful legacy host binding forward to V8;
- removing or documenting stale runtime behavior.

For new cart/runtime features, implement the V8 binding/decoder path first.

## Related Docs

- `docs/v8/paint.md` - shared engine paint order.
- `docs/v8/layout.md` - shared layout and node fields.
- `docs/v8/canvas.md` - shared canvas behavior, with V8 notes.
- `docs/v8/useIFTTT.md` - current IFTTT hook pipeline.
- `docs/v8/fs.md`, `docs/v8/localstore.md`, `docs/v8/process.md`,
  `docs/v8/fetch.md`, `docs/v8/postgres.md`, `docs/v8/telemetry.md` - modern
  hook/binding docs that overlap parts of `qjs_bindings.zig`.
