# V8 Canvas

Last updated: 2026-05-04.

`Canvas` is ReactJIT's pan/zoom surface. It is not a browser `<canvas>` and it
does not expose an imperative drawing context. Carts describe a tree of host
nodes:

- `Canvas` owns the viewport, camera, clipping, background, grid, pan, and zoom.
- `Canvas.Node` places normal ReactJIT UI in graph space.
- `Canvas.Path` paints SVG path data in graph space.
- `Canvas.Clamp` paints viewport-pinned overlay UI above the panning graph.

The same path/node fields are also used by `Graph`, the static charting surface.
`Graph` is related enough to keep in this document, but the interactive pipeline
below is about `Canvas`.

## Quick Start

```tsx
import { Box, Canvas, Pressable, Text } from '../../runtime/primitives';

export default function Flow() {
  return (
    <Canvas
      style={{ width: '100%', height: '100%', backgroundColor: '#0b111a' }}
      viewX={0}
      viewY={0}
      viewZoom={1}
      gridStep={64}
      gridStroke={1}
      gridColor="#263241"
      gridMajorColor="#3b4a5c"
      gridMajorEvery={4}
    >
      <Canvas.Path
        d="M 80 80 C 160 20 260 160 340 96"
        stroke="#7dd3fc"
        strokeWidth={2}
        flowSpeed={40}
      />

      <Canvas.Node
        gx={120}
        gy={96}
        gw={180}
        gh={72}
        onMove={(event: any) => {
          console.log(event.targetId, event.gx, event.gy);
        }}
      >
        <Pressable
          onPress={() => console.log('tile press')}
          style={{
            width: '100%',
            height: '100%',
            borderRadius: 8,
            backgroundColor: '#111827',
            borderWidth: 1,
            borderColor: '#334155',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text color="#e5e7eb" fontSize={14}>Drag with Alt</Text>
        </Pressable>
      </Canvas.Node>

      <Canvas.Clamp>
        <Box style={{ position: 'absolute', left: 12, top: 12 }}>
          <Text color="#e5e7eb" fontSize={12}>HUD stays pinned</Text>
        </Box>
      </Canvas.Clamp>
    </Canvas>
  );
}
```

Mouse wheel zooms the canvas around the pointer. Left-drag pans the canvas.
Alt-left-drag on a `Canvas.Node` that has an `onMove` handler moves that node and
dispatches `onMove({ targetId, gx, gy })`.

## Public API

### `Canvas`

`Canvas` is declared in `runtime/primitives.tsx` as a host element named
`"Canvas"`. It accepts normal host props plus the canvas-specific props parsed
by `v8_app.zig`.

| Prop | Type | Default | Runtime field | Notes |
| --- | --- | --- | --- | --- |
| `style` | object | inherited layout rules | `Node.style` | Use explicit width/height or flex sizing. The canvas rect is the viewport clip. The current paint path also draws a built-in dark canvas background over the node's own background. |
| `viewX` | number | `0` | `canvas_view_x` | Programmatic camera center X in graph space. |
| `viewY` | number | `0` | `canvas_view_y` | Programmatic camera center Y in graph space. |
| `viewZoom` | number | `1` | `canvas_view_zoom` | Programmatic camera zoom. Values <= 0 are treated as 1 in graph paint; wheel zoom clamps to 0.05..100. |
| `driftX` | number | `0` | `canvas_drift_x` | Ambient pan speed in graph pixels/sec. Negative moves left. |
| `driftY` | number | `0` | `canvas_drift_y` | Ambient pan speed in graph pixels/sec. Negative moves up. |
| `driftActive` | boolean | `false` | `canvas_drift_active` | Runs while no canvas drag is active and no canvas node is selected. |
| `gridStep` | number | `0` | `canvas_grid_step` | Enables built-in grid when > 0. Drawn under canvas children in graph space. |
| `gridStroke` | number | `1` | `canvas_grid_stroke` | Grid stroke in screen pixels; engine converts to graph width by dividing by zoom. |
| `gridColor` | color string | `#161d27` equivalent | `canvas_grid_color` | Minor grid line color. |
| `gridMajorColor` | color string | `gridColor` | `canvas_grid_color_major` | Major grid line color. |
| `gridMajorEvery` | number | `0` | `canvas_grid_major_every` | Every Nth line is major; 0 disables majors. |
| `originTopLeft` | boolean | `false` | `graph_origin_topleft` | Parsed on Canvas and Graph, but only the Graph paint path currently uses it. Canvas remains center-origin. |

