# ReactJIT

This is an experiment. We don't know where it's going. It's a general-purpose stack that does whatever you point it at — coding tools, 3D scenes, physics sims, audio visualizers, agent UIs, dashboards, emulators. Put the fries in the bag.

Write React in plain `.tsx`. Bundle with esbuild. Get a single-file native binary. Copy-paste components from any React project. JSX, hooks, tailwind classes, HTML tags — all work. But there is no DOM, no CSS engine, no browser. React's reconciler emits CREATE/APPEND/UPDATE mutation commands against a Zig-owned `Node` pool. Layout, paint, hit-test, events, input, text, and GPU are native Zig/wgpu. React is the algorithm, not the environment.

The JS runtime is **V8** (embedded via zig-v8) — the default since April 2026. The prior QuickJS-based host (`qjs_app.zig`) hit a 2000ms-per-click ceiling on large React trees and is now maintenance-only legacy. `scripts/ship` builds V8 by default; `--qjs` is legacy opt-in.

The "V8 has baggage" myth is fake — the baggage is Chromium, not V8. V8 standalone is ~6MB. Node+V8 is ~50MB. CEF is ~200MB. We measured it. V8-qua-V8, embedded in a native app, is tight.

---

## The debugging arc that got us here

For several days we chased phantom performance problems. Multiple architecture refactors, redesigns, desperate attempts to fix what felt like a fundamentally slow runtime. The actual bottleneck turned out to be a synchronous `npx tsc` call in the React reconciler path — blocking every click. Once that was async'd, clicks dropped from ~1800ms to something reasonable. Moving to V8 at the same time gave headroom QJS couldn't provide. The final number: ~40ms clicks. That's a 75× improvement from one architecture discovery.

Before that: 50 days building `.tsz`, a Smith-era DSL that compiled ahead-of-time to Zig. Theory: AOT beats VM. Reality: layout is the bottleneck, not JS execution. AOT bought nothing user-facing and cost every language feature as emitter work. Frozen at `tsz/`.

Before that: `love2d/`, a proven reconciler-on-Lua stack with 30+ packages, storybook, classifier, theme, tw, hooks. Still frozen as read-only reference.

The LuaJIT detour (JSRT at `framework/lua/jsrt/`) is being unwound. JSRT is a JS evaluator in Lua running inside LuaJIT — JS stays JS as data, evaluator walks an AST. 12/13 targets passing. Interesting experiment, but not the default path.

---

## What's in it right now

### Working surfaces

- **IDE cart** (`cart/sweatshop/`, evolved from `cursor-ide`) — file tree, editor with syntax highlighting, git panel, search, command palette, agent chat, settings, theme editor. Multi-panel dock system. This is the daily-driver surface.
- **Primitives** — `Box`, `Row`, `Col`, `Text`, `Image`, `Pressable`, `ScrollView`, `TextInput`, `TextArea`, `TextEditor`, `Canvas`/`Canvas.Node`/`Canvas.Path`/`Canvas.Clamp`, `Graph`/`Graph.Path`/`Graph.Node`, `Native`.
- **HTML tag remapping** — `<div>`, `<button>`, `<h1>`–`<h6>`, `<img>`, `<input>`, etc. all map to native primitives. Copy-paste React markup from anywhere.
- **Tailwind via `className`** — full utility coverage at CREATE time.
- **Host bindings** — `__exec` (shell), `__fs_*` (file system), `__store_*` (SQLite localstore), `__http_*` (sync+async), `__crypto_*`, `__clipboard_*`, `__openWindow`, `__mermaidRender`, and others. See `runtime/hooks/README.md` for the full matrix.
- **Dev host with hot reload** — persistent binary, ~300ms save-to-visible for TSX changes.

### Incomplete / pending

- **Multi-window** — `__openWindow` host fn exists but the multi-window orchestration isn't wired end-to-end.
- **Physics FFI** — `framework/physics2d.zig` and `framework/physics3d.zig` exist but aren't bridged to JSX primitives yet.
- **Audio DSP** — framework has audio capture/playback; web-audio-style graph bridging is pending.
- **Video pipeline** — `framework/videos.zig` exists, not yet exposed as `<Native type="Video" />`.
- **Inspector** — planned, regenerate from `love2d/` reference. Don't port Smith-era `tsz/carts/tools/Inspector*.tsz`.
- **useHotState** — scaffolded but doesn't preserve state across reloads in practice.
- **WebSocket** — `framework/net/websocket.zig` needs a Zig 0.15 writer-API migration.
- **Subprocess streaming** — `framework/process.zig` has spawn/kill but no stdout/stderr pipes.

---

## Running it

```bash
./scripts/ship sweatshop          # self-extracting binary
./scripts/ship sweatshop -d       # debug/raw ELF
./scripts/ship sweatshop --raw    # release/raw ELF

./scripts/dev sweatshop           # hot-reload dev host
```

---

## Source layout

```
cart/                    .tsx apps. One file or directory-based.
cart/sweatshop/          Active IDE cart (was cursor-ide).

framework/               Zig runtime. ~45k lines. Layout, engine, GPU,
                         events, input, state, effects, text, windows.
framework/lua/jsrt/      JSRT evaluator in Lua. Alternate path, 12/13 targets.

runtime/                 JS entry, primitives, classifier, theme, tw,
                         JSX shim, window/document shims, hooks.
renderer/                Reconciler host config. Mutation command stream.
scripts/                 ship (one-command build), esbuild wrapper.
build.zig                Root build.

v8_app.zig               ACTIVE. V8-based cart host (default).
qjs_app.zig              LEGACY. QJS host. Maintenance-only.
jsrt_app.zig             JSRT host binary. Alternate path.

tsz/                     FROZEN. Smith-era compiler stack. Read-only.
love2d/                  FROZEN. Proven reconciler-on-Lua stack. Read-only.
archive/                 FROZEN. Old compiler iterations.
os/                      Future (CartridgeOS). Mostly stubs.
```

See [`AGENTS.md`](AGENTS.md) for agent/AI contributor conventions. See [`CLAUDE.md`](CLAUDE.md) for Claude Code specific guidance.

---

*"Any sufficiently advanced technology is indistinguishable from magic." — Arthur C. Clarke*
