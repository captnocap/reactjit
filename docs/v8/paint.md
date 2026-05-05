# V8 paint pipeline

This is the end-to-end path from JSX to pixels for the V8 runtime. The short
version:

```text
TSX primitive
  -> React reconciler hostConfig mutation
  -> JSON batch through globalThis.__hostFlush
  -> v8_app.zig stable Node map
  -> per-frame materialized layout.Node tree
  -> layout.layout(...)
  -> engine.zig paintNode(...)
  -> gpu primitive queues
  -> gpu.frame(...) upload, draw, present, reset
```

The important rule: there is no DOM paint phase. React produces host mutation
commands; Zig owns layout, hit testing, clipping, batching, and presentation.

## Source map

- `runtime/primitives.tsx` defines the JSX component API.
- `renderer/hostConfig.ts` is the React reconciler host config. It creates,
  diffs, batches, and flushes host mutations.
- `framework/v8_bindings_core.zig` registers `__hostFlush` and holds the
  pending-flush queue.
- `v8_app.zig` parses mutation JSON, owns the stable node map, materializes
  `layout.Node` trees, and marks layout dirty.
- `framework/layout.zig` computes `node.computed`, content extents, text
  measurement, scroll bounds, and canvas-node placement.
- `framework/engine.zig` owns the SDL/wgpu loop, event dispatch, layout calls,
  recursive painting, overlays, and paint telemetry.
- `framework/gpu/gpu.zig` orchestrates wgpu device state, scissor segments,
  offscreen captures, uploads, draw ordering, present, and per-frame reset.
- `framework/gpu/rects.zig`, `text.zig`, `curves.zig`, `polys.zig`,
  `capsules.zig`, and `images.zig` own the primitive-specific queues and
  pipelines.
- `framework/image_cache.zig`, `videos.zig`, `render_surfaces.zig`,
  `effects.zig`, `gpu/3d.zig`, `svg_path.zig`, and `border_dash.zig` are
  paint-side specialty backends.

## React side

`runtime/primitives.tsx` wrappers emit host type strings:

| JSX API | Host type | Paint meaning |
| --- | --- | --- |
| `Box`, `Row`, `Col` | `View` | Layout container, optional rect/background/border/shadow. |
| `Text` | `Text` | Text container. String children become separate text nodes. |
| `Image` | `Image` | Bitmap texture via `image_cache`. |
| `Video` | `Image` + `videoSrc` | Video frame source routed to `videos.zig`. |
| `Pressable` | `Pressable` | Paints like a view; handler metadata enables hit testing. |
| `ScrollView` | `ScrollView` | View with default `overflow: scroll`. |
| `TextInput`, `TextArea`, `TextEditor` | same | Input slot plus text paint, selection, cursor. |
| `Terminal` | `Terminal` | vterm cell-grid paint. |
| `Canvas` | `Canvas` | Pan/zoom graph-space container. |
| `Canvas.Node`, `Graph.Node` | same | UI subtree positioned in graph space. |
| `Canvas.Path`, `Graph.Path` | same | SVG path stroke/fill. |
| `Canvas.Clamp` | same | Canvas overlay pinned to viewport. |
| `Graph` | `Graph` | Static graph viewport with path/node support. |
| `RenderTarget` | `View` + `renderSrc` | Host render-to-texture source. |
| `Render` | `Render` | Capture/render surface primitive. |
| `StaticSurface` | `View` + `staticSurface` | Cached subtree composited as one image quad. |
| `Filter` | `View` + `filterName` | Per-frame offscreen capture plus shader composite. |
| `Effect` | `Effect` | Generative pixel surface or custom `onRender`/shader. |
| `Scene3D` and children | `View` + `scene3d*` flags | wgpu 3D render-to-texture viewport. |
| `Native` | `props.type` | Escape hatch for host-specific types. |

