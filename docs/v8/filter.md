# Filter Pipeline (V8 Runtime)

`Filter` is the V8 runtime subtree post-process primitive. It is not browser CSS
`filter`, `backdrop-filter`, SVG filters, or a DOM layer. A `Filter` node lays out
like a normal `View`, renders its children into an offscreen GPU texture, then
draws that texture back through a named WGSL fragment shader.

The important split:

- React and layout still see a normal host node with normal children.
- Hit testing and event dispatch still target the real children.
- The visual output of the children is captured and replaced by one filtered
  textured quad during paint.
- Captures are rebuilt every frame, so animations inside the subtree keep
  moving.

## Public API

Import from `runtime/primitives`:

```tsx
import { Filter } from '@reactjit/runtime/primitives';
```

Usage:

```tsx
<Filter shader="pixelate" intensity={0.75} style={{ width: '100%', height: '100%' }}>
  <App />
</Filter>
```

The component is currently untyped (`any`) and forwards the rest of its props to
the host `View` it creates.

```ts
type FilterProps = {
  shader: FilterShaderName;
  intensity?: number;        // default 1, clamped to 0..1 by V8
  style?: object;            // normal View style
  children?: React.ReactNode;

  // Any normal host View props/handlers can be forwarded too.
};

type FilterShaderName =
  | 'deepfry'
  | 'crt'
  | 'chromatic'
  | 'posterize'
  | 'vhs'
  | 'scanlines'
  | 'invert'
  | 'grayscale'
  | 'pixelate'
  | 'dither'
  | 'bytecode';
```

`intensity` is shader-specific strength. The host clamps it to `0..1`. Values
below 0 become 0; values above 1 become 1. Omitted intensity becomes 1 in
`runtime/primitives.tsx`.

The low-level host props are:

```ts
{
  filterName: string;
  filterIntensity: number;
}
```

`Filter` maps `shader` to `filterName` and `intensity` to `filterIntensity`.
Cart code should prefer `<Filter shader=...>` instead of setting these directly,
unless it is intentionally bypassing the convenience primitive.

## Related Surfaces

`StaticSurface` and `Filter` share most of their capture machinery. The difference
is cache behavior:

- `StaticSurface` captures a subtree into a texture and reuses it until dirty.
- `Filter` captures a subtree into a texture every frame and composites through a
  shader. Its `StaticSurfaceEntry.ready` flag is intentionally left false.

`Effect` is separate. It runs a user-supplied pixel shader or named effect surface
through the effect path. `Filter` only post-processes an existing ReactJIT subtree.

## End-to-End Flow

### 1. TSX creates a host `View`

`runtime/primitives.tsx` implements `Filter` as a small wrapper:

```tsx
export const Filter: any = ({ shader, intensity, ...rest }: any) =>
  h('View', {
    ...rest,
    filterName: shader,
    filterIntensity: intensity ?? 1,
  }, rest.children);
```

The wrapper does not validate `shader`; validation happens later in Zig.

### 2. React host config emits mutations

`renderer/hostConfig.ts` treats the filtered node like any other host node.

On mount, `createInstance` strips function handlers, stores handlers in JS, and
emits:

```json
{
  "op": "CREATE",
  "id": 123,
  "type": "View",
  "props": {
    "filterName": "pixelate",
    "filterIntensity": 0.75,
    "style": { "width": "100%", "height": "100%" }
  }
}
```

On update, `prepareUpdate` diffs plain props and nested `style`, then
`commitUpdate` emits an `UPDATE` with changed props plus any `removeKeys` /
`removeStyleKeys`. Multiple updates to the same node are coalesced before the
bridge flush.

### 3. `__hostFlush` applies props to the Zig node

`v8_app.zig` receives the JSON mutation batch and applies it to the shared
`layout.Node` pool.

Relevant paths:

- `applyCommand(CREATE)` calls `applyTypeDefaults`, then `applyProps`.
- `applyCommand(UPDATE)` applies removals first, then `applyProps`.
- `removePropKeys` resets `filterName` to null and `filterIntensity` to 1.
- `applyProps` stores:

```zig
node.filter_name = duplicated_string;
node.filter_intensity = clamp(float, 0.0, 1.0);
```

The storage fields live on `framework/layout.zig`'s `Node`:

```zig
filter_name: ?[]const u8 = null,
filter_intensity: f32 = 1.0,
```

Layout does not special-case filters. The filter node computes its rectangle like
any other `View`.

### 4. Paint diverts the subtree into a capture texture

`framework/engine.zig:paintNode` checks `node.filter_name` after transforms and
opacity setup, before `StaticSurface`.

For a filtered node:

1. Build a stable capture key from the node pointer.
2. Call `gpu.beginFilterCapture(key, filter_name, intensity, x, y, w, h, 1.0)`.
3. Suspend normal scissor state for the offscreen capture.
4. Record primitive counts before painting the children.
5. Offset descendants by `-node_rect.x, -node_rect.y` so the captured subtree is
   local to the offscreen texture.
6. Paint non-background children into the normal primitive queues.
7. Restore transform, offsets, scissor, and capture flags.
8. Record primitive counts after painting.
9. Call `gpu.finishFilterCapture(...)`.
10. Return without painting the children normally.

The primitive count range is the link between the capture pass and the main pass:
it identifies which rects, glyphs, curves, capsules, polygons, and images belong
to the filtered subtree.

### 5. GPU capture uses the static-surface texture pool

`framework/gpu/gpu.zig` stores filter captures in the same `StaticSurfaceEntry`
pool used by `StaticSurface`.

`beginFilterCapture`:

- converts the node rect to texture dimensions with `staticDim`,
- finds or creates a matching static entry,
- creates filter-specific entry resources if needed:
  - a `FilterUniforms` buffer,
  - a bind group pointing at the entry texture view and sampler,
- returns a `StaticSurfaceToken`.

`finishFilterCapture`:

- rejects empty captures,
- resolves `filterName` through `filters.resolveFilter`,
- appends a `StaticSurfaceCapture` with `is_filter = true`,
- stores `filter`, `filter_intensity`, and screen-space bounds.

If the filter name is unknown, `finishFilterCapture` logs `filter unknown: NAME`
and does not queue a composite. Treat unknown names as invalid API input.

### 6. Offscreen pass renders the captured primitive range

During `gpu.frame`, after primitive buffers upload and before the main surface
render pass, `renderStaticSurfaceCaptures` renders each queued capture into its
entry texture.

For filter captures:

1. Set globals to the capture texture size.
2. Render only the captured primitive ranges into the offscreen texture.
3. Leave `entry.ready = false` so the capture repeats next frame.
4. Compute shader time as `frame_counter / 60.0`, wrapped at 1,000,000 frames.
5. Call `filters.queueComposite(...)`.

After captures finish, globals are restored to the window size.

### 7. Main pass skips captured primitives and draws composites last

The normal main render pass draws all primitive queues with `draw*Skipping`
helpers. Those helpers skip primitive ranges owned by queued captures, so the
unfiltered children do not draw directly to the window.

After all normal primitives are drawn, the pass resets scissor to the whole
window and calls:

```zig
filters.drawComposites(render_pass);
```

Each queued composite draws six vertices, using the filter-specific pipeline and
the captured texture as input.

## Shader Registry

`framework/gpu/filters.zig` owns the shader registry:

```zig
pub const Filter = enum(u8) {
    deepfry,
    crt,
    chromatic,
    posterize,
    vhs,
    scanlines,
    invert,
    grayscale,
    pixelate,
    dither,
    bytecode,
};
```

`resolveFilter(name)` matches exact enum tag names. Names are case-sensitive.

`filters.ensureInit(device, format)` is called during GPU init and compiles one
pipeline per enum member. Each enum case maps to a WGSL source constant in
`framework/gpu/filter_shaders.zig`.

## Shader Uniforms

Every filter shader shares one bind group layout:

```text
binding 0: globals uniform       - screen_size
binding 1: input texture         - captured subtree texture
binding 2: sampler               - filtering sampler
binding 3: filter uniforms       - bounds, time, intensity
```

The Zig and WGSL uniform layouts match:

```ts
type FilterUniforms = {
  bounds_x: number;
  bounds_y: number;
  bounds_w: number;
  bounds_h: number;
  time: number;
  intensity: number;
  _pad0: number;
  _pad1: number;
};
```

In WGSL this is exposed as:

```wgsl
struct FilterUniforms {
  bounds_pos: vec2f;
  bounds_size: vec2f;
  time: f32;
  intensity: f32;
  _pad0: f32;
  _pad1: f32;
};
```

The shared vertex shader draws a quad over `bounds_pos` and `bounds_size` in
window pixels. Fragment shaders sample the captured texture with `in.uv`.

## Built-In Filters

- `deepfry`: sharpen, saturation boost, posterization, and block noise.
- `crt`: barrel distortion, scanlines, RGB channel offset, and vignette.
- `chromatic`: RGB channel shift only.
- `posterize`: reduced color levels.
- `vhs`: horizontal wobble, color bleed, scanlines, and tape grain.
- `scanlines`: line darkening.
- `invert`: blends toward inverted premultiplied color.
- `grayscale`: blends toward luma.
- `pixelate`: blocky sampling from larger pixel cells.
- `dither`: 4x4 Bayer threshold toward monochrome.
- `bytecode`: tile-based glyph/fingerprint visualization with scan reveal.

## Adding a Filter

1. Add a new enum tag to `framework/gpu/filters.zig`.
2. Add a matching `case` in `Filter.wgsl`.
3. Add a WGSL string constant to `framework/gpu/filter_shaders.zig`.
4. Use the shared header and define `fs_main(in: VertexOutput) -> vec4f`.
5. Add the new string name to docs and any cart-side UI that lists filters.

No extra host prop parsing is needed if the shader only needs `intensity`, time,
bounds, and the captured texture. Anything beyond that needs a new uniform API,
V8 prop parsing, and docs.

## Current Limitations And Gotchas

- Nested filters are not reliable. An inner filter captures its own children into
  a separate offscreen texture; the outer filter capture does not see the inner
  composite in the same way it sees ordinary primitives. Existing carts avoid
  overlap by conditionally rendering only one active filter layer at a time.
- The wrapper is rectangular. The composite quad covers the filter node's computed
  bounds.
- The filter node's own visuals are not painted by the filter branch. Use the
  wrapper `style` for layout and sizing; put backgrounds, borders, opacity, and
  visible content inside a child if they should appear in the filtered output.
- `filterName` must be one of the exact enum names. There is no fallback shader
  or case-insensitive lookup.
- `filterIntensity` is a single scalar. Per-filter custom knobs are not exposed.
- Filter capture scale is currently fixed at `1.0`; unlike `StaticSurface`, there
  is no public scale prop.
- Filter captures are intentionally not cached. This preserves child animation
  but makes filters more expensive than a normal subtree or a cached
  `StaticSurface`.
- The composite queue is capped at 256 filters per frame. Additional composites
  are dropped with a warning.
- The static surface pool is capped at 2048 entries and is shared with
  `StaticSurface`.
- Filter composites are drawn in the final composite phase after normal
  primitives. The captured primitive ranges are skipped, but a filtered subtree
  can still behave differently from a normal sibling in edge-case stacking
  scenarios where later non-filtered siblings overlap the same pixels.
- Background effects marked `effect_background` are skipped during filter child
  capture. Ordinary children, text, paths, images, and canvas-generated primitive
  output are captured by primitive range.
- The current filter capture path resets opacity while painting children and does
  not pass wrapper opacity into `queueComposite`. Put opacity inside the filtered
  subtree if you need a faded filtered result.

## Source Map

- `runtime/primitives.tsx`: public `<Filter>` wrapper.
- `renderer/hostConfig.ts`: prop cleaning, diffing, mutation emission, flushing,
  and update coalescing.
- `v8_app.zig`: mutation application, `filterName` / `filterIntensity` parsing,
  and prop removal reset behavior.
- `framework/layout.zig`: node storage fields.
- `framework/engine.zig`: paint-time capture diversion.
- `framework/gpu/gpu.zig`: static-surface entry pool, filter capture queue,
  offscreen render pass, primitive skipping, and final composite call.
- `framework/gpu/filters.zig`: filter enum, pipeline setup, entry resources,
  composite queue, and composite draw.
- `framework/gpu/filter_shaders.zig`: shared WGSL header and built-in fragment
  shaders.
- Example carts: `cart/app_fried`, `cart/app_scanlines`, `cart/app_pixelate`,
  `cart/app_bytecode`, and `cart/filter_morph`.
