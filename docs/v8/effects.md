# V8 effects

Last updated: 2026-05-04.

This document traces the visual effects pipeline in the V8 runtime: `<Effect>`,
shader effects, JS `onRender` effects, named effect fills, text/glyph effects,
and post-process `<Filter>`. It does not describe React's `useEffect` lifecycle
except where the local effect profiler is mentioned at the end.

## Mental model

An effect is a host node that produces pixels. The pixels become a wgpu texture
and are painted as a quad, or stored under a name so another primitive can
sample them.

There are two live render paths:

- **GPU shader path**: `<Effect shader={WGSL} />` is wrapped with the standard
  uniform block and fullscreen vertex shader, compiled to a wgpu render
  pipeline, rendered into an offscreen texture, then composited as an image
  quad.
- **CPU JS path**: `<Effect onRender={(e) => ...} />` gets a zero-copy
  `ArrayBuffer` view of the effect instance's RGBA buffer. JS writes pixels,
  Zig uploads the buffer to a texture, then the texture is composited.

Named effect fills use the CPU path today. `fillEffect`, `textEffect`, and
inline glyph `fillEffect` sample the named effect's CPU pixel buffer, so named
effects are intentionally excluded from the GPU shader fast path.

## Public TSX surface

The primitive is just:

```tsx
import { Effect } from '@reactjit/runtime/primitives';

<Effect style={{ width: 320, height: 180 }} onRender={(e) => {
  e.clearColor(0, 0, 0, 1);
}} />
```

`runtime/primitives.tsx` emits a host element of type `"Effect"`. It does not
wrap or validate props; the V8 host decodes the props listed below.

### `<Effect>` props

```ts
type EffectProps = {
  style?: Record<string, any>;

  // CPU path. The function stays in JS handlerRegistry and is called every
  // paint for the effect node.
  onRender?: (e: EffectContext) => void;

  // GPU path. User WGSL is auto-wrapped by v8_app.zig before it reaches
  // framework/effects.zig.
  shader?: string;

  // Named source for fillEffect/textEffect/inline glyph fills. Named effects
  // render but do not draw their own quad.
  name?: string;

  // Paint this effect behind the parent node's content using the parent's
  // computed rect, not the effect node's own rect.
  background?: boolean;

  // Decoded into node.effect_mask and disables the GPU path. The completed
  // parent clip/mask paint path is not present in engine.zig today.
  mask?: boolean;
};
```

`style.width` / `style.height` determine the displayed rectangle. The internal
effect texture is usually the same size, but `framework/effects.zig` can scale
it down to fit per-frame budgets.

For background effects, the parent rect wins: `engine.zig` paints a child with
`background` over the parent's computed bounds. Use `background`, not the older
`effectBackground` field listed in the broad `HostNodeProps` advisory type;
the V8 decoder handles the `<Effect>` prop named `background`.

### CPU `EffectContext`

`runtime/effectContext.ts` builds the JS context passed to `onRender`. It reuses
one object per host node and swaps the typed array view each frame.

```ts
type EffectContext = {
  width: number;
  height: number;
  time: number;          // seconds since effect instance creation
  dt: number;            // last frame delta seconds
  frame: number;
  mouse_x: number;       // local effect-buffer coords
  mouse_y: number;
  mouse_inside: boolean;

  setPixel(x: number, y: number, r: number, g: number, b: number, a: number): void;       // floats 0..1
  setPixelRaw(x: number, y: number, r: number, g: number, b: number, a: number): void;    // bytes 0..255
  getPixel(x: number, y: number): [number, number, number, number];                       // floats 0..1
  clearColor(r: number, g: number, b: number, a: number): void;
  fade(alpha: number): void;  // multiplies alpha channel only

  sin: Math['sin'];
  cos: Math['cos'];
  tan: Math['tan'];
  atan2: Math['atan2'];
  sqrt: Math['sqrt'];
  abs: Math['abs'];
  floor: Math['floor'];
  ceil: Math['ceil'];
  pow: Math['pow'];
  exp: Math['exp'];
  log: Math['log'];
  min: Math['min'];
  max: Math['max'];
  clamp(x: number, lo: number, hi: number): number;
  mod(x: number, y: number): number;

  noise2(x: number, y: number): number;
  noise3(x: number, y: number, z: number): number;
  fbm(x: number, y: number, octaves: number): number;
  hsv(h: number, s: number, v: number): [number, number, number];
  hsl(h: number, s: number, l: number): [number, number, number];
};
```

