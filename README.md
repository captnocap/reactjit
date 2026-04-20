# ReactJIT

its react! (kinda) its fast! (really fast) hi. all the code in this project is an accident from a bad joke. the code is not a joke, how it came to be was though. also, i didnt write a single line of code in here, and this readme is also ai generated after i finish my brief intro. this is really now just one big experiment that started from asking how i could put the react based game i was making, inside of a monitor in cs_office, things really got out of hand after that. this is a series of fortunate (or unfortunate) events that all came from asking 'how' and then following with 'if that worked, what about this'. we will see where this all lands at the 60 day mark and again at the 90 day mark. thanks for stopping by

---

Write React. Get a single-file native binary. Copy-paste components from any React project. JSX, hooks, tailwind classes, HTML tags (`<div>`, `<button>`, `<h1>`), setState, useEffect — all work. Layout, paint, hit-test, events, input, text, GPU are native Zig. React runs inside the framework's in-process QuickJS VM, drives a Zig-owned `Node` pool via a react-reconciler host. No virtual DOM on the output side — React's mutations land directly as CREATE/UPDATE/APPEND commands against real Nodes.

```
cart/my_app.tsx (standard React + JSX + hooks)
   │
   ▼
esbuild → bundle.js
   │
   ▼
@embedFile into qjs_app.zig
   │
   ▼
zig build → ELF + framework/ (layout, GPU, events, text, effects)
   │
   ▼
scripts/ship packages with ld-linux + all .so deps
   │
   ▼
self-extracting single-file binary (runs anywhere, no system deps)
```

```tsx
// cart/counter.tsx
import { useState } from 'react';
import { Box, Text, Pressable } from '../runtime/primitives';

export default function Counter() {
  const [count, setCount] = useState(0);

  return (
    <Box className="p-8 gap-4 bg-slate-900">
      <Text fontSize={28} color="#ffffff">Counter</Text>
      <Text fontSize={48} color="#ff79c6">{String(count)}</Text>
      <Pressable
        onPress={() => setCount(count + 1)}
        className="p-4 bg-teal-500 rounded-lg"
      >
        <Text fontSize={16} color="#ffffff">+ Increment</Text>
      </Pressable>
    </Box>
  );
}
```

One file. `./scripts/ship counter`. Done — `zig-out/bin/counter` is shippable anywhere.

---

## Quick Start

```bash
# Build a cart into a self-extracting native binary:
./scripts/ship counter          # cart/counter.tsx → zig-out/bin/counter

# Debug build (raw ELF for gdb/ldd inspection, at zig-out/bin/<name>-raw):
./scripts/ship counter -d

# Release, raw ELF (no self-extracting wrapper), for ldd inspection:
./scripts/ship counter --raw

# Directory-based cart layout also works (cart/counter/index.tsx):
./scripts/ship counter
```

The `ship` pipeline:
1. **esbuild** bundles `cart/<name>.tsx` + `runtime/` + `renderer/` into `bundle.js`.
2. **Zig build** compiles `qjs_app.zig` (the reconciler host) with `bundle.js` embedded via `@embedFile` — the binary carries its own JS.
3. **Package** (Linux): `ldd` walks deps, bundles every non-system `.so` + `ld-linux` into a lib/ dir, prepends a self-extracting shell wrapper that extracts to `~/.cache/reactjit-<name>/<sig>/` on first run.
4. **macOS**: `.app` bundle with `Frameworks/` dylib rewrites, ad-hoc codesigned.

Result: **one file, no system dependencies, runs anywhere.**

---

## Dev Loop (hot reload)

```bash
./scripts/dev cockpit           # launches persistent dev host, watches cart/cockpit
./scripts/dev inspector         # in a second terminal: pushes to running host, adds a tab
./scripts/dev cockpit           # re-push cockpit → switches back to that tab
```

One persistent ReleaseFast binary at `zig-out/bin/reactjit-dev` hosts every cart you push. The dev host is borderless — the top strip IS the window chrome, with tabs for each pushed cart, window controls on the right, double-click to maximize, drag empty chrome to move, edge-drag to resize.

**When to rebuild:**

| What you changed | Action |
|---|---|
| `cart/**`, `runtime/**`, `renderer/**` (React / TSX / TS) | **Nothing.** Save the file — esbuild rebundles and pushes over `/tmp/reactjit.sock`, host tears down QJS + re-evals in ~300ms. |
| `framework/**`, `qjs_app.zig`, `build.zig`, `scripts/**` | **Rebuild the dev binary.** Delete `zig-out/bin/reactjit-dev` then re-run `./scripts/dev <cart>`, or explicitly: `zig build app -Ddev-mode=true -Doptimize=ReleaseFast -Dapp-name=reactjit-dev`. |

