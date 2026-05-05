# `<Image>` and `Icon` (V8 Runtime)

`<Image>` is the native bitmap primitive. It decodes a synchronous image source
into a GPU texture and paints it as a textured quad.

`Icon` is not a native primitive. It is a JS component in `runtime/icons/Icon.tsx`
that renders Lucide-style vector data as:

```text
Box -> Graph -> Graph.Path
```

There is one practical overlap: icon-like brand logos can be rendered through
`<Image source={...}>` when the source is a supported bitmap, commonly a
`data:image/png;base64,...` URL.

## Public API

Image:

```tsx
import { Image } from '@reactjit/runtime/primitives';

<Image source="/absolute/or/relative/path.png" style={{ width: 64, height: 64 }} />
<Image source="data:image/png;base64,..." style={{ width: 16, height: 16 }} />
```

The primitive wrapper is direct:

```ts
export const Image = (props: any) => h('Image', props, props.children);
```

Lowercase HTML also works:

```tsx
<img src="/tmp/icon.png" className="w-4 h-4" />
```

`renderer/hostConfig.ts` remaps:

```text
img -> Image
img.src -> source
className -> tw(className) -> style
```

Icon:

```tsx
import { Icon } from '@reactjit/runtime/icons/Icon';
import { Activity } from '@reactjit/runtime/icons/icons';

<Icon icon={Activity} size={18} color="theme:ink" strokeWidth={2} />
```

String-name lookup is opt-in:

```tsx
import { registerIcons } from '@reactjit/runtime/icons/registry';
import { Activity } from '@reactjit/runtime/icons/icons';

registerIcons({ Activity });

<Icon name="Activity" />
```

Icon props:

| Prop | Type | Behavior |
|---|---|---|
| `icon` | `number[][]` | Direct icon path data. Preferred, tree-shakable path. |
| `name` | string | Registry lookup. Requires explicit `registerIcon(s)` for cart icons. |
| `size` | number | Width and height in layout pixels. Defaults to `16`. |
| `color` | string | Stroke color. Defaults to `theme:ink`. |
| `strokeWidth` | number | Graph path stroke width. Defaults to `2`. |

## Image Host Pipeline

`<Image>` creates a host node with type `"Image"` and a `source` prop. The
renderer emits normal mutation commands:

```json
{
  "op": "CREATE",
  "id": 12,
  "type": "Image",
  "props": {
    "source": "data:image/png;base64,...",
    "style": { "width": 16, "height": 16 }
  }
}
```

`v8_app.zig:applyProps()` decodes the source prop:

| JS prop | Node field | Behavior |
|---|---|---|
| `source` | `image_src` | Duplicated string source. |

`removePropKeys()` resets `source` by setting `node.image_src = null`.

`framework/layout.zig` stores:

```zig
image_src: ?[]const u8 = null
```

`framework/engine.zig:debugNodeKind()` reports a node with `image_src` as
`"Image"` for debug/telemetry even though the host type string is not stored
on the layout node.

## Image Layout

Image layout can use natural dimensions.

During engine startup:

```zig
layout.setMeasureImageFn(measureImageCallback);
```

`measureImageCallback()` calls:

```zig
image_cache.measure(src)
```

The layout engine uses that callback when an image has no explicit width or
height:

| Layout path | Behavior |
|---|---|
| intrinsic width | `measureNodeImage(node).width + padding`. |
| intrinsic height | `measureNodeImage(node).height + padding`. |

If decode fails or no image measure callback is installed, natural dimensions
are `0 x 0`.

Explicit `style.width` / `style.height` avoid intrinsic measurement. The image
still decodes during paint.

## Image Decode and Cache

`framework/image_cache.zig` owns decoded image resources.

Supported source forms:

| Source | Supported | Notes |
|---|---|---|
| File path | yes | Absolute or cwd-relative path. File is read synchronously. |
| `data:image/<fmt>;base64,<payload>` | yes | Payload is base64-decoded, whitespace stripped first. |
| HTTP URL | no | Caller must fetch/write/provide a local or data source. |
| `data:image/svg+xml;utf8,...` | no | Plain text data URLs are rejected. |
| SVG file/data decoded by `<Image>` | no | Decode goes through `stb_image`, which does not decode SVG. |

The cache is keyed by:

```text
Wyhash(source bytes) + source length
```

Each entry stores:

| Field | Meaning |
|---|---|
| `width` / `height` | Decoded pixel size. |
| `texture` | WGPU texture. |
| `texture_view` | Texture view for binding. |
| `bind_group` | Image pipeline bind group. |
| `failed` | Negative-cache marker for broken sources. |
| `active` | Slot is occupied. |

Limits:

```zig
const MAX_ENTRIES: u32 = 256;
```

Decode path:

1. Read file bytes or decode base64 data URL.
2. Decode pixels with `stbi_load_from_memory(..., desired_channels = 4)`.
3. Swizzle RGBA to BGRA when the swapchain format is `bgra8_unorm`.
4. Flip rows vertically to match the shared image shader's default UV flip.
5. Create a WGPU texture/view.
6. Upload pixels with `queue.writeTexture`.
7. Create a shared sampler if needed.
8. Create an image bind group through `gpu/images.zig`.

