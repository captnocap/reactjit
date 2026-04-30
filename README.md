# reactjit

A native runtime for React. Write plain `.tsx`, bundle with esbuild, get a single-file binary. No DOM, no CSS engine, no browser, no Chromium, no Node.

React's reconciler emits CREATE/APPEND/UPDATE/REMOVE mutation commands (host config in `renderer/hostConfig.ts`). Those commands drive a Zig-owned node tree. Layout (flexbox), paint, hit-testing, events, input, text, audio, voice, networking, and GPU are native Zig sitting on V8 and wgpu. JSX, hooks, standard HTML tag names, Tailwind via `className`, and CSS transforms (rotate / scale / translate via 2D matrix) all work — the host shims what needs shimming and the reconciler translates the rest.

This is an experiment. Highly experimental, active construction, rough edges everywhere. The shape of the project keeps moving.

## Why

Copy-paste a React component, ship native performance, don't ship Chromium. V8 standalone is small (~6 MB); Node bundles V8 into a ~50 MB package; CEF (Chromium Embedded) is ~200 MB. The "V8 is heavy" intuition is really "Chromium is heavy." Measure before assuming.

## Carts

Applications are called **carts**. A cart is a `.tsx` file — or a directory with an `index.tsx` entry — under `cart/`. The cart name resolves as `cart/<name>/index.tsx` first, then falls back to `cart/<name>.tsx`. Anything React can express, a cart can be.

The carts that pull the most weight today:

| Cart | What it is |
|---|---|
| `cart/app/` | The product surface in progress. Router, homepage, onboarding flow (greeting → goal → cartridge selector → clarify → write), recipe-driven Claude integration. |
| `cart/sweatshop/` | The IDE reactjit develops itself inside. Editor + chat + git + indexer + agents + charts + scene3d + physics. One cart among many — not the framework. |
| `cart/component-gallery/` | 128 documented gallery components: charts, menus, dex graph/spatial/tree explorers, tooltips, code blocks, command-composer, time-instruments, social UIs. The closest thing this repo has to a Storybook. |
| `cart/cockpit/`, `cart/effects/`, `cart/browser/`, `cart/inspector/` | Bigger reference carts. |
| `cart/dictation.tsx`, `cart/voice_lab.tsx`, `cart/whisper_bench.tsx`, `cart/pocket_operator.tsx` | Voice / VAD / whisper / synth. |
| `cart/watchdog.tsx`, `cart/ifttt_test.tsx` | IFTTT registry + per-process memory/CPU watcher demos. |
| `cart/chat-loom.tsx`, `cart/flow_editor.tsx`, `cart/card_grid.tsx`, `cart/nested_grid.tsx`, `cart/tile_drag.tsx`, `cart/context_menu_demo.tsx`, `cart/clipboard_menu_test.tsx`, `cart/rotate_text.tsx` | Standalone UX experiments. |

Everything else (`hello*`, `host_smoke`, `host_test`, `render-test`, `shadow_test`, `transparency_test`, `tooltip_test`, `text_chop_test`, `input_lab`, `router_probe`, `load_via_*`, `spinner`, `braille_graph`, `d152`, `canvas_stress`, `hello_stress`, `graph_demo`) is smoke / regression / contract carts.

A cart manifest is a small `cart.json` next to the entry: `name`, `description`, `customChrome`, `width`, `height`. That's the whole format.

## Primitives

Exported from `runtime/primitives.tsx`:

```
Box  Row  Col  Text  Image  Pressable  ScrollView
TextInput  TextArea  TextEditor  Terminal
Window  Notification
Canvas     Canvas.Node  Canvas.Path  Canvas.Clamp
Graph      Graph.Path   Graph.Node
Physics
Video  Cartridge  RenderTarget  StaticSurface
Render  Effect  Native
```

Each primitive emits a host-node type string (`'View'`, `'Text'`, `'Canvas'`, `'Window'`, `'Cartridge'`, …) that the reconciler host passes into the Zig runtime.

**HTML tag remapping** (`renderer/hostConfig.ts`): `div`/`section`/`article`/`aside`/`main`/`nav`/`header`/`footer`/`form`/`a`/`button`/`details`/`summary`/`dialog`/`menu`/list and table tags → `View`; `h1`–`h6`, `p`, `span`, `label`, `strong`/`em`/`b`/`i`, `code`/`small`/`mark`/`abbr`/`cite`/`q`/`time`/`sub`/`sup` → `Text`; `img` → `Image`; `video` → `Video`; `input` → `TextInput`; `textarea` → `TextEditor`; `pre` → `CodeBlock`; `math` → `Math`. `aria-*`, `data-*`, and HTML-only props are stripped at the bridge.

