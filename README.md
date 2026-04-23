# reactjit

A native runtime for React. Write plain `.tsx`, bundle with esbuild, get a single-file binary. No DOM, no CSS engine, no browser.

React's reconciler emits CREATE/APPEND/UPDATE/REMOVE mutation commands (host config in `renderer/hostConfig.ts`). Those commands drive a Zig-owned node tree. Layout (flexbox), paint, hit-testing, events, input, text, and GPU are native Zig on top of V8 and wgpu. JSX, hooks, standard HTML tag names, and Tailwind via `className` all work — the host shims what needs shimming and the reconciler translates the rest.

This is an experiment. Highly experimental, active construction, rough edges everywhere. The shape of the project keeps moving.

## Why

Copy-paste a React component, ship native performance, don't ship Chromium. V8 standalone is small (~6 MB); Node bundles V8 into a ~50 MB package; CEF (Chromium Embedded) is ~200 MB. The "V8 is heavy" intuition is really "Chromium is heavy." Measure before assuming.

## Carts

Applications are called **carts**. A cart is a `.tsx` file — or a directory with a `.tsx` entry — under `cart/`. Anything React can express, a cart can be.

The tree today (`ls cart/`):

```
browser         canvas_stress   cockpit         d152            effects
graph_demo      hello           hello2          hello_stress    hottest
input_lab       inspector       load_via_hook   load_via_react  pocket_operator
spinner         sweatshop       text_chop_test  tooltip_test
```

`cart/sweatshop/` is one cart among many. It's the IDE reactjit is currently developed inside of, not the framework itself.

## Primitives

Exported from `runtime/primitives.tsx` (grep-verified):

```
Box  Row  Col  Text  Image  Pressable  ScrollView
TextInput  TextArea  TextEditor  Terminal
Canvas     Canvas.Node  Canvas.Path  Canvas.Clamp
Graph      Graph.Path   Graph.Node
Render  Effect  Native
```

Each primitive emits a host-node type string (`'View'`, `'Text'`, `'Image'`, `'Canvas'`, …) that the reconciler host passes into the Zig runtime.

**HTML tag remapping** (`renderer/hostConfig.ts`): `div`/`section`/`article`/`aside`/`a`/`button`/`details`/`summary` → `View`; `h1`–`h6`, `p`, `span` → `Text`; `img` → `Image`; `input` → `TextInput`; `textarea` → `TextEditor`; `video` → `Video`. `img.src` and `input.value`/`textarea.value` are forwarded through.

**Tailwind via `className`** — parsed by `tw()` in `runtime/tw.ts` at CREATE time.

`Native` is internal plumbing for host-handled node types; no cart uses it directly.

### Drawing, graphs, physics, audio, 3D

**`<Canvas>`** (`Canvas.Node`, `Canvas.Path`, `Canvas.Clamp`) is the pan/zoomable drawing surface. Real uses: `cart/canvas_stress/StressCanvas.tsx` (node-count stress load), `cart/graph_demo/GraphStage.tsx`, `cart/cockpit/index.tsx`, plus many sweatshop components — `plancanvas.tsx`, `mermaid/renderer.tsx`, `chemistry/MoleculeView.tsx`, `gamepad/StickView.tsx`, `audio/Patchbay.tsx`, `noise/NoiseField.tsx`, `graph/GraphCanvas.tsx`, `cockpit/HeatmapGrid.tsx` + `WorkerCanvas.tsx`.

**`<Graph>`** (`Graph.Path`, `Graph.Node`) is the static-viewport polyline/path surface. Used by the charts in `cart/sweatshop/components/charts/` (`LineChart`, `BarChart`, `PieChart`), `cart/effects/paisley_garden.tsx` + `circle_path_debug.tsx`, `cart/inspector/panels/` (Memory, Performance), `cart/sweatshop/components/audio/Knob.tsx`, and the cart-side Lucide icon renderer at `cart/sweatshop/components/icons.tsx` (polyline → `Graph.Path`).

