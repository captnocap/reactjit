# Right-click events

Any element can listen for right-clicks via `onRightClick` (alias: `onContextMenu`).

```tsx
<div onRightClick={(e) => console.log('clicked at', e.x, e.y)}>
  right-click me
</div>
```

## The event payload

The handler receives an event object — **not** separate `x, y` arguments:

```ts
type RightClickEvent = {
  targetId: number;  // host node id of the element that was hit
  x: number;         // window-relative click x (pixels)
  y: number;         // window-relative click y (pixels)
};
```

The coordinates are in window-screen space — the same coordinate system you'd use for `position: absolute, left, top`. Use them directly to anchor a menu, popover, or tooltip at the click site.

## Aliases

`onRightClick` and `onContextMenu` are interchangeable; both are dispatched for the same event. Use whichever reads better for your component.

## How it gets to JS

Under V8, the path is:

1. SDL `BUTTON_RIGHT` arrives at the engine event loop (`framework/engine.zig`).
2. `events.zig:hitTestRightClick` walks the layout tree back-to-front for the deepest node with `on_right_click` set.
3. The engine calls the wired V8 dispatcher (`v8_app.zig:dispatchV8RightClick`), which sets the prepared coords on `qjs_runtime.g_prepared_mouse_x/y` and evals `__dispatchRightClick(id)` in V8.
4. The runtime (`runtime/index.tsx`) dispatches to `handlerRegistry.get(id)` after pulling the coords back via the `__getPreparedRightClick` host fn (registered in `framework/v8_bindings_core.zig`).

## What does **not** work

- Receiving coords as separate args (`onRightClick={(x, y) => ...}`). The handler always gets the event object as a single argument.
- Listening on a node with no clickable area. Hit-testing requires the node's computed rect to actually contain the click point — `display: none` or zero-sized nodes won't fire.
- Stacking menus inside `overflow: hidden` ancestors and expecting them to escape via z-index alone — see [context_menu.md](./context_menu.md) for how the engine actually handles that.

## Right-click vs the legacy `contextMenuItems` prop

There's an older host-painted menu reachable via:

```tsx
<div contextMenuItems={[{label:'Open'}, {label:'Delete'}]} onContextMenu={(idx) => ...} />
```

That path uses `framework/context_menu.zig` to paint a fully Zig-styled overlay. It works but it can't be themed or composed in TSX. **Prefer the `onRightClick` + `useContextMenu` pattern** for any new code. The legacy path is kept for backward compatibility with carts that already use it; the engine prefers `contextMenuItems` over `on_right_click` when both are set on the same node, so don't combine them.

## See also

- [`docs/v8/context_menu.md`](./context_menu.md) — how to render a TSX-styled menu that escapes ancestor clipping.
- `runtime/hooks/useContextMenu.tsx` — the hook that handles open/close/dismiss state.