HTML host tags are normalized in `renderer/hostConfig.ts` before Zig sees them.
Examples: `div` -> `View`, `span`/`p`/`h1` -> `Text`, `img` -> `Image`,
`input` -> `TextInput`, `textarea` -> `TextEditor`, `button` -> `View`.
`className` is parsed through `runtime/tw.ts` and merged into `style` before
the `CREATE` command.

Text has one special JS-side behavior: `Text` flattens adjacent string/number
children and simple nested Text-like nodes into a single text run. This avoids
wrapping a sentence as multiple block siblings.

## Mutation command API

The reconciler emits plain JSON commands. Handler functions do not cross the
bridge; only handler names and metadata do. The canonical command shapes are:

```ts
{ op: 'CREATE', id, type, props, hasHandlers, handlerNames, handlerMeta?, debugName?, debugSource? }
{ op: 'CREATE_TEXT', id, text }
{ op: 'APPEND', parentId, childId }
{ op: 'APPEND_TO_ROOT', childId }
{ op: 'INSERT_BEFORE', parentId, childId, beforeId }
{ op: 'INSERT_BEFORE_ROOT', childId, beforeId }
{ op: 'REMOVE', parentId, childId }
{ op: 'REMOVE_FROM_ROOT', childId }
{ op: 'UPDATE', id, props, removeKeys?, removeStyleKeys?, hasHandlers, handlerNames, renderCount? }
{ op: 'UPDATE_TEXT', id, text }
```

`hostConfig` keeps a JS-side tree and handler registry:

- `createInstance` remaps HTML types, strips handlers from props, emits
  `CREATE`, and stores handlers in `handlerRegistry`.
- `createTextInstance` emits `CREATE_TEXT`.
- append/remove/insert methods update the JS tree and emit structure commands.
- `prepareUpdate` computes partial prop/style diffs and removed keys.
- `commitUpdate` refreshes the handler registry and emits `UPDATE` only when
  Zig-visible props or handler-name sets changed.
- closure-only handler changes update the JS registry without bridge traffic.
- `resetAfterCommit` schedules a microtask flush so multiple React commits from
  one event become one bridge batch.

`flushToHost` annotates window ownership, coalesces same-id `UPDATE` commands
with nested style merging, `JSON.stringify`s the batch, and calls
`globalThis.__hostFlush(payload)`.

## V8 bridge

`framework/v8_bindings_core.zig:hostFlush` copies the JSON string into
`g_pending_flush`. It does not apply commands immediately. The app tick later
calls:

```zig
drainPendingFlushes();
```

which invokes `v8_app.zig:applyCommandBatch` for each queued JSON payload.
This keeps React commits, timers, and event handlers on the JS side while the
Zig tree mutates at a controlled pre-frame point.

## Stable node map

`v8_app.zig` owns stable storage:

- `g_node_by_id: id -> *Node`
- `g_children_ids: parent_id -> []child_id`
- `g_parent_id: child_id -> parent_id`
- `g_root_child_ids`
- per-field latch node sets
- input slots, window ownership, context menu state, and other side tables

`ensureNode(id)` creates a zeroed `layout.Node`, sets `scroll_persist_slot = id`,
stores it in `g_node_by_id`, and initializes its child-id list.

`applyCommand` mutates this stable graph:

- `CREATE` applies type defaults and props.
- `CREATE_TEXT` stores `node.text`.
- `APPEND`/`INSERT` update child-id lists and `g_parent_id`.
- `REMOVE` detaches ids and marks ancestors dirty before clearing the parent.
- `UPDATE` removes deleted props/style keys, applies changed props, reapplies
  handler flags, and propagates typography into bare text children.
- `UPDATE_TEXT` replaces text.

Every structural or prop mutation calls `markSubtreeDirty(id)` and sets
`g_dirty = true`. `markSubtreeDirty` stamps `subtree_last_mutated_frame` on the
node and each ancestor. StaticSurface uses that frame number to detect stale
offscreen captures.