Tab switching tears down the QJS context fully and re-evals the target cart's bundle — React state (`useState` / `useRef`) resets on every reload. A `useHotState` hook + `framework/hotstate.zig` scaffold exists for state preservation but **isn't working yet** — don't rely on atoms surviving reloads.

Dev mode always compiles `-Doptimize=ReleaseFast`; the Debug build has a pre-existing framework bug that silently crashes on any click.

---

## What's Real on the .tsx Side

### Works out of the box (copy-paste from any React project)

- **All standard hooks** — `useState`, `useEffect`, `useRef`, `useMemo`, `useCallback`, `useContext`, custom hooks
- **HTML tags** — `<div>`, `<span>`, `<p>`, `<button>`, `<a>`, `<img>`, `<input>`, `<h1>`–`<h6>`, `<section>`, `<nav>`, `<header>`, `<footer>`, `<ul>`, `<li>`, `<table>`, and friends. Remapped to native primitives in `renderer/hostConfig.ts`. HTML-only attrs (`alt`, `htmlFor`, `aria-*`, `data-*`, `tabIndex`) stripped before the bridge. Headings auto-size (h1=32, h2=28, …, h6=16).
- **Tailwind via `className`** — full utility coverage via `runtime/tw.ts` (ported from love2d): spacing (`p-4`, `mx-8`), sizing (`w-full`, `h-[300]`), flex (`flex-row`, `gap-2`, `justify-center`, `items-start`), colors (`bg-blue-500`, `text-slate-200`), radius (`rounded-lg`), borders (`border-2`), typography (`text-xl`, `font-bold`), arbitrary bracket values (`p-[20]`, `bg-[#ff6600]`).
- **Style props + `className` together** — mix freely, `style` wins on conflicts.
- **Timers** — `setTimeout`, `setInterval`, `clearTimeout`, `clearInterval`, `performance.now()` all real, backed by the engine's frame clock.
- **Events** — `onClick`, `onPress`, `onChangeText`, `onSubmit`, `onHoverEnter`/`onHoverExit`, `onKeyDown`, `onScroll`, `onRightClick`/`onContextMenu`. Bidirectional: press → Zig hit-test → `js_on_press` eval → React handler → state change → commit → new mutations → same Node pool.

### Works via hooks (`runtime/hooks/`)

Shipped surfaces you can import directly — see `runtime/hooks/README.md` for the full matrix.

- **`fs`** — `readFile`, `writeFile`, `exists`, `listDir`, `mkdir`, `remove`, `stat` (absolute or CWD-relative paths)
- **`localstore`** — persistent key/value via SQLite under the app data dir. `installLocalStorageShim()` aliases it to `globalThis.localStorage`.
- **`sqlite`** — handle registry, JSON param binding, `query_json` → typed row objects
- **`http`** — `get/post` sync (via `curl` subprocess) and `getAsync/postAsync` (libcurl worker pool, drained each tick). `installFetchShim()` aliases it to `globalThis.fetch`.
- **`crypto`** — `randomBytes`, HMAC-SHA256, HKDF-SHA256, XChaCha20-Poly1305 encrypt/decrypt (base64-encoded across the bridge)
- **`clipboard`** — system clipboard get/set
- **`process.envGet`/`envSet`/`exit`** — `std.posix` / libc wrappers

`runtime/hooks/index.ts` has a `installBrowserShims()` one-liner that installs `fetch` + `localStorage` globals for copy-pasted code.

### Still missing (framework exists, Zig binding pending)

- **`WebSocket`** — `framework/net/websocket.zig` needs a small Zig 0.15 writer-API migration before its hooks can land. `installWebSocketShim()` is a no-op stub today.
- **Long-running subprocess with stdout/stderr streaming** — `framework/process.zig` has spawn/kill but no pipes; per-child read-thread infra pending.
- **Shamir secret split/combine** — framework has it (hex I/O); hook wrapper not yet written.

### Doesn't work (no browser context)

- **No `window`/`document`/`navigator`/`location`** — minimal shims exist so copy-pasted code doesn't crash, but DOM manipulation is a no-op.
- **No `sessionStorage`, `IndexedDB`, cookies** — out of scope; use `localstore` for persistent state.
- **No `XMLHttpRequest`, `URL`, `Blob`, `FormData`, `FileReader`** — undefined.
- **Inline `<svg>` with `<path>`/`<circle>`/`<rect>`** — not remapped. Use `<Canvas.Path d="..." />` or `<Graph.Path>` instead.
- **CSS `@media`, CSS Grid, CSS `:hover`/`:focus` pseudo-classes, CSS transitions/animations** — not parsed. Use `useEffect` + interval for animations, `onHoverEnter`/`onHoverExit` for hover state.
- **Images** — png/jpg/bmp/tga/gif via stb_image only. No blob URLs.

