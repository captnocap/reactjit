# `<Window>` and `<Notification>` (V8 Runtime)

`<Window>` is the React-side primitive for opening a secondary native host
window and routing a React subtree into it. `<Notification>` uses the same
host-node shape, but opens an in-process notification window instead of a
separate child process.

The pipeline is split across three layers:

1. React creates `Window` / `Notification` host nodes.
2. `renderer/hostConfig.ts` annotates mutations with window ownership.
3. `v8_app.zig` opens native windows, routes owned mutations, and rebuilds
   the appropriate layout roots.

This document covers the V8 default path. QJS is legacy and not covered here.

## Public API

Import the primitives from runtime primitives:

```tsx
import { Window, Notification } from '@reactjit/runtime/primitives';
```

`Window` is a light wrapper:

```tsx
export const Window = (props: any) => h('Window', props, props.children);
export const window = Window;
```

`Notification` is the same shape:

```tsx
export const Notification = (props: any) =>
  h('Notification', props, props.children);
export const notification = Notification;
```

Typical usage:

```tsx
<Window title="Test cart" width={960} height={720} onClose={close}>
  <Cartridge src={`${BUNDLE_DIR}/example.cart.js`} />
</Window>
```

Notification usage:

```tsx
<Notification
  title="Saved"
  width={380}
  height={100}
  duration={5}
  onDismiss={handleDismiss}
>
  <Text>Changes written.</Text>
</Notification>
```

Recognized host-window props:

| Prop | Type | Applies to | Behavior |
|---|---|---|---|
| `title` | string | both | Native window title. Defaults to `"Window"` or `"Notification"`. |
| `width` | number | both | Initial width. Window default is `640`; notification default is `380`. |
| `height` | number | both | Initial height. Window default is `480`; notification default is `100`. |
| `x` | number | both | Optional initial screen x position. |
| `y` | number | both | Optional initial screen y position. |
| `duration` | number | notification | Auto-dismiss duration in seconds. Defaults to `5` seconds. |
| `alwaysOnTop` | boolean | both | Passed to the child/native window. Defaults to `true` for notifications. |
| `borderless` | boolean | both | Passed to the child/native window. Defaults to `true` for notifications. |
| `onClose` | function | window | Fired when a host window closes or its child process exits. |
| `onDismiss` | function | notification | Fired when a notification host closes. |

`Window` currently opens as an independent child process. `Notification`
currently opens as an in-process SDL window with notification hints.

## Adjacent Host Props

`windowDrag` and `windowResize` are ordinary node props, not props on
`<Window>` itself. They mark regions inside a borderless host window:

```tsx
<Box windowDrag style={{ height: 32 }} />
<Box windowResize style={{ position: 'absolute', right: 0, width: 8 }} />
```

They are decoded in `v8_app.zig` into `layout.Node.window_drag` and
`layout.Node.window_resize`. Engine hit testing uses those flags for custom
chrome drag/resize behavior.

## Host Functions

There is also a lower-level host-function surface:

```ts
globalThis.__window_close();
globalThis.__window_minimize();
globalThis.__window_maximize();
globalThis.__window_is_maximized();
globalThis.__openWindow(title, width, height);
```

Camel-case aliases exist for the first three controls:

```ts
globalThis.__windowClose();
globalThis.__windowMinimize();
globalThis.__windowMaximize();
```

These functions control or open native windows outside the React
`<Window>` ownership pipeline:

| Function | Current behavior |
|---|---|
| `__window_close()` | Requests SDL quit for the main app window. |
| `__window_minimize()` | Minimizes the main app window. |
| `__window_maximize()` | Toggles maximize/restore for the main app window. |
| `__window_is_maximized()` | Returns whether the main app window is maximized. |
| `__openWindow(title, width, height)` | Opens an in-process secondary window without binding a React subtree to it. |

Sharp edge: these functions are registered by `framework/v8_bindings_fs.zig`.
The build option is `has-fs`, and `build.zig` describes it as registering
`__fs_*/__window_*` bindings. `scripts/ship-metafile-gate.js` enables that
gate from shipped file inputs listed in `sdk/dependency-registry.json`; those
inputs are the fs hooks (`runtime/hooks/fs.ts`, `useFileContent.ts`,
`useFileDrop.ts`, `useFileWatch.ts`). A cart that only calls
`__window_minimize` directly does not, by that registry alone, trigger
`has-fs`.

## React Host Pipeline

`runtime/primitives.tsx` maps JSX to host node types:

```tsx
<Window>...</Window>       -> h('Window', props, children)
<Notification>...</Notification> -> h('Notification', props, children)
```

`renderer/hostConfig.ts` treats `Window` and `Notification` as special host
roots:

```ts
const WINDOW_HOST_TYPES = new Set(['Window', 'Notification']);
```

Each renderer `Instance` can carry a `hostWindowId`. Ownership rules:

| Node | `hostWindowId` |
|---|---|
| `Window` / `Notification` node | Its own node id. |
| Child under a window host | Inherits the parent window id. |
| Main app node | `null`. |

The renderer keeps that ownership current in `markParent()` /
`assignHostWindow()`. Before a flush, `annotateWindowCommands()` walks pending
mutation commands and adds both spellings:

```json
{
  "window_id": 42,
  "windowId": 42
}
```

Both names exist because older and newer native paths used different casing.
`v8_app.zig` accepts both.

Mutation commands still use the normal React host protocol:

| Operation | Meaning |
|---|---|
| `CREATE` | Create a native `Node` record from host type and props. |
| `UPDATE` | Update props on an existing node. |
| `APPEND` | Attach child to parent. |
| `APPEND_TO_ROOT` | Attach child to root. |
| `INSERT_BEFORE` | Insert child before sibling. |
| `REMOVE` | Remove child from parent. |

The difference is that commands under a window carry the owning window id.
`runtime/index.tsx` serializes the batch and calls the V8 host function:

```ts
globalThis.__hostFlush(JSON.stringify(commands));
```

`framework/v8_bindings_core.zig` queues that JSON in `g_pending_flush`.
`v8_app.zig` drains it during the next app tick.

## Parent V8 Pipeline

The parent process owns the cart's V8 isolate and React reconciler.

`applyCommandBatch()` parses the JSON command array. For each command it:

1. Calls `applyCommand(cmd)` to mutate the parent process node table.
2. If this is not a child process, calls `routeCommandToHostWindow(cmd)`.

`applyCommand(cmd)` records ownership first:

```zig
noteCommandWindowOwner(cmd);
```

`noteCommandWindowOwner()` reads `window_id` / `windowId` and maps `id` and
`childId` to the owning window in `g_window_owner_by_node_id`. That fallback
lets later commands route correctly even if they do not carry an explicit
window id.

On `CREATE` of a `Window` or `Notification`, `openHostWindowForNode()` opens
the native host:

| Type | `windows.WindowKind` | Render process |
|---|---|---|
| `Window` | `.independent` | Separate child process. |
| `Notification` | `.notification` | In-process SDL secondary window. |

The open binding is stored in:

```zig
g_window_by_node_id: AutoHashMap(u32, WindowBinding)
```

`WindowBinding` stores:

| Field | Meaning |
|---|---|
| `slot` | Index into `framework/windows.zig` window slots. |
| `kind` | `.independent` or `.notification`. |
| `title` | Owned title string for cleanup. |

## Independent `<Window>` Routing

For `.independent` windows, the parent sends mutations to a child process over
TCP NDJSON. `routeCommandToHostWindow()` determines the owner from:

1. Explicit `window_id` / `windowId`.
2. Existing owner map entry for `id`, `childId`, or `parentId`.
3. `parentId` being the `Window` node itself.

It only routes to bindings whose kind is `.independent`. Notifications stay
in process and are materialized by the parent.

The `Window` host node itself is not replayed into the child:

```zig
CREATE Window(id == window_id) -> drop
```

Root-level child mutations are translated because the child process does not
have a real `Window` node parent:

| Parent command | Child command |
|---|---|
| `APPEND` where `parentId == window_id` | `APPEND_TO_ROOT` |
| `INSERT_BEFORE` where `parentId == window_id` | `INSERT_BEFORE_ROOT` |
| `REMOVE` where `parentId == window_id` | `REMOVE_FROM_ROOT` |

All other owned subtree mutations are sent as-is. When `ZIGOS_TRACE_IPC=1`,
the parent logs routed mutation sizes and translated ops.

## Child Process Pipeline

`framework/windows.zig` opens an independent window by spawning the same
launcher executable with child-window environment:

| Env var | Meaning |
|---|---|
| `ZIGOS_WINDOW_CHILD=1` | Switches `v8_app.zig` into child mode. |
| `ZIGOS_IPC_PORT=<port>` | TCP NDJSON server port opened by the parent. |
| `ZIGOS_WINDOW_ID=<id>` | React node id of the parent `Window` host node. |
| `ZIGOS_WINDOW_TITLE=<title>` | Native window title. |
| `ZIGOS_WINDOW_W=<n>` | Initial width. |
| `ZIGOS_WINDOW_H=<n>` | Initial height. |
| `ZIGOS_WINDOW_X=<n>` | Optional initial x position. |
| `ZIGOS_WINDOW_Y=<n>` | Optional initial y position. |
| `ZIGOS_WINDOW_BORDERLESS=1` | Borderless child window. |
| `ZIGOS_WINDOW_ALWAYS_ON_TOP=1` | Always-on-top child window. |
| `ZIGOS_WINDOW_NOT_FOCUSABLE=1` | Non-focusable child window. |
| `ZIGOS_WINDOW_AUTO_DISMISS_MS=<n>` | Auto-exit delay for notification-style children. |

