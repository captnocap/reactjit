# V8 Layout Pipeline

Last updated: 2026-05-04.

This document traces the V8 layout path from cart JSX to computed rectangles,
paint, hit testing, and event feedback. It covers the current V8 runtime path,
not the legacy QJS or LuaJIT evaluator paths.

## Source Map

The layout path crosses these files in order:

- `runtime/primitives.tsx`: author-facing primitive wrappers and typed
  convenience components.
- `runtime/tw.ts`: Tailwind-like class parser that emits plain ReactJIT style
  objects.
- `renderer/hostConfig.ts`: React reconciler host config; creates host
  instances, diffs props, strips handlers, and emits mutation commands.
- `runtime/index.tsx`: creates the reconciler container, installs
  `__hostFlush` transport, and dispatches Zig events back into JS handlers.
- `framework/v8_bindings_core.zig`: registers `__hostFlush` and queues command
  payloads for the frame tick.
- `v8_app.zig`: drains command batches, applies props/styles to stable
  `layout.Node` structs, materializes the arena tree, and marks layout dirty.
- `framework/layout.zig`: owns `Style`, `Node`, intrinsic measurement, flex
  layout, scroll content measurement, and computed rectangles.
- `framework/engine.zig`: installs measure callbacks, runs the frame loop,
  invokes layout, paints nodes, handles scroll/canvas/event hit testing, and
  dispatches back into V8.
- `framework/events.zig`: hit-test helpers that consume computed layout.
- `framework/text.zig`, `framework/gpu/text.zig`, `framework/image_cache.zig`:
  measurement and paint dependencies used by layout.

## End-To-End Flow

### 1. JSX becomes host element intent

Cart code renders primitives from `runtime/primitives.tsx`.

Core primitives are thin wrappers over host type strings:

| JSX primitive | Host type emitted | Notes |
| --- | --- | --- |
| `Box` | `View` | Base flex container. |
| `Row` | `View` | Adds `style.flexDirection = "row"` before user style. |
| `Col` | `View` | Adds `style.flexDirection = "column"`. |
| `Text` | `Text` | Flattens adjacent string/number children and nested Text-like children into inline text content. |
| `Image` | `Image` | Uses `source` for decoded bitmap path. |
| `Pressable` | `Pressable` | Layout-equivalent to a node; interaction comes from handlers. |
| `ScrollView` | `ScrollView` | Adds `initialScrollY` hot-reload restoration and wraps `onScroll`. |
| `TextInput`, `TextArea`, `TextEditor` | same | Single-line, multi-line, and editor input surfaces. |
| `Terminal` | `Terminal` | Terminal cell-grid node. |
| `Canvas` | `Canvas` | Pan/zoom graph-space container. |
| `Canvas.Node` | `Canvas.Node` | Positioned graph-space child. |
| `Canvas.Path` | `Canvas.Path` | SVG path child. |
| `Canvas.Clamp` | `Canvas.Clamp` | Screen-space overlay inside Canvas. |
| `Graph` | `Graph` | Static viewport graph/chart container. |
| `Graph.Node`, `Graph.Path` | same | Graph-space node/path without pan/zoom. |
| `Effect` | `Effect` | Pixel shader/custom effect surface. |
| `StaticSurface` | `View` | Adds static-surface cache props. |
| `Filter` | `View` | Adds post-process filter props. |
| `Video` | `Image` | Maps `src` to `videoSrc`. |
| `RenderTarget` | `View` | Maps `src` to `renderSrc`. |
| `Window`, `Notification` | same | Open host windows/notifications. |
| `Physics.*`, `Scene3D.*`, `Audio.*` | mostly `View` | Convenience wrappers that emit host flags read by engine-side subsystems. |
| `Native` | dynamic `type` prop | Escape hatch that emits any host type string. |

Theme tokens with the `theme:` prefix are resolved in primitives before the
host config sees props.

### 2. `className` and HTML-ish JSX are normalized