### Library compatibility

- **Pure-JS state libs** (zustand, jotai, xstate, redux, immer) — work.
- **react-query / swr** — work, once you `installFetchShim()` (or swap their fetcher for the `http` hook).
- **Headless component libs** (Radix, Headless UI, React Aria) — don't work (DOM refs).
- **Styled component libs** (MUI, Chakra, Ant Design, Tailwind UI) — don't work (DOM CSS cascade).
- **Animation libs** (framer-motion, react-spring) — partial; hook state works, imperative DOM manipulation doesn't.
- **react-router** — memory mode works.
- **React Native libs** — port naturally (same flex layout + primitive model).

This is closer to React Native than browser React. Great for dashboards, forms, internal tools, games, visualizers, music apps, chat UIs, creative coding. Not for e-commerce checkout flows.

---

## Primitives

From `runtime/primitives.tsx`:

- **Layout / text**: `Box`, `Row`, `Col`, `Text`, `Image`, `Pressable`, `ScrollView`, `TextInput`, `TextArea`, `TextEditor`
- **Canvas** (pan/zoomable surface): `Canvas`, `Canvas.Node`, `Canvas.Path`, `Canvas.Clamp` — with `gx/gy/gw/gh` coordinate-space positioning and SVG `d`/`stroke`/`strokeWidth`/`fill` props on paths
- **Graph** (static-viewport chart surface): `Graph`, `Graph.Path`, `Graph.Node`
- **Native** — universal escape hatch: `<Native type="Audio" src="song.mp3" />`, `<Native type="Video" src="clip.mp4" />`, `<Native type="Cartridge" src="sidebar.so" />`

Custom host-handled types (Audio, Video, Cartridge, LLMAgent, RigidBody, etc.) use `Native` — the reconciler emits CREATE with that type string, the Zig host handles it. Exposing these each as first-class JSX primitives is incremental work.

---

## Runtime Shims

Ported from love2d's runtime (`love2d/packages/core/src/`):

- **`runtime/classifier.tsx`** — global classifier registry. Define once at app init, use everywhere:
  ```ts
  classifier({
    Card: { type: 'Box', style: { padding: 16, borderRadius: 8, backgroundColor: 'theme:surface' } },
    Title: { type: 'Text', size: 24, bold: true, color: 'theme:text' },
  });
  // Then: import { classifiers as C } from '../../runtime/classifier';
  //       <C.Card><C.Title>Hi</C.Title></C.Card>
  ```
  Supports static defaults, `'theme:*'` token resolution, and hook-powered defaults via a `use` field.

- **`runtime/theme.tsx`** — `<ThemeProvider colors={...}>` + `useThemeColors()` / `useThemeColorsOptional()`. Minimal (single colors map, no multi-theme switching); extend when needed.

- **`runtime/tw.ts`** — tailwind class-to-style parser, 819 lines.

---

## Framework Modules

The Zig runtime at `framework/` — ~45k lines across categories:

| Category | Modules |
|----------|---------|
| Core | `engine`, `engine_paint`, `state`, `events`, `input`, `layout`, `text`, `geometry`, `math`, `random`, `lib` |
| Rendering | `gpu/`, `render_surfaces`, `render_surfaces_vm`, `effects`, `effect_ctx`, `effect_shader`, `easing`, `transition`, `canvas`, `svg_path`, `blend2d`, `vello`, `engine_web` |
| UI | `theme`, `classifier`, `selection`, `tooltip`, `context_menu`, `router`, `query`, `windows`, `applescript` |
| Cartridge | `cartridge`, `cartpack`, `dev_shell`, `devtools`, `devtools_state`, `api`, `core` |
| Terminal | `pty`, `pty_client`, `pty_remote`, `vterm`, `semantic` |
| Networking | `qjs_ipc`, `net/` |
| Media | `audio`, `player`, `videos`, `recorder`, `capture` |
| Data | `fs`, `fswatch`, `sqlite`, `localstore`, `archive`, `crypto`, `privacy` |
| Scripting | `qjs_runtime`, `qjs_value`, `qjs_semantic`, `qjs_c`, `luajit_runtime`, `luajit_worker`, `lua_guard` |
| Agent | `agent_core`, `agent_session`, `agent_spawner` |
| Tools | `tool_framework`, `tools_builtin` |
| Dev | `telemetry`, `log`, `log_export`, `testharness`, `testdriver`, `testassert`, `debug_client`, `debug_server`, `watchdog`, `witness` |
| System | `process`, `child_engine`, `physics2d`, `physics3d`, `filedrop`, `breakpoint`, `crashlog`, `c` |

