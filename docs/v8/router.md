# V8 Router pipeline

Last updated: 2026-05-04.

This document traces the V8 runtime router end to end. In this repository,
`runtime/router.tsx` is the public React API and `framework/router.zig` is the
host-side memory history. There is no browser location bar, no DOM history API,
and no URL synchronization with an external page.

## Mental model

`<Router>` initializes a process-global host history stack, then renders a
React Context provider. `useNavigate()` mutates that host history through V8
host functions. `Route` reads the current path from context and decides whether
to return its children.

```text
<Router initialPath="/">
  -> runtime/router.tsx reads hot route state
  -> __routerInit(path)
  -> framework/router.zig stores memory history
  -> RouterContext.Provider exposes current path
  -> <Route> calls JS matchRoute(...)
  -> matching route returns children
```

Navigation goes the other direction:

```text
Pressable / event handler
  -> useNavigate().push("/settings")
  -> __routerPush("/settings")
  -> framework/router.zig updates history
  -> runtime/router.tsx persists hot route path
  -> runtime/router.tsx notifies subscribers
  -> <Router> force-renders
  -> routes rematch against __routerCurrentPath()
  -> reconciler sends normal host mutations
```

The router does not paint directly. It decides which React children exist; the
normal V8 mutation, layout, and paint pipeline handles those children.

## Public TSX surface

Import the routed API from `runtime/router`:

```tsx
import { Link, Route, Router, useNavigate, useRoute } from '@reactjit/runtime/router';

export default function App() {
  return (
    <Router initialPath="/" hotKey="app:path">
      <Route path="/">
        <Home />
      </Route>
      <Route path="/users/:id">
        {(params) => <User id={params.id} />}
      </Route>
      <Route fallback>
        <NotFound />
      </Route>
    </Router>
  );
}
```

Lowercase JSX also works. `runtime/jsx_shim.ts` maps:

| Lowercase | Runtime component |
| --- | --- |
| `<router>` | `runtime/router.Router` |
| `<route>` | `runtime/router.Route` |

Example:

```tsx
<router initialPath="/">
  <box>
    <route path="/">
      <text>Home route</text>
    </route>
  </box>
</router>
```

Lowercase router tags are components, not native host nodes. Styling
`<router style={...}>` has no layout effect because `Router` renders only a
Context provider.

## API surface

### `Router`

```ts
type RouterProps = {
  initialPath?: string; // default "/"
  hotKey?: string;      // default "router:path"
  children?: any;
};
```

`Router`:

1. Chooses `hotKey || "router:path"`.
2. Reads `__hot_get(hotKey)` when available.
3. Falls back to `initialPath`.
4. Normalizes the path so non-empty relative paths get a leading slash.
5. Calls `__routerInit(path)` when the mounted router/hot key initializes.
6. Writes the path back through `__hot_set(hotKey, JSON.stringify(path))`.
7. Subscribes to the runtime router listener set and force-renders on
   navigation.
8. Reads `__routerCurrentPath()` on every render and exposes it through
   `RouterContext`.

The hot-state mirror is best-effort. If `__hot_get` / `__hot_set` are missing,
the router still works, but hot reload restarts from `initialPath`.

### `Route`

```ts
type RouteProps = {
  path?: string;
  fallback?: boolean;
  children?: any | ((params: Record<string, string>) => any);
};
```

Two child forms are supported:

```tsx
<Route path="/x">{() => <Page />}</Route>
<Route path="/x"><Page /></Route>
```

If `children` is a function, `Route` calls it with the matched params. If
`children` is a single React element, `Route` clones it with a `params` prop.
Otherwise it returns `children` unchanged.

`fallback` routes render only when no earlier sibling route in the same provider
render pass has set the internal `__matched` marker.

Important behavior: non-fallback routes do not implement `Switch` semantics. If
two ordinary `Route` components match, both can render. Ordering only controls
whether a later fallback is suppressed.

### `Link`

```ts
type LinkProps = {
  to: string;
  replace?: boolean;
  children?: any;
  style?: any;
  [key: string]: any;
};
```

