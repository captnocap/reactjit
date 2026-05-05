# SVG Pipeline (V8 Runtime)

Last updated: 2026-05-04

This document covers every live SVG-related pipeline in the V8 runtime.

ReactJIT does not implement a browser SVG DOM. There is no `<svg>` element
tree, no CSS/SVG inheritance, no `<defs>`, no filters, no markers, and no SVG
image decoder. The live support is narrower and more direct:

- SVG path data in `Canvas.Path` and `Graph.Path`.
- SVG path data embedded inside text through `GLYPH_SLOT` and `inlineGlyphs`.
- Icon components that convert icon polylines into `Graph.Path`.
- Animated dashed/flowing box borders, which are SVG-adjacent because they
  generate path-like line segments and render them through `svg_path` stroke
  primitives.
- Optional CPU rasterizers (`blend2d.zig`, `vello.zig`) that can rasterize SVG
  paths to GPU image quads. In the current engine path, Blend2D is used for
  effect-filled paths when built in; Vello is present but not wired into
  `engine.zig`.

## Source Map

| Layer | Files | Role |
| --- | --- | --- |
| Public primitives | `runtime/primitives.tsx` | Exposes `Canvas.Path`, `Graph.Path`, `Graph`, `Canvas`, `Image`, `Text`, and `GLYPH_SLOT`. |
| Icon helper | `runtime/icons/Icon.tsx`, `runtime/icons/icons.ts` | Converts icon point arrays to SVG `d` strings and renders `Graph.Path`. |
| Host prop docs | `runtime/host_props.ts` | Documents V8 path props such as `fillOpacity`, `strokeOpacity`, `fillEffect`, and `flowSpeed`. |
| React host bridge | `renderer/hostConfig.ts` | Emits `CREATE`, `UPDATE`, `REMOVE`, text, and append mutation commands. |
| V8 command decoder | `v8_app.zig` | Applies type defaults and decodes path, glyph, border, graph, and image props into `layout.Node`. |
| Layout model | `framework/layout.zig` | Stores path fields, inline glyph descriptors, graph fields, and border dash style fields. |
| Paint orchestration | `framework/engine.zig` | Dispatches graph/canvas/path paint, inline glyph paint, image paint, and animated border paint. |
| SVG parser/renderer | `framework/svg_path.zig` | Parses SVG path strings, triangulates fills, draws SDF strokes, capsules, gradients, effect fills, and flow pulses. |
| Hidden border path | `framework/border_dash.zig` | Builds rounded-rectangle perimeter polylines and emits dashed stroke segments. |
| Effect sources | `framework/effects.zig` | Supplies named CPU pixel buffers for `fillEffect` and inline glyph `fillEffect`. |
| Optional raster fill | `framework/blend2d.zig` | Rasterizes SVG path alpha masks/fills to textures when `has_blend2d` is enabled. |
| Adjacent raster fill | `framework/vello.zig` | Cached anti-aliased SVG path fill backend, currently not called from `engine.zig`. |
| Image decode | `framework/image_cache.zig` | Decodes bitmap image sources; does not decode SVG images. |

## Public Surfaces

### `Graph.Path` and `Canvas.Path`

`runtime/primitives.tsx` defines both as thin host wrappers:

```ts
CanvasBase.Path = (props: any) => h('Canvas.Path', props, props.children);
GraphBase.Path = (props: any) => h('Graph.Path', props, props.children);
```

The V8 type default marks both host nodes as `node.canvas_path = true`.
They share the same native renderer.

```ts
type PathProps = {
  d: string;

  stroke?: string;        // defaults to white if omitted or parsed as null
  strokeWidth?: number;   // default 2
  strokeOpacity?: number; // clamped 0..1, default 1

  fill?: string;          // flat fill color; omit for no fill
  fillOpacity?: number;   // clamped 0..1, default 1

  gradient?: {
    x1?: number;          // default 0
    y1?: number;          // default 0
    x2?: number;          // default 24
    y2?: number;          // default 24
    stops: Array<{
      offset: number;
      color: string;
      opacity?: number;
    }>;
  };

  fillEffect?: string;    // named Effect pixel surface used as path fill
  flowSpeed?: number;     // animated stroke pulse; positive forward, negative reverse
  style?: object;
};
```