Most subsystems **exist in Zig but aren't yet exposed as JSX primitives**. Window chrome (drag/resize regions), terminal, video, audio, 3D rendering, physics, LLM/Claude/Codex/AppleScript — the framework implements them; wiring them into `qjs_app.zig`'s CREATE path + exposing as primitives is incremental work. `<Native type="X" />` is the universal bridge until they get first-class wrappers.

---

## Performance

Vsync-locked to monitor refresh by default (`.fifo` present mode). Uncap with `ZIGOS_VSYNC=0 ./zig-out/bin/<app>` for profiling.

**Build**:
- esbuild bundle: ~30–100ms
- zig build (cached engine): ~1–3s
- packaging (ldd walk + tarball): ~500ms

**Runtime** (representative: spinner cart, 240Hz monitor, vsync on):
- FPS: 240 (vsync-locked)
- Layout: sub-ms
- Paint: ~250µs
- QJS→Zig bridge: 52M setState calls/sec (not a bottleneck; layout is)

**Binary size**: ~24MB self-extracting (compressed tarball with ~57 bundled `.so` libs + ld-linux + ELF).

---

## Repository Layout

Active stack at the root:

```
framework/         Zig runtime (layout, engine, GPU, events, input, state,
                   effects, text, windows, QuickJS bridge). ~45k lines.
qjs_app.zig        React-reconciler host. Loads embedded bundle.js into
                   framework's in-process QuickJS, owns Node pool, wires events.
runtime/           JS entry (index.tsx), timer subsystem, primitives,
                   classifier, theme, tw (tailwind parser), JSX shim,
                   window/document shims.
renderer/          react-reconciler host config. Emits CMD JSON via
                   __hostFlush. HTML tag remap, className parsing, handler
                   extraction, subscription manager.
cart/              .tsx apps. Single-file (cart/foo.tsx) or directory-based
                   (cart/foo/index.tsx) layouts both work.
scripts/           ship (one-command build), build-bundle.mjs (esbuild wrapper).
build.zig          Root build, linking parity with Smith-era app target.
stb/               stb_image headers (needed by framework GPU).
```

Frozen reference directories — **read-only, do not modify**:

```
tsz/               Smith-era stack (50-day experiment). .tsz compiler,
                   d-suite conformance, cockpit/Sweatshop .tsz carts,
                   InspectorTsz tools. Useful for screenshots + porting
                   reference.
love2d/            The proven reconciler-on-Lua stack. 30+ packages, a full
                   storybook, classifier + theme + tw + hooks all battle-
                   tested. Primary reference for any runtime pattern.
archive/           Old compiler iterations (v1/v2 tsz).
os/                Future (CartridgeOS). Mostly stubs.
game/              Dead Internet Game. Separate project.
```

---

## Why This Shape

For 50 days this project built `.tsz` — a custom DSL that compiled via Smith (a JS compiler running in QuickJS hosted by a Zig kernel called Forge) to generated Zig. The theory: AOT compilation would produce a faster-feeling UI than running React-reconciler in QuickJS at runtime.

The theory was wrong. A reconciler-over-QuickJS spike (`qjs_app.zig`) was written to compare, and it matched Smith's runtime feel exactly — because QJS→Zig is 52M calls/sec and **layout is the bottleneck, not JS execution**. AOT compilation bought nothing user-facing. Meanwhile, love2d had already shipped a full storybook in 30 days with the same reconciler-over-VM shape.

So the Smith-era stack is frozen at `tsz/` (treated like `love2d/` and `archive/` — reference only, do not modify). The active stack at the root is the reconciler path: write `.tsx`, ship a native binary. The ergonomics land in the same place — with the added bonus that copy-pasting React code from anywhere just works.

---

## Design Philosophy: Postel's Law

**Be conservative in what you send, be liberal in what you accept.**

The runtime accepts anything React emits. HTML tags. `className` with tailwind. Inline styles with arbitrary CSS-shaped objects. Handler props named any way you like (`onPress`, `onClick`, `onMouseEnter` — aliases normalize). `style.flex: 1` shorthand works. If something a model hallucinates parses as valid JSX, it should still render.

But the golden path is conservative. First-party code uses classifiers, theme tokens, semantic primitives, and the framework's style guide. The framework's own Zig code is strict and explicit. The freedom is at the boundary where external code enters the system.

---

*"Any sufficiently advanced technology is indistinguishable from magic." — Arthur C. Clarke*