`renderer/hostConfig.ts` remaps common HTML tags before emitting `CREATE`.
Examples:

- Containers such as `div`, `section`, `main`, `button`, `ul`, `li`, `table`
  map to `View`.
- Text tags such as `span`, `p`, `label`, `h1`-`h6`, `strong`, `em`, `code`
  map to `Text`.
- `img` maps to `Image`; `input` maps to `TextInput`; `textarea` maps to
  `TextEditor`.

HTML-only props are stripped. `className` is parsed through `tw()` and merged
into `style`; explicit `style` wins. Headings get default `fontSize` and
`fontWeight: "bold"`. `img.src` becomes `source`.

Important: these are compatibility shims, not browser DOM semantics. There is
no cascade, DOM node, CSS layout engine, or HTML event system behind them.

### 3. React host config emits mutation commands

The reconciler runs with `supportsMutation: true`. Host instances are JS-side
objects:

```ts
{
  id: number,
  type: string,
  props: Record<string, any>,
  handlers: Record<string, Function>,
  children: Instance[],
  renderCount: number,
  parent?: Instance | null,
  hostWindowId?: number | null,
}
```

Handlers never cross the bridge. `extractHandlers()` removes function props
whose key starts with `on` and stores them in `handlerRegistry`.

Command surface:

| Command | Required fields | Purpose |
| --- | --- | --- |
| `CREATE` | `id`, `type`, `props`, `hasHandlers`, `handlerNames` | Allocate/update stable Zig node and apply initial props. |
| `CREATE_TEXT` | `id`, `text` | Create React text instance as a host text node. |
| `APPEND` | `parentId`, `childId` | Add child to parent. |
| `APPEND_TO_ROOT` | `childId` | Add root child. |
| `INSERT_BEFORE` | `parentId`, `childId`, `beforeId` | Insert child before sibling. |
| `INSERT_BEFORE_ROOT` | `childId`, `beforeId` | Root insertion. |
| `REMOVE` | `parentId`, `childId` | Detach child from parent. |
| `REMOVE_FROM_ROOT` | `childId` | Detach root child. |
| `UPDATE` | `id`, `props`, optional removals | Apply partial prop/style diff. |
| `UPDATE_TEXT` | `id`, `text` | Replace text node contents. |

`prepareUpdate()` diffs clean props and style keys. Style updates are partial:
changed style keys are sent under `props.style`, removed style keys are sent as
`removeStyleKeys`. Removed top-level props are sent as `removeKeys`.

`resetAfterCommit()` schedules a microtask flush. `flushToHost()` annotates
window-owned commands, coalesces same-node `UPDATE`s, JSON-stringifies the
command list, and calls the installed transport.

### 4. `__hostFlush` queues JSON into Zig

`runtime/index.tsx` installs the transport:

```ts
setTransportFlush((cmds) => globalThis.__hostFlush(JSON.stringify(cmds)))
```

`framework/v8_bindings_core.zig` registers `__hostFlush`. The host callback
copies the JSON string into `g_pending_flush`; it does not apply mutations
immediately inside the JS call. `v8_app.zig` drains pending flushes on the next
`appTick()`.

### 5. `v8_app.zig` applies commands to the stable Node pool

`v8_app.zig` keeps stable, heap-owned state:

- `g_node_by_id: id -> *layout.Node`
- `g_children_ids: parent id -> child ids`
- `g_parent_id: child id -> parent id`
- `g_root_child_ids`
- side registries for windows, inputs, scroll props, latch-bound style fields,
  context menus, inline glyphs, and handler expression strings.

`applyCommandBatch()` parses the JSON array and calls `applyCommand()` for each
entry.

`CREATE`:

1. `ensureNode(id)` allocates or fetches a stable `layout.Node`.
2. `applyTypeDefaults()` marks special host types:
   - `ScrollView`: `style.overflow = .scroll`
   - `Canvas`: `canvas_type = "canvas"`, `graph_container = true`
   - `Graph`: `graph_container = true`
   - `Canvas.Node` / `Graph.Node`: `canvas_node = true`
   - `Canvas.Path` / `Graph.Path`: `canvas_path = true`
   - `Canvas.Clamp`: `canvas_clamp = true`
   - terminal/input types allocate their native slots.