**Physics.** `framework/physics2d.zig` + `framework/physics3d.zig` are bridged via `cart/sweatshop/components/physics/`: `<PhysicsWorld>` provides a `PhysicsWorldCore` through a React context (`PhysicsContext.ts`); `<RigidBody>` + `useBodyState` + `useForce` + `usePhysics` are the cart-side hooks. This is a working integration inside sweatshop, not a framework-level primitive — reuse means copying the pattern.

**Audio.** `framework/audio.zig` exposes a modular synth graph via `__audio_init`, `__audio_add_module`, plus module-parameter setters. `cart/pocket_operator.tsx` is the reference cart: it calls the host functions directly (no `<Audio>` React primitive). The modules registered by pocket_operator include `mixer`, `delay`, and a `pocket` drum/synth voice.

**3D.** `cart/sweatshop/components/scene3d/` (`Scene3D.tsx`, `Mesh.tsx`, `OrbitControls.tsx`, `PointLight.tsx`, `DirectionalLight.tsx`, `StandardMaterial.ts`, `useScene3D.ts`) is a cart-side 3D scene built on top of the engine's GPU primitives. Same status as physics: working inside sweatshop, not yet factored into a runtime-level export.

## Host bindings

The V8 host registers 174 functions on the JS global (`grep registerHostFn framework/v8_bindings_*.zig`). By area:

| Area | Representative names |
|------|----------------------|
| Filesystem | `__fs_read`, `__fs_write`, `__fs_readfile`, `__fs_writefile`, `__fs_exists`, `__fs_list_json`, `__fs_scandir`, `__fs_stat_json`, `__fs_mkdir`, `__fs_remove`, `__fs_deletefile` |
| Subprocess + env | `__exec`, `__exec_async`, `__spawn_self`, `__getenv`, `__env_get`, `__env_set`, `__exit`, `__getpid`, `__get_run_path`, `__get_app_dir` |
| HTTP + net | `__http_request_sync`, `__http_request_async`, `__fetch`, `__ws_open`, `__ws_send`, `__ws_close`, `__browser_page_sync`, `__browser_page_async` |
| SQLite + kv store | `__sql_open`, `__sql_close`, `__sql_exec`, `__sql_query_json`, `__sql_changes`, `__sql_last_rowid`, `__store_get`, `__store_set`, `__store_remove`, `__store_clear`, `__store_keys_json`, `__db_query` |
| Hot state | `__hot_get`, `__hot_set`, `__hot_remove`, `__hot_clear`, `__hot_keys_json` |
| Clipboard + window | `__clipboard_get`, `__clipboard_set`, `__window_maximize`, `__window_minimize`, `__window_close`, `__window_is_maximized` |
| IPC (dev host) | `__ipc_connect`, `__ipc_disconnect`, `__ipc_request`, `__ipc_response`, `__ipc_poll`, `__ipc_submit_code`, `__ipc_tree_node`, `__ipc_tree_count`, `__ipc_perf`, `__ipc_status` |
| Telemetry / inspector | `__tel_frame`, `__tel_gpu`, `__tel_layout`, `__tel_input`, `__tel_net`, `__tel_node`, `__tel_nodes`, `__tel_state`, `__tel_system`, `__tel_history`, `__sem_*` |
| Coding agents | `__claude_init`, `__claude_send`, `__claude_poll`, `__claude_close`, `__kimi_close` |
| Frame / input introspection | `getFps`, `getTickUs`, `getLayoutUs`, `getPaintUs`, `getMouseX`, `getMouseY`, `getMouseDown`, `getMouseRightDown`, `isKeyDown`, `getSelectedNode`, `getActiveNode` |
| JS eval | `__js_eval` |

TypeScript wrappers live under `runtime/hooks/` (`fs.ts`, `http.ts`, `sqlite.ts`, `crypto.ts`, `clipboard.ts`, `process.ts`, `localstore.ts`, `websocket.ts`, `browser_page.ts`, `useFileContent.ts`, `useHotState.ts`). `runtime/hooks/index.ts:installBrowserShims()` installs `fetch`, `localStorage`, and a no-op `WebSocket` stub for paste-compatibility.

**Not available** (no browser context): `window`/`document`/`navigator` in any meaningful sense, `sessionStorage`, `IndexedDB`, cookies, `Blob`, `FormData`, `FileReader`, `XMLHttpRequest`, CSS Grid, media queries, pseudo-classes, inline SVG, blob URLs. Closer to React Native than browser React.