`Link` renders a host `"Pressable"` with an `onPress` handler. Pressing it calls
`nav.push(to)` or `nav.replace(to)`.

### `useRoute`

```ts
function useRoute(): {
  path: string;
  params: Record<string, string>;
  hotKey: string;
};
```

`useRoute()` reads `RouterContext`. The current runtime provider sets `params`
to `{}`. Route-specific params are available through a route render prop or the
cloned child's `params` prop, not through `useRoute()` inside arbitrary
descendants.

### `useNavigate`

```ts
function useNavigate(): {
  push(path: string): void;
  replace(path: string): void;
  back(): void;
  forward(): void;
};
```

The returned functions call the host bridge, persist the current path to
hot-state, then notify all runtime router listeners.

### `matchRoute`

```ts
function matchRoute(pattern: string, pathname: string): {
  matched: boolean;
  params: Record<string, string>;
};
```

The JS matcher is the matcher used by V8 `<Route>`.

Supported pattern forms:

| Pattern | Behavior |
| --- | --- |
| `/settings` | Exact segment match. |
| `/users/:id` | Captures one path segment as `id`. |
| `/files/*` | Trailing `*` matches the rest of the path. |

Both pattern and pathname have one trailing slash stripped unless the whole
string is `/`. Param values are decoded with `decodeURIComponent`, falling back
to the raw segment on decode errors.

Unsupported in the JS matcher today:

- query strings
- hash fragments
- optional params such as `:id?`
- wildcard params
- route ranking or best-match selection

## Host bridge

`runtime/router.tsx` talks to V8 globals registered by
`framework/v8_bindings_core.zig`:

| Global | Native function | Behavior |
| --- | --- | --- |
| `__routerInit(path)` | `hostRouterInit` | Initializes host memory history. |
| `__routerPush(path)` | `hostRouterPush` | Pushes a new entry and truncates forward history. |
| `__routerReplace(path)` | `hostRouterReplace` | Replaces the current entry. |
| `__routerBack()` | `hostRouterBack` | Moves back one entry when possible. |
| `__routerForward()` | `hostRouterForward` | Moves forward one entry when possible. |
| `__routerCurrentPath()` | `hostRouterCurrentPath` | Returns the current host path. |

`push`, `replace`, `back`, and `forward` call `state.markDirty()` after touching
the host router. In the React V8 path, the immediate route UI update comes from
the JS listener/`forceRender` in `runtime/router.tsx`; the final visible change
still goes through normal React reconciliation and `__hostFlush`.

## Native history

`framework/router.zig` owns a fixed-size memory history:

```zig
const MAX_HISTORY = 64;
const MAX_PATH_LEN = 256;

var history: [MAX_HISTORY][MAX_PATH_LEN]u8 = undefined;
var history_lens: [MAX_HISTORY]u16 = [_]u16{0} ** MAX_HISTORY;
var history_count: usize = 0;
var history_index: usize = 0;
```

Behavior:

- `init(initial_path)` writes entry 0, sets count to 1, and index to 0.
- `push(path)` truncates forward history, appends the new path if there is
  capacity, and moves the index to the new entry.
- `replace(path)` overwrites the current entry.
- `back()` decrements the index when possible.
- `forward()` increments the index when possible.
- `currentPath()` returns the current byte slice.

Paths longer than 256 bytes are truncated. There is no allocation in the native
history path.

The native router also tracks a private dirty flag and exposes
`isDirty()`/`clearDirty()`, but the V8 React router does not use that flag for
route rendering. Telemetry reads `router.telemetryStats()` for history depth and
current index.

## Native matcher

`framework/router.zig` also has a matcher intended for compile-time/generated
route code:

```zig
pub fn matchRoute(pattern: []const u8, pathname: []const u8) RouteMatch
pub fn findBestMatch(patterns: []const []const u8, pathname: []const u8) ?usize
pub fn getParam(name: []const u8) ?[]const u8
```

It supports scoring:

| Segment | Score |
| --- | --- |
| literal | 4 |
| `:param` | 3 |
| `:param?` | 2 |
| `*` | 1 |