Child mode does not load the cart bundle. It runs the native engine with an
empty JS program and consumes mutations from the parent:

```zig
engine.run(.{
  .js_logic = "",
  .init = childInit,
  .tick = childTick,
  .shutdown = childShutdown,
  .dispatch_js_event = childDispatchEvent,
});
```

`childInit()` connects to the parent's IPC server and sends:

```json
{"type":"ready"}
```

`childTick()` drains queued NDJSON messages. It intentionally drains the
whole available backlog each tick so a large initial subtree does not paint
over many frames.

Accepted parent-to-child messages:

| Message | Behavior |
|---|---|
| `{"type":"mutations","commands":[...]}` | Apply each mutation command. |
| `{"type":"init","commands":[...]}` | Same command application path. |
| `{"type":"quit"}` | Exit the child process. |

The protocol comment in `framework/net/ipc.zig` also lists `resize`, but the
current child-side message handler only applies `quit`, `mutations`, and
`init`.

Child `applyCommand()` has an extra guard for window-host commands:

| Command shape | Child behavior |
|---|---|
| `CREATE` or `UPDATE` for `id == ZIGOS_WINDOW_ID` | Skip. |
| `APPEND` / `INSERT_BEFORE` / `REMOVE` where `parentId == ZIGOS_WINDOW_ID` | Translate to root operation. |
| Other commands | Apply normally to the child node table. |

When child nodes receive input events, `childDispatchEvent()` sends them back
to the parent:

```json
{"type":"event","targetId":123,"handler":"onClick"}
```

On shutdown the child sends:

```json
{"type":"windowEvent","targetId":42,"handler":"onClose"}
```

`framework/windows.zig` receives those lines in the parent and calls the
registered JS dispatch callback for `targetId` and `handler`.

## Notification Pipeline

`Notification` uses `windows.WindowKind.notification`.

It is opened in-process with SDL:

1. `openHostWindowForNode()` calls `windows.open(kind = .notification)`.
2. `framework/windows.zig` creates an SDL secondary window and SDL renderer.
3. The window is configured as borderless, always-on-top, not focusable, and
   utility/notification-style where platform hints are available.
4. `v8_app.zig` keeps its subtree in the parent node table.
5. `rebuildTree()` materializes a synthetic root for that notification slot.
6. `windows.layoutAll()` and `windows.paintAndPresent()` layout and paint it.

Notifications have a fade lifecycle and auto-dismiss. When the native slot is
closed or expires, `cleanupClosedHostWindows()` removes the binding and
dispatches `onDismiss` for the notification node.

In-process notification painting is intentionally simpler than the main WGPU
renderer. It paints background, border, text, and children through the SDL
secondary-window path.

## Root Materialization

The parent process keeps one node table for the main app plus window-owned
subtrees.

`materializeChildrenForOwner()` filters children by ownership:

| Root being built | Included children |
|---|---|
| Main app root | Nodes that are not `Window` hosts and are not owned by a window. |
| Window synthetic root | Nodes whose owner is that window id. |

`materializeWindowRoot()` creates a synthetic root node for each active host
window. That root gets a basic flex-column style and then the owned child
subtree is attached beneath it.

`rebuildTree()` does different work by process role:

| Process | Rebuild behavior |
|---|---|
| Parent | Rebuild each in-process/notification window slot, then rebuild the main root without window-owned nodes. |
| Child | Rebuild the child root from `g_root_child_ids`; no parent cart tree exists. |

Independent windows receive mutations over IPC and rebuild their own root
inside the child process. Notifications are rebuilt and painted by the
parent.

## Events and Lifecycle

There are two event paths:

| Window kind | Event path |
|---|---|
| Independent `Window` | Child native event -> child `dispatch_js_event` -> IPC `event` -> parent JS `__dispatchEvent`. |
| In-process `Notification` | Parent `windows.routeEvent()` hit test -> parent JS dispatch. |

For in-process secondary windows, `framework/engine.zig` calls
`windows.routeEvent(&event)` before main-window event handling. If a secondary
window consumes the event, the main window does not also handle it.

`windows.routeEvent()` handles:

| Event | Behavior |
|---|---|
| close request | Closes the secondary slot. |
| pixel-size changed | Updates slot dimensions and marks layout dirty. |
| mouse down | Hit-tests and dispatches press. |
| mouse motion | Handles hover enter/exit. |
| mouse wheel | Scrolls matching scroll containers. |

Window closure is observed in `cleanupClosedHostWindows()`:

| Kind | JS handler dispatched |
|---|---|
| `Window` | `onClose` |
| `Notification` | `onDismiss` |

Independent child shutdown also emits an `onClose` window event through IPC.

## Shutdown and Reload

`destroyDetachedNode(id)` closes a native host if the removed node id is a
window host. It also removes ownership entries and recursively destroys
children.

`clearTreeStateForReload()` closes every active host window, frees stored
window titles, and clears node/ownership maps. This keeps hot reload from
leaving stale secondary windows open.

`appShutdown()` frees stored titles and clears `g_window_by_node_id`.
`framework/engine.zig` owns the broader `windows.deinitAll()` cleanup for SDL
and child-window resources.

## Debugging

Useful switches:

| Switch | Location | Effect |
|---|---|---|
| `globalThis.__TRACE_WINDOWS = true` | JS runtime | Logs each `Window` render from `runtime/primitives.tsx`. |
| `ZIGOS_TRACE_IPC=1` | Process env | Logs parent-child window IPC routing and child message application. |

The app test settings page has a window/cartridge trace toggle path and can
render isolated tests as:

```tsx
<Window title={t.label} width={960} height={720} onClose={...}>
  <Cartridge src={`${BUNDLE_DIR}/${t.id}.cart.js`} />
</Window>
```

## Current Users

Current references in the app tree:

| File | Usage |
|---|---|
| `cart/app/settings/routes/tests.tsx` | Test runner can wrap each isolated test cartridge in `<Window>`. |
| `cart/app/index.tsx` | Uses `windowDrag` and `__window_*` controls for app chrome. |
| `cart/app/docs/01-console-cartridges.md` | Documents the intended `<Window><Cartridge /></Window>` test target. |
| `docs/v8/layout.md` | Summarizes `Window` / `Notification` prop decoding. |
| `docs/v8/paint.md` | Mentions `windowDrag` / `windowResize` paint/layout flags. |

## File Map

Core JS and renderer files:

| File | Role |
|---|---|
| `runtime/primitives.tsx` | Exports `Window`, `window`, `Notification`, and `notification`. |
| `renderer/hostConfig.ts` | Tracks window ownership and annotates mutation commands. |
| `runtime/index.tsx` | Installs the `__hostFlush` transport and JS event dispatch. |
| `runtime/host_props.ts` | Declares `windowDrag` and `windowResize` host props. |

Native V8/runtime files:

| File | Role |
|---|---|
| `framework/v8_bindings_core.zig` | Registers `__hostFlush` and queues mutation batches. |
| `v8_app.zig` | Opens host windows, routes mutations, handles child mode, rebuilds roots, dispatches close events. |
| `framework/windows.zig` | Owns SDL secondary windows, notification lifecycle, independent child processes, and IPC fanout. |
| `framework/net/ipc.zig` | TCP NDJSON transport used by independent windows. |
| `framework/engine.zig` | Integrates secondary-window event routing, layout, paint, and main-window controls. |
| `framework/v8_bindings_fs.zig` | Registers `__window_*` and `__openWindow` host functions. |

Build/gating files:

| File | Role |
|---|---|
| `build.zig` | `has-fs` controls fs/window host-function registration. |
| `scripts/ship-metafile-gate.js` | Converts shipped inputs into positional binding gates. |
| `sdk/dependency-registry.json` | Defines fs gate triggers and the `window-runtime` feature marker. |

## Review Notes

Current sharp edges found while tracing:

1. `<Window>` and `__openWindow` are different APIs. `<Window>` owns and
   routes a React subtree. `__openWindow(title, width, height)` opens a bare
   in-process secondary window and does not attach React children.
2. `__window_*` host functions live in the fs binding module. The ship gate is
   triggered by fs hook files, not direct raw calls to `__window_*`.
3. The IPC protocol comment lists a `resize` parent-to-child message, but the
   current child handler only accepts `quit`, `mutations`, and `init`.
4. `Window` opens as `.independent`; `Notification` opens as `.notification`.
   The `.in_process` window kind exists in `framework/windows.zig`, and
   `__openWindow` uses it, but `<Window>` does not currently select it.
5. In-process notification painting uses the SDL secondary-window painter,
   which is simpler than the main WGPU render path.
6. Both `window_id` and `windowId` are intentionally emitted and decoded.
   Removing either spelling would risk breaking one side of the current route
   path.