`setPixel` clamps coordinates and writes RGBA floats. `setPixelRaw` is the hot
path for dense loops because it avoids float-to-byte conversion in the helper.
The callback must complete all writes before returning.

`framework/effect_ctx.zig` has a richer native context (`fillRect`,
`blendPixel`, `line`, `circle`, source-buffer reads, `smoothstep`, `voronoi`,
etc.) used by compiled/native render callbacks. Those methods are not currently
mirrored on the JS `EffectContext` object unless `runtime/effectContext.ts` adds
them.

### WGSL shader API

`shader` is not a full wgpu module. It is the user fragment portion appended to
the host-provided header and math library.

```tsx
const shader = `
@fragment fn fs_main(in: VsOut) -> @location(0) vec4f {
  let x = in.uv.x * U.size_w;
  let y = in.uv.y * U.size_h;
  let rgb = hsv2rgb(fract(U.time * 0.05 + x * 0.001), 0.7, 0.9);
  return vec4f(rgb, 1.0);
}
`;

<Effect shader={shader} style={{ flexGrow: 1 }} />
```

Injected by `v8_app.zig:assembleEffectShader`:

- `U.size_w`, `U.size_h`
- `U.time`, `U.dt`, `U.frame`
- `U.mouse_x`, `U.mouse_y`, `U.mouse_inside`
- `VsOut { pos, uv }`
- `@vertex fn vs_main(...)`
- `framework/gpu/effect_math.wgsl`

Helpers from `effect_math.wgsl` include `snoise`, `snoise3`, `fbm`, `voronoi`,
`hsv2rgb`, `hsl2rgb`, `_lerp`, `_remap`, and `_dist`.

Do not combine `shader` and `onRender` unless you deliberately want `onRender`
as a CPU fallback. `framework/effects.zig:paintCustomEffect` tries the GPU
shader first when possible; if GPU render succeeds, the JS `onRender` callback
is not called for that frame.

## Named effect consumers

### `fillEffect`

`Canvas.Path`, `Graph.Path`, and inline glyphs can fill from a named effect:

```tsx
<Effect name="debug-wheel" onRender={drawWheel} style={{ width: 256, height: 256 }} />
<Graph.Path d={circlePath} fillEffect="debug-wheel" stroke="#eafff4" strokeWidth={6} />
```

Flow:

1. The named `<Effect>` paints through `effects.paintNamedEffect`.
2. The instance stores `name`, CPU `pixel_buf`, dimensions, and screen position.
3. `Graph.Path` / `Canvas.Path` calls `effects.getEffectFill(name)`.
4. `engine.zig` fills the SVG path by sampling the named CPU buffer:
   - Blend2D path: `blend2d_gfx.fillSVGPathFromEffect`
   - fallback path: `svg_path.drawFillFromEffect`

Named effects do not draw their own quad. If a `fillEffect` name is missing,
the path simply does not use the effect fill.

### `textEffect`

Any text node can set `textEffect="name"`. Before drawing text,
`drawNodeTextCommon` looks up the named effect and calls `gpu.setTextEffect`.
The text renderer samples that effect while rasterizing glyphs, then
`gpu.clearTextEffect` resets the state after the text draw.

### Inline glyph `fillEffect`

`inlineGlyphs` entries can carry `fillEffect`. The engine samples the named
effect directly through `svg_path.drawFillFromEffect` for the glyph's path.
This deliberately avoids the Blend2D shared surface path because shared
surfaces can be overwritten between inline glyph paints.

## `<Filter>` surface

`runtime/primitives.tsx` also exposes a subtree post-process primitive:

```tsx
<Filter shader="crt" intensity={0.8}>
  <App />
</Filter>
```

This is not the same as `<Effect>`. `<Filter>` emits a normal `"View"` with:

- `filterName`
- `filterIntensity`

`engine.zig` captures the subtree into an offscreen texture every frame and
`framework/gpu/filters.zig` composites it through a named filter shader.
Available names are:

- `deepfry`
- `crt`
- `chromatic`
- `posterize`
- `vhs`
- `scanlines`
- `invert`
- `grayscale`
- `pixelate`
- `dither`
- `bytecode`