**Tailwind via `className`** — parsed by `tw()` in `runtime/tw.ts` at CREATE time, merged into `style`.

**CSS transform stack** is real: `transform: rotate(...) scale(...) translate(...)` composes into a 2D matrix consumed by paint, hit-test, and clipping.

**Theme tokens** — props can carry `'theme:NAME'` strings; primitives resolve them against the active classifier snapshot. Hex/rgba literals belong only in theme files.

`Native` is the universal escape hatch — `<Native type="X" />` emits CREATE with that type string and the Zig host handles it.

### Drawing, graphs, physics, audio, 3D

- **`<Canvas>`** (`Canvas.Node`, `Canvas.Path`, `Canvas.Clamp`) — pan/zoomable drawing surface with `gx/gy/gw/gh` graph-space coordinates and SVG `d`/`stroke`/`strokeWidth`/`fill` on paths. Real uses across `cart/canvas_stress`, `cart/graph_demo`, `cart/cockpit`, and many sweatshop components (mermaid renderer, chemistry molecule view, gamepad sticks, audio patchbay, noise field, graph canvas, cockpit heatmap).
- **`<Graph>`** (`Graph.Path`, `Graph.Node`) — static-viewport polyline/path surface. Drives the chart family in `cart/component-gallery/components/` (area, bar, boxplot, bubble-*, candlestick, combination, contour, donut, fan, polar, radar, scatterplot, spline, waterfall, …) and the cart-side Lucide icon renderer.
- **`<StaticSurface>`** suspends layout/paint inside its subtree until explicitly resumed — basis for the render-surface VM and the kitty/headless capture path.
- **Physics.** `framework/physics2d.zig` + `framework/physics3d.zig` are bridged via `cart/sweatshop/components/physics/`: `<PhysicsWorld>`, `<RigidBody>`, `useBodyState`, `useForce`, `usePhysics`. Box2D is feature-gated. Working integration inside sweatshop, not yet a runtime-level export.
- **Audio.** `framework/audio.zig` exposes a modular synth graph (`__audioInit`, `__audioAddModule`, `__audioConnect`, `__audioNoteOn/Off`, `__audioSetParam`, `__audioMasterGain`). `cart/pocket_operator.tsx` is the reference cart and registers `mixer`, `delay`, and a `pocket` drum/synth voice. There is no `<Audio>` React primitive; carts call host functions directly.
- **3D.** `cart/sweatshop/components/scene3d/` (`Scene3D`, `Mesh`, `OrbitControls`, `PointLight`, `DirectionalLight`, `StandardMaterial`, `useScene3D`) on top of the engine's wgpu primitives. Same status as physics: cart-level, not promoted to runtime.

### Voice + whisper

`framework/voice.zig` opens an SDL3 mic stream and runs libfvad's WebRTC VAD over it; `useVoiceInput` (`runtime/hooks/useVoiceInput.ts`) exposes per-frame VAD trace, peak-dBFS level, and confirmed utterance buffers. `whisper.cpp` is vendored at `deps/whisper.cpp/` (CPU-only, dynamic-linked `libwhisper.so`); `framework/whisper.zig` runs `whisper_full` on a worker thread, transcripts return via `__voice_onTranscript`. `useEnsembleTranscript` runs tier-escalating whisper passes with inline candidate proposals and consensus voting. Models are fetched with `scripts/fetch-whisper-models`. Reference carts: `voice_lab` (tuning surface), `dictation` (consumer), `whisper_bench` (timing harness). Plan in `framework/WHISPER_TODO.md`.

### IFTTT + watchdog

`framework/ifttt.zig` (with `framework/lua/ifttt.lua`) is a registry + bus that folds compositional triggers from registered sources (`proc:*`, `fs:*`, clipboard, signals) into rule-driven actions, with payload substitution. The cart-side hook is `runtime/hooks/useIFTTT.ts` (plus `ifttt-compose.ts` and `ifttt-registry.ts`). `framework/watchdog.zig` is the per-process memory/CPU watcher. `cart/watchdog.tsx` is the live demo (kill-log, leak-on-demand, absolute-byte thresholds); `cart/ifttt_test.tsx` is the rule-bus smoke cart.

## Host bindings

The V8 host registers **338 functions** on the JS global, split across 16 binding files (`grep -h registerHostFn framework/v8_bindings_*.zig | wc -l`):

