# `<StaticSurface>` (V8 Runtime)

`<StaticSurface>` is the React primitive for caching a stable subtree into a
GPU texture. It is a paint optimization only: children remain in the layout
tree and hit-test tree, while paint can collapse the subtree into one textured
quad after capture.

The end-to-end path is:

1. React emits a normal `View` host node with static-surface props.
2. `v8_app.zig` decodes those props onto `layout.Node`.
3. Reconciler mutations stamp `subtree_last_mutated_frame` on the node and
   its ancestors.
4. `framework/engine.zig` detects `node.static_surface` during recursive
   paint.
5. `framework/gpu/gpu.zig` captures the subtree into an offscreen texture,
   then queues that texture as an image quad on later frames.

## Public API

Import from runtime primitives or use the ambient global:

```tsx
import { StaticSurface } from '@reactjit/runtime/primitives';
```

Primitive implementation:

```tsx
export const StaticSurface = ({
  staticKey,
  staticSurfaceKey,
  scale,
  staticSurfaceScale,
  warmupFrames,
  staticSurfaceWarmupFrames,
  introFrames,
  staticSurfaceIntroFrames,
  ...rest
}: any) => {
  const React = require('react');
  const id = React.useId();
  return h('View', {
    ...rest,
    staticSurface: true,
    staticSurfaceKey: staticSurfaceKey ?? staticKey ?? id,
    staticSurfaceScale: staticSurfaceScale ?? scale ?? 1,
    staticSurfaceWarmupFrames: staticSurfaceWarmupFrames ?? warmupFrames ?? 0,
    staticSurfaceIntroFrames: staticSurfaceIntroFrames ?? introFrames ?? 0,
  }, rest.children);
};
```

Typical usage:

```tsx
<StaticSurface staticKey="chart:revenue:q2" introFrames={30}>
  <Graph style={{ width: 480, height: 260 }}>
    <Graph.Path d={curve} stroke="theme:accent" strokeWidth={2} fill="none" />
  </Graph>
</StaticSurface>
```

Author-facing props:

| Prop | Alias | Type | Behavior |
|---|---|---|---|
| `staticSurfaceKey` | `staticKey` | string | Stable cache key. Defaults to `React.useId()`. |
| `staticSurfaceScale` | `scale` | number | Backing texture scale, clamped to `1..4`. |
| `staticSurfaceWarmupFrames` | `warmupFrames` | number | Number of live-paint frames before first capture. |
| `staticSurfaceIntroFrames` | `introFrames` | number | GPU-only intro animation length for the cached quad. |
| `staticSurfaceOverlay` | none | boolean | Paint this descendant over the cached quad instead of baking it into the capture. |
| `style` | none | object | Normal `View` style; controls layout size and position. |

`staticSurfaceOverlay` is not a wrapper component. Put it directly on a
descendant that should stay dynamic:

```tsx
<StaticSurface staticKey="plot">
  <Graph>{staticPaths}</Graph>
  <Box staticSurfaceOverlay style={{ position: 'absolute', left: dotX, top: dotY }}>
    <Text>live</Text>
  </Box>
</StaticSurface>
```

## JS Host Shape

`StaticSurface` does not create a native host type named `StaticSurface`.
It creates:

```tsx
h('View', {
  staticSurface: true,
  staticSurfaceKey: ...,
  staticSurfaceScale: ...,
  staticSurfaceWarmupFrames: ...,
  staticSurfaceIntroFrames: ...,
}, children)
```

Because the host type is `View`, no special renderer type default is needed.
`renderer/hostConfig.ts` treats these props as ordinary non-handler props and
includes them in normal `CREATE` / `UPDATE` mutation payloads.

Ambient exposure is wired through:

| File | Role |
|---|---|
| `framework/ambient_primitives.ts` | Re-exports `StaticSurface` from `runtime/primitives`. |
| `framework/ambient.d.ts` | Declares global `StaticSurface` for TSX files that rely on ambient primitives. |

## Native Prop Decode