`viewX`/`viewY`/`viewZoom` are not reapplied on every render. The engine calls
`canvas.applyPropView` only when the prop triple changes since last application,
so normal rerenders do not snap the user's pan/zoom. Changing any of the three
props intentionally recenters the camera.

Color strings are parsed host-side. `#rgb`, `#rrggbb`, `#rrggbbaa`, `rgb(...)`,
`rgba(...)`, a small named-color set, and `transparent` are handled. Theme tokens
such as `theme:bg` must be resolved by the theme layer before they cross the
bridge.

### `Canvas.Node`

`Canvas.Node` is a real host node, not a canvas bitmap sprite. Its children are
normal ReactJIT nodes (`Box`, `Text`, `Pressable`, `ScrollView`, `TextInput`,
etc.) and go through the same layout, paint, text, input, and event code as the
rest of the app.

| Prop | Type | Default | Runtime field | Notes |
| --- | --- | --- | --- | --- |
| `gx` | number | `0` | `canvas_gx` | Graph-space X coordinate of the node center. |
| `gy` | number | `0` | `canvas_gy` | Graph-space Y coordinate of the node center. |
| `gw` | number | parent width | `canvas_gw` | Graph-space width. |
| `gh` | number | auto height | `canvas_gh` | Graph-space height. `0` means auto-height: layout with a temporary 500px height, measure children, then relayout. |
| `onMove` | function | none | `canvas_move_draggable` | Presence of the handler enables Alt-drag movement. Handler receives `{ targetId, gx, gy }`. |
| normal layout props | mixed | normal defaults | `Node.style` and fields | `style`, handlers, text/input descendants, scroll descendants, etc. work as normal. |

Coordinate convention: `gx`/`gy` are the center. The engine positions the node's
computed top-left at:

```text
x = gx - computed.w / 2
y = gy - computed.h / 2
```

Recommended shape:

```tsx
<Canvas.Node gx={x} gy={y} gw={w} gh={h}>
  <Pressable onPress={select} style={{ width: '100%', height: '100%' }}>
    <Box style={{ width: '100%', height: '100%' }}>
      ...
    </Box>
  </Pressable>
</Canvas.Node>
```

Keep `Canvas.Node` as a direct child of `Canvas`, or inside one plain wrapper
used by a `.map()` list. The current engine deliberately flattens one level
through non-canvas containers, but it does not implement nested
`Canvas.Node`-local coordinate spaces.

### `Canvas.Path`

`Canvas.Path` is SVG-path rendering through `framework/svg_path.zig` plus
optional fill paths.

| Prop | Type | Default | Runtime field | Notes |
| --- | --- | --- | --- | --- |
| `d` | string | none | `canvas_path_d` | SVG path data. Parsed each paint. |
| `stroke` | color string | white | `text_color` | Stroke color is stored in the shared text color field. |
| `strokeWidth` | number | `2` | `canvas_stroke_width` | Stroke width in graph units under the active transform. |
| `strokeOpacity` | number | `1` | `canvas_stroke_opacity` | Clamped to 0..1. |
| `fill` | color string | none | `canvas_fill_color` | Solid fill. Omit the prop for no fill; `"none"` is ignored by the parser and will not clear an existing fill on update. |
| `fillOpacity` | number | `1` | `canvas_fill_opacity` | Clamped to 0..1. |
| `gradient` | object | none | `canvas_fill_gradient` | Linear gradient fill. |
| `fillEffect` | string | none | `canvas_fill_effect` | Samples a named `Effect` surface as the fill texture. |
| `flowSpeed` | number | `0` | `canvas_flow_speed` | Animated pulse along the stroke. Positive moves p0->p3; negative reverses. |