3. `applyProps()` decodes top-level props and nested `style`.
4. `applyHandlerFlags()` translates handler names into Zig event slots.
5. The node and ancestors are stamped dirty for static-surface invalidation.

`APPEND` and `INSERT_BEFORE` update `g_children_ids` and `g_parent_id`, then
copy typography from a parent Text node onto bare text children. This is why
`<Text style={{ fontSize: 20 }}>hello</Text>` sizes the React text instance
correctly.

`UPDATE` resets removed keys, applies partial props, updates handler flags, and
re-propagates typography to text children. `UPDATE_TEXT` replaces the node text.

Any mutation sets `g_dirty = true`.

### 6. Stable nodes materialize into the render tree

The stable Node pool is not the tree that `engine.zig` lays out directly.
During `appTick()`, if `g_dirty` is set:

1. `snapshotRuntimeState()` copies runtime-mutated state, especially scroll
   offsets, from the previous arena tree back into stable nodes.
2. `rebuildTree()` resets the arena and materializes `g_root.children` from
   `g_root_child_ids` and `g_children_ids`.
3. Window-owned children are routed to their host windows instead of the main
   root.
4. Optional development chrome is prepended.
5. `layout.markLayoutDirty()` is called.

The materialized tree contains copied `layout.Node` values whose `children`
slices live in the arena. Stable fields such as `scroll_persist_slot` point
back to the original id so runtime scroll state can be copied back later.

### 7. Engine frame loop measures, lays out, and paints

`framework/engine.zig` initializes FreeType/text and registers callbacks:

- `layout.setMeasureFn(measureCallback)`
- `layout.setMeasureImageFn(measureImageCallback)`
- input hit testing gets a width-only text measurement callback.

Each frame:

1. SDL/window/input events are handled. Resize marks layout dirty.
2. JS timers run through `__jsTick(now)`.
3. V8 binding domains drain async work.
4. Pending React mutation batches drain into the stable Node pool.
5. Host animations/latches update style fields and can set `g_dirty`.
6. If `g_dirty`, `rebuildTree()` rematerializes `config.root`.
7. `layout.layout(config.root, 0, 0, win_w, win_h)` computes rectangles.
8. Hover targets are re-resolved after layout when needed.
9. Physics may overwrite computed positions after layout.
10. Secondary windows are laid out and painted.
11. Effects, videos, render surfaces, text cursor blink, and other frame
    systems update.
12. `paintNode(config.root)` paints the main tree.
13. Tooltip/context-menu overlays paint on top.

Note: `layout.zig` has a dirty flag API, but the current engine path calls
`layout.layout(...)` every frame. `g_dirty` currently gates tree
materialization, not whether the flex pass runs.

## `layout.zig` Algorithm

### Node and Style model

`layout.Style` is a compact CSS-ish struct. Defaults are flex-column,
`display: flex`, `alignItems: stretch`, `overflow: visible`, zero padding and
margin, no explicit size, no border, opacity `1`.

`layout.Node` contains:

- `style`
- `children`
- `computed: { x, y, w, h }`
- text/image/input data and typography
- scroll state and content extents
- canvas/graph/path fields
- effect/static-surface/filter fields
- 3D/physics/terminal/window/event metadata
- transient layout caches and scratch fields.

### Units and value decoding

Numbers are pixels. Percentage strings such as `"50%"` are decoded in
`v8_app.zig` as negative fractions internally (`-0.5`) and resolved by
`resolveMaybePct(value, parent)`. `"auto"` margin is represented as infinity
and converted to distributable auto margin during flex layout.

Colors accepted by the Zig parser:

- `#rgb`
- `#rrggbb`
- `#rrggbbaa`
- `rgb(...)` / `rgba(...)`
- named: `black`, `white`, `red`, `blue`, `green`, `yellow`, `cyan`,
  `magenta`, `transparent`

`tw()` can emit the full Tailwind color palette as hex strings, which then
passes through the hex parser.

Font family strings are mapped to small ids. Recognized families include
generic `sans-serif`, `serif`, `monospace`, plus common family substrings such
as `times`, `roman`, `courier`, `noto`, `arial`, `helvetica`,
`liberation sans`, `segoe`, `ubuntu`, `sf pro`, `inter`, `roboto`,
`quicksand`, and `dejavu sans`.

### Intrinsic measurement

Layout uses intrinsic helpers before the concrete flex pass:

- `estimateIntrinsicWidth(node)`
- `estimateIntrinsicHeight(node, availableWidth)`
- `computeMinContentW(node)`

Text measurement routes through `measureNodeTextW()`, which calls the
engine-provided FreeType measurement callback and caches by text pointer,
length, font size, family, weight, width, letter spacing, line height, line
clamp, and wrapping mode.

Image measurement routes through `measureImageFn`, backed by image-cache
metadata.

Special intrinsic behavior:

- Scroll/auto overflow containers do not size themselves to all content unless
  `maxHeight` participates.
- Row height estimates allocate likely child widths before measuring wrapping
  text heights.
- Flex items use min-content width when automatic minimums would otherwise let
  text overflow.

### Concrete layout

`layout.layout(root, x, y, w, h)` invalidates caches, seeds root `_flex_w` and
`_stretch_h`, then calls `layoutNode()`.

`layoutNode()`:

1. Skips `display: none`.
2. Handles special nodes before flex:
   - `Canvas.Path` overlay paths collapse to zero layout.
   - standalone path nodes can size to their own box.
   - `Canvas.Clamp` spans the parent bounds.
   - video/render surfaces fill the offered bounds, clamped to 8192.
   - `Canvas.Node` uses graph-space `gw`/`gh`; `gh = 0` auto-measures child
     content and then relayouts with the measured height.
3. Resolves own width/height from explicit size, flex scratch fields, parent
   offer, percentages, min/max, and aspect ratio.
4. Computes padding, margin, inner width, and concrete/auto inner height.
5. Collects visible relative children and separate absolute children.
6. Computes child basis/grow/shrink/cross sizes using explicit size,
   flex-basis, intrinsic estimates, and margins.
7. Sorts by `style.order` if present internally. Current V8 style decoding does
   not expose an `order` prop, so this is mostly framework-internal today.
8. Splits lines for `flexWrap: "wrap"` / `"wrap-reverse"`.
9. Distributes cross-axis space via `alignContent`.
10. For each line, distributes main-axis free space via flex grow/shrink,
    auto margins, gap, and `justifyContent`.
11. Applies per-child alignment from `alignSelf` or parent `alignItems`,
    including stretch and baseline.
12. Sets child scratch sizes (`_flex_w`, `_stretch_h`) and recursively lays out
    children.
13. Computes auto height from text/input/content extents.
14. Computes `content_width` and `content_height` for scroll/hidden/auto
    overflow by measuring visible descendant extents.
15. Lays out absolute children from `top/right/bottom/left`, explicit size,
    percentages, and intrinsic fallback.
16. Writes `node.computed`.

Text paint and text measure share the same wrapping path so line breaks agree.

### Paint and hit testing

`engine.paintNode()` consumes `computed` rects:

- Skips `display: none` and zero-size nodes.
- Applies visual transforms and opacity. Transforms do not affect layout
  positions or hit testing.
- Handles filter/static-surface capture.
- Paints node visuals: background, border/shadow, image/video/render surface,
  effect, 3D, text, input, terminal, selection.
- Paints `Canvas` and `Graph` through their graph-space transform paths.
- Clips `overflow: hidden`, `overflow: scroll`, and `overflow: auto`.
- Offsets descendants by `scroll_x`/`scroll_y` while painting scroll content.
- Paints children in z-index order, stable by DOM order for ties.
- Paints scrollbars after children.