Filters preserve layout, hit-testing, and child animation. They are presentation
only.

## End-to-end pipeline

### 1. React tree to mutation command

`renderer/hostConfig.ts` handles the React reconciler:

1. `createInstance("Effect", props, ...)` allocates a numeric host id.
2. `extractHandlers` keeps `onRender` in `handlerRegistry`; function values do
   not cross the bridge.
3. The clean props emit in a `CREATE` command.
4. `resetAfterCommit` schedules a microtask flush.
5. `flushToHost` coalesces updates and sends one JSON payload to
   `globalThis.__hostFlush`.

### 2. V8 host command application

`runtime/index.tsx` installs the transport:

```ts
setTransportFlush((cmds) => globalThis.__hostFlush(JSON.stringify(cmds)));
```

`v8_app.zig:applyCommandBatch` parses the JSON and applies each command to the
Zig node pool:

- `applyProps` decodes `name`, `background`, `mask`, and `shader`.
- `shader` is assembled into a `GpuShaderDesc` by prepending the standard WGSL
  header and `effect_math.wgsl`.
- `applyHandlerFlags` sees `handlerNames` and wires:
  - `onRender` -> `node.effect_render = &v8_effect_shim`
  - shader-only effects -> `node.effect_render = &noop_effect_render`
- `node.scroll_persist_slot` carries the React host id; the effect instance
  uses it as a stable identity key.

The shader-only noop is intentional: `engine.zig` only enters
`paintCustomEffect` when `node.effect_render` is non-null, so shader-only nodes
need a sentinel function pointer even though the GPU path never calls it.

### 3. Frame update

Each frame, `engine.zig` calls:

```zig
effects.update(dt_sec);
```

`effects.update`:

- records `g_dt`
- resets per-frame pixel/upload budget counters
- sweeps effect instances not painted for more than `STALE_INSTANCE_GRACE`
  frames
- advances `time` and `frame_count`
- updates/draws legacy registry effects
- uploads dirty registry CPU buffers

Custom JS/GPU effects are rendered during paint, not update. Rendering them in
both places caused resize-time use-after-destroy on texture resources.

### 4. Paint traversal

`engine.zig:paintNode` handles effects in three places:

- **Background effect children**: children with `effect_background` paint behind
  the parent content using the parent's computed rect.
- **Standalone effects**: a node with `effect_render` paints at its own computed
  rect through `effects.paintCustomEffect`.
- **Named effects**: a node with both `effect_render` and `effect_name` calls
  `effects.paintNamedEffect`; it updates the named source but does not queue a
  visible quad.

Path/text/glyph consumers call `effects.getEffectFill(name)` when they need to
sample a named effect.

### 5. CPU custom render path

`effects.paintCustomEffect` creates or finds an `Instance`, resolves a safe
texture size, ensures a CPU pixel buffer, and calls `renderCpuNow`.

`renderCpuNow` builds a Zig `EffectContext` and calls `node.effect_render`.
Under V8 that function pointer is `v8_effect_shim`:

1. `v8_effect_shim` reads `ctx.user_data` as the React host id.
2. It calls `v8_runtime.dispatchEffectRender`.
3. `dispatchEffectRender` wraps the Zig pixel buffer in a V8 `ArrayBuffer`
   BackingStore with a no-op deleter.
4. It calls JS global `__dispatchEffectRender(id, buffer, width, height, stride,
   time, dt, mouse_x, mouse_y, mouse_inside, frame)`.
5. `runtime/index.tsx` looks up `handlerRegistry.get(id).onRender`.
6. `prepareContext` creates or refreshes the JS `EffectContext`.
7. The user's callback writes into the typed array.
8. Control returns to Zig; the instance marks dirty, uploads the CPU buffer to
   its wgpu texture, and queues `images.queueQuad`.

CPU uploads flip rows before `queue.writeTexture` and flip them back after the
upload. That keeps CPU-side `fillEffect` sampling top-down while matching the
shared image shader's texture orientation.

### 6. GPU shader path

`effects.paintCustomEffect` uses the GPU path when all of these are true:

- backend preference is not forced to CPU
- `node.effect_shader != null`
- `node.effect_name == null`
- `node.effect_mask == false`

Then it:

1. Resolves texture size against the total effect pixel budget.
2. Ensures a render-attachment texture and image bind group.
3. Hashes the WGSL. If the shader changed, it releases cached GPU resources.
4. Builds a uniform buffer, bind group, shader module, pipeline layout, and
   render pipeline as needed.
5. Writes `GpuUniforms` for size, time, dt, frame, and mouse state.
6. Renders a fullscreen triangle into the effect texture.
7. Queues the texture as an image quad.

If any GPU step fails, the instance marks `gpu_failed` and falls back to the CPU
path on future paints.

## Limits and knobs

The limits live in `framework/effects.zig`:

- `MAX_INSTANCES = 4096`
- `MAX_EFFECT_PIXELS = 2_000_000` per frame
- `MAX_EFFECT_DIM = 2048`
- `MAX_UPLOAD_BYTES = 8 * 1024 * 1024` per frame for CPU texture uploads

`resolveEffectSize` scales effect textures down when requested dimensions would
exceed the remaining budget. The display quad still uses the layout rect, so
large effects may render at a lower internal resolution.

Environment:

- `ZIGOS_EFFECTS_BACKEND=cpu` disables the GPU shader path.
- `ZIGOS_EFFECTS_BACKEND=gpu` leaves GPU enabled for shader-safe effects.
- unset / anything else uses auto mode.
- `ZIGOS_PAISLEY_DEBUG=1` enables extra named-effect/fill sampling logs for
  `paisley-*` effect names.

## Known gaps

- `mask` is decoded and blocks GPU rendering, but no completed parent
  clip/mask compositor path is visible in `engine.zig` today.
- Legacy registry effects still exist in `framework/effects.zig`
  (`EffectModule`, `register`, `paintEffect`), but the current V8 TSX surface
  does not appear to set `node.effect_type`. New code should use `shader` or
  `onRender`.
- `runtime/host_props.ts` still has a broad `effectBackground` entry. The
  working V8 `<Effect>` API is the `background` prop decoded by `v8_app.zig`.
- GPU shader effects do not provide a CPU pixel buffer. Anything intended to be
  sampled by `fillEffect`, `textEffect`, or inline glyphs must be a named CPU
  effect.
- `runtime/index.tsx` says the host detaches the effect `ArrayBuffer` after the
  JS call. The V8 path actually uses a shared BackingStore with a no-op deleter;
  stale JS references can still point at the live effect buffer until the Zig
  instance is swept. Treat the buffer as frame-local anyway.

## Related files

- `runtime/primitives.tsx` - `<Effect>` and `<Filter>` primitives.
- `runtime/effectContext.ts` - JS `EffectContext` object and helpers.
- `runtime/host_props.ts` - advisory TypeScript prop surface.
- `runtime/background.tsx` - reusable shader-backed background component.
- `runtime/highlight.tsx` - interaction affordance layered on `Background`.
- `renderer/hostConfig.ts` - React reconciler mutation commands and handler
  registry.
- `runtime/index.tsx` - transport setup and `__dispatchEffectRender`.
- `v8_app.zig` - V8 command decoder, effect prop decoding, shader assembly,
  and `v8_effect_shim`.
- `framework/effects.zig` - effect instances, CPU/GPU render paths, budgets,
  named effect lookup.
- `framework/effect_ctx.zig` - native `EffectContext` shape used by Zig
  render callbacks and the V8 shim.
- `framework/effect_shader.zig` - `GpuShaderDesc`.
- `framework/gpu/effect_math.wgsl` - shader helper library.
- `framework/gpu/filters.zig` and `framework/gpu/filter_shaders.zig` -
  post-process filter pipeline.
- `framework/engine.zig` - paint traversal, background effects, path/text/glyph
  effect sampling, filter capture.
- `cart/plasma.tsx` - minimal GPU shader effect.
- `cart/circle_path_debug.tsx` - named CPU effect sampled by `Graph.Path`.
- `cart/paisley_garden.tsx` - background shader plus multiple named fill
  effects.

## React hook effect profiler

`runtime/effect_tracker.ts` is related by name only. It instruments
`React.useEffect` / `useLayoutEffect` to find expensive React effects. It
installs globals:

- `__getTopEffects(limit)`
- `__getTopEffectsByRunCount(limit)`
- `__effectStatsSummary()`
- `__resetEffectStats()`

Use it for React hook performance. It is not involved in visual `<Effect>`
rendering.