Broken sources get a negative-cache entry so the engine does not retry decode
every frame.

Set `REACTJIT_VERBOSE_IMAGE_CACHE=1` to log image loads, dimensions, format,
and row-flip diagnostics.

## Image Paint

`framework/engine.zig:paintNodeVisuals()` paints an image after background and
before border:

```zig
if (node.image_src) |src| {
    image_cache.queueQuad(src, r.x, r.y, r.w, r.h, g_paint_opacity);
}
```

That ordering means a rounded/padded image container can show its background
behind the image, and a border can frame the image on top.

`image_cache.queueQuad()` loads or finds the cache entry, then calls:

```zig
images.queueQuad(x, y, w, h, opacity, bind_group);
```

If decode fails, the image paints nothing. The node still participates in
layout and hit testing according to its computed rect.

## GPU Image Quad Pipeline

`framework/gpu/images.zig` is the shared textured-quad pipeline for:

| Producer | Example |
|---|---|
| Images | `<Image source="...">` |
| Videos | `framework/videos.zig` |
| Render surfaces | `RenderTarget`, captured app feeds |
| StaticSurface / Filter | cached or filtered subtrees |
| Blend2D/Vello/effect fill paths | rasterized vector/effect textures |
| Scene3D | offscreen 3D view composited into 2D layout |

The queue limit is:

```zig
pub const MAX_IMAGE_QUADS = 2048;
```

Each queued quad stores:

```zig
pos_x, pos_y, size_w, size_h, opacity, no_flip_y
```

`queueQuad()` records image boundaries before and after the quad. Those
boundaries let the main renderer preserve ordering when images interleave with
text, rects, clipping, z-index, or StaticSurface capture ranges.

The image shader binds:

| Binding | Resource |
|---|---|
| `0` | globals uniform with screen size. |
| `1` | `texture_2d<f32>`. |
| `2` | sampler. |

Each image quad is one draw call because each quad may have a different bind
group/texture.

Per-frame lifecycle:

1. `images.queueQuad(...)` appends quads during paint.
2. `gpu.frame(...)` uploads image quad data every frame when any image quad is
   queued.
3. The main render pass calls `images.drawBatch(...)` by scissor/order segment.
4. `images.reset()` clears only the per-frame quad queue. Decoded image cache
   entries remain.

## Icon Component Pipeline

`runtime/icons/icons.ts` contains generated Lucide path data:

```ts
export const Activity: number[][] = [
  [22, 12, 19.52, 12, ...],
  ...
];
```

The icon data format is:

```ts
type IconData = number[][];
```

Each inner array is one flat polyline:

```text
[x0, y0, x1, y1, x2, y2, ...]
```

The component resolves path data in `runtime/icons/Icon.tsx`:

1. If `props.icon` exists, use it directly.
2. Otherwise, if `props.name` exists, call `lookupIcon(name)`.
3. Simplify each polyline with a Douglas-Peucker style pass.
4. Cache simplified direct icons in a `WeakMap`.
5. Cache simplified named icons in a `Map`.
6. Convert each polyline to SVG path data.
7. Render a fixed-size `Box` containing a `Graph`.
8. Render each polyline as a `Graph.Path`.

Rendered shape:

```tsx
<Box style={{ width: size, height: size, overflow: 'hidden' }}>
  <Graph
    style={{ width: size, height: size }}
    viewX={0}
    viewY={0}
    viewZoom={size / 24}
  >
    <Graph.Path d="M -2,-4 L ..." stroke={color} strokeWidth={strokeWidth} fill="none" />
  </Graph>
</Box>
```

Icon coordinates are centered by subtracting `12` from every source point.
The `Graph` viewport uses `viewZoom = size / 24`, so the original 24x24 Lucide
viewbox scales to the requested pixel size.

If no icon resolves, `Icon` renders an empty `Box` with the requested size.

## Icon Registry

`runtime/icons/registry.ts` exists only for string-name lookup.

API:

```ts
function registerIcon(name: string, paths: number[][]): void;
function registerIcons(icons: Record<string, number[][]>): void;
function lookupIcon(name: string): number[][] | undefined;
function getRegisteredIconNames(): string[];
function getAllResolvableNames(): string[];
function getAliasesForName(name: string): string[];
```

Lookup order:

1. Exact registered name.
2. Case-insensitive registered name.
3. PascalCase conversion, so `"arrow-down"` can resolve to `"ArrowDown"`.
4. Semantic alias table, such as `"x" -> "X"` and `"settings" -> "Settings"`.

The registry deliberately does not auto-register `runtime/icons/icons.ts`.
Auto-registration would force the full icon pack into every bundle. Direct
usage is the preferred tree-shakable form:

```tsx
import { Search } from '@reactjit/runtime/icons/icons';

<Icon icon={Search} />
```