`framework/events.zig` hit-tests the computed tree back-to-front. Scroll
containers clip hit testing to their viewport and convert screen coordinates
into content coordinates. Canvas hit testing converts screen coordinates into
graph coordinates for non-clamped children.

## Author-Facing Style Surface

These are the style keys currently decoded by `v8_app.zig` and consumed by
`layout.zig` / `engine.zig`.

### Geometry and sizing

| Key | Values | Effect |
| --- | --- | --- |
| `width`, `height` | number, numeric string, percent string, `latch:KEY` | Explicit size. Percent resolves against parent offer. Latch values update from host latches. |
| `minWidth`, `maxWidth`, `minHeight`, `maxHeight` | number or percent string | Clamp resolved size. |
| `aspectRatio` | number | Derives missing dimension when one axis is explicit. |
| `display` | `"flex"`, `"none"` | `none` removes node from layout/paint/hit-test. Anything else becomes flex. |
| `position` | `"relative"`, `"absolute"` | Absolute children are removed from flex flow and placed by insets. |
| `top`, `right`, `bottom`, `left` | number, percent string, `latch:KEY` | Absolute positioning offsets. |

### Flex

| Key | Values | Effect |
| --- | --- | --- |
| `flexDirection` | `"row"`, `"column"`, `"row-reverse"`, `"column-reverse"` | Main axis. |
| `flex` | number | Shorthand for grow=N, shrink=1, basis=0. |
| `flexGrow` | number | Positive grow factor. |
| `flexShrink` | number | Shrink factor; default is `1` when unset. |
| `flexBasis` | number or percent string | Main-axis basis before grow/shrink. |
| `flexWrap` | `"nowrap"`, `"wrap"`, `"wrap-reverse"` | Multi-line flex. |
| `gap`, `rowGap`, `columnGap` | number | Main/cross gaps. |
| `justifyContent` | `"start"`, `"center"`, `"end"`, `"flex-end"`, `"space-between"`, `"space-around"`, `"space-evenly"` | Main-axis distribution. |
| `alignItems` | `"stretch"`, `"start"`, `"flex-start"`, `"center"`, `"end"`, `"flex-end"`, `"baseline"` | Cross-axis default alignment. |
| `alignSelf` | `"auto"`, `"stretch"`, `"start"`, `"flex-start"`, `"center"`, `"end"`, `"flex-end"`, `"baseline"` | Per-child alignment override. |
| `alignContent` | `"stretch"`, `"start"`, `"flex-start"`, `"center"`, `"end"`, `"flex-end"`, `"space-between"`, `"space-around"`, `"space-evenly"` | Wrapped-line cross-axis distribution. |

### Spacing and overflow

| Key | Values | Effect |
| --- | --- | --- |
| `padding`, `paddingLeft`, `paddingRight`, `paddingTop`, `paddingBottom` | number | Inner spacing. |
| `margin`, `marginLeft`, `marginRight`, `marginTop`, `marginBottom` | number, percent string, `"auto"` | Outer spacing; auto margins absorb free main-axis space. |
| `overflow` | `"visible"`, `"hidden"`, `"scroll"`, `"auto"` | Clip/scroll behavior and content extent tracking. |
| `textAlign` | `"left"`, `"center"`, `"right"`, `"justify"` | Text alignment consumed by text paint/layout propagation. |

### Typography

Typography keys are accepted both as top-level props and inside `style`.

| Key | Values | Effect |
| --- | --- | --- |
| `fontSize` | number | Font size in px. |
| `fontFamily` | string | Maps to a host font-family id. |
| `fontWeight` | `"normal"`, `"bold"`, numeric 1..900 | `>= 600` uses bold face when available. |
| `color` | color string | Text/stroke color depending on node type. |
| `letterSpacing` | number | Extra glyph spacing. |
| `lineHeight` | number | Line stride override. |

