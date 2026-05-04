# Graph Pipeline (V8 Runtime)

`Graph` is the static vector/embedded-UI surface in the V8 runtime. It is not a DOM
`<svg>` layer and it is not an HTML canvas. It is a ReactJIT host primitive that
reuses the same Zig `layout.Node` fields as `Canvas.Path` / `Canvas.Node`, then
paints through the native GPU and SVG-path code.

The practical split:

- `Graph` = static viewport transform and clipping for `Graph.Path` children.
- `Canvas` = interactive viewport with pan, zoom, hover, selection, drag, clamps,
  optional built-in grid, and the same path/node drawing primitives.
- `Graph.Path` and `Canvas.Path` are the same host-side path node.
- `Graph.Node` and `Canvas.Node` are both recognized as the same host-side
  `canvas_node` flag, but only the `Canvas` paint path currently runs the
  positioning pass that applies `gx`/`gy`.

## Public API

Import from `runtime/primitives`:

```tsx
import { Canvas, Graph } from '@reactjit/runtime/primitives';
```

Lowercase JSX also works through `runtime/jsx_shim.ts`:

```tsx
<graph>
  <Graph.Path d="M -40 0 L 40 0" stroke="#fff" strokeWidth={2} />
</graph>
```

Related public surfaces:

- `runtime/classifier.tsx` exposes classifier primitive names `Graph`,
  `GraphPath`, `GraphNode`, `Canvas`, `CanvasPath`, `CanvasNode`, and
  `CanvasClamp`.
- `runtime/icons/Icon.tsx` renders icons by placing `Graph.Path` polylines
  inside a 24-unit `Graph` viewport.

### `<Graph>`

Static graph viewport.

Supported graph-specific props:

```ts
type GraphProps = {
  style?: object;
  children?: React.ReactNode;

  // Camera transform for graph-space children.
  viewX?: number;       // default 0
  viewY?: number;       // default 0
  viewZoom?: number;    // default 1; <=0 falls back to 1 in paint

  // Default false: graph-space 0,0 maps to the element center.
  // true: graph-space 0,0 maps to the element top-left.
  originTopLeft?: boolean;
};
```

`Graph` is clipped to its computed rectangle. It has no built-in mouse pan,
wheel zoom, hover index, selection, or drag loop.

### `<Graph.Path>`

Vector path node. Same storage and renderer as `Canvas.Path`.

```ts
type GraphPathProps = {
  d: string;            // SVG path data
  stroke?: string;      // color string; defaults to white if omitted
  strokeWidth?: number; // default 2
  strokeOpacity?: number; // 0..1, default 1

  fill?: string;        // flat fill color; omit for no fill
  fillOpacity?: number; // 0..1, default 1
  gradient?: {
    x1?: number;
    y1?: number;
    x2?: number;        // default 24
    y2?: number;        // default 24
    stops: Array<{ offset: number; color: string; opacity?: number }>;
  };
  fillEffect?: string;  // name of an <Effect> pixel surface to sample as fill

  flowSpeed?: number;   // animated stroke flow; 0 = solid, negative reverses
  style?: object;       // only relevant for standalone icon-style paths
};
```

SVG path commands supported by `framework/svg_path.zig`:

```text
M/m L/l H/h V/v C/c S/s Q/q T/t A/a Z/z
```

The parser accepts whitespace and comma separators, implicit repeats, and
relative or absolute commands. Hard limits are currently 64 subpaths, 4096
flattened point floats per subpath, and 2048 GPU curve segments per path.

Known unsupported path props:

- `strokeDasharray` is passed through by React if supplied, but V8 does not parse
  it for `Graph.Path` / `Canvas.Path`.
- line caps, line joins, markers, SVG filters, text-on-path, and CSS/SVG
  inheritance are not implemented.

### `<Graph.Node>`

Declared in `runtime/primitives.tsx` and recognized by `v8_app.zig` as a
`canvas_node`.

```ts
type GraphNodeProps = {
  gx?: number;
  gy?: number;
  gw?: number;
  gh?: number;
  children?: React.ReactNode;
};
```

Important implementation note: the current `Graph` paint branch does not call
`positionCanvasNodes`, so `Graph.Node` does not reliably position children by
`gx` / `gy` today. For embedded ReactJIT UI in world coordinates, use
`Canvas.Node` inside a `Canvas`. `Graph.Node` is part of the intended API shape,
but the V8 graph branch needs a positioning pass before it is equivalent.

### `<Canvas>`

Interactive graph viewport. It shares path/node primitives with `Graph` and adds
camera state and input behavior.

Canvas-specific props parsed by V8:

```ts
type CanvasProps = GraphProps & {
  driftX?: number;
  driftY?: number;
  driftActive?: boolean;

  gridStep?: number;
  gridStroke?: number;
  gridColor?: string;
  gridMajorColor?: string;
  gridMajorEvery?: number;
};
```

`Canvas` defaults `canvas_type` to `"canvas"` and gets the interactive paint and
event path:

- wheel zoom via `framework/canvas.zig`;
- left-drag background pan;
- hover/selection index over flattened `Canvas.Node` / `Canvas.Path` children;
- `Alt` + drag on a node with `onMove` for host-owned node movement;
- `Canvas.Clamp` children painted in screen space as HUD overlays;
- built-in grid rendering under children when `gridStep > 0`.

The Zig canvas module has multi-instance fields (`canvas_id`, `*For(id, ...)`),
but the V8 prop parser does not currently set `canvas_id`; active V8 Canvas
surfaces use instance 0.

### `<Canvas.Node>`

Embeds normal ReactJIT UI in graph coordinates.

```ts
type CanvasNodeProps = {
  gx: number;        // graph-space center x
  gy: number;        // graph-space center y
  gw?: number;       // graph-space width; 0/omitted falls back to parent offer
  gh?: number;       // graph-space height; 0/omitted auto-measures children
  onMove?: (event: { targetId: number; gx: number; gy: number }) => void;
  children?: React.ReactNode;
};
```

`Canvas.Node` children are ordinary `Box`, `Text`, `Pressable`, `TextInput`,
`ScrollView`, etc. Layout happens first in local box coordinates; just before
painting, `engine.zig` shifts the computed rect and all descendants so the node
is centered on `gx`/`gy`.

`onMove` is special. When present, `v8_app.zig` sets
`canvas_move_draggable=true`. During `Alt` + drag, `engine.zig` writes
`canvas_gx` / `canvas_gy` directly into the host node pool for live movement and
dispatches `__dispatchCanvasMove(id, gx, gy)` to JS at roughly 60 Hz plus once on
release.

### `<Canvas.Path>`

Same props and renderer as `Graph.Path`, but it participates in Canvas hover
index ordering and paints under the interactive camera transform.

### `<Canvas.Clamp>`

Screen-space overlay inside a Canvas.

```tsx
<Canvas.Clamp>
  <Box style={{ position: 'absolute', left: 12, top: 12 }}>
    <Text>HUD</Text>
  </Box>
</Canvas.Clamp>
```

`Canvas.Clamp` spans the Canvas viewport, ignores graph-space camera transform,
and paints after graph-space children.

## End-To-End Pipeline

1. JSX calls the primitive wrapper.

   `runtime/primitives.tsx` defines `Graph`, `Graph.Path`, and `Graph.Node` as
   thin wrappers around `React.createElement('Graph' | 'Graph.Path' |
   'Graph.Node', props, children)`. Lowercase `<graph>` resolves to the same
   primitive in `runtime/jsx_shim.ts`.

2. React reconciler creates host instances.

   `renderer/hostConfig.ts` assigns a numeric host id, splits function handlers
   into the JS-only `handlerRegistry`, and emits a clean `CREATE` command:

   ```json
   {
     "op": "CREATE",
     "id": 12,
     "type": "Graph.Path",
     "props": { "d": "M 0 0 L 100 0", "stroke": "#fff" },
     "handlerNames": []
   }
   ```

   Updates become coalesced `UPDATE` commands. Handler identity changes update
   only `handlerRegistry` when the host does not need to know about the change.

3. Commands cross the V8 host bridge.

   `flushToHost()` serializes the pending command list to JSON and calls the
   registered transport, normally `globalThis.__hostFlush`.

4. `v8_app.zig` applies command type defaults.

   `applyTypeDefaults` maps type strings to `layout.Node` flags:

   ```text
   Canvas       -> canvas_type = "canvas", graph_container = true
   Graph        -> graph_container = true
   Canvas.Node  -> canvas_node = true
   Graph.Node   -> canvas_node = true
   Canvas.Path  -> canvas_path = true
   Graph.Path   -> canvas_path = true
   Canvas.Clamp -> canvas_clamp = true
   ```

5. `v8_app.zig` parses props into `layout.Node` fields.

   Relevant fields include:

   ```text
   originTopLeft -> graph_origin_topleft
   viewX/Y/Zoom  -> canvas_view_x/y/zoom + canvas_view_set
   gx/gy/gw/gh   -> canvas_gx/gy/gw/gh
   d             -> canvas_path_d
   stroke        -> text_color
   strokeWidth   -> canvas_stroke_width
   strokeOpacity -> canvas_stroke_opacity
   fill          -> canvas_fill_color
   fillOpacity   -> canvas_fill_opacity
   gradient      -> canvas_fill_gradient
   fillEffect    -> canvas_fill_effect
   flowSpeed     -> canvas_flow_speed
   ```

   Color parsing accepts `#...`, `rgb(...)` / `rgba(...)`, a small named-color
   set (`black`, `white`, `red`, `blue`, `green`, `yellow`, `cyan`, `magenta`),
   and `transparent`.

6. Layout computes boxes.

   In `framework/layout.zig`:

   - `Canvas.Path` / `Graph.Path` nodes collapse to `0x0` because they overlay
     their parent under the active graph transform.
   - Standalone icon-style path nodes with `canvas_path_d` but not
     `canvas_path=true` get a normal 24x24-ish layout box and are scaled into it.
   - `Canvas.Node` / `Graph.Node` get a layout box from `gw` / `gh`; `gh=0`
     performs an auto-height pass over children.