| File | Count | Surface |
|------|------:|---------|
| `privacy` | 66 | sha256/hmac/hkdf, xchacha20, libsodium, GPG, keyring, Noise, Shamir, audit log, PII detect/redact, steganography, secure buffers, manifest verify, policy/consent |
| `sdk` | 62 | sqlite (`__sql_*`), DuckDB (`__db_query`), local store, hot state, IPC, browser-page, coding agents (`__claude_*`, `__kimi_*`, `__localai_*`), recorder/replay, terminal recorder, router |
| `core` | 56 | input / clipboard / window, audio graph, classifier, hot-state, kv store, JS eval, frame timers (`getFps`, `getTickUs`, `getLayoutUs`, `getPaintUs`), `__nowMs`, `__sleepMs`, `__exit` |
| `telemetry` | 48 | `__tel_frame/gpu/layout/input/net/state/system/canvas/history/nodes/node*`, `__sem_*` semantic graph, PTY, kvstore |
| `fs` | 42 | `__fs_read/write/readfile/writefile/exists/list_json/scandir/stat_json/mkdir/remove`, media index, watchers, file-drop |
| `cli` | 23 | `__argv`, `__cwd`, `__readFile`, `__spawn`/`__spawnSync`, unix-socket client, exit, telemetry counters. Used by `tools/v8cli` for build-time scripts |
| `net` | 8 | `__tcp_*`, `__udp_*`, `__socks5_register/unregister` |
| `process` | 7 | `__proc_spawn`, `__proc_kill`, `__proc_stat`, `__proc_stdin_write/close`, `__proc_watch_add/remove` (watchdog source) |
| `gameserver` | 6 | `__rcon_open/command/close`, `__a2s_open/query/close` (Source-engine RCON + A2S query) |
| `voice` | 5 | `__voice_start/stop/set_mode/set_floor/release_buffer` |
| `wsserver` | 4 | `__wssrv_listen/send/broadcast/close` |
| `websocket` | 3 | `__ws_open/send/close` |
| `httpserver` | 3 | `__httpsrv_listen/respond/close` |
| `tor` | 2 | `__tor_start/stop` (real bootstrap, exposes `socksPort`/`hostname`/`hsPort`) |
| `zigcall` | 2 | `__zig_call`, `__zig_call_list` (generic Zig FFI) |
| `whisper` | 1 | `__whisper_transcribe` |

TypeScript wrappers and React hooks under `runtime/hooks/`:

```
fs.ts  http.ts  sqlite.ts  crypto.ts  clipboard.ts  process.ts
localstore.ts  websocket.ts  browser_page.ts  media.ts  whisper.ts
math.ts  ifttt-registry.ts  ifttt-compose.ts

useConnection          — streaming HTTP / SSE / WS / TCP / UDP, kind+via composition
useHost                — declarative HTTP / WS / TCP server inside a cart
useVoiceInput          — SDL3 mic + libfvad VAD
useEnsembleTranscript  — multi-model whisper consensus with tier escalation
useIFTTT               — register triggers, fire actions
useTelemetry           — fps / gpu / nodes / state / history in one hook
useHotState            — hot-reload-surviving state (work in progress)
useFileContent  useFileWatch  useFileDrop  useLocalStore
useCRUD  useMedia  useFuzzySearch  usePrivacy  useTerminalRecorder
useContextMenu
```

`runtime/hooks/index.ts:installBrowserShims()` installs `fetch`, `localStorage`, and a no-op `WebSocket` stub for paste-compatibility.

### Networking trichotomy

All networking funnels through three hooks split by **direction**, with a `kind` for protocol and `via:` for transport composition:

| Hook | Direction |
|------|-----------|
| `useHost`       | I bind a port / I own a process. Server-side. |
| `fetch()`       | One-shot outbound request, no persistent state. SSE supported. |
| `useConnection` | Persistent outbound channel I don't own the other end of. |

Wired today: `ws`, `tcp`, `udp`, `http`/SSE, `tor` (real bootstrap), `socks5`, `tcp via:tor`, `tcp via:socks5`. `wireguard`/`stun`/`peer` are typed and reserved but not yet implemented. RCON + A2S Source Query bindings exist for game-server carts.

### Coding agents

`__claude_*`, `__kimi_*`, `__localai_*` host bindings drive long-running agent sessions. Standalone `claude_runner.zig` ships a Zig CLI wrapper around `framework/claude_sdk/`.

### Render surfaces

`framework/render_surfaces.zig` + `render_surfaces_vm.zig` provide a render suspend/resume pipeline (kitty/VM/headless) with clipboard and signal watchers — useful for the dev host and for headless capture.