`v8_app.zig:applyProps()` decodes the static-surface props onto `layout.Node`:

| JS prop | Node field | Decode behavior |
|---|---|---|
| `staticSurface` | `static_surface` | Boolean. |
| `staticSurfaceKey` | `static_surface_key` | Duplicated string. |
| `staticSurfaceScale` | `static_surface_scale` | Float clamped to `1..4`. |
| `staticSurfaceWarmupFrames` | `static_surface_warmup_frames` | Integer clamped to `0..u16.max`. |
| `staticSurfaceIntroFrames` | `static_surface_intro_frames` | Integer clamped to `0..u16.max`. |
| `staticSurfaceOverlay` | `static_surface_overlay` | Boolean. |

`removePropKeys()` resets those fields when React removes the props:

| Removed prop | Reset value |
|---|---|
| `staticSurface` | `false` |
| `staticSurfaceKey` | `null` |
| `staticSurfaceScale` | `1` |
| `staticSurfaceWarmupFrames` | `0` |
| `staticSurfaceIntroFrames` | `0` |
| `staticSurfaceOverlay` | `false` |

`framework/layout.zig` stores the runtime fields:

```zig
static_surface: bool = false,
static_surface_key: ?[]const u8 = null,
static_surface_scale: f32 = 1,
static_surface_warmup_frames: u16 = 0,
static_surface_intro_frames: u16 = 0,
static_surface_overlay: bool = false,
subtree_last_mutated_frame: u64 = 0,
```

## Dirty Tracking

StaticSurface invalidation is automatic for React host mutations.

Every structural or prop mutation in `v8_app.zig:applyCommand()` calls:

```zig
markSubtreeDirty(id);
```

That function reads `gpu.frameCounter()` and stamps
`subtree_last_mutated_frame` on the changed node and every ancestor through
`g_parent_id`:

```text
changed node -> parent -> grandparent -> ... -> root
```

The paint loop passes this stamp as `dirty_frame` to the GPU cache. A cached
entry is stale when:

```zig
entry.captured_frame < dirty_frame
```

This means a stable `staticKey` can still recapture when a descendant changes.
You do not need to fold every prop into the key just to handle normal React
updates.

Important boundary: only host mutations that pass through `applyCommand()` are
tracked this way. Pure GPU-side animation inside a cached subtree will not
invalidate the static texture unless it also causes a React host mutation or
the key changes. Put live descendants behind `staticSurfaceOverlay` when they
must keep updating over a cached background.

## Paint Pipeline

`framework/engine.zig:paintNode()` handles `StaticSurface` before normal node
visuals and child paint.

High-level flow:

```text
paintNode(node)
  if node.static_surface and key exists:
    if cached texture is ready and not stale:
      queue cached quad
      paint overlay descendants
      return

    if still warming:
      fall through to normal live paint

    else:
      begin offscreen capture
      paint children into capture coordinate space
      finish capture
      paint overlay descendants
      return

  paint normal node visuals and children
```

Ready-cache path:

1. `gpu.queueStaticSurface(...)` checks the key, size, scale, ready flag, and
   `dirty_frame`.
2. If valid, it queues one image quad using the cached texture bind group.
3. `paintStaticSurfaceOverlays(node)` walks descendants and paints only nodes
   marked `static_surface_overlay`.
4. The normal subtree paint is skipped.

Warmup path:

1. `gpu.staticSurfaceWarming(...)` creates or finds the cache entry.
2. If `age < warmupFrames` and the entry has never captured, the engine falls
   through to normal live paint.
3. Warmup only applies before the first capture. A ready but stale entry skips
   warmup and recaptures immediately.

Capture path:

1. `gpu.beginStaticSurfaceCapture(...)` ensures the offscreen texture exists.
2. It queues the future texture quad for the main pass.
3. The engine suspends the current scissor stack for capture.
4. The engine offsets descendants by `-node.computed.x/y` so the captured
   subtree renders at texture origin.
5. If scale is greater than `1`, the engine pushes a composed GPU transform so
   child primitives render into a larger backing texture.