7. Paint chooses Graph or Canvas behavior.

   In `framework/engine.zig`, `paintNode` checks `canvas_type` before
   `graph_container`:

   - `Canvas` goes through `paintCanvasContainer`.
   - `Graph` goes through the lightweight `graph_container` branch.

8. Graph paint path applies a static transform.

   The Graph branch pushes a scissor for the element rect, computes:

   ```text
   ox = originTopLeft ? rect.x : rect.x + rect.w / 2
   oy = originTopLeft ? rect.y : rect.y + rect.h / 2
   tx = ox - viewX * viewZoom
   ty = oy - viewY * viewZoom
   scale = viewZoom
   ```

   `setComposedGpuTransform` composes this with any parent Canvas transform, so
   a `Graph` nested inside a `Canvas` can draw static path layers that still move
   with the Canvas camera.

9. Canvas paint path applies interactive camera state.

   `paintCanvasContainer` syncs changed `viewX/Y/Zoom` props into
   `framework/canvas.zig`, applies drift, pushes scissor, draws the Canvas
   background/custom renderer, positions `Canvas.Node` children, sets the camera
   GPU transform, paints graph-space children, then resets transform and paints
   `Canvas.Clamp` overlays.

10. Path painting parses and draws SVG data.

    `paintCanvasPath` calls `svg_path.parsePath(d)` for fills and strokes:

    - fillEffect: sample a named `Effect` pixel buffer, with Blend2D when
      available and Zig fallback otherwise;
    - gradient: triangulate and Gouraud-shade a linear gradient;
    - flat fill: triangulate and draw filled polygons;
    - stroke: draw GPU-native line/quadratic/cubic curve segments with optional
      `flowSpeed`.

11. Events dispatch back to JS.

    For ordinary handlers, Zig evaluates `__dispatchEvent(id, 'onClick')`, and
    `runtime/index.tsx` resolves aliases like `onPress` / `onClick` from
    `handlerRegistry`.

    Canvas-specific input uses `events.findCanvasNode` and
    `canvas.screenToGraph` to convert mouse coordinates into graph coordinates,
    then hit-tests `Canvas.Node` descendants. `Graph` has no equivalent event
    branch; use `Pressable` overlays or `Canvas` when graph-space interaction is
    required.

## Recommended Patterns

Static chart or decorative vector layer:

```tsx
<Graph style={{ width: '100%', height: '100%' }} viewX={0} viewY={0} viewZoom={1}>
  <Graph.Path d="M -120 40 C -20 -80 80 120 140 -20" stroke="#7de8ff" strokeWidth={3} />
</Graph>
```

Interactive graph with vector edges and draggable cards:

```tsx
<Canvas style={{ flexGrow: 1 }} viewX={camera.x} viewY={camera.y} viewZoom={camera.zoom}>
  <Graph style={{ position: 'absolute', left: 0, top: 0, width: '100%', height: '100%' }}>
    {edges.map((edge) => (
      <Graph.Path key={edge.id} d={edge.d} stroke={edge.color} strokeWidth={1.5} />
    ))}
  </Graph>

  {nodes.map((node) => (
    <Canvas.Node
      key={node.id}
      gx={node.x}
      gy={node.y}
      gw={160}
      gh={72}
      onMove={(event) => moveNode(node.id, event.gx, event.gy)}
    >
      <Pressable onPress={() => selectNode(node.id)}>
        <Text>{node.label}</Text>
      </Pressable>
    </Canvas.Node>
  ))}

  <Canvas.Clamp>
    <Text>HUD</Text>
  </Canvas.Clamp>
</Canvas>
```

DOM-coordinate chart:

```tsx
<Graph
  originTopLeft
  style={{ width: 480, height: 240 }}
  viewX={0}
  viewY={0}
  viewZoom={1}
>
  <Graph.Path d="M 40 200 L 140 120 L 240 160 L 360 60" stroke="#fff" />
</Graph>
```

## Source Map

- `runtime/primitives.tsx` — public `Canvas` / `Graph` wrappers.
- `runtime/jsx_shim.ts` — lowercase `<canvas>` / `<graph>` intrinsic mapping.
- `renderer/hostConfig.ts` — React reconciler host instances, handler stripping,
  mutation command emission, update coalescing.
- `runtime/index.tsx` — `__dispatchEvent` and handler alias dispatch.
- `v8_app.zig` — JSON command application, type defaults, prop parsing, handler
  flag installation, `onMove` bridge.
- `framework/layout.zig` — `layout.Node` fields and path/node layout behavior.
- `framework/engine.zig` — Graph transform branch, Canvas paint branch, path
  painting, Canvas input handling.
- `framework/canvas.zig` — Canvas camera, pan/zoom, hover/selection/dim/flow
  state.
- `framework/events.zig` — tree hit-testing and Canvas discovery.
- `framework/svg_path.zig` — SVG path parser, fill tessellation, GPU curve
  stroke emission.
- `framework/blend2d.zig` — optional high-quality fillEffect raster path.