### Not available (no browser context)

`window`/`document`/`navigator` in any meaningful sense, `sessionStorage`, `IndexedDB`, cookies, `Blob`, `FormData`, `FileReader`, `XMLHttpRequest`, CSS Grid, media queries, pseudo-classes, inline SVG, blob URLs. Closer to React Native than browser React.

## Getting started

Prerequisites: Linux (macOS path exists, Linux is the daily driver). The repo is **node-free** — `tools/v8cli` is the standalone V8 script host that runs every build-time `.js` script (no npm, no bun, no node). A pinned Zig toolchain ships under `tools/zig/` (fetched by `scripts/fetch-zig.sh`) so a fresh clone bootstraps without a system Zig.

```bash
./scripts/ship  <cart-name>        # bundle + zig build + self-extracting binary (release)
./scripts/ship  <cart-name> -d     # debug ELF, skips packaging
./scripts/run   <cart-name>        # launch a previously-built binary
./scripts/dev   <cart-name>        # push cart into the persistent dev host
./scripts/init  <directory>        # scaffold a new cart from a template
./scripts/help                     # subcommand help
```

`scripts/ship` always builds against V8 (`-Duse-v8=true`). The QJS host (`qjs_app.zig`) is still in the tree but no longer reachable from the ship path — maintenance-only legacy. Do not build new features against it.

What `ship` does:

1. `scripts/cart-bundle.js` (run under `tools/v8cli`) bundles `cart/<name>.tsx` (or `cart/<name>/index.tsx`) → `bundle-<name>.js`.
2. The metafile resolver inspects esbuild's output and selects `-Dhas-*` feature flags from `sdk/dependency-registry.json` (gates libsqlite3, libvterm, libwhisper, libfvad, box2d, duckdb, etc.).
3. `zig build app -Duse-v8=true -Dbundle-path=...` → `zig-out/bin/<name>` (ELF, dynamic-linked, bundle embedded via `@embedFile`).
4. `ldd`-walk + bundled `ld-linux` + glibc family + the cart's transitive `.so`s tarballed under a self-extracting shell wrapper.

First run extracts to `~/.cache/reactjit-<name>/<sig>/` and execs through the bundled `ld-linux`. Cross-distro: `deps/sysroot/` ships glibc family + SDL3 transitive deps so the binary runs on fresh Whonix / Debian / Ubuntu / Fedora without a system toolchain or shared-library install.