6. The engine resets capture opacity to the parent opacity so this node's own
   opacity is applied once at composite time, not baked into children and then
   applied again.
7. Children paint normally into the global primitive queues.
8. The engine restores transform, offsets, scissor state, and opacity.
9. `gpu.finishStaticSurfaceCapture(...)` records the primitive-count range that
   belongs to the capture.

The first capture frame does not draw both raw children and the cached quad in
the main pass. The captured primitive ranges are skipped during the main pass,
while `renderStaticSurfaceCaptures()` first renders those ranges into the
offscreen texture.

## GPU Cache Pipeline

`framework/gpu/gpu.zig` owns a fixed pool:

```zig
const MAX_STATIC_SURFACES = 2048;
const MAX_STATIC_CAPTURES = 2048;
```

Each cache entry stores:

| Field | Meaning |
|---|---|
| `key_hash` / `key_len` | Cache identity. |
| `width` / `height` | Backing texture dimensions after scale. |
| `texture` / `view` | Offscreen WGPU texture resources. |
| `sampler` / `bind_group` | Resources used to composite the texture as an image quad. |
| `ready` | Whether the texture can be reused. |
| `active` | Whether the slot is allocated. |
| `warmup_started_frame` | Frame used for first-capture warmup gating. |
| `ready_frame` | Frame used for intro animation progress. |
| `captured_frame` | Frame on which the texture was last rendered. |

Texture dimensions are:

```text
ceil(layout_width * clamp(scale, 1, 4))
ceil(layout_height * clamp(scale, 1, 4))
```

`ensureStaticEntry()` finds an existing entry by key hash and key length, or
allocates a free slot. If the size changes, it releases and recreates the
texture/view/sampler/bind group.

`renderStaticSurfaceCaptures()` runs before the main render pass:

1. For each pending capture, set globals to the capture texture size.
2. Begin a render pass targeting the offscreen texture.
3. Draw only the primitive ranges recorded for that capture.
4. Restore globals to the main window size.
5. Mark the entry `ready = true`.
6. Stamp `ready_frame` and `captured_frame` with the current GPU frame.

During the main render pass, `drawRectsSkipping()`, `drawTextSkipping()`,
`drawCurvesSkipping()`, `drawCapsulesSkipping()`, `drawPolysSkipping()`, and
`drawImagesSkipping()` skip primitive ranges that were captured offscreen.
That prevents duplicate drawing.

The cached quad itself is queued through `images.queueQuadNoFlip(...)`, so
StaticSurface composites through the same image-batch path used by other GPU
texture quads.

## Intro Animation

`staticSurfaceIntroFrames` controls a GPU-only composite animation after a
capture becomes ready.

Progress is calculated from:

```zig
g_frame_counter - entry.ready_frame
```

The easing is an ease-out curve:

```zig
1.0 - pow(1.0 - t, 3.0)
```

The quad starts at 98.5 percent scale and fades from transparent to its target
opacity. `introFrames = 0` disables the effect.

Because this is applied to the cached quad, it does not re-run React or repaint
the child subtree.

## Overlay Descendants

Overlay nodes solve the common "cached background with live marker" case.

During capture:

```zig
if (g_static_surface_capture and node.static_surface_overlay) return;
```

So overlay nodes are skipped and not baked into the texture.

After a cached quad is queued or after a capture is scheduled,
`paintStaticSurfaceOverlays(node)` recursively finds descendants with
`static_surface_overlay` and paints them over the cached quad.

Practical examples:

| Static cached content | Overlay content |
|---|---|
| Chart axes and paths | Hover cursor, live value marker, tooltip. |
| Grid cell chrome | Selection ring, caret, drag handle. |
| Easing curve | Animated dot. |

## Layout and Hit Testing

StaticSurface does not remove children from the tree.

Layout still computes every descendant. Hit testing still sees descendants.
Scroll, press, hover, context menu, and text input behavior continue to use the
normal node tree.

Only paint is collapsed. When the cache is ready, the normal descendant paint
path is skipped except for overlay descendants.

