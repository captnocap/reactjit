# packages/ — Framework Internals

This directory IS the framework. Changes here affect every project, every story, every example. Read carefully before touching anything.

---

## Package Landscape

The two load-bearing packages are `core` and `native` — they form the rendering pipeline and are required by everything. The rest are domain packages that add capabilities:

| Package | Role |
|---------|------|
| **`core`** | Primitives, components, hooks, animation, types — the React API surface |
| **`native`** | react-reconciler host config, instance tree, event dispatch, bridge — the runtime |
| `3d` | 3D scene, lighting, materials (Scene3D) |
| `ai` | LLM agent integration |
| `apis` | External API wrappers |
| `audio` | Audio playback, synth capabilities |
| `controls` | Higher-level UI controls |
| `crypto` | Cryptographic utilities |
| `geo` | Geolocation, maps |
| `media` | Video, media playback |
| `router` | Navigation / routing |
| `rss` | RSS feed parsing |
| `server` | HTTP server capabilities |
| `storage` | Persistent storage (SQLite, docstore) |
| `theme` | Theming system |
| `webhooks` | Webhook handling |

Domain packages follow the same source-of-truth rules: edit here, `make cli-setup` propagates to `cli/runtime/`, `reactjit update` propagates to projects.

---

## The Mental Model

There are two runtimes talking to each other through a narrow bridge:

- **JS side** — React + reconciler + hooks + components (this directory)
- **Lua side** — Layout engine + painter + event pump + capabilities

The bridge is **one-way write, poll-based read**:
- JS → Lua: `globalThis.__hostFlush(JSON.stringify(commands))`
- Lua → JS: `globalThis.__hostGetEvents()` polled each frame

Everything in this package either **produces commands** (reconciler), **routes events** (dispatcher), **abstracts the bridge** (IBridge), or **builds on top of those three** (hooks, components, capabilities).

---

## The Four Load-Bearing Pieces

### 1. `packages/native/src/hostConfig.ts` — The Reconciler Host

This is where React mutations become bridge commands. It is the most subtle file in the codebase.

**What it manages:**
- `Instance` — `{ id, type, props, handlers, children }`. ID is the Lua node's identity.
- `TextInstance` — `{ id, text }`. Separate type because text nodes are treated differently.
- The `handlerRegistry` — a Map from node ID to its handler functions. **Handlers never leave JS.** Only `hasHandlers: true` is sent to Lua so it knows to hit-test that node.
- **Command coalescing** — multiple `UPDATE` commands for the same node in one commit are merged into one. This is not optional; it's correctness, not optimization.

**Props diffing:** `UPDATE` only contains changed keys. Removed keys go in `removeKeys[]`. If you add a new prop category, make sure it's being diffed correctly — sending full props on every update is a bug.

**If you add a new host element type** (a new node Lua needs to know about), add it to the type system in `types.ts` first, then handle it in `createInstance`. Never invent a new op code without coordinating with the Lua side.

### 2. `packages/native/src/eventDispatcher.ts` — Event Routing

40+ event types, three dispatch strategies. Know which strategy each event uses before adding a new one:

| Strategy | What it means | Examples |
|----------|--------------|---------|
| **Bubbling** | Walk `bubblePath[]`, stop on `stopPropagation()` | `onClick`, `onRelease`, `onDragStart`, `onFileDrop` |
| **Target-only** | Delivered to the specific node, no bubbling | `onPointerEnter`, `onFocus`, `onScroll`, `onLayout` |
| **Broadcast** | Sent to every registered handler | `onKeyDown`, `onGamepadPress`, `onMidiNote`, `onTouchMove` |

**`bubblePath` normalization:** Lua tables can arrive as either arrays or keyed objects depending on how they're serialized. The dispatcher normalizes both. Do not assume array.

**Capability events:** Use the event's `handler` field to dynamically invoke the right prop (e.g., `onProgress`, `onEnded`). This is how `Audio`, `Timer`, etc. fire their callbacks without needing hardcoded routing.

**Keyboard routing subtlety:** If the event has a `targetId` (focused node), send to that node's handlers. If not, broadcast. Global hotkeys rely on the broadcast path.

### 3. `packages/native/src/NativeBridge.ts` — Transport

**The JSON serialization rule:** Commands are sent as `JSON.stringify(commands)`, not as raw objects. QuickJS's GC can silently drop object properties during FFI property enumeration if objects are large or have certain shapes. This is not a style preference — it is a correctness fix.

**RPC correlation:** `bridge.rpc(method, args)` generates a UUID, sends `{ type: 'rpc:call', id, method, args }`, then subscribes to `rpc:${id}`. The Lua side responds with that exact event name. The Promise resolves when the event arrives. Do not bypass this with direct subscribes for request-response patterns.

**Special event channels:** HTTP responses, streaming chunks, WebSocket frames, and capability events all have dedicated routing logic in `pollAndDispatchEvents`. If you add a new async protocol (a new kind of Lua callback), add a routing case here, not a one-off in a hook.

**`__deferMount` protocol:** Lua sets `globalThis.__deferMount = true` before evaluating the bundle. The app stores its render callback in `globalThis.__mount`. Lua calls `globalThis.__mount()` after eval returns. This prevents React from blocking QuickJS during bundle evaluation. Do not remove or work around this.