## Icon Native Paint Path

Because `Icon` renders `Graph.Path`, its native pipeline is the Graph/path
pipeline, not the image cache.

For each icon path:

1. React creates `View`, `Graph`, and `Graph.Path` host nodes.
2. `v8_app.zig` marks `Graph` as a graph container and `Graph.Path` as a
   canvas/path node.
3. `applyProps()` decodes `d`, `stroke`, `strokeWidth`, `fill`, and related path
   props.
4. `framework/engine.zig` paints the `Graph` with a graph transform.
5. `paintCanvasPath()` parses the SVG path data through `framework/svg_path.zig`.
6. Stroke paint calls `svg_path.drawStrokeCurves(...)`.
7. GPU-native curve/capsule primitives are queued.

This makes `Icon` recolorable and scalable without bitmap decode, but it is
not a textured image quad. Large grids of icons stress SVG path parsing and
curve paint, not `image_cache`.

## Image-Backed Icons

Some app icons are intentionally image-backed. Example:

```tsx
import { PROVIDER_ICONS } from './providerIcons.generated';

<Image source={PROVIDER_ICONS.openai} style={{ width: 18, height: 18 }} />
```

`cart/app/gallery/components/model-card/providerIcons.generated.ts` stores
provider logos as `data:image/png;base64,...`. Its header notes they are
rasterized from `@lobehub/icons-static-svg` to 128px PNG via ImageMagick.

That pipeline is:

```text
SVG source asset -> generated PNG data URL -> <Image source> -> image_cache -> GPU image quad
```

Use this path for brand/logo artwork that should preserve its original fill
colors or raster detail. Use `Icon` for UI glyphs that should inherit theme
colors and scale as vector strokes.

## File Map

Image files:

| File | Role |
|---|---|
| `runtime/primitives.tsx` | Exports `Image`. |
| `renderer/hostConfig.ts` | Remaps `<img src>` to `Image` + `source`; emits mutations. |
| `runtime/host_props.ts` | Documents `source` as the image prop. |
| `v8_app.zig` | Decodes/removes `source` into `layout.Node.image_src`. |
| `framework/layout.zig` | Stores `image_src` and asks `measureImageFn` for intrinsic size. |
| `framework/engine.zig` | Installs image measurement callback and queues image paint. |
| `framework/image_cache.zig` | Reads/decodes/caches image sources and creates texture bind groups. |
| `framework/gpu/images.zig` | Queues/uploads/draws textured image quads. |
| `framework/gpu/shaders.zig` | Defines the image WGSL shader. |

Icon files:

| File | Role |
|---|---|
| `runtime/icons/icons.ts` | Generated Lucide polyline data, named exports. |
| `runtime/icons/Icon.tsx` | JS component that renders `Box -> Graph -> Graph.Path`. |
| `runtime/icons/registry.ts` | Optional string-name registry and aliases. |
| `framework/ambient_primitives.ts` | Exposes `Image` globally, but not `Icon`. |
| `docs/v8/graph.md` | Documents the Graph/Path pipeline used by `Icon`. |
| `docs/v8/glyph.md` | Documents the separate inline text glyph pipeline. |

Representative app uses:

| File | Usage |
|---|---|
| `cart/app/gallery/components/model-card/ProviderIcon.tsx` | Uses `Image` for provider logo data URLs, falls back to vector `Icon`. |
| `cart/opacity_test.tsx` | Separately stress-tests PNG data URL images and Lucide `Icon`. |
| `cart/app/gallery/components/icon-catalog/IconCatalog.tsx` | Renders named icons through the registry path. |
| `cart/app/sweatshop/start/page.tsx` | Direct tree-shakable `Icon icon={...}` usage. |

## Review Notes

Current sharp edges found while tracing:

1. `Icon` is not a primitive and is not ambient-exported. Import it from
   `@reactjit/runtime/icons/Icon`.
2. `<Image>` uses `source`, while lowercase `<img>` uses browser-like `src`
   only because `hostConfig` rewrites `src` to `source`.
3. `<Image>` does not fetch HTTP URLs. Fetch or generate the image elsewhere,
   then pass a local path or base64 data URL.
4. SVG is not currently an `<Image>` decode path. Existing `data:image/svg+xml`
   examples rely on behavior that `framework/image_cache.zig` does not provide.
   Use `Graph.Path` / `Icon`, or rasterize to PNG first.
5. Image cache identity is `Wyhash(source)` plus source length. The full source
   bytes are not retained for collision checking.
6. Image cache entries are not evicted; the decoded image cache has 256 slots.
   Dynamic one-off data URLs can exhaust it.
7. Failed image sources are negatively cached. Fixing a file at the same source
   path in the same process may still hit the failed entry until restart or
   source-key change.
8. Icon named lookup only sees registered icons. Importing `icons.ts` exports
   does not automatically populate the registry.
9. `Icon` simplifies polylines before rendering. This reduces paint cost but
   means it is not a byte-for-byte renderer for original Lucide SVG paths.
