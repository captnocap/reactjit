# Tooltip Pipeline (V8 Runtime)

There are two tooltip systems in the current V8 stack:

- Engine-native tooltips: a node prop, `tooltip="..."`, stored on
  `layout.Node` and painted by `framework/tooltip.zig`.
- React overlay tooltips: `runtime/tooltip/Tooltip.tsx`, a React component tree
  that renders a positioned `<Box>` overlay.

They share the same user-facing idea but not the same pipeline. Engine-native
tooltips are outside React once the prop lands in Zig. React overlay tooltips are
ordinary React nodes that use hover handlers, timers, global mouse helpers, and
absolute positioning.

## Public API

### Engine-Native Tooltip Prop

Any primitive can forward the host prop:

```tsx
<Pressable
  tooltip="Open settings"
  hoverable={true}
  onPress={openSettings}
  style={{ width: 120, height: 32 }}
>
  <Text>Settings</Text>
</Pressable>
```

The host prop surface is documented in `runtime/host_props.ts`:

```ts
type HostNodeProps = {
  tooltip?: string;
  hoverable?: boolean;
};
```

Important: `tooltip` by itself does not make a node hover-hit-testable. The node
must also participate in hover hit testing through one of these:

- `hoverable={true}`
- `onHoverEnter`, `onHoverExit`, `onMouseEnter`, or `onMouseLeave`
- `onPress` / `onClick` or other event handlers
- `href`
- input/canvas participation

For plain `Box`/`Text` nodes with no handlers, pair `tooltip` with
`hoverable={true}`.

### React Tooltip Root

Import the React overlay tooltip:

```tsx
import { TooltipRoot, Tooltip } from '@reactjit/runtime/tooltip/Tooltip';

export default function App() {
  return (
    <TooltipRoot>
      <Tooltip label="Create a new file" side="top" delayMs={250}>
        <Pressable onPress={createFile}>
          <Text>New</Text>
        </Pressable>
      </Tooltip>
    </TooltipRoot>
  );
}
```

Trigger props:

```ts
type TooltipSide = 'top' | 'bottom' | 'left' | 'right';
type TooltipVariant =
  | 'sweatshop-ui'
  | 'sweatshop-chart'
  | 'component-gallery-chart';

type TooltipRow = { label: string; value: string; color?: string };

type TriggerTooltipProps = {
  label?: string;
  title?: string;
  rows?: TooltipRow[];
  shortcut?: string;
  markdown?: boolean;
  variant?: TooltipVariant;
  style?: any;
  staticSurfaceOverlay?: boolean;
  side?: TooltipSide;       // default: 'top'
  delayMs?: number;         // default: 500
  disabled?: boolean;
  children: any;
};
```

Current trigger-mode caveat: the effect that activates a trigger tooltip forwards
`label`, `markdown`, `shortcut`, `variant`, and rect anchor data. It does not
currently forward `title`, `rows`, `style`, or `staticSurfaceOverlay` in trigger
mode.

### Positioned React Tooltip

The same component also supports controlled positioned mode:

```tsx
<Tooltip
  visible={hovered}
  anchor={{ kind: 'cursor', offsetX: 14, offsetY: 14 }}
  title="Latency"
  rows={[
    { label: 'P95', value: '118 ms', color: '#f59e0b' },
  ]}
  variant="component-gallery-chart"
  staticSurfaceOverlay
/>
```

Position anchors:

```ts
type TooltipAnchor =
  | { kind: 'cursor'; offsetX?: number; offsetY?: number }
  | { kind: 'absolute'; x: number; y: number; offsetX?: number; offsetY?: number };
```

Positioned mode can render through a surrounding `TooltipRoot` context or fall
back to rendering its own absolute overlay when no root is present.

## End-to-End Flow: Engine-Native Tooltip

### 1. React emits a host prop