Detached nodes are not freed during the command loop itself. After the batch,
`cleanupDetachedNodes()` walks reachability from `g_root_child_ids`, releases
side resources, and destroys unreachable stable nodes.

## Type defaults

`applyTypeDefaults` maps host types to `layout.Node` flags:

- `ScrollView` sets `style.overflow = .scroll`.
- `Canvas` sets `canvas_type = "canvas"` and `graph_container = true`.
- `Graph` sets `graph_container = true`.
- `Canvas.Node` and `Graph.Node` set `canvas_node = true`.
- `Canvas.Path` and `Graph.Path` set `canvas_path = true`.
- `Canvas.Clamp` sets `canvas_clamp = true`.
- terminal types set `terminal = true`.
- input types allocate/register an input slot.

Those flags are what later choose special layout, hit-test, and paint paths.

## Prop surface

`applyProps` is the real V8 prop API. Paint-relevant props include:

Common text props:

- `fontSize`, `fontFamily`, `fontWeight`
- `color`
- `letterSpacing`, `lineHeight`
- `numberOfLines`, `noWrap`
- `inlineGlyphs`
- `textEffect`
- `href`

Input props:

- `value`
- `contentHandle`
- `placeholder`
- `paintText`
- `colorRows`

Image, media, and host surfaces:

- `source`
- `videoSrc`
- `renderSrc`
- `renderSuspended`

Static/captured subtree props:

- `staticSurface`
- `staticSurfaceKey`
- `staticSurfaceScale`
- `staticSurfaceWarmupFrames`
- `staticSurfaceIntroFrames`
- `staticSurfaceOverlay`

Filter props:

- `filterName`
- `filterIntensity`

Scroll props:

- `scrollX`, `scrollY`
- `initialScrollX`, `initialScrollY`
- `showScrollbar`
- `scrollbarSide`
- `autoHide`

Canvas/Graph props:

- `originTopLeft`
- `gx`, `gy`, `gw`, `gh`
- `d`
- `stroke`, `strokeOpacity`, `strokeWidth`
- `fill`, `fillOpacity`, `gradient`
- `fillEffect`
- `flowSpeed`
- `viewX`, `viewY`, `viewZoom`
- `driftX`, `driftY`, `driftActive`
- `gridStep`, `gridStroke`, `gridColor`, `gridMajorColor`, `gridMajorEvery`

Effect props:

- `name`
- `background`
- `mask`
- `shader`
- `onRender` handler name

3D props:

- `scene3d`
- `scene3dMesh`, `scene3dCamera`, `scene3dLight`, `scene3dGroup`
- `scene3dGeometry`, `scene3dLightType`
- `scene3dColorR/G/B`
- `scene3dPosX/Y/Z`
- `scene3dRotX/Y/Z`
- `scene3dScaleX/Y/Z`
- `scene3dLookX/Y/Z`
- `scene3dDirX/Y/Z`
- `scene3dFov`, `scene3dIntensity`, `scene3dRadius`, `scene3dTubeRadius`
- `scene3dSizeX/Y/Z`
- `scene3dShowGrid`, `scene3dShowAxes`
- `scene3dTexW`, `scene3dTexH`, `scene3dTexData`

Interaction/debug props that affect paint or paint-adjacent behavior:

- `hoverable`
- `tooltip`
- `contextMenuItems`
- `devtoolsViz`
- `debugName`
- `testID`
- `windowDrag`, `windowResize`
- handler names: `onClick`/`onPress`, `onMouseDown`, `onMouseUp`,
  `onHoverEnter`, `onHoverExit`, `onScroll`, `onRightClick`,
  `onContextMenu`, `onMove`, `onRender`

Physics props exist on the same `Node` surface and may mutate computed positions
after layout, but they are not themselves paint primitives.

## Style surface

`style` maps to `layout.Style`. Supported paint/layout keys include:

Layout:

- `width`, `height`, `minWidth`, `maxWidth`, `minHeight`, `maxHeight`
- `flex`, `flexGrow`, `flexShrink`, `flexBasis`
- `flexDirection`, `flexWrap`
- `justifyContent`, `alignItems`, `alignSelf`, `alignContent`
- `gap`, `rowGap`, `columnGap`
- `padding`, `paddingLeft`, `paddingRight`, `paddingTop`, `paddingBottom`
- `margin`, `marginLeft`, `marginRight`, `marginTop`, `marginBottom`
- `display`
- `overflow`
- `textAlign`
- `position`, `top`, `left`, `right`, `bottom`
- `aspectRatio`

Paint:

- `backgroundColor`
- `opacity`
- `borderWidth`, `borderTopWidth`, `borderRightWidth`,
  `borderBottomWidth`, `borderLeftWidth`
- `borderColor`
- `borderRadius`, `borderTopLeftRadius`, `borderTopRightRadius`,
  `borderBottomRightRadius`, `borderBottomLeftRadius`
- `borderDash`, `borderDashOn`, `borderDashOff`
- `borderFlowSpeed`, `borderDashWidth`
- `zIndex`
- `shadowOffsetX`, `shadowOffsetY`, `shadowBlur`, `shadowColor`,
  `shadowMethod`
- text style aliases: `fontSize`, `fontFamily`, `fontWeight`, `color`,
  `letterSpacing`, `lineHeight`

Visual transform:

- `rotation`
- `scaleX`, `scaleY`
- `transform: { rotate, scaleX, scaleY, translateX, translateY, originX, originY }`

Transitions:

- `transition: { all: { duration, easing, delay } }`

Latches:

- `width`, `height`, `left`, `top`, `right`, and `bottom` may be
  `"latch:KEY"`. `__latchSet(KEY, value)` updates the host-owned value, and
  `syncLatchesToNodes` writes it into node style before layout without sending
  React mutations.

Removed style keys are reset to a fresh `Style{}` default by `removeStyleKeys`.

## Per-frame materialization

The stable map is not the tree that the engine lays out and paints. When
`g_dirty` is true, `appTick` does:

```zig
snapshotRuntimeState();
rebuildTree();
layout.markLayoutDirty();
g_dirty = false;
```

`snapshotRuntimeState` copies scroll positions from the last rendered arena tree
back into stable nodes unless the scroll was controlled by a prop this frame.

`rebuildTree` resets `g_arena` and copies reachable stable nodes into a fresh
arena-backed `g_root.children` tree. Children are recursively materialized from
`g_children_ids`. Window/notification roots are materialized separately and sent
to `windows.setRoot`. Dev-mode chrome and borderless resize edges are injected
around the cart tree.

This split is why stable ids survive React updates while the layout tree can be
rebuilt cheaply from flat id maps.

## Layout

The engine frame loop calls:

```zig
layout.layout(config.root, 0, 0, win_w, app_h);
```

`layout.layout` invalidates layout caches, sets root available size, and calls
`layoutNode` recursively. The result is stored in `node.computed` plus content
fields such as `content_width` and `content_height`.

Important layout hooks:

- text measurement uses `layout.setMeasureFn(measureCallback)` from
  `engine.zig`, backed by `framework/text.zig` and FreeType.
- image measurement uses `layout.setMeasureImageFn(measureImageCallback)`,
  backed by `image_cache.measure`.
- text measurement and text paint share word-wrapping logic through
  `TextEngine`, so measured line breaks and painted line breaks stay aligned.
- `Canvas.Path` can bypass normal box layout in icon/path cases.
- `Canvas.Node` uses `gx/gy/gw/gh` graph-space geometry and lays out its child
  UI inside that graph-space box.
- scroll/auto containers compute content extents and clamp scroll later.

## Engine frame order

The relevant frame order in `framework/engine.zig` is:

1. SDL events are pumped. Hit testing may dispatch JS event expressions.
2. `config.tick` runs. In the V8 app, this is `appTick`.
3. transitions tick and may mark layout dirty.
4. terminals, classifiers, drag selection, and host subsystems tick.
5. `layout.layout(...)` computes geometry.
6. physics may overwrite computed positions after layout.
7. secondary windows layout and paint.
8. selection, videos, render surfaces, cursor blink, effects, 3D, fs/watch,
   clipboard, voice, whisper, and system signals update.
9. main tree paint runs through `paintNode(config.root)`.
10. tooltip, context menu, resize/debug overlays paint on top.
11. `gpu.frame(...)` uploads queued primitives, issues wgpu draw calls,
    presents, and resets all per-frame queues.
12. capture/test/witness/telemetry hooks run.

## Recursive paint

`paintNode(node)` is the main recursive painter.

Early exits and frame guards:

- `display: none` increments hidden count and returns.
- StaticSurface overlay nodes do not paint into their own capture.
- `PAINT_BUDGET` stops likely recursive/infinite trees.
- `Canvas.Path` paints before the zero-size check, because path/icon cases can
  be meaningful without normal layout dimensions.
- zero-size nodes increment zero count and return.

State pushed around a node:

- visual transform: `rotation`, `scaleX`, `scaleY`, `translateX/Y`, origin
  push a GPU node-matrix. This affects visuals and descendants, not layout or
  hit testing.
- opacity multiplies `g_paint_opacity` and cascades through descendants.

Special subtree paths before normal visuals:

- `filterName`: render children into an offscreen texture every frame, then
  composite through a filter shader.
- `staticSurface`: if the cached texture is ready and not stale, queue one image
  quad and skip normal child paint. Otherwise capture children into an offscreen
  texture and finish the capture for future frames.

Then `paintNodeVisuals(node)` queues this node's own visuals. After that:

- background effects (`Effect background`) paint behind normal children.
- `Canvas` containers use `paintCanvasContainer` and return.
- `Graph` containers push a scissor, set a graph transform, paint children, and
  return.
- normal children paint with overflow/scissor handling, scroll offsetting, and
  z-index ordering.
- scrollbars paint after scrolled children.

## Node visuals

`paintNodeVisuals` queues primitives in this order:

1. optional hover affordance for `hoverable`.
2. shadow behind the box.
3. background and baked border, including per-corner radius.
4. image quad from `image_src`.
5. border-only rect if there is a border but no background.
6. animated/dashed/flowing border via `border_dash.zig` and SVG line segments.
7. video frame.
8. render surface frame.
9. built-in effect.
10. custom/named effect.
11. 3D viewport.
12. selection highlight.
13. terminal cells.
14. regular text.
15. TextInput/TextArea/TextEditor text, selection, and cursor.

Actual GPU draw order is still batched by primitive type inside scissor
segments, so this order is queue order, not always final draw interleaving.
See scissor segmentation below.

## Text paint

`drawNodeTextCommon` is the shared text path for normal `Text`, input text, and
some overlays:

- resets inline glyph slots.
- enables `textEffect` if a named effect fill exists.
- applies line-height, letter-spacing, font family, and bold state to the GPU
  text module.
- calls `TextEngine.drawTextWrappedRGBA`, which uses the same wrap algorithm as
  measurement.
- paints inline SVG glyphs into recorded sentinel slots.
- clears text effect state.
- paints an underline if `href` is set.

The lower-level GPU text path rasterizes glyphs through FreeType into an atlas
and queues `GlyphInstance` records. Canvas transforms and CSS node transforms
adjust effective raster size so zoomed/scaled text stays crisp.

## Images

`Image` paint is:

```text
node.image_src
  -> image_cache.queueQuad
  -> decode/load once with stb_image if cache miss
  -> create wgpu texture + bind group
  -> gpu.images queue quad
```

Supported sources are file paths and base64 `data:image/...` URLs. HTTP fetching
is not part of image paint; callers must provide a synchronously readable source.

## Canvas and Graph

`Canvas` has a host camera and interaction model. Paint flow:

1. apply prop-driven `viewX/viewY/viewZoom` if changed.
2. apply camera drift if active.
3. push scissor to the canvas rect.
4. call `canvas.renderCanvas`.
5. position `Canvas.Node` children from graph-space coords.
6. set GPU transform from graph space to screen space.
7. draw optional grid under children.
8. paint `Canvas.Path` and `Canvas.Node` children, including flattening through
   wrapper containers.
9. reset transform.
10. open a new scissor segment for `Canvas.Clamp` overlays so tile text is
    flushed before clamp backgrounds.

`Graph` is lighter: it pushes a scissor, sets a transform from graph space to
the element rect, paints children, restores transform, and returns. It has no
pan/zoom/drag camera handling.

`Canvas.Path`/`Graph.Path` paint SVG path data. Fill options are named effect
fill, linear gradient, or flat color. Stroke uses GPU-native SDF curves via
`svg_path.drawStrokeCurves`. Standalone non-`canvas_path` paths with a computed
box are treated as 24x24 icon viewboxes scaled into the node rect.

## StaticSurface and Filter

`StaticSurface` is a cached subtree:

- children remain in layout and hit testing.
- first valid paint captures children into an offscreen texture.
- later frames queue a single image quad if the cache is ready.
- `subtree_last_mutated_frame` invalidates stale captures.
- `staticSurfaceWarmupFrames` delays first capture.
- `staticSurfaceIntroFrames` controls the composite intro animation.
- `staticSurfaceOverlay` children paint over the cached quad but are skipped
  while capturing.

`Filter` uses the same capture machinery, but never treats the texture as a
stable cache. It captures every frame and composites through a named filter
shader so animated children still update.

## Z-index, clipping, and scissor segments

Overflow and scroll clipping use `gpu.pushScissor`/`popScissor`. `zIndex` also
uses scissor, but deliberately with a full-viewport scissor:

```zig
if (child.style.z_index != 0) {
    gpu.pushScissor(0, 0, win_w, win_h);
    paintNode(child);
    gpu.popScissor();
} else {
    paintNode(child);
}
```

Children are painted in ascending `zIndex`, stable on ties. Non-zero z-index
does two things:

- creates a GPU segment boundary so the child's rects, text, curves, polygons,
  and images draw together after previous siblings.
- escapes ancestor clipping because the new scissor is full viewport.

This is an intentional divergence from CSS. It is why TSX context menus and
popovers can escape scroll containers without portals.

## GPU queues and final draw

Paint functions do not draw immediately. They append to per-frame CPU arrays:

- rects: rounded rectangles, borders, shadows, gradients.
- glyphs: text atlas glyph instances.
- curves: quadratic/cubic path strokes.
- capsules: capsule primitives.
- polys: triangle/poly fills.
- images: textured quads, including images, videos, StaticSurface, Filter,
  render surfaces, 3D, and effect-fill composites.

`gpu.pushScissor` records segment boundaries containing current primitive
counts. `images.queueQuad` records image boundaries too because images have
per-quad bind groups and need ordering boundaries.

`gpu.frame(bg)` then:

1. gets the swapchain texture.
2. hashes frame data and uploads changed primitive buffers.
3. always uploads image quads if any exist, because video/render-surface
   textures may change independently.
4. renders pending StaticSurface/Filter offscreen captures.
5. begins the main render pass.
6. draws either one unsegmented batch or each scissor segment.
7. inside each segment, draws in fixed pipeline order:
   rects -> text -> curves -> capsules -> polys -> images.
8. draws filter composites after primitive draws.
9. submits, optionally captures, presents, cleans 3D targets, resets queues,
   clears scissor state, and resets the GPU op count.

Because each segment draws by primitive type, a later sibling's background rect
cannot cover earlier sibling text unless a scissor segment boundary separates
them. This is the main reason z-index forces a segment break.

## Event-to-paint loop

User input returns to paint through the same mutation path:

```text
SDL event
  -> Zig hit test on layout.Node tree
  -> node.handlers.js_on_* expression
  -> V8 __dispatchEvent(id, handlerName, payload?)
  -> JS handler from handlerRegistry
  -> React state update
  -> reconciler commit
  -> __hostFlush(JSON batch)
  -> next appTick drainPendingFlushes
  -> rebuild materialized tree
  -> layout
  -> paint
```

Handler expression installation happens in `applyHandlerFlags`. For example,
`onClick`/`onPress` becomes:

```zig
node.handlers.js_on_press = "__dispatchEvent(<id>,'onClick')"
```

`onScroll` and right-click use prepared payload paths. `onMove` marks a
`Canvas.Node` draggable so host-side Alt-drag can write `canvas_gx/gy` directly
without flooding React with motion updates.

## Performance limits and diagnostics

Important limits:

- `PAINT_BUDGET` in `engine.zig` stops runaway recursive paint.
- `gpu.GPU_OPS_BUDGET` caps total queued primitive operations per frame.
- rect queue capacity is in `framework/gpu/rects.zig`.
- glyph queue and atlas capacity are in `framework/gpu/text.zig`.
- image quad capacity is in `framework/gpu/images.zig`.
- static/filter capture capacity is in `framework/gpu/gpu.zig`.

Useful diagnostics:

- `REACTJIT_VERBOSE_BATCHES=1` prints batch parse/apply/cleanup timing and
  rebuild timing.
- `REACTJIT_NODEDUMP=1` emits a post-layout visible node dump around tick 60.
- GPU logs show primitive counts and scissor boundary counts when GPU logging
  is enabled.
- telemetry records tick, layout, paint, frame total, FPS, bridge calls,
  visible nodes, hidden nodes, zero-size nodes, and hovered node.
- frame timing logs print when input-to-present latency exceeds thresholds.

## Adding a new paintable prop or primitive

Follow the existing path:

1. Add or wrap the JSX API in `runtime/primitives.tsx` if authors need a new
   component-level API.
2. Ensure `renderer/hostConfig.ts` forwards only serializable props. Handlers
   should stay in JS and cross as handler names.
3. In `v8_app.zig`, parse the prop in `applyProps` or style key in
   `applyStyleEntry`.
4. Store the parsed value on `layout.Node` or `layout.Style`. Keep
   `framework/api.zig` in sync if it is public API.
5. If the prop changes geometry, make sure the normal mutation path reaches
   `g_dirty = true` and `layout.markLayoutDirty()`.
6. Paint it in `engine.zig` or a focused backend module.
7. Queue GPU primitives through `framework/gpu/*`, not direct wgpu calls from
   the recursive painter.
8. Consider scissor segmentation if the new primitive needs ordering relative
   to text/images.
9. Add test carts or stress carts when the new path changes batching,
   clipping, text, images, or high-node-count behavior.

## Gotchas

- Do not use browser APIs for paint. There is no DOM, CSS cascade, or
  `dangerouslySetInnerHTML`.
- `style.zIndex` is not CSS z-index. It is a z sort plus full-viewport scissor
  segment.
- Transform is visual only. Hit testing and layout still use untransformed
  `computed` rects.
- Text and rects are batched separately. Use scissor boundaries when visual
  stacking across primitive types matters.
- `tw()` emits `backgroundGradient`, and `layout.Style` still has older
  gradient fields, but V8 style decoding currently does not consume those keys.
  Use `Canvas.Path`/`Graph.Path` `gradient` for V8-supported gradient fills.
- `StaticSurface` caches paint only. Layout and hit testing still walk children.
- Controlled input text is stored in input slots; paint syncs from node text
  without clobbering live user edits unless the controlled value changed.
- `initialScrollX/Y` apply only on `CREATE`, not on `UPDATE`.
- The stable node map and the painted arena tree are different structures.
  Mutate the stable map when handling host mutations; paint reads the
  materialized tree.
- If a subtree disappears, remember side resources: input slots, context menu
  items, inline glyph allocations, windows, and child-id lists.