Top-level text props:

| Prop | Effect |
| --- | --- |
| `numberOfLines` | Maximum rendered/measured lines; `0` means unlimited. |
| `noWrap` | Disables wrapping. |
| `inlineGlyphs` | SVG path glyphs painted into `GLYPH_SLOT` sentinel positions. |
| `textEffect` | Named effect texture used for glyph coloring. |

### Visual paint

| Key | Values | Effect |
| --- | --- | --- |
| `backgroundColor` | color string | Background fill. |
| `borderWidth`, per-side border widths | number | Border thickness. |
| `borderColor` | color string | Border color. |
| `borderRadius`, per-corner radii | number | Rounded corners. |
| `borderDash`, `borderDashOn`, `borderDashOff`, `borderDashWidth`, `borderFlowSpeed` | numbers | Animated dashed border path. |
| `opacity` | number | Cascades through descendants during paint. |
| `zIndex` | integer | Paint ordering among siblings. |
| `shadowOffsetX`, `shadowOffsetY`, `shadowBlur`, `shadowColor`, `shadowMethod` | numbers/color/`"sdf"`/`"rect"` | Shadow paint. |

### Transforms and transitions

| Key | Values | Effect |
| --- | --- | --- |
| `rotation` | degrees | Visual-only transform. |
| `scaleX`, `scaleY` | number | Visual-only transform. |
| `transform.rotate` | degrees | Same as `rotation`. |
| `transform.scaleX`, `transform.scaleY` | number | Visual-only scale. |
| `transform.translateX`, `transform.translateY` | number | Visual-only translation. |
| `transform.originX`, `transform.originY` | 0..1 | Transform pivot; default center. |
| `transition.all.duration` | ms | Enables host interpolation on supported update props. |
| `transition.all.delay` | ms | Transition delay. |
| `transition.all.easing` | `"linear"`, `"easeIn"`, `"easeOut"`, `"easeInOut"` | Transition easing. |

Transitioned properties currently include `backgroundColor`, `opacity`,
`rotation`, `scaleX`, and `scaleY`.

## Non-Style Prop Surface

### Identity and interaction

| Prop | Effect |
| --- | --- |
| `debugName` | Human-readable name for diagnostics/query tools. |
| `testID` | Stable test/query id. |
| `tooltip` | Host tooltip text. |
| `hoverable` | Participates in hover hit testing without a handler. |
| `href` | Hyperlink metadata and underline behavior for text. |
| `windowDrag`, `windowResize` | Custom borderless window chrome regions. |
| `contextMenuItems` | Native context-menu items; dispatches `onContextMenu(index)`. |
| `devtoolsViz` | Inspector/debug overlay mode. |

### Scroll

| Prop | Effect |
| --- | --- |
| `scrollX`, `scrollY` | Controlled scroll offset. |
| `initialScrollX`, `initialScrollY` | One-shot create-time scroll seed. |
| `showScrollbar` | Enables scrollbar paint. |
| `scrollbarSide` | `"auto"`, `"left"`, `"right"`, `"top"`, `"bottom"`, `"start"`, `"end"`. |
| `autoHide` | Auto-hide scrollbar behavior. |

`ScrollView` sets `overflow: scroll` by type default.

### Media and surfaces

| Prop | Effect |
| --- | --- |
| `source` | Image source path. |
| `videoSrc` | Video source path/URL. |
| `renderSrc` | External render surface id/source. |
| `renderSuspended` | Suspends live render surface feed. |
| `staticSurface` | Cache subtree into a GPU texture. |
| `staticSurfaceKey` | Cache key. |
| `staticSurfaceScale` | Backing texture scale, clamped 1..4. |
| `staticSurfaceWarmupFrames` | Live frames before capture. |
| `staticSurfaceIntroFrames` | GPU intro frames for cached surface. |
| `staticSurfaceOverlay` | Paint dynamic descendant over cached surface. |
| `filterName`, `filterIntensity` | Per-frame post-process filter. |