`Graph.Path` is used inside a static clipped `Graph` transform.
`Canvas.Path` is used inside the interactive canvas transform with pan, zoom,
hover, selection, dimming, clamps, and optional grid behavior.

Path coordinates are graph coordinates. A `Graph` maps graph origin either to
the element center by default or to the top-left corner with `originTopLeft`.
`Canvas` maps graph space through the canvas camera.

### `Icon`

`Icon` is not a native primitive. It is a JS component that renders:

```text
Box -> Graph -> Graph.Path
```

`runtime/icons/Icon.tsx` loads icon point arrays from the icon registry,
simplifies them, converts each polyline to a `d` string, and renders one
`Graph.Path` per polyline. Its path strings are centered around a 24-unit icon
view:

```tsx
<Graph
  style={{ width: size, height: size }}
  viewX={0}
  viewY={0}
  viewZoom={size / 24}
>
  <Graph.Path d="M ..." stroke={color} strokeWidth={strokeWidth} fill="none" />
</Graph>
```

That means icon rendering enters the exact same `Graph.Path` pipeline below.

### Inline SVG Glyphs

`runtime/primitives.tsx` exports:

```ts
export const GLYPH_SLOT = '\x01';
```

A `Text` string can contain that byte to reserve a square inline slot. The
matching `inlineGlyphs[i]` descriptor paints an SVG path into the i-th recorded
slot:

```ts
type InlineGlyph = {
  d: string;
  fill?: string;       // default white
  fillEffect?: string; // named Effect fill
  stroke?: string;     // default transparent
  strokeWidth?: number;
  scale?: number;      // default 1
};
```

This is not a native `<Glyph>` element in V8 JSX. Unknown `<Glyph>` elements can
exist as host nodes, but V8 gives no glyph semantics to that tag. Use
`GLYPH_SLOT` plus `inlineGlyphs`.

### Animated Box Borders

Box/View style supports a hidden path-like border pipeline:

```ts
type BorderDashStyle = {
  borderDash?: [number, number];
  borderDashOn?: number;
  borderDashOff?: number;
  borderFlowSpeed?: number; // px/sec, positive clockwise
  borderDashWidth?: number;
};
```

Tailwind-ish class parsing also emits these props:

```text
border-dash-4-2  -> borderDashOn: 4, borderDashOff: 2
border-dash-6    -> borderDashOn: 6, borderDashOff: 6
border-dash-w-2  -> borderDashWidth: 2
border-flow-30   -> borderFlowSpeed: 30
```

This is not SVG path data parsing. It builds a rounded-rectangle perimeter from
box geometry and emits line segments into the same GPU capsule line primitive
used by SVG path strokes.

### Image SVG Non-Support

`Image` is bitmap-only in the current runtime. It stores `source` as
`node.image_src`, and `engine.zig` queues it through `image_cache.queueQuad`.
The image cache uses bitmap decoding, not SVG document rendering. `Image`
should not be treated as an SVG surface, even though some icon systems on the
web use SVG files or data URLs.

Use `Graph.Path` / `Canvas.Path` / `Icon`, or rasterize the SVG to PNG before
passing it to `Image`.

## Color and `none` Semantics

`v8_app.zig` color parsing accepts:

- hex strings such as `#rgb`, `#rrggbb`, and alpha forms handled by `parseHex`;
- `rgb(...)` / `rgba(...)`;
- a small set of named colors: `black`, `white`, `red`, `blue`, `green`,
  `yellow`, `cyan`, `magenta`;
- `transparent`;
- resolved theme tokens, because `runtime/primitives.tsx` resolves `theme:*`
  values before they reach V8.

The parser does not have a real SVG `none` color token. This matters:

- `fill="none"` parses to null, so the fill pass is skipped. This works for
  icon strokes.
- `stroke="none"` also parses to null, but the path paint code falls back to
  white when `node.text_color` is null. To suppress stroke, use
  `stroke="transparent"`, `strokeOpacity={0}`, or `strokeWidth={0}`.

## Path Data Parser

`framework/svg_path.zig` is the central SVG path parser. It supports:

```text
M/m L/l H/h V/v C/c S/s Q/q T/t A/a Z/z
```

The parser accepts comma or whitespace separators, implicit repeated commands,
and relative or absolute command forms.

Parser output has two parallel shapes:

- flattened subpaths: point arrays used for fills, gradient fills, effect fills,
  arc length helpers, and partial legacy strokes;