`findBestMatch` stores params from the best match so generated code can later
read them with `getParam`.

Current V8 `runtime/router.tsx` does not call this native matcher. It mirrors
part of the behavior in JS, but the JS matcher is simpler and is the one that
controls `<Route>` rendering.

## Re-render and paint path

Routing itself does not create a host node. A route change causes React children
to change, and those children enter the normal host pipeline:

1. `useNavigate().push(...)` calls `__routerPush`.
2. `runtime/router.tsx` calls `notifyRouterListeners()`.
3. The mounted `Router` subscriber calls `forceRender`.
4. `Router` reads `__routerCurrentPath()`.
5. `Route` components re-run `matchRoute`.
6. React reconciles the new child tree.
7. `renderer/hostConfig.ts` emits `CREATE`, `UPDATE`, `REMOVE`, `APPEND`, or
   `INSERT_BEFORE` commands.
8. `globalThis.__hostFlush` sends the JSON batch to V8.
9. `v8_app.zig` updates the stable node map and marks `g_dirty`.
10. The next app tick snapshots/rebuilds the `layout.Node` tree, marks layout
    dirty, and the engine lays out and paints the resulting nodes.

Because routing is just child selection, all layout, hit testing, scroll,
effects, media, and paint behavior is inherited from the mounted route
contents.

## Hot reload and scroll interaction

`Router` mirrors the current path through hot-state under `hotKey`. The default
key is `"router:path"`. Use a distinct key if a cart intentionally has multiple
independent host-backed routers, though see the global-history caveat below.

`ScrollView` also reads `__routerCurrentPath()` in `runtime/primitives.tsx` and
uses it as part of its hot scroll key:

```text
scroll:<currentRoutePath>:<React.useId()>
```

This prevents the first scroll view on `/settings` from inheriting the hot
scroll position of the first scroll view on `/`.

## Lowercase scaffold path

The `scripts/init` basic template intentionally uses lowercase intrinsics:

```tsx
<router initialPath="/">
  <box>
    <text>Hello</text>
    <route path="/">
      <text>Home route</text>
    </route>
  </box>
</router>
```

The JSX factory shim resolves those names at bundle time. Zig never sees a host
node with type `"router"` or `"route"` unless a cart bypasses the shim.

## API map

| Layer | File | Surface |
| --- | --- | --- |
| Public React API | `runtime/router.tsx` | `Router`, `Route`, `Link`, `useRoute`, `useNavigate`, `matchRoute` |
| Lowercase JSX shim | `runtime/jsx_shim.ts` | `<router>` and `<route>` component resolution |
| Host globals | `framework/v8_bindings_core.zig` | `__routerInit`, `__routerPush`, `__routerReplace`, `__routerBack`, `__routerForward`, `__routerCurrentPath` |
| Native history | `framework/router.zig` | fixed memory history stack |
| Native generated matcher | `framework/router.zig` | `matchRoute`, `findBestMatch`, `getParam` |
| Route-aware scroll hot keys | `runtime/primitives.tsx` | `ScrollView` hot scroll state includes current route path |
| Telemetry | `framework/telemetry.zig` | route history depth and current index |
| Probe cart | `cart/testing_carts/router_probe.tsx` | runtime/lowercase router comparison |

## Known gaps and sharp edges

- The host router history is process-global. Multiple runtime `<Router>`
  instances share one native current path and can overwrite each other.
- Nested independent routing should use a local React router shim, like
  `cart/app/gallery/local-router.tsx`, or a future namespaced native router.
- `<router>` is not a layout node; styling it has no effect.
- `Route` is not a `Switch`. Multiple non-fallback routes can render if they
  match the same path.
- Fallback routing depends on sibling render order and should be placed after
  ordinary routes.
- `useRoute().params` is currently always `{}` from the provider. Use route
  render props or cloned child `params` for matched params.
- JS `<Route>` matching does not use the native best-match/scoring matcher.
- Query strings and hashes are treated as part of the path string if included;
  there is no parser for `?query` or `#hash`.
- Native paths are capped at 256 bytes and history depth is capped at 64.