`gradient` format:

```ts
{
  x1?: number; y1?: number;
  x2?: number; y2?: number;
  stops: Array<{ offset: number; color: string; opacity?: number }>;
}
```

Coordinates in `d` are graph coordinates. A `Canvas.Path` nested under a
`Canvas.Node` does not automatically get a local `(0,0)` origin at the node's
top-left. If a path should track a node, generate its `d` from graph-space
coordinates or draw it with regular `Box`/`Text` children inside the node.

`strokeDasharray` appears in some cart code, but the V8 prop parser does not
currently consume it for `Canvas.Path`/`Graph.Path`. Use `flowSpeed` for animated
stroke energy; dashed path strokes need a host parser/rendering addition.

### `Canvas.Clamp`

`Canvas.Clamp` is the fixed overlay layer for a canvas. It spans the canvas
viewport, is laid out in screen space, and paints after panning graph children.
Use it for toolbars, HUDs, minimaps, status chips, or action bars that should not
move with the camera.

```tsx
<Canvas.Clamp>
  <Box style={{ position: 'absolute', left: 16, bottom: 16 }}>
    <Text>Fixed overlay</Text>
  </Box>
</Canvas.Clamp>
```

Clamps are skipped by the graph-space child pass, then laid out with the canvas
rect and painted after `gpu.resetTransform()`.

### `Graph`, `Graph.Node`, `Graph.Path`

`Graph` shares the same node fields and `Graph.Path` uses the same path renderer,
but it does not use the canvas input pipeline. It is a static viewport with a
transform:

```tsx
<Graph style={{ width: 240, height: 120 }} viewX={0} viewY={0} viewZoom={1}>
  <Graph.Path d="M -80 0 L 0 -40 L 80 0" stroke="#fff" />
</Graph>
```

`Graph` defaults to center origin: graph `(0,0)` maps to the element center.
`originTopLeft` flips Graph to DOM/chart coordinates: graph `(0,0)` maps to the
element top-left.

Current caveat: `Graph.Path` is the well-used path. `Graph.Node` is parsed as a
canvas node, but the engine's `positionCanvasNodes` step currently runs only for
`Canvas` containers. Verify before relying on `Graph.Node` placement.

## Full Pipeline

### 1. TSX primitive construction

Source: `runtime/primitives.tsx`, `runtime/jsx_shim.ts`.

The exported primitive is tiny:

```ts
const CanvasBase: any = (props: any) => h('Canvas', props, props.children);
CanvasBase.Node = (props: any) => h('Canvas.Node', props, props.children);
CanvasBase.Path = (props: any) => h('Canvas.Path', props, props.children);
CanvasBase.Clamp = (props: any) => h('Canvas.Clamp', props, props.children);
export const Canvas: any = CanvasBase;
```

Lowercase `<canvas>` is also supported by `runtime/jsx_shim.ts`, which maps it
to the `Canvas` wrapper before React sees the element. Unlike browser React, this
does not create an HTML canvas element.

### 2. React reconciler command stream

Source: `renderer/hostConfig.ts`.

React calls the custom host config. For a host element, `createInstance`:

1. Resolves HTML aliases for normal tags. `Canvas` is already a host type and
   passes through unchanged.
2. Splits function props from data props via `extractHandlers`.
3. Emits a `CREATE` mutation with `{ id, type, props, hasHandlers, handlerNames }`.
4. Stores handlers in the JS-side `handlerRegistry`.

Example emitted shape:

```json
{
  "op": "CREATE",
  "id": 42,
  "type": "Canvas.Node",
  "props": { "gx": 120, "gy": 96, "gw": 180, "gh": 72 },
  "hasHandlers": true,
  "handlerNames": ["onMove"]
}
```

Tree shape is separate mutations:

- `APPEND`
- `APPEND_TO_ROOT`
- `INSERT_BEFORE`
- `INSERT_BEFORE_ROOT`
- `REMOVE`
- `REMOVE_FROM_ROOT`
- `UPDATE`
- `UPDATE_TEXT`