`tooltip` is an ordinary non-style host prop. `renderer/hostConfig.ts` strips
function handlers out of props, keeps plain props in `clean`, and emits them in
the mutation batch:

```json
{
  "op": "CREATE",
  "id": 42,
  "type": "View",
  "props": {
    "tooltip": "Open settings",
    "hoverable": true,
    "style": { "width": 120, "height": 32 }
  }
}
```

On updates, `prepareUpdate` diffs plain props. A changed tooltip value appears in
`UPDATE.props.tooltip`; a removed tooltip appears in `removeKeys`.

### 2. V8 applies props to the node

`v8_app.zig:applyProps` copies tooltip text into the Zig node:

```zig
if (std.mem.eql(u8, k, "tooltip")) {
    if (dupJsonText(v)) |s| node.tooltip = s;
}
```

`hoverable` is copied as a boolean:

```zig
if (std.mem.eql(u8, k, "hoverable")) {
    if (jsonBool(v)) |b| node.hoverable = b;
}
```

The storage fields live on `framework/layout.zig`'s `Node`:

```zig
tooltip: ?[]const u8 = null,
hoverable: bool = false,
```

Removing the prop through `removeKeys` resets:

```zig
node.tooltip = null;
node.hoverable = false;
```

### 3. Handler flags make nodes hover-testable

The V8 command also carries handler names. `v8_app.zig:applyHandlerFlags` maps
hover handler names into JavaScript dispatch expressions:

```zig
onHoverEnter / onMouseEnter -> __dispatchEvent(id, 'onHoverEnter')
onHoverExit  / onMouseLeave -> __dispatchEvent(id, 'onHoverExit')
```

`runtime/index.tsx` aliases these back to the JS handler names:

```ts
onHoverEnter -> ['onHoverEnter', 'onMouseEnter']
onHoverExit  -> ['onHoverExit', 'onMouseLeave']
```

Any node with handlers participates in `events.hitTestHoverable`. A node with no
handlers must opt in with `hoverable={true}` if it wants a native tooltip.

### 4. Mouse motion updates the hovered node

On `SDL_EVENT_MOUSE_MOTION`, `framework/engine.zig` calls:

```zig
updateHover(config.root, mx, my);
```

`updateHover` first handles scrollbar hover state, then calls:

```zig
events.hitTestHoverable(root, mx, my)
```

`framework/events.zig:hitTestHoverable` walks children back-to-front and returns
the deepest node under the cursor that has handlers, `hoverable`, `href`, input,
or canvas participation. It accounts for scroll containers and canvas graph-space
coordinates.

If the returned node is the same pointer as the previous `hovered_node`, the
engine only updates the cursor and returns.

### 5. Hover exit and enter dispatch

When the hovered node changes, `updateHover`:

1. Fires native `on_hover_exit` on the previous node, if present.
2. Evaluates `js_on_hover_exit`, wrapped in `__beginJsEvent` / `__endJsEvent`.
3. Stores the new `hovered_node`.
4. Fires native `on_hover_enter`, if present.
5. Evaluates `js_on_hover_enter`, also wrapped as a JS event.
6. Marks state dirty after JS hover handler evaluation.

This is the same hover transition used by JS-side hover UI, chart hit overlays,
and native tooltip display.

### 6. Tooltip state is shown or hidden

After enter dispatch, `updateHover` checks the new node:

```zig
if (node.tooltip) |tt| {
    const r = node.computed;
    const off = events.cumulativeScrollOffset(root, node);
    tooltip.show(tt, r.x - off.sx, r.y - off.sy, r.w, r.h);
} else {
    tooltip.hide();
}
```

`framework/tooltip.zig:show` stores:

- visible flag
- borrowed tooltip text slice
- screen-space anchor `x`, `y`, `w`, `h`

The scroll-offset subtraction matters because descendants of scroll containers
store computed coordinates in content space.

When hover leaves all tooltip-bearing nodes, `tooltip.hide()` clears visibility
and text.