### 4. `packages/core/src/primitives.tsx` — The Rendering Fork

Every primitive (`Box`, `Text`, `Image`, etc.) checks `useRendererMode()` and follows one of two paths:

- **`'web'`** — converts style → CSS, renders to DOM
- **`'native'`** — passes everything to react-reconciler as host elements

**Handler prop extraction in `Box`:** `Box` destructures each `on*` prop by name explicitly. It does NOT spread `...rest` into the element. If you add a new event type (e.g. `onFileDrop`), you must:

1. Add the type to `BoxProps` in `types.ts`
2. Add it to the destructure list in `Box()`
3. Add it to the `React.createElement` call in the native branch
4. Subscribe to the bridge event in `eventDispatcher.ts`

Skipping steps 2-3 means the handler silently disappears. `extractHandlers` in hostConfig never sees it. The symptom is Lua pushing events that never reach React, with no error.

**`styleToCSS`** handles web-only conversions. The native path never touches it. If a style property is native-only (no CSS equivalent), only implement it in the Lua painter — do not add it to `styleToCSS`.

**Theme token resolution:** Colors prefixed with `"#"` that match a theme token key are resolved via `ThemeColorsContext`. This happens in `resolveColor`. Don't bypass it by hardcoding colors in components that should respect the theme.

---

## IBridge: The Contract

`packages/core/src/bridge.ts` defines the interface every hook depends on. The primary implementation is:

- `NativeBridge` (native/src/) — QuickJS FFI

A `WebBridge` for the planned Emscripten/WASM target does not exist yet. When it does, it will live in a `packages/web/` package and implement the same `IBridge` interface.

**Never write a hook that imports `NativeBridge` directly.** Always consume `IBridge` via `useBridge()`. This keeps hooks target-agnostic and will enable web support when the web bridge is implemented.

**Adding a new hook:** If the hook needs to communicate with Lua, use `bridge.send()` + `bridge.subscribe()` or `bridge.rpc()`. Never call `globalThis.__hostFlush` directly from a hook — that's the bridge's job.

---

## The Capability System

The right place to add a new native feature is almost always a capability, not a raw hook.

Pattern:
1. Lua side: `Capabilities.register("Foo", { schema, create, update, tick, destroy })`
2. JS side: `<Foo prop={value} onEvent={handler} />` in `capabilities.tsx`
3. Under the hood: `<Native type="Foo" ... />` creates a host element; events route via capability dispatcher
4. AI discovery: `useCapabilities()` returns the schema automatically

If you're building something that requires users to call `bridge.rpc()` or understand event namespaces, you haven't finished. Wrap it in a capability component.

---

## Types: Where Everything Starts

`packages/core/src/types.ts` is the single source of truth for:
- `Style` — 100+ layout and visual properties
- `LoveEvent` — event context (coordinates, modifiers, bubblePath, stopPropagation)
- All `*Props` interfaces

**Prop interface discipline:** Component props go in `types.ts`. Internal state types stay in the component file. If something is used across more than one component, it belongs in types.ts.

**Event enrichment:** All events arrive from Lua as plain data. `eventDispatcher.ts` enriches them with `currentTarget`, `stopPropagation()`, etc. before passing to React handlers. If you add a new event field, add it to the relevant type in `types.ts` first.

---

## What Not To Do

**Do not import from `cli/runtime/`** — that's a disposable copy. Source of truth is `lua/` and `packages/`.

**Do not spread `...rest` through Box's native branch** — handlers get lost. Be explicit.

**Do not send raw objects through `__hostFlush`** — stringify them. The GC bug is real.

**Do not use `NativeBridge` directly in hooks** — use `useBridge()`.

**Do not add a new node op without a Lua counterpart** — the Lua side must know every op code. They must be added together or the Lua parser will throw/silently ignore.

**Do not add a new bubbling event without verifying `bubblePath` is populated** — Lua must include `bubblePath` in the event payload for bubbling to work. If Lua doesn't send it, the dispatcher has nothing to walk.

**Do not create components that only work in native mode without guarding** — either handle both paths in the component, or use `<Native>` which already no-ops on web.

---

## Exporting New Things

`packages/core/src/index.ts` re-exports everything users need. `packages/native/src/index.ts` re-exports core + adds native-specific exports.

When you add something:
- If it's a type or hook or component: export from `packages/core/src/index.ts`
- If it's native-only internals (bridge impl, hostConfig internals): export from `packages/native/src/index.ts`
- If it's a capability component: export from `packages/core/src/index.ts` alongside the other capabilities

Both packages have lean re-export lists — don't export internal implementation details.

---

## After Changing Anything Here

1. `make cli-setup` — propagates to `cli/runtime/` for consumer projects
2. The storybook picks up changes automatically (symlink for Lua, esbuild for TS)
3. Rebuild storybook bundle if you changed anything Lua-adjacent: `make build-storybook-native`
4. For each example project that uses the changed feature: `reactjit update && reactjit build dist:sdl2`
5. Commit. This is framework code. Other Claudes and users depend on it being stable and tracked.