Updates are diffed. Handler closure changes update `handlerRegistry` without
emitting a bridge update when the handler-name set is unchanged. Multiple
`UPDATE`s for the same node are coalesced before flushing.

`flushToHost()` serializes coalesced commands to JSON and calls `__hostFlush`.

### 3. V8 host flush queue

Source: `framework/v8_bindings_core.zig`, `v8_app.zig`.

`__hostFlush` does not immediately mutate the live render tree. It copies the
JSON payload into `g_pending_flush`. On the next app tick, `v8_app.zig` calls:

```text
__jsTick(now)
ingredient tick drains
drainPendingFlushes()
animations.tickAll()
syncLatchesToNodes()
rebuildTree() if dirty
layout.markLayoutDirty()
```

`drainPendingFlushes(applyCommandBatch)` parses each JSON array and applies
every command to a persistent node pool:

- `g_node_by_id`: React host id -> stable `*Node`
- `g_children_ids`: parent id -> ordered child ids
- `g_parent_id`: child id -> parent id for ancestor dirty walks
- `g_root_child_ids`: root-level host ids

The engine does not paint directly from the persistent pool. When dirty,
`rebuildTree()` copies the persistent pool into an arena tree under `g_root`.
The arena tree is what layout, hit-testing, and painting traverse for the frame.
This is why engine-owned Canvas.Node dragging has a special callback that writes
back into the persistent pool as well as the current arena copy.

### 4. Type defaults and prop parsing

Source: `v8_app.zig`.

`applyTypeDefaults` maps host type strings to runtime flags:

| Host type | Fields set |
| --- | --- |
| `Canvas` | `canvas_type = "canvas"`, `graph_container = true` |
| `Graph` | `graph_container = true` |
| `Canvas.Node`, `Graph.Node` | `canvas_node = true` |
| `Canvas.Path`, `Graph.Path` | `canvas_path = true` |
| `Canvas.Clamp` | `canvas_clamp = true` |

`applyProps` maps public props to `Node` fields. Canvas-related mappings:

```text
gx, gy, gw, gh              -> canvas_gx, canvas_gy, canvas_gw, canvas_gh
d                           -> canvas_path_d
stroke                      -> text_color
strokeWidth                 -> canvas_stroke_width
strokeOpacity               -> canvas_stroke_opacity
fill                        -> canvas_fill_color
fillOpacity                 -> canvas_fill_opacity
gradient                    -> canvas_fill_gradient
fillEffect                  -> canvas_fill_effect
flowSpeed                   -> canvas_flow_speed
viewX, viewY, viewZoom       -> canvas_view_* and canvas_view_set
driftX, driftY, driftActive  -> canvas_drift_*
gridStep                    -> canvas_grid_step
gridStroke                  -> canvas_grid_stroke
gridColor                   -> canvas_grid_color
gridMajorColor              -> canvas_grid_color_major
gridMajorEvery              -> canvas_grid_major_every
originTopLeft               -> graph_origin_topleft
```

`applyHandlerFlags` also treats `onMove` specially: if a node has an `onMove`
handler name, `canvas_move_draggable` becomes true. The function itself remains
in JS `handlerRegistry`.

### 5. Layout

Source: `framework/layout.zig`.

Layout gives canvas-related nodes initial computed rectangles:

- `Canvas` is a normal layout node. Its `style` decides its viewport rect.
- `Canvas.Path` collapses to `{ w: 0, h: 0 }` when it is the inline path host
  type. Standalone path data on a non-path host can size to its box for icon use.
- `Canvas.Clamp` spans the parent bounds and lays out children in that viewport.
- `Canvas.Node` uses `gw` for width and `gh` for height. If `gh` is 0, it lays
  out children with a temporary 500px height, measures child extent, stores the
  measured height back to `canvas_gh`, and lays children out again.

After normal layout, `framework/engine.zig:positionCanvasNodes` translates
canvas nodes from their flex/layout positions to graph coordinates. It runs in
the Canvas paint path, just before the graph transform is activated:

```text
target_x = canvas_gx - computed.w / 2
target_y = canvas_gy - computed.h / 2
offset descendants by target - computed
```

This step flattens one level through non-canvas wrapper nodes. It does not
recursively create nested local coordinate systems for nested `Canvas.Node`s.

### 6. Camera state and coordinate math

Source: `framework/canvas.zig`.

Canvas camera state is held in `CanvasInstance`:

```zig
cam_x: f32
cam_y: f32
cam_zoom: f32
last_applied_view_x/y/zoom
hovered_node_idx
selected_node_idx
node_dim[8192]
flow_override[8192]
```

The graph-to-screen transform used during paint is:

```text
screen_x = graph_x * zoom + (viewport_center_x - cam_x * zoom)
screen_y = graph_y * zoom + (viewport_center_y - cam_y * zoom)
```

The inverse used for hit-testing and wheel zoom is:

```text
graph_x = (screen_x - viewport_center_x + cam_x * zoom) / zoom
graph_y = (screen_y - viewport_center_y + cam_y * zoom) / zoom
```

Wheel zoom preserves the graph point under the cursor:

1. Compute the graph point under the mouse at the old zoom.
2. Multiply zoom by `1.15` or `1 / 1.15`, clamped to `0.05..100`.
3. Compute the graph point under the mouse at the new zoom.
4. Adjust `cam_x`/`cam_y` by the difference.

Drag-to-pan subtracts screen delta divided by zoom:

```text
cam_x -= dx / zoom
cam_y -= dy / zoom
```

Important current limitation: `framework/canvas.zig` has a multi-instance pool
(`MAX_CANVAS_INSTANCES = 16`) and `*For(id, ...)` helpers, but the V8 engine path
mostly calls the default helpers (`screenToGraph`, `handleDrag`, `handleScroll`,
`getHoveredNode`, `getSelectedNode`, `renderCanvas`) and no V8 prop currently
parses `canvasId`. Multiple `Canvas` surfaces therefore share the default camera,
hover, selection, dim, and flow state in the current public V8 path.

### 7. Painting

Source: `framework/engine.zig`, `framework/svg_path.zig`, `framework/blend2d.zig`,
`framework/gpu/*`.

`paintNode` handles Canvas before generic child recursion:

1. Paints the Canvas node's own visual background/border/text path via normal
   node painting.
2. If `canvas_type != null`, calls `paintCanvasContainer(node)` and returns.

`paintCanvasContainer`:

1. Applies changed `viewX`/`viewY`/`viewZoom` props through `canvas.applyPropView`.
2. Applies drift by calling `canvas.handleDrag` when active and not dragging or
   selected.
3. Pushes a scissor equal to the canvas viewport.
4. Calls `canvas.renderCanvas("canvas", x, y, w, h)`, which paints the default
   dark background and any registered internal custom renderer for that type.
5. Calls `positionCanvasNodes`.
6. Sets the GPU transform for graph-space drawing.
7. Paints the built-in grid under children when `gridStep > 0`.
8. Paints graph-space children: `Canvas.Path` and `Canvas.Node`, flattening one
   wrapper level.
9. Resets the GPU transform.
10. Starts a fresh scissor segment and paints `Canvas.Clamp` children in screen
    space above the graph.

`paintCanvasChild` is also where selection/highlight affordances and host
overrides are applied:

- Selected node: purple-ish rounded rect behind the node.
- Hovered node: softer rounded rect behind the node.
- `setNodeDim(index, opacity)` overrides `g_paint_opacity` for a flattened
  child index.
- `setPathFlow(index, enabled)` enables/disables path flow for a flattened
  child index.

`paintCanvasPath`:

1. Parses `d` for fill and stroke.
2. Fills from a named `Effect` if `fillEffect` resolves.
3. Else fills from `gradient`.
4. Else fills from `fill`.
5. Strokes with GPU-native SDF curves.
6. If `flowSpeed != 0`, dims the base stroke and emits moving pulse particles
   along curve segments.

Fills are path-based, not DOM/CSS fills. `fillEffect` reads from the CPU-visible
pixel buffer of a named `Effect` and maps it over the path bounding box.