### 7. Main tree paints normally

The hovered node is also passed into normal paint. A node with
`hoverable=true` gets an automatic hover affordance:

- if the node has no background color, paint draws a dark hover rect
- if the node has a background color, paint brightens that background

This visual hover affordance is independent of the tooltip bubble. Event-only
hit targets can avoid the hover rect by leaving `hoverable` false and relying on
handler-based hit testing instead.

### 8. Tooltip overlay paints after the tree

After `paintNode(config.root)`, the engine paints overlays:

```zig
tooltip.paintOverlay(measureCallback, win_w, win_h);
context_menu.paintOverlay(measureCallback, win_w, win_h);
```

`framework/tooltip.zig:paintOverlay`:

1. Returns if not visible or text is empty.
2. Measures wrapped text with font size `13` and max width `300`.
3. Computes box size with horizontal padding `10` and vertical padding `6`.
4. Centers the tooltip above the anchor.
5. Clamps horizontally to the window.
6. Flips below the anchor if it would clip at the top.
7. Clamps vertically to the window.
8. Pushes a full-viewport scissor.
9. Draws a rounded dark rectangle with border.
10. Draws wrapped text.
11. Pops scissor.

Because this is painted after the main tree with a full-viewport scissor, native
tooltips are not clipped by parent `overflow: hidden`.

## End-to-End Flow: React Tooltip Overlay

### 1. `TooltipRoot` owns one active tooltip

`TooltipRoot` stores:

```ts
const [viewport, setViewport] = useState(getViewport());
const [active, setActive] = useState<TooltipState | null>(null);
```

It provides a context with:

```ts
setActive(sourceId, payload | null)
```

Only one active tooltip is shown at a time. Clearing is source-aware: a source can
only clear itself if it is still the active source.

`TooltipRoot` renders:

```tsx
<Box style={{ position: 'relative', width: '100%', height: '100%', overflow: 'visible' }}>
  {children}
  <TooltipOverlay active={active} viewport={viewport} />
</Box>
```

### 2. Trigger mode wraps children in a hover box

For child-wrapping usage, `Tooltip` returns:

```tsx
<Box
  onHoverEnter={() => setHovered(true)}
  onHoverExit={() => setHovered(false)}
  onMouseEnter={() => setHovered(true)}
  onMouseLeave={() => setHovered(false)}
  onLayout={(rect) => setAnchor(rect)}
  style={{ position: 'relative', display: 'flex', overflow: 'visible' }}
>
  {children}
</Box>
```

When hovered and an anchor rect is available, an effect waits `delayMs` and then
sets the root active tooltip with a rect anchor and preferred side.

Current V8 limitation: `onLayout` is marked by `renderer/hostConfig.ts` with
`__hasOnLayout`, but this trace did not find a V8 host path that dispatches
layout rectangles back to JS. Without that dispatch, trigger-mode anchor state
stays null and the root tooltip is not activated.

### 3. Positioned mode is controlled by props

For `visible={true}`, `Tooltip` enters positioned mode. With a root context it
sets the active root tooltip in an effect:

```ts
ctx.setActive(sourceId, {
  title,
  label,
  rows,
  shortcut,
  markdown,
  style,
  staticSurfaceOverlay,
  anchor,
});
```

If there is no `TooltipRoot`, positioned mode renders an inline absolute
`TooltipCard` fallback directly.

### 4. Overlay estimates size and places the card

`TooltipOverlay` estimates the tooltip card size in JS from title/label length,
row lengths, preset padding, min width, and max width.

For rect anchors it calls `useAutoFlip`:

1. Try the requested side.
2. Try the opposite side.
3. Pick the side with the best remaining space.
4. Clamp to viewport padding.

For cursor or absolute anchors it calls `pointPlacement`, which offsets from the
point, flips left/up if it would exceed the viewport, then clamps.

### 5. Cursor anchors poll host mouse position