- curve segments: line, quadratic, and cubic segments used by the GPU-native
  stroke renderer.

Hard limits:

| Limit | Value |
| --- | --- |
| `MAX_SUBPATHS` | 64 |
| `MAX_POINTS` | 4096 floats per subpath |
| `MAX_CURVE_SEGMENTS` | 2048 |
| `DEFAULT_TOLERANCE` | 0.5 |

Arcs are converted into cubic segments for stroke rendering and flattened into
points for fill rendering.

## `Graph.Path` / `Canvas.Path` End-To-End

1. Cart code renders:

```tsx
<Graph.Path
  d="M -40 0 C -10 -30 20 30 40 0"
  stroke="#7de8ff"
  strokeWidth={3}
  fill="transparent"
/>
```

2. `runtime/primitives.tsx` creates a host element with type `Graph.Path` or
   `Canvas.Path`.
3. `renderer/hostConfig.ts` emits a `CREATE` or `UPDATE` command.
4. `flushToHost` batches commands, JSON stringifies them, and calls
   `__hostFlush`.
5. `v8_app.zig` decodes the JSON command.
6. `applyTypeDefaults` sets `node.canvas_path = true` for `Graph.Path` and
   `Canvas.Path`.
7. `applyProps` decodes:

```text
d             -> node.canvas_path_d
stroke        -> node.text_color
strokeWidth   -> node.canvas_stroke_width
strokeOpacity -> node.canvas_stroke_opacity
fill          -> node.canvas_fill_color
fillOpacity   -> node.canvas_fill_opacity
gradient      -> node.canvas_fill_gradient
fillEffect    -> node.canvas_fill_effect
flowSpeed     -> node.canvas_flow_speed
```

8. Layout collapses `canvas_path` nodes to `0x0` because they overlay their
   graph/canvas parent rather than taking flex space.
9. During paint, `engine.zig` reaches `paintCanvasPath`.
10. The fill pass runs first if `fillEffect`, `gradient`, or `fill` is present.
11. The stroke pass always runs after fill. It parses the path and calls
    `svg_path.drawStrokeCurves`.

The path paint branch runs before the normal zero-size early return. That is
why overlay paths with computed `0x0` still paint.

## Fill Pipelines

### Flat Fill

Flat fill is the simplest path:

```text
node.canvas_fill_color
-> svg_path.parsePath(d)
-> svg_path.drawFill(path, rgba)
-> ear clip each flattened subpath
-> gpu.drawTri(...)
```

`drawFill` triangulates each subpath independently. Disjoint filled subpaths
work. Nested holes are not bridged, so true SVG even-odd/nonzero hole behavior
is not fully implemented.

### Linear Gradient Fill

The gradient prop is decoded by `parseLinearGradient`:

```ts
{
  x1?: number; // default 0
  y1?: number; // default 0
  x2?: number; // default 24
  y2?: number; // default 24
  stops: [{ offset, color, opacity? }]
}
```

Paint path:

```text
node.canvas_fill_gradient
-> svg_path.parsePath(d)
-> translate layout.GradientStop to svg_path.GradientStopF
-> svg_path.drawFillLinearGradient(...)
-> ear clip
-> sample gradient at vertices
-> gpu.drawTriColored(...)
```

The gradient is Gouraud-interpolated by vertex colors. It is not a browser SVG
gradient implementation with spread modes, units, transforms, or defs.

Current allocation note: `parseLinearGradient` allocates stop arrays with the
same node-lifetime/leak-on-replace pattern as `canvas_path_d`.

### Named Effect Fill

`fillEffect` samples a named effect pixel surface:

```tsx
<Graph.Path d={shape} fillEffect="plasma" stroke="transparent" />
```

Paint path:

```text
node.canvas_fill_effect
-> effects.getEffectFill(name)
-> svg_path.parsePath(d)
-> compute path bounding box from flattened points
-> if HAS_BLEND2D:
     blend2d_gfx.fillSVGPathFromEffect(...)
   else:
     svg_path.drawFillFromEffect(...)
```

The fallback `drawFillFromEffect` path triangulates the path and samples effect
pixels at triangle vertices. That is cheap but coarse for detailed effect
textures.