## Relation to Filter

`Filter` shares the same offscreen capture machinery and the same
`StaticSurfaceEntry` pool, but has different cache semantics:

| Feature | StaticSurface | Filter |
|---|---|---|
| Capture cadence | First valid paint, then on invalidation. | Every frame. |
| Entry `ready` | Set true after capture. | Intentionally left false. |
| Composite path | Plain image quad. | Filter shader composite. |
| Animated children | Freeze unless invalidated or overlaid. | Keep animating. |
| Author API | `<StaticSurface>` | `<Filter shader="...">` |

Use `StaticSurface` for expensive static visuals. Use `Filter` when the subtree
must keep animating inside a post-process effect.

## Current Users

Representative uses in the repo:

| File | Usage |
|---|---|
| `cart/app/gallery/components/chart/Chart.tsx` | `staticPreview` wraps charts in `StaticSurface` with data-derived keys. |
| `cart/app/gallery/components/easings/EasingsLatch.tsx` | Caches curve/frame paths while a live dot animates outside the cached graph. |
| `cart/app/gallery/components/easings/EasingsZigStatic.tsx` | Combines cached curve paint with host-side math/latches. |
| `cart/app/gallery/components/easings/EasingsHostInterval.tsx` | Keeps paint cost low by caching static graph paths. |
| `cart/opacity_test.tsx` | Stress/test cells can be wrapped in `StaticSurface staticKey="cell:N"`. |
| `cart/chart_stress.tsx` | Stress path imports and exercises `StaticSurface`. |

## File Map

JS/runtime files:

| File | Role |
|---|---|
| `runtime/primitives.tsx` | Exports `StaticSurface`; maps it to `View` plus static-surface props. |
| `runtime/host_props.ts` | Documents static-surface host props. |
| `framework/ambient_primitives.ts` | Re-exports `StaticSurface` for ambient primitive injection. |
| `framework/ambient.d.ts` | Declares global `StaticSurface`. |

Native files:

| File | Role |
|---|---|
| `v8_app.zig` | Decodes props, removes props, stamps dirty ancestors after host mutations. |
| `framework/layout.zig` | Stores static-surface fields and mutation frame stamps on `Node`. |
| `framework/engine.zig` | Detects static surfaces during recursive paint, captures children, paints overlays. |
| `framework/gpu/gpu.zig` | Owns texture pool, capture queue, offscreen render passes, cached quad compositing, and skip ranges. |
| `framework/gpu/images.zig` | Queues the cached texture as an image quad. |
| `framework/gpu/filters.zig` | Shares the same entry pool for per-frame filter captures. |

Docs with adjacent coverage:

| File | Coverage |
|---|---|
| `docs/v8/layout.md` | Lists the prop surface and node fields. |
| `docs/v8/paint.md` | Summarizes recursive paint and StaticSurface/Filter interaction. |
| `docs/v8/filter.md` | Documents the related per-frame capture path. |

## Review Notes

Current sharp edges found while tracing:

1. `StaticSurface` is a `View` wrapper, not a distinct native node type. Any
   code looking for host type `"StaticSurface"` will miss it.
2. Cache identity in `gpu.zig` is `Wyhash(key)` plus key length. The full key
   bytes are not stored or compared, so collisions are possible, though
   unlikely.
3. Static entries are not released when a React node unmounts. The pool is
   fixed at 2048 active entries and is fully cleared only by GPU deinit.
   Highly dynamic keys can exhaust the cache and fall back to uncached paint.
4. Empty captures are not marked ready because `finishStaticSurfaceCapture()`
   requires primitive counts to increase. An empty cached surface can keep
   attempting capture.
5. `staticSurfaceWarmupFrames` only delays the first capture. A stale ready
   entry recaptures immediately.
6. GPU-side animation inside the cached subtree freezes after capture unless a
   host mutation invalidates the surface or the live part is marked
   `staticSurfaceOverlay`.
7. Layout and hit testing still walk children. StaticSurface reduces paint
   work, not layout cost or event-tree cost.