For `{ kind: 'cursor' }`, the overlay polls every 16 ms while visible:

```ts
getMouseX()
getMouseY()
```

Those are core V8 host globals registered by `framework/v8_bindings_core.zig`.

### 6. TooltipCard renders ordinary primitives

The visible card is built from `Box`, `Row`, and `Text`. Presets define min/max
width, padding, radius, border/background/text colors, optional shortcut styling,
shadow styling, and `staticSurfaceOverlay`.

The root overlay is a full-viewport absolute `Box` with:

```ts
zIndex: 10000
pointerEvents: 'none'
overflow: 'visible'
```

The tooltip itself is another absolutely positioned `Box` containing
`TooltipCard`.

## Telemetry

Native tooltip visibility is exposed through telemetry:

- `framework/tooltip.zig:telemetryVisible()`
- `framework/telemetry.zig` stores `tooltip_visible`
- `framework/v8_bindings_telemetry.zig:__tel_input()` returns
  `tooltip_visible`

Node telemetry also reports:

```text
has_tooltip: node.tooltip != null
```

This telemetry is for the engine-native tooltip prop. React overlay tooltips are
ordinary nodes and do not toggle `tooltip_visible`.

## Limits And Caveats

- Engine-native `tooltip` requires the node to be hover-testable; use
  `hoverable={true}` for inert nodes.
- Engine-native tooltips have no JS delay, no variants, no rows, no shortcuts,
  and no markdown rendering.
- Engine-native tooltip text is a borrowed node string; the node should outlive
  the visible tooltip. Normal host node storage satisfies this.
- Native tooltip anchor is updated when hover changes. If layout changes under a
  still-hovered pointer, the bubble can keep the previous anchor until hover is
  re-resolved by motion or another hover transition.
- Native tooltip overlay paints only in the main engine overlay path. Secondary
  windows track hover handlers in `framework/windows.zig` but do not call
  `framework/tooltip.zig`.
- React trigger-mode tooltip currently depends on an `onLayout` dispatch path
  that is not visible in the traced V8 files.
- React trigger mode currently forwards only a subset of `TooltipPopupProps`.
- React positioned mode is the reliable rich-tooltip path today.
- `TooltipRoot.getViewport()` checks `innerWidth`/`innerHeight` and camel-case
  `__viewportWidth`/`__viewportHeight`; core host globals are snake-case
  `__viewport_width`/`__viewport_height`. Without another shim setting viewport
  dimensions, React overlay placement can see a zero viewport.
- Unknown React tooltip variants fall back to `sweatshop-ui`.
- `markdown` is carried through the props but `TooltipCard` currently renders
  plain `Text`; it does not parse markdown.

## Source Map

- `runtime/host_props.ts`: advisory type surface for `tooltip` and `hoverable`.
- `runtime/tooltip/Tooltip.tsx`: React `TooltipRoot`, `Tooltip`, overlay, card,
  presets, cursor polling, fade.
- `runtime/tooltip/useAutoFlip.ts`: rect-anchor side selection and clamping.
- `runtime/index.tsx`: JS event dispatch aliases for hover enter/exit.
- `renderer/hostConfig.ts`: handler extraction, mutation emission, `onLayout`
  marker.
- `v8_app.zig`: `tooltip`/`hoverable` prop application and hover handler flags.
- `framework/layout.zig`: `Node.tooltip`, `Node.hoverable`, computed rects.
- `framework/events.zig`: hover hit testing and scroll-offset conversion.
- `framework/engine.zig`: mouse-motion hover state, native tooltip show/hide,
  hover affordance paint, overlay paint call.
- `framework/tooltip.zig`: native tooltip state, placement, measurement, paint,
  telemetry.
- `framework/windows.zig`: secondary-window hover tracking without native tooltip
  overlay paint.
- `cart/testing_carts/tooltip_test.tsx`: native-vs-JS tooltip drift test cart.