When `HAS_BLEND2D` is true, `blend2d.zig` builds a real SVG alpha mask on a CPU
surface, replaces masked pixels with the named effect pixels, optionally draws
the stroke into the same transient texture, uploads it, and queues a GPU image
quad at the path bounding box. This preserves effect detail better than
per-vertex sampling.

`ZIGOS_PAISLEY_DEBUG` enables extra debug logging for selected effect names in
this path.

## Stroke Pipeline

The stroke pass is GPU-native:

```text
svg_path.parsePath(d)
-> svg_path.drawStrokeCurves(path, rgba, strokeWidth, flowSpeed, ticks)
-> line       -> svg_path.drawLineSegment -> gpu.drawCapsule
-> quadratic  -> gpu.drawCurve
-> cubic      -> gpu.drawCubicCurve
```

`drawLineSegment` uses `gpu.drawCapsule`, not a rotated rectangle. The capsule
shader gives rounded caps and covers polyline joins without CPU join geometry.

If `flowSpeed != 0`, `drawStrokeCurves` dims the base stroke alpha to 25
percent and overlays two moving pulse segments per curve segment. Positive
speed moves from segment start to end; negative speed reverses.

There is also a legacy tessellated `drawStroke` and a `drawStrokePartial`
helper in `svg_path.zig`. The current `Graph.Path` / `Canvas.Path` paint path
uses `drawStrokeCurves`, not the legacy stroke path.

Canvas-specific flow controls exist in the V8 host bindings, and there is also
a global flow-mode binding left in the surface:

| Host function | Role |
| --- | --- |
| `setFlowEnabled(mode)` | Calls `svg_path.setFlowMode(mode)` with `0=off`, `1=partial`, `2=full`; current `drawStrokeCurves` does not read this global value, so treat it as legacy/scaffolded. |
| `setPathFlow(index, enabled)` | Canvas-level flow override for a flattened child index. |
| `resetPathFlow()` | Clears canvas path flow overrides. |

`flowSpeed` is still the public prop that makes a path visibly animated.

## Inline Glyph Pipeline

Inline glyphs reuse `svg_path.zig`, but their positioning comes from text
layout rather than graph/canvas layout.

1. Cart code renders a `Text` node whose string contains `GLYPH_SLOT`.
2. `inlineGlyphs` is sent as a normal top-level prop.
3. `v8_app.zig` calls `applyInlineGlyphs`.
4. Each descriptor becomes a `layout.InlineGlyph` with duplicated `d` and
   `fillEffect` strings.
5. Text measurement treats each sentinel byte as a `fontSize x fontSize`
   inline box.
6. Text paint records the actual slot positions while drawing the string.
7. `engine.zig` calls `paintInlineGlyphs`.
8. For each recorded slot and matching glyph descriptor:
   - parse the path;
   - compute the path bbox;
   - scale it to fit the slot;
   - set a temporary GPU transform;
   - fill with either `fillEffect` or flat `fill`;
   - stroke if `strokeWidth > 0` and stroke alpha is nonzero;
   - reset the GPU transform.

Inline glyph effect fills intentionally use `svg_path.drawFillFromEffect`
directly even when Blend2D is available. The Blend2D path uses shared transient
surfaces and is avoided for inline glyph effect masks.

See `docs/v8/glyph.md` for the full text and glyph pipeline.

## Icon Pipeline

`runtime/icons/icons.ts` stores icons as arrays of points. `Icon.tsx` does:

1. Resolve paths by `name` or direct `icon` prop.
2. Simplify each polyline with a small Douglas-Peucker-style pass.
3. Convert each polyline to SVG path data:

```text
M x0-12,y0-12 L x1-12,y1-12 ...
```

4. Render a clipped `Box` with a `Graph`.
5. Render each polyline as a `Graph.Path` with `fill="none"`.
6. V8 paints those paths through the regular Graph path stroke pipeline.

Because icons are `Graph.Path`, they are not image quads and not bitmap cache
entries. Their anti-aliasing and flow behavior are the same as any path stroke.

## Border Dash / Border Flow Pipeline

The hidden border file is `framework/border_dash.zig`.

This pipeline starts from box style, not SVG `d`:

```tsx
<Box
  style={{
    borderColor: '#7de8ff',
    borderRadius: 12,
    borderWidth: 0,
    borderDashOn: 8,
    borderDashOff: 4,
    borderDashWidth: 2,
    borderFlowSpeed: 40,
  }}
/>
```

V8 style decode:

```text
borderDash        -> style.border_dash_on/off
borderDashOn      -> style.border_dash_on
borderDashOff     -> style.border_dash_off
borderFlowSpeed   -> style.border_flow_speed
borderDashWidth   -> style.border_dash_width
```

Paint path:

```text
paintNodeVisuals
-> if any dash/flow field is non-default
-> choose stroke width:
     borderDashWidth
     else borderWidth
     else 1.5
-> inset rect by half stroke width
-> border_dash.buildRoundedRectPerimeter(...)
-> border_dash.emitDashedStroke(...)
-> for each visible dash segment:
     svg_path.drawLineSegment(...)
     -> gpu.drawCapsule(...)
```

`buildRoundedRectPerimeter` flattens each rounded corner into 12 line segments
per quarter circle. `emitDashedStroke` walks the perimeter by arc length,
applies an `[on, off]` dash pattern, wraps the pattern at the seam, and
quantizes the period so an integer number of dash cycles fits the perimeter.
That avoids a visible pause/stutter at one corner.

If `borderDashOff <= 0`, the emitter draws the whole perimeter as continuous
segments. `borderFlowSpeed` then animates the phase offset, so the border can
read as continuous motion even without gaps.

Important distinction: path `flowSpeed` draws moving glow pulses on an SVG
path. Border `borderFlowSpeed` moves the dash pattern around a rounded
rectangle.

Current reset caveat: `resetStyleEntry` does not list the border dash fields,
so removing a dash style key from a later update may not reset the stored value.
Set the relevant fields back to `0` explicitly when turning a dashed/flowing
border off.

## CPU Raster Backends

### Blend2D

`framework/blend2d.zig` provides:

- `fillSVGPath`: cached flat SVG path fills keyed by path pointer and color.
- `fillSVGPathFromEffect`: transient effect-mask fills.
- `beginFrame`: resets transient fill counters.
- `deinit`: releases cached GPU resources.

In the current `engine.zig` path, ordinary flat path fills use
`svg_path.drawFill`, not `blend2d_gfx.fillSVGPath`. Blend2D is called for
`fillEffect` when `HAS_BLEND2D` is enabled.

### Vello

`framework/vello.zig` wraps a Rust Vello CPU FFI and exposes cached
anti-aliased SVG path fills that upload to GPU textures. A repo search shows no
current `engine.zig` call site for `vello.fillSVGPath`, so treat it as an
adjacent backend rather than a live V8 path-rendering surface.

## Unsupported SVG Features

The current V8 runtime does not implement:

- full `<svg>` document parsing;
- SVG files or `data:image/svg+xml` through `Image`;
- SVG DOM elements such as `<circle>`, `<rect>`, `<g>`, `<defs>`, `<use>`, or
  `<linearGradient>`;
- CSS cascade or inherited SVG presentation attributes;
- `currentColor`;
- real `stroke="none"` semantics;
- `strokeDasharray` on `Graph.Path` / `Canvas.Path`;
- line join and line cap props;
- markers;
- masks, clips, filters, blend modes, or text-on-path;
- even-odd/nonzero hole handling for nested fill contours.

## Practical Guidance

- For static vector icons, use `Icon` or direct `Graph.Path`.
- For chart/vector surfaces, use `Graph.Path` unless you need canvas pan/zoom
  or canvas selection behavior.
- For interactive graph/world content, use `Canvas.Path` and `Canvas.Node`.
- For icon-like shapes inside text, use `GLYPH_SLOT` and `inlineGlyphs`.
- For SVG artwork stored in files, convert it to path data or rasterize it to
  PNG before using `Image`.
- Use `fill="none"` or omit `fill` for stroke-only paths. Use
  `stroke="transparent"`, `strokeOpacity={0}`, or `strokeWidth={0}` for
  fill-only paths.
- Use `borderDash*` / `borderFlowSpeed` for animated rectangular card borders;
  use path `flowSpeed` for animated vector paths.

## Related Docs

- `docs/v8/graph.md` - Graph and Canvas path API.
- `docs/v8/canvas.md` - Canvas interaction and path paint details.
- `docs/v8/glyph.md` - Inline text glyph pipeline.
- `docs/v8/effects.md` - Named effects and effect fills.
- `docs/v8/paint.md` - Full paint order.
- `docs/v8/image_icon.md` - Image and Icon pipelines.