`scripts/ship` and `scripts/dev` split `RJIT_HOME` (the SDK install) from `CART_ROOT` (the user's project). `scripts/pack-sdk.js` produces a self-contained SDK tarball; the SDK ships its own Zig, sysroot, and pkg cache so cart binaries build off-tree without root.

The dev host is a long-lived `ReleaseFast` binary listening on `/tmp/reactjit.sock`. `scripts/dev` bundles to `.cache/bundle-<cart>.js` and pushes over IPC; a second `scripts/dev <other>` adds a tab to the same host. Save-to-visible is ~300 ms for TSX/TS edits. A rebuild is required for changes under `framework/`, `build.zig`, or `scripts/`. Debug builds have a pre-existing click-path issue — stick to the default `ReleaseFast` for dev work. `useHotState` is wired but state does not survive reloads today.

## Layout

```
cart/                 .tsx carts (single-file or directory-based with index.tsx)
runtime/              JS entry (runtime/index.tsx), primitives.tsx, classifier.tsx,
                      tw.ts, JSX shim, host shims, hook wrappers under runtime/hooks/,
                      router, theme, icons, intent system.
renderer/             react-reconciler host config + mutation command stream.
framework/            Zig runtime
  layout/engine/text/gpu       — flexbox, paint, fonts, wgpu
  audio/voice/whisper          — synth graph, SDL3 mic + libfvad, whisper.cpp wrapper
  physics2d/physics3d          — Box2D (feature-gated) + 3D shim
  net/                         — http(s) client + streaming, websocket, ws-server,
                                 http-server, tcp/udp, socks5, tor, RCON, A2S, IPC
  ifttt/watchdog/process       — composable triggers + per-proc/fs sources
  claude_sdk/                  — long-running coding-agent sessions
  render_surfaces*             — suspend/resume render pipeline (vm, kitty, headless)
  v8_bindings_*.zig            — 338 host fns across 16 modules (cli/core/fs/
                                 gameserver/httpserver/net/privacy/process/sdk/
                                 telemetry/tor/voice/websocket/whisper/wsserver/zigcall)
  lua/ifttt.lua                — IFTTT compose helper (only Lua left in the active stack)
sdk/                  dependency-registry.json — feature → -D flags + bundle policy
scripts/              ship, run, dev, init.js, help.js, cart-bundle.js,
                      push-bundle.js, pack-sdk.js, sdk-dependency-resolve.js,
                      fetch-zig.sh, fetch-whisper-models, fetch-v8-prebuilt.sh,
                      autotest, classify, watchdog.sh.
tools/v8cli           Standalone V8 script host. Replaces every former
                      `node scripts/X.mjs` invocation. Zero npm/node/bun deps.
tools/zig/            Pinned Zig toolchain (populated by scripts/fetch-zig.sh).
deps/                 Vendored: zig-v8, wgpu_native_zig, vello_ffi, libfvad,
                      whisper.cpp, llama.cpp.zig, libvterm, duckdb, tls.zig,
                      sysroot, v8-prebuilt.
vendor/               Pinned react, react-reconciler, scheduler, typescript.
build.zig             Root build.

v8_app.zig            Default cart host. Embeds V8 via deps/zig-v8.
qjs_app.zig           Legacy QuickJS host. Maintenance-only, not on the ship path.
v8_hello.zig          Minimal V8 smoke-test host.
v8_cli.zig            Backing host for tools/v8cli.
claude_runner.zig     Standalone Zig CLI around framework/claude_sdk/.

tsz/                  FROZEN. Smith-era AOT-compile-.tsz-to-Zig experiment.
love2d/               FROZEN. The reconciler-on-Lua predecessor stack.
archive/              FROZEN. Earlier compiler iterations.
os/                   Speculative (CartridgeOS). Mostly stubs.
```

Frozen trees are read-only reference material. The JSRT (JS-inside-Lua evaluator) experiment is gone; the only Lua left in the active stack is `framework/lua/ifttt.lua` and a small `tsl_stdlib.lua` support file.

## Status

| Working | Incomplete / pending |
|---|---|
| V8 host (default), single ship path | QJS host kept around but not on the ship path |
| Every primitive listed above, HTML remap, Tailwind, CSS transforms | Multi-window orchestration beyond `__window_*` / `__openWindow` |
| Voice capture (SDL3 + libfvad VAD) + whisper.cpp ensemble transcription | Whisper streaming + diarization polish (see `framework/WHISPER_TODO.md`) |
| IFTTT registry + compose, watchdog cart, `proc:*` / `fs:*` sources | More built-in IFTTT sources |
| Networking trichotomy (`useHost` / `fetch` / `useConnection`) wired for ws/tcp/udp/http/SSE/tor/socks5 | `wireguard` / `stun` / `peer` connection kinds |
| RCON + A2S Source Query for game-server carts | No `<Audio>` React primitive — carts call `__audio*` directly |
| Privacy / crypto stack: GPG, keyring, Noise, Shamir, steganography, audit logs, PII redaction, secure buffers | Inspector UI cart (host telemetry plumbing exists; UI sparse) |
| Persistent dev host + IPC bundle-push + hot reload | `useHotState` state persistence across reloads |
| `scripts/ship` self-extracting packaging, cross-distro sysroot bundling | Video primitive end-to-end |
| Render suspend/resume + kitty/VM/headless render surfaces | Standalone `rjit` dispatcher (templates + help present, dispatcher in progress) |
| CSS transform stack (rotate/scale/translate via matrix), z-index scissor breakouts for context menus | Physics + 3D still cart-side integrations under `cart/sweatshop/components/`, not runtime exports |
| Coding-agent host APIs: `__claude_*`, `__kimi_*`, `__localai_*` + standalone `claude_runner.zig` | macOS path: cross-compile works, native dev loop unverified recently |
| `cart/app/` onboarding + homepage v1, 128-component gallery with theme classifiers | |

## Pointers

- [`AGENTS.md`](AGENTS.md) — contributor conventions for AI/agent work.
- [`CLAUDE.md`](CLAUDE.md) — Claude Code-specific rules (frozen trees, git discipline, hard bans, V8-is-default reminder, banned shell commands).
- [`framework/WHISPER_TODO.md`](framework/WHISPER_TODO.md) — voice → whisper integration plan.
- `sdk/dependency-registry.json` — single source of truth for tools, vendored packages, native libs, feature flags.
- `git log` — the real story of how this got here. Prior eras (react-love → iLoveReact → multi-target ReactJIT → SDL2/Love2D → Smith/.tsz → JSRT-evaluator detour → current Zig+V8 cart runtime) are all in there.