## Getting started

Prerequisites: Zig (pinned via `build.zig.zon`, currently tracking 0.15.2), Node 20+, Linux (macOS path exists, Linux is the daily driver).

```bash
./scripts/ship  <cart-name>        # bundle + zig build + self-extracting binary
./scripts/ship  <cart-name> -d     # debug ELF, skips packaging
./scripts/ship  <cart-name> --raw  # release ELF, skips packaging (for ldd)
./scripts/ship  <cart-name> --qjs  # legacy QuickJS host (maintenance-only)
./scripts/ship  <cart-name> --jsrt # alternate LuaJIT-based evaluator host
./scripts/run   <cart-name>        # launch a previously-built binary
./scripts/dev   <cart-name>        # push cart into the persistent dev host
```

The dev host is a long-lived `ReleaseFast` binary listening on `/tmp/reactjit.sock`. `scripts/dev` bundles to `.cache/bundle-<cart>.js` and pushes over IPC; a second `scripts/dev <other>` adds a tab to the same host. Save-to-visible is ~300 ms for TSX/TS edits. A rebuild is required for changes under `framework/`, `build.zig`, or `scripts/`.

Debug builds have a pre-existing click-path issue — stick to the default `ReleaseFast` for dev work. `useHotState` is wired but state does not survive reloads today.

## Layout

```
cart/                 .tsx carts (single-file or directory-based)
framework/            Zig runtime — layout, engine, GPU (wgpu), events, input,
                      state, text, windows, cartridge, audio, agents.
                      V8 bindings: framework/v8_bindings_{core,fs,sdk,telemetry,websocket}.zig
framework/lua/jsrt/   JS evaluator written in Lua (LuaJIT). Alternate host path.
runtime/              JS entry (runtime/index.tsx), primitives.tsx, classifier.tsx,
                      tw.ts, JSX shim, host-shim shims, hook wrappers.
renderer/             react-reconciler host config + mutation command stream.
scripts/              ship, run, dev, build-bundle.mjs, watchers, autotest.
build.zig             Root build.

v8_app.zig            Default cart host. Embeds V8 via zig-v8.
qjs_app.zig           Legacy QuickJS host. Maintenance-only.
jsrt_app.zig          Alternate LuaJIT/JSRT host binary.
v8_hello.zig          Minimal V8 smoke-test host.

tsz/                  FROZEN. Smith-era AOT-compile-.tsz-to-Zig experiment.
love2d/               FROZEN. The reconciler-on-Lua predecessor stack.
archive/              FROZEN. Earlier compiler iterations.
os/                   Speculative (CartridgeOS). Mostly stubs.
```

Frozen trees are read-only reference material. See `git log` for the backstory; the short version is "we built it, learned from it, moved on, kept it around to port patterns from."

## Status

| Working | Incomplete / pending |
|---|---|
| V8 host (default), QJS host (legacy), JSRT host (alt) | Multi-window orchestration beyond `__window_*` |
| Every primitive listed above, HTML remapping, tailwind | Physics + 3D live as sweatshop-cart integrations, not runtime-level primitives |
| Host bindings: fs, exec, http, sqlite, crypto, clipboard, hot-state, audio | No `<Audio>` React primitive — carts call `__audio_*` directly |
| Persistent dev host + IPC bundle-push + hot reload | Video primitive end-to-end |
| Inspector host-side telemetry (`__tel_*`, `__sem_*`) | Inspector UI cart (planned, to be regenerated from the `love2d/` reference) |
| `scripts/ship` self-extracting packaging, snapshot autotest gate | `useHotState` state persistence across reloads |
| | WebSocket bindings exist; high-level hooks sparse |

## Pointers

- [`AGENTS.md`](AGENTS.md) — contributor conventions for AI/agent work.
- [`CLAUDE.md`](CLAUDE.md) — Claude Code-specific rules (frozen trees, git discipline, hard bans).
- `git log` — the real story of how this got here. Prior eras (react-love → iLoveReact → multi-target ReactJIT → SDL2/Love2D → Smith/.tsz → current Zig+V8 cart runtime) are all in there.