### Input/editor

| Prop | Effect |
| --- | --- |
| `value` | Syncs input/editor text. |
| `placeholder` | Placeholder text. |
| `paintText` | Enables/disables host input text paint. |
| `colorRows` | Per-row colored spans for editable syntax highlighting. |
| `contentHandle` | Points input/editor text at a Zig-owned content buffer. |

### Canvas and Graph

| Prop | Applies to | Effect |
| --- | --- | --- |
| `originTopLeft` | `Canvas`, `Graph` | Makes graph origin top-left instead of centered. |
| `viewX`, `viewY`, `viewZoom` | `Canvas`, `Graph` | Initial/explicit viewport transform. |
| `driftX`, `driftY`, `driftActive` | `Canvas` | Ambient canvas camera drift. |
| `gridStep`, `gridStroke`, `gridColor`, `gridMajorColor`, `gridMajorEvery` | `Canvas` | Built-in grid overlay. |
| `gx`, `gy`, `gw`, `gh` | `Canvas.Node`, `Graph.Node` | Graph-space position and size. |
| `d` | `Canvas.Path`, `Graph.Path`, standalone path | SVG path data. |
| `stroke`, `strokeWidth`, `strokeOpacity` | Path | Stroke paint. |
| `fill`, `fillOpacity`, `gradient`, `fillEffect` | Path | Fill paint. |
| `flowSpeed` | Path | Animated stroke flow. |
| `onMove` | `Canvas.Node` | Enables engine-owned Alt-drag and dispatches graph coordinates. |

`gradient` shape:

```ts
{
  x1?: number, y1?: number,
  x2?: number, y2?: number,
  stops: Array<{ offset: number, color: string, opacity?: number }>
}
```

### Effects

| Prop | Effect |
| --- | --- |
| `name` | Named effect registration/fill target. |
| `shader` | Inline WGSL fragment shader body. |
| `background` | Paint effect behind parent content. |
| `mask` | Use effect alpha as mask path. |
| `onRender` | JS custom effect render callback. |

### Window and notification

`Window` / `Notification` creation reads `title`, `width`, `height`, `x`, `y`,
`duration`, `alwaysOnTop`, and `borderless` in `openHostWindowForNode()`.
Children are routed into the opened host window by `window_id` annotations.

### Physics, 3D, terminal

The host also decodes physics (`physicsWorld`, `physicsBody`,
`physicsCollider`, gravity/body/collider fields), 3D scene fields
(`scene3d*`), and terminal fields (`terminalFontSize`). These fields live on
`layout.Node` so those subsystems can use the same layout tree for sizing,
paint, and hit testing.

## Events

JS handlers stay in `handlerRegistry`; Zig only receives handler names.

Handler-name mapping in `v8_app.zig`:

| JS handler name | Zig slot / dispatch |
| --- | --- |
| `onClick`, `onPress` | `js_on_press -> __dispatchEvent(id, "onClick")` |
| `onMouseDown` | `js_on_mouse_down` |
| `onMouseUp` | `js_on_mouse_up` |
| `onHoverEnter`, `onMouseEnter` | `js_on_hover_enter` |
| `onHoverExit`, `onMouseLeave` | `js_on_hover_exit` |
| `onScroll` | prepared scroll payload dispatch |
| `onRightClick`, `onContextMenu` | prepared right-click/context payload dispatch |
| `onMove` | Canvas node drag dispatch |
| `onRender` | Effect render callback gate |

`runtime/index.tsx` aliases event names before invoking user handlers:

- `onClick` dispatch tries `onClick`, then `onPress`.
- `onPress` dispatch tries `onPress`, then `onClick`.
- hover dispatch aliases mouse enter/leave names.
- input dispatch calls `onChangeText`, `onChange`, `onInput`,
  `onSubmit`, `onSubmitEditing`, `onFocus`, `onBlur`, and `onKeyDown` from
  input-specific host callbacks.