### 8. Hit-testing, events, and movement

Source: `framework/events.zig`, `framework/engine.zig`, `runtime/index.tsx`.

Canvas has specialized hit paths because graph-space children are not in window
coordinates after pan/zoom.

Hover:

1. SDL mouse motion arrives in the engine loop.
2. `events.findCanvasNode(root, mx, my)` finds the topmost Canvas viewport under
   the cursor.
3. Engine converts screen coordinates to graph coordinates with
   `canvas.screenToGraph`.
4. It scans flattened `Canvas.Node` children and stores the hovered flattened
   index with `canvas.setHoveredNode`.

Click:

1. Normal `layout.hitTest` gets first chance. If a regular interactive node was
   hit, the usual event path runs.
2. Otherwise, if the cursor is over a Canvas, the engine converts to graph
   coordinates and hit-tests `Canvas.Node` children.
3. If an interactive child inside a Canvas.Node is hit, its normal handler is
   dispatched (`onPress`, `onMouseDown`, input focus, href, etc.).
4. If no interactive child is hit, the engine toggles Canvas selection from the
   current hovered flattened index and starts canvas pan.

Wheel:

1. If the pointer is over a terminal inside a Canvas.Node, terminal scrollback
   consumes the wheel.
2. Else if the pointer is over a `ScrollView` inside a Canvas.Node, that
   ScrollView consumes the wheel and dispatches `onScroll`.
3. Else the Canvas camera zooms.
4. Outside Canvas, normal scroll containers handle wheel events.

Alt-drag node movement:

1. On left mouse down with Alt held, the engine looks for a hovered
   `Canvas.Node` whose `canvas_move_draggable` flag is true.
2. That flag is set only when the JS handler-name set includes `onMove`.
3. During motion, the engine computes new graph coordinates and writes them
   directly into the persistent node pool through
   `AppConfig.set_canvas_node_position`.
4. It also updates the current arena node so the visual follows immediately.
5. It dispatches live `__dispatchCanvasMove(id, gx, gy)` at roughly 60 Hz.
6. On mouse up, it dispatches one final `__dispatchCanvasMove`.
7. `runtime/index.tsx` maps that global to the JS handler:

```ts
dispatchAliases(id, ['onMove'], { targetId: id, gx, gy });
```

The direct pool write is intentional. It avoids rerendering the full
Canvas.Node subtree on every pointer motion.

## Host Functions And Telemetry

These globals are registered by V8 bindings and relate to Canvas:

| Global | Source | Purpose |
| --- | --- | --- |
| `getActiveNode()` | `framework/v8_bindings_fs.zig` | Returns selected flattened canvas child index, or hovered index, or `-1`. |
| `getSelectedNode()` | `framework/v8_bindings_fs.zig` | Returns selected flattened canvas child index, or `-1`. |
| `setNodeDim(index, opacity)` | `framework/v8_bindings_fs.zig` | Sets per-child paint opacity by flattened index. |
| `resetNodeDim()` | `framework/v8_bindings_fs.zig` | Resets all per-child opacity overrides. |
| `setPathFlow(index, enabled)` | `framework/v8_bindings_fs.zig` | Enables/disables flow for a flattened child index. |
| `resetPathFlow()` | `framework/v8_bindings_fs.zig` | Resets all flow overrides to enabled. |
| `setFlowEnabled(mode)` | `framework/v8_bindings_fs.zig` | Sets global SVG path flow mode in `svg_path.zig`: `0=off`, `1=partial`, `2=full`. |
| `__tel_canvas()` | `framework/v8_bindings_telemetry.zig` | Returns canvas telemetry: camera x/y/zoom and registered custom renderer count. |

Flattened child indices are not React host ids. The index is assigned during the
Canvas child paint scan. It includes `Canvas.Node` and `Canvas.Path` children,
skips `Canvas.Clamp`, and flattens one level through non-canvas wrappers.

## Internal Zig API

`framework/canvas.zig` exposes internal helpers:

```zig
pub fn init() void
pub fn register(name: []const u8, renderer: CanvasRenderer) void
pub fn get(name: []const u8) ?*const CanvasRenderer
pub fn setCamera(cx: f32, cy: f32, zoom: f32) void
pub fn applyPropView(id: u8, vx: f32, vy: f32, vz: f32) bool
pub fn renderCanvas(canvas_type: []const u8, x: f32, y: f32, w: f32, h: f32) void
pub fn screenToGraph(screen_x: f32, screen_y: f32, vp_cx: f32, vp_cy: f32) [2]f32
pub fn handleScroll(mx: f32, my: f32, delta: f32, vp_w: f32, vp_h: f32) void
pub fn handleDrag(dx: f32, dy: f32) void
pub fn setHoveredNode(idx: ?u16) void
pub fn clickNode() void
pub fn setNodeDim(idx: u16, opacity: f32) void
pub fn setFlowOverride(idx: u16, enabled: bool) void
pub fn telemetryCameraState() TelemetryCameraState
```

There are also `*For(id, ...)` variants for the scaffolded instance pool. Treat
the non-`For` functions as the current public V8 path unless the engine is
updated to carry canvas ids end to end.

`CanvasRenderer` is internal:

```zig
pub const CanvasRenderer = struct {
    render_fn: *const fn (
        x: f32,
        y: f32,
        w: f32,
        h: f32,
        cam: CameraTransform,
    ) void,
};
```

The current public `Canvas` type always sets `canvas_type = "canvas"`. There is
no public TSX prop that selects a registered custom canvas type.

## Source Map

| Concern | Files |
| --- | --- |
| Public primitive wrappers | `runtime/primitives.tsx` |
| Lowercase intrinsic mapping | `runtime/jsx_shim.ts` |
| Reconciler mutation generation, handler registry, flush coalescing | `renderer/hostConfig.ts` |
| V8 `__hostFlush` queue | `framework/v8_bindings_core.zig` |
| Command application, type defaults, prop parsing, tree materialization | `v8_app.zig` |
| Node fields and layout rules | `framework/layout.zig`, `framework/api.zig` |
| Camera state, selection, dim/flow overrides, transforms | `framework/canvas.zig` |
| Paint, grid, path fill/stroke, pan/zoom/move event loop | `framework/engine.zig` |
| Canvas viewport hit discovery | `framework/events.zig` |
| SVG path parsing/fill/stroke/flow | `framework/svg_path.zig`, `framework/blend2d.zig` |
| GPU transform application | `framework/gpu/gpu.zig`, `framework/gpu/rects.zig`, `framework/gpu/text.zig`, `framework/gpu/curves.zig`, `framework/gpu/images.zig` |
| JS event dispatch globals | `runtime/index.tsx` |

## Current Caveats

- Multi-canvas instance support is scaffolded in `framework/canvas.zig`, but the
  current V8 path uses the default instance in most engine calls and does not
  parse a public `canvasId` prop.
- `originTopLeft` affects `Graph`; it is parsed for Canvas but the Canvas paint
  transform still uses center origin.
- `Canvas` style backgrounds are currently painted before the built-in canvas
  background in `canvas.renderCanvas`, so the built-in dark fill may cover them.
- `strokeDasharray` is not wired for Canvas/Graph paths.
- `Canvas.Path` coordinates are graph-space coordinates. Nesting under
  `Canvas.Node` does not create a local path origin.
- `Canvas.Node` positioning is intended for direct Canvas children, with one
  wrapper level tolerated for mapped lists. Nested `Canvas.Node` coordinate
  spaces are not implemented.
- `Graph.Node` is parsed but does not go through the Canvas-specific
  `positionCanvasNodes` step. Prefer `Graph.Path` for static charts unless you
  verify node placement.
- `getActiveNode`, `getSelectedNode`, `setNodeDim`, and `setPathFlow` use
  flattened paint indices, not React host ids.
- Path data is parsed during paint. For very large animated path sets, prefer
  stable paths plus host-driven `flowSpeed` over rebuilding thousands of `d`
  strings per frame.
