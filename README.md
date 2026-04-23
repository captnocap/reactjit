# reactjit

A general-purpose native runtime for React. Write plain `.tsx`, bundle with esbuild, ship a single-file binary. No DOM, no CSS engine, no browser.

React's reconciler emits CREATE/APPEND/UPDATE mutation commands against a Zig-owned node tree. Layout, paint, hit-test, events, input, text, and GPU are native Zig on top of V8 and wgpu. React is the algorithm, not the environment.

## Why

Copy-paste React components. Get native performance. Don't ship Chromium.

V8 standalone is ~6MB. Node+V8 is ~50MB. CEF is ~200MB. The "V8 is bloated" intuition is really "Chromium is bloated" — V8 itself is tight.

## Carts

Applications built on reactjit are called **carts**. A cart is a `.tsx` file (or directory) under `cart/`. Anything React can describe, a cart can be: an IDE, a physics sim, a game, an emulator, a dashboard, an audio visualizer, an agent UI.

```
cart/counter.tsx       one-file cart
cart/sweatshop/        directory cart — the current internal dev-driver IDE
cart/...               your cart goes here
```

`cart/sweatshop/` is one cart among many. It happens to be the IDE reactjit is developed inside of. It is not the framework.

## Primitives

```
Box  Row  Col  Text  Image  Pressable  ScrollView
TextInput  TextArea  TextEditor
Canvas  Canvas.Node  Canvas.Path
Graph  Graph.Path  Graph.Node
Native
```

Standard HTML tags (`<div>`, `<span>`, `<button>`, etc.) are remapped to these at reconcile time. Tailwind utilities work via `className` (parsed by `runtime/tw.ts`). `<Native type="X" />` is the universal escape hatch — it bridges to any Zig-handled node type until that type gets a first-class wrapper.

## Host bindings

Exposed on the JS global. Filesystem (`__fs_*`), subprocess (`__exec`), SQLite (`__store_*`), HTTP sync+async (`__http_*`), crypto (`__crypto_*`), clipboard, timers, and more. `installBrowserShims()` adds `fetch` and `localStorage`.

Not available: `window`/`document`, `sessionStorage`/`IndexedDB`, CSS Grid, media queries, pseudo-classes, inline SVG, blob URLs. This is closer to React Native than browser React.

## Getting started

Prerequisites: Zig 0.15.2, Node 20+.

```bash
./scripts/ship <cart-name>          # cart/<name>[.tsx] → self-extracting binary
./scripts/run  <cart-name>          # run the built binary (headless-capable)
./scripts/dev  <cart-name>          # persistent dev host, ~300ms hot reload
```

The JS runtime is V8 by default (`--qjs` opts into the legacy QuickJS host; maintenance-only). Dev builds run `ReleaseFast` — debug builds have a click-path bug and are not for daily work.

## Layout

```
cart/          .tsx cart apps
framework/     Zig runtime (~45k lines). Layout, engine, GPU,
               events, input, state, text, windows.
runtime/       JS entry, primitives, classifier, theme, tw, hooks.
renderer/      Reconciler host config. Mutation command stream.
scripts/       Build + dev tooling.
build.zig      Root build.

v8_app.zig     Active cart host (default, embeds V8).
qjs_app.zig    Legacy QuickJS host. Maintenance-only.
jsrt_app.zig   Alternate LuaJIT-based JS host.

tsz/ love2d/ archive/    Frozen reference trees — read-only. See git log
                         for backstory.
os/                      Future CartridgeOS. Mostly stubs.
```

## Status

| Working | Incomplete |
|---|---|
| V8 runtime, all primitives, HTML remapping, tailwind | Multi-window, Inspector |
| Host bindings (fs, http, crypto, clipboard, sqlite) | Physics/audio/video bridging |
| Dev host with hot reload                            | WebSocket hooks, subprocess pipes |
| Snapshot autotest gate in `scripts/ship`           | `useHotState` persistence across reloads |

## Contributing

See [`AGENTS.md`](AGENTS.md) for agent/AI contributor conventions. See [`CLAUDE.md`](CLAUDE.md) for Claude Code–specific guidance.

---

*"Any sufficiently advanced technology is indistinguishable from magic." — Arthur C. Clarke*