`onLayout` is detected in `hostConfig.ts` and emits `__hasOnLayout`, but no
current V8/Zig path was found that dispatches layout rectangles back to this
handler.

## Tailwind Parser Surface

`tw()` is a helper that emits style objects. It is not a separate style engine.
The emitted keys must still be decoded by `v8_app.zig`.

Supported families include:

- Display/position: `hidden`, `relative`, `absolute`, `fixed`, `sticky`.
- Flex/grid approximation: `flex-row`, `flex-col`, `flex-wrap`, `flex-1`,
  `grow`, `shrink`, `grid`, `grid-cols-*`.
- Overflow: `overflow-hidden`, `overflow-visible`, `overflow-scroll`,
  `overflow-auto`, axis variants mapped to the single host `overflow`.
- Alignment: `items-*`, `justify-*`, `self-*`.
- Spacing: `p*`, `m*`, `gap-*`, `space-x-*`, `space-y-*`.
- Size: `w-*`, `h-*`, `size-*`, `min-w-*`, `min-h-*`, `max-w-*`,
  `max-h-*`, `basis-*`.
- Position offsets: `inset-*`, `top-*`, `right-*`, `bottom-*`, `left-*`.
- Visuals: `bg-*`, `border*`, `rounded*`, `shadow*`, `opacity-*`,
  `z-*`, `aspect-*`.
- Text: `text-*` for size/color/alignment, `font-*`, `leading-*`,
  `tracking-*`.
- Transition and transform: `transition*`, `duration-*`, `ease-*`,
  `delay-*`, `translate-*`, `rotate-*`, `scale-*`, `origin-*`.

Known parser/host mismatches:

- `tw()` emits `backgroundGradient`, but V8 style decoding currently does not
  consume that key. `layout.Style` still has older `gradient_color_end` fields,
  but the V8 parser does not wire them.
- `visibility`, `textOverflow`, `textDecorationLine`, `outlineWidth`,
  `outlineColor`, and `outlineOffset` can be emitted by `tw()` but are not
  decoded by `v8_app.zig` today.
- `flex-row-reverse`, `flex-col-reverse`, and `flex-wrap-reverse` currently map
  to non-reverse values in `tw()` even though `layout.zig` supports reverse
  enums if the direct style prop is supplied.
- `order` exists in `layout.Style` and the layout algorithm sorts by it, but
  V8 style decoding does not currently expose an `order` style key.

## Debugging Hooks

Useful gates and traces:

- `REACTJIT_VERBOSE_BATCHES=1`: logs batch parse/apply/cleanup timing and tree
  rebuild timing.
- `ZIGOS_TRACE_IPC=1`: traces routed host-window mutation messages.
- `REACTJIT_NODEDUMP`: one-shot visible node coordinate dump.
- layout logging through `framework/log.zig` can emit `logTree()` output when
  `.layout` is enabled.
- `debugName` and `testID` are copied into nodes for witness, query, telemetry,
  and diagnostic tooling.

## Review Notes

- The active V8 path is a custom flex implementation, not Yoga and not browser
  layout.
- Layout has two node representations: stable heap nodes for mutation state and
  arena materialized nodes for the current frame. Scroll state is copied back
  from arena nodes before rebuilding.
- A mutation does not immediately relayout. It queues JSON, drains on
  `appTick()`, rebuilds the tree if dirty, and the engine lays out on the frame.
- Paint transforms are visual-only. Hit testing uses computed layout plus
  special scroll/canvas coordinate adjustments, not transformed bounds.
- Text wrapping should remain consistent between layout and paint because both
  route through the same text engine wrapping implementation.
- Adding a new layout/style prop requires wiring all relevant layers:
  primitive/types or `tw()`, `hostConfig` diffing if needed, `applyStyleEntry`
  or `applyProps` in `v8_app.zig`, `layout.Style`/`layout.Node`, layout
  algorithm behavior, paint/hit-test behavior if it affects visuals or input,
  reset handling for removed keys, and tests/docs.
