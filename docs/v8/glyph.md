# V8 Glyph Pipeline

Last updated: 2026-05-04

This document traces every live glyph-related path in the V8 runtime:

- normal text glyphs: FreeType glyph rasterization into the GPU text atlas.
- inline SVG glyphs: icon-like shapes embedded inside `<Text>` by sentinel
  slots and the `inlineGlyphs` prop.
- legacy/adjacent TSZ `<Glyph>` and `<name glyph>` compiler syntax, which
  compiles to the same inline glyph runtime shape but is not the V8 JSX API.

## Terminology

The codebase uses "glyph" for two related but different systems:

| Name | Meaning | Live V8 API |
| --- | --- | --- |
| Font glyph | A rasterized codepoint from a FreeType face, packed into the text atlas and drawn as a `GlyphInstance`. | Any `<Text>hello</Text>` string. |
| Inline glyph | A vector SVG path inserted into text flow, occupying a square slot where the text contains `\x01`. | `<Text inlineGlyphs={[...]}>{GLYPH_SLOT}</Text>` |
| TSZ `<Glyph>` | Legacy/compiler syntax parsed inside `<Text>` and lowered to sentinel text plus `InlineGlyph`. | Not a React/V8 host primitive. |
| TSZ `<name glyph>` | Legacy named glyph registry block used by TSZ shortcodes like `:warning:`. | Not part of V8 JSX runtime. |

There is currently no first-class V8 host element named `<glyph>` or
`<Glyph>`. Unknown JSX host types pass through the reconciler, but the Zig V8
host does not give them glyph semantics. In V8 carts, use `GLYPH_SLOT` and
`inlineGlyphs`.

## Source Map

| Layer | Files | Role |
| --- | --- | --- |
| Public V8 API | `runtime/primitives.tsx`, `runtime/host_props.ts` | Exports `GLYPH_SLOT`; documents `inlineGlyphs` and `textEffect`. |
| React host bridge | `renderer/hostConfig.ts` | Emits `CREATE`, `CREATE_TEXT`, `UPDATE`, `UPDATE_TEXT` mutation commands. |
| V8 command decoder | `v8_app.zig` | Stores text, typography, `inlineGlyphs`, and frees glyph allocations on change/remove. |
| Layout model | `framework/layout.zig` | Defines `InlineGlyph`, `InlineSlot`, node text/typography fields, and measurement callback type. |
| Text measurement | `framework/text.zig`, `framework/layout.zig` | Treats glyph sentinels as `fontSize x fontSize` inline boxes. |
| Paint orchestration | `framework/engine.zig` | Draws text, records inline slots, then paints inline SVG glyph paths. |
| GPU text atlas | `framework/gpu/text.zig`, `framework/gpu/shaders.zig` | Rasterizes FreeType glyphs, queues `GlyphInstance`s, uploads/draws instanced text quads. |
| SVG path fill/stroke | `framework/svg_path.zig` | Parses and paints inline glyph path fills/strokes/effect fills. |
| Effects | `framework/effects.zig`, `docs/v8/effects.md` | Supplies named CPU effect pixel buffers for `textEffect` and inline glyph `fillEffect`. |
| Telemetry | `framework/telemetry.zig`, `framework/v8_bindings_telemetry.zig` | Exposes glyph queue and atlas counts. |
| Legacy TSZ compiler | `tsz/compiler/smith/**`, `manifest/*.glyphs.tsz` | Parses `<Glyph>`, `<name glyph>`, and shortcodes into `inline_glyphs`. Read-only reference path. |

## Public V8 API

### `GLYPH_SLOT`

`runtime/primitives.tsx` exports:

```ts
export const GLYPH_SLOT = '\x01';
```

That byte is SOH (`0x01`). In a text string it reserves one square inline slot.
The slot's width and height are the node's `fontSize`.

Example:

```tsx
import { GLYPH_SLOT, Text } from '@reactjit/runtime/primitives';

const CHECK = 'M2 8 L6 12 L14 3';

export function StatusLine() {
  return (
    <Text
      style={{ fontSize: 14, color: '#e8eef7' }}
      inlineGlyphs={[{
        d: CHECK,
        stroke: '#22c55e',
        strokeWidth: 2,
        fill: 'transparent',
      }]}
    >
      {GLYPH_SLOT} ready
    </Text>
  );
}
```

The i-th sentinel slot paints the i-th `inlineGlyphs` entry. Extra sentinels
without matching glyph descriptors reserve space but paint no vector glyph.
Extra descriptors without matching sentinels are ignored.

### `inlineGlyphs`

`runtime/host_props.ts` documents the accepted shape:

```ts
inlineGlyphs: Array<{
  d: string;
  fill?: string;
  fillEffect?: string;
  stroke?: string;
  strokeWidth?: number;
  scale?: number;
}>;
```

Fields:

| Field | Type | Default | Runtime destination |
| --- | --- | --- | --- |
| `d` | SVG path string | `""` | `layout.InlineGlyph.d` |
| `fill` | color string | white | `layout.InlineGlyph.fill` |
| `fillEffect` | named effect | none | `layout.InlineGlyph.fill_effect` |
| `stroke` | color string | transparent | `layout.InlineGlyph.stroke` |
| `strokeWidth` | number | `0` | `layout.InlineGlyph.stroke_width` |
| `scale` | number | `1.0` | `layout.InlineGlyph.scale` |

Only SVG path data is accepted at runtime. Named shapes, layers, boolean ops,
and `currentColor` from `manifest/*.glyphs.tsz` are compiler-era concepts, not
implemented in the V8 `inlineGlyphs` decoder.

### `textEffect`

Any text node can set:

```tsx
<Text textEffect="plasma">Effect colored text</Text>
```

`textEffect` affects normal font glyphs. During text paint,
`drawNodeTextCommon` looks up the named effect fill and calls
`gpu.setTextEffect`. `framework/gpu/text.zig` samples that pixel buffer at each
font glyph's screen-space center and uses the sampled RGB instead of the text
color. Alpha still comes from the text color and global paint opacity.

Inline glyphs use their own `fillEffect` field rather than `textEffect`.

## End-To-End V8 Inline Glyph Flow

1. Cart code renders `<Text inlineGlyphs={[...]}>{GLYPH_SLOT} label</Text>`.
2. `runtime/primitives.tsx` creates a normal host `Text` element. It does not
   synthesize a glyph child; `GLYPH_SLOT` is just a string byte.
3. React creates a host `Text` instance and a child text instance for the string.
4. `renderer/hostConfig.ts` emits:

```text
{ op: 'CREATE', id, type: 'Text', props: { inlineGlyphs, style/font props } }
{ op: 'CREATE_TEXT', id, text: '\x01 label' }
{ op: 'APPEND', parentId: textNodeId, childId: textInstanceId }
```

5. `flushToHost` coalesces updates, JSON stringifies the command batch, and
   calls `__hostFlush`.
6. `v8_app.zig` decodes `CREATE`, applies type defaults, applies props, and
   calls `applyInlineGlyphs` for the `inlineGlyphs` prop.
7. `CREATE_TEXT` stores the string on a separate Zig node.
8. `APPEND` records the parent-child edge and calls `inheritTypography`, so the
   bare text child receives the parent `fontSize`, `fontFamily`, `fontWeight`,
   `letterSpacing`, `lineHeight`, `numberOfLines`, `noWrap`, and color.
9. Layout materializes the node tree and calls the text measurement callback.
10. `framework/text.zig` sees the sentinel byte and measures it as a square
    `fontSize` advance.
11. During paint, `drawNodeTextCommon` calls `TextEngine.drawTextWrappedRGBA`.
12. `framework/gpu/text.zig` sees the same sentinel byte. Instead of queuing a
    FreeType glyph, it records an `InlineSlot` at the current pen position,
    advances the pen by `fontSize`, and continues drawing the rest of the text.
13. After the text draw returns, `drawNodeTextCommon` calls
    `paintInlineGlyphs`.
14. `paintInlineGlyphs` matches recorded slots to `node.inline_glyphs`, parses
    each SVG path, scales it into the slot, and queues fill/stroke geometry
    through `svg_path.zig`.
15. The GPU frame upload/draw path renders text atlas glyphs and vector glyph
    fills/strokes in the same primitive batching system as the rest of paint.

## React Host Bridge

### Creation

`renderer/hostConfig.ts` maps HTML text tags such as `span`, `p`, `h1`, and
`code` to host `Text`, but it does not map `glyph` or `Glyph`.

For text:

- `createInstance` emits `CREATE` for the host node.
- `createTextInstance` emits `CREATE_TEXT`.
- `appendInitialChild` / `appendChild` emit `APPEND`.

For updates:

- `prepareUpdate` diffs top-level props and style props.
- `commitUpdate` emits `UPDATE` when props changed.
- `commitTextUpdate` emits `UPDATE_TEXT`.

`inlineGlyphs` is a top-level non-style prop. It travels in `props` exactly as
the cart provided it.

### Text Flattening

The `Text` primitive flattens adjacent string/number children and nested
Text-like children into fewer string runs. `GLYPH_SLOT` participates as a normal
string character. Non-text children remain normal block siblings; they are not
inline glyphs.

## V8 Host Decoder

### Typography

`v8_app.zig` accepts typography props at top level and inside `style`:

| Prop | Zig field |
| --- | --- |
| `fontSize` | `node.font_size` |
| `fontFamily` | `node.font_family_id` |
| `fontWeight` | `node.font_weight` |
| `color` | `node.text_color` |
| `letterSpacing` | `node.letter_spacing` |
| `lineHeight` | `node.line_height` |
| `numberOfLines` | `node.number_of_lines` |
| `noWrap` | `node.no_wrap` |
| `textEffect` | `node.text_effect` |
| `inlineGlyphs` | `node.inline_glyphs` |

`fontFamilyIdFor` maps common names to small ids:

| Family id | Names |
| --- | --- |
| `0` | default face |
| `1` | `sans-serif`, `DejaVu Sans` |
| `2` | `serif`, Times/Roman |
| `3` | `monospace`, Mono/Courier |
| `4` | Noto |
| `5` | Arial, Helvetica, Liberation Sans |
| `6` | Segoe, Ubuntu, SF Pro, Inter |
| `7` | Roboto, Quicksand |

### Inline Glyph Allocation

`applyInlineGlyphs(node, val)`:

1. Uses `node.scroll_persist_slot` as the stable node id key.
2. Calls `clearInlineGlyphs(node_id)` to free any previous allocation.
3. Rejects non-array or empty arrays and sets `node.inline_glyphs = null`.
4. Allocates:
   - `[]layout.InlineGlyph`
   - owned `d` strings
   - owned `fillEffect` strings
5. Parses object fields:
   - `d`
   - `fill`
   - `fillEffect`
   - `stroke`
   - `strokeWidth`
   - `scale`
6. Stores the allocation in `g_inline_glyphs_by_node`.
7. Points `node.inline_glyphs` at the owned glyph slice.

`clearInlineGlyphs` frees all owned path/effect strings and the glyph slice when
the prop changes or the node is destroyed.

### Text Child Typography Inheritance

React represents:

```tsx
<Text fontSize={17}>Hello</Text>
```

as a host `Text` node plus a child text instance. `inheritTypography` copies the
parent typography fields onto the child when the child is appended and again
when the parent updates. This is why a sentinel inside a text child measures and
paints with the parent `fontSize`.

## Layout Model

`framework/layout.zig` defines:

```zig
pub const InlineGlyph = struct {
    d: []const u8,
    fill: Color = Color.rgb(255, 255, 255),
    fill_effect: ?[]const u8 = null,
    stroke: Color = Color.rgba(0, 0, 0, 0),
    stroke_width: f32 = 0,
    scale: f32 = 1.0,
};

pub const InlineSlot = struct {
    x: f32 = 0,
    y: f32 = 0,
    size: f32 = 0,
    glyph_index: u8 = 0,
};
```

Node fields:

```zig
text: ?[]const u8 = null,
font_size: u16 = 16,
font_family_id: u8 = 0,
font_weight: u16 = 400,
text_color: ?Color = null,
letter_spacing: f32 = 0,
line_height: f32 = 0,
text_effect: ?[]const u8 = null,
inline_glyphs: ?[]const InlineGlyph = null,
inline_slots: [MAX_INLINE_SLOTS]InlineSlot,
inline_slot_count: u8 = 0,
```

`MAX_INLINE_SLOTS` is `8`. `framework/gpu/text.zig` mirrors this as
`MAX_RECORDED_SLOTS`, so only the first eight inline glyph slots in a single
text draw are recorded.

## Measurement

`framework/engine.zig` installs:

```zig
layout.setMeasureFn(measureCallback);
```

`measureCallback`:

1. Sets the active GPU font family for measurement.
2. Sets bold mode when `font_weight >= 600`.
3. Calls `TextEngine.measureTextWrappedEx`.
4. Restores font family and bold state.

`framework/text.zig` contains the sentinel recognizer:

```zig
fn inlineGlyphSentinelLen(text: []const u8, i: usize) usize
```

It accepts several encodings:

| Encoding in stored text | Bytes consumed |
| --- | --- |
| raw SOH byte `0x01` | `1` |
| escaped `\\1` form | `3` |
| escaped `\\x01` form | `5` |
| single-backslash `\1` form | `2` |
| single-backslash `\x01` form | `4` |

Measurement treats each sentinel as one character whose width is `fontSize`.
This happens in:

- word wrapping
- line width measurement
- min-content width
- truncation

Letter spacing applies around sentinels the same way it applies around regular
characters.

## Normal Font Glyph Pipeline

Normal text characters flow through the FreeType atlas path.

### Startup

`framework/engine.zig` initializes text after GPU init:

1. Try DejaVu Sans on Linux.
2. Try Arial on macOS.
3. Try Segoe UI on Windows.
4. Create `TextEngine`.
5. Call `gpu.initText(te.library, te.face, te.fallback_faces, te.fallback_count)`.
6. Register a bold face if one loaded.
7. Set `layout.setMeasureFn(measureCallback)`.

`TextEngine.initHeadless` also loads fallback faces when present:

- Noto CJK
- Noto Color Emoji
- Noto Sans Symbols 2
- WenQuanYi Zen Hei
- Arial Unicode
- Apple Color Emoji
- Courier New

### GPU Text State

`framework/gpu/text.zig` owns:

```zig
pub const MAX_GLYPHS = 131072;
const ATLAS_SIZE = 2048;
const MAX_ATLAS_GLYPHS = 2048;
```

Important state:

- `g_atlas_texture`, `g_atlas_view`, `g_atlas_sampler`
- `g_text_buffer`
- `g_text_bind_group`
- `g_glyphs: [MAX_GLYPHS]GlyphInstance`
- `g_glyph_count`
- `g_atlas_keys`, `g_atlas_vals`, `g_atlas_index`
- font family and bold face slots

### Atlas Cache

`cacheGlyph(codepoint, size_px)`:

1. Chooses the active regular/bold face.
2. Builds a packed key from codepoint, size, and font id.
3. Checks the hash map and fallback linear cache.
4. If the active face lacks the codepoint, scans fallback faces.
5. Calls `FT_Load_Char(..., FT_LOAD_RENDER)`.
6. Packs the grayscale bitmap into a row-based `2048 x 2048` RGBA atlas.
7. Uploads the glyph bitmap with `queue.writeTexture`.
8. Stores UVs, bearing, advance, width, and height in `AtlasGlyphInfo`.

The atlas stores white RGB plus glyph alpha. Tinting happens in the text shader.

### Queueing Glyph Instances

`drawTextLine` walks UTF-8 text:

- For sentinel bytes, it records inline slots and advances by `fontSize`.
- For newline, it skips drawing.
- For normal codepoints, it calls `cacheGlyph`.
- If the glyph bitmap has dimensions and the per-frame queue has capacity, it
  appends a `GlyphInstance`.

`GlyphInstance` contains:

- screen position
- screen size
- atlas UV rectangle
- color RGBA
- optional CSS transform matrix

Canvas transforms and node CSS transforms affect the effective atlas render
size so scaled text remains crisp. Node transforms are carried in the instance
matrix and applied in the text vertex shader.

### Shader

`framework/gpu/shaders.zig` defines `text_wgsl`.

The vertex shader expands each instance into six vertices, applies the optional
2D affine matrix, and converts screen pixels to clip coordinates.

The fragment shader samples the atlas alpha:

```wgsl
let atlas_sample = textureSample(atlas_tex, atlas_sampler, in.uv);
let alpha = atlas_sample.a * in.color.a;
let rgb = in.color.rgb * alpha;
return vec4f(rgb, alpha);
```

The text pipeline uses premultiplied alpha blending.

### Upload And Draw

On each frame, `framework/gpu/gpu.zig` uploads primitive buffers:

```zig
rects.upload(queue);
text.upload(queue);
curves.upload(queue);
capsules.upload(queue);
polys.upload(queue);
```

Then it draws by primitive type inside each scissor segment:

```text
rects -> text -> curves -> capsules -> polys -> images
```

Text is drawn by `drawTextSkipping`, which calls `framework/gpu/text.zig`
`drawBatch(start, end)`.

At the end of the frame, `text.reset()` saves the last glyph count for telemetry
and clears the per-frame queue. The atlas persists across frames.

## Inline SVG Glyph Paint

Inline glyphs are not atlas glyphs. They are vector paths painted after text has
recorded their slots.

`drawNodeTextCommon`:

1. Computes final text alpha from color alpha and paint opacity.
2. Calls `gpu.resetInlineSlots()`.
3. Enables `textEffect` if present.
4. Applies line height, letter spacing, font family, and bold state.
5. Calls `TextEngine.drawTextWrappedRGBA`.
6. Restores line height, letter spacing, bold, and font family state.
7. Calls `paintInlineGlyphs(node.inline_glyphs, node.font_size)`.
8. Clears text effect.
9. Paints underline for `href`.

`framework/gpu/text.zig` records inline slots while walking text:

```zig
g_inline_slots[g_inline_slot_count] = .{
    .x = pen_x,
    .y = start_y,
    .size = slot_size,
    .glyph_index = g_inline_slot_count,
};
```

`paintInlineGlyphs`:

1. Reads `gpu.getInlineSlotCount()` and `gpu.getInlineSlots()`.
2. Iterates while `slot index < slot_count` and `< glyphs.len`.
3. Computes `slot_size = slot.size * glyph.scale`.
4. Parses `glyph.d` through `svg_path.parsePath`.
5. Computes the path bounding box.
6. Scales the path uniformly to fit the slot.
7. Centers the path in the slot.
8. Sets a temporary GPU transform.
9. Fills using either:
   - `svg_path.drawFillFromEffect` if `glyph.fill_effect` resolves.
   - `svg_path.drawFill` with the flat fill color.
10. Strokes with `svg_path.drawStrokeCurves` when `strokeWidth > 0` and stroke
    alpha is nonzero.
11. Resets the GPU transform.

Inline glyph `fillEffect` samples the named effect directly through
`svg_path.drawFillFromEffect`. It deliberately avoids the Blend2D shared surface
path because that shared surface can be overwritten between inline glyph paints.

## Legacy TSZ `<Glyph>` And `<name glyph>` Paths

These files live under `tsz/` and `archive/`, which are read-only in this repo.
They are useful for understanding the historical `<glyph>` syntax, but they are
not the current V8 JSX runtime API.

### Inline `<Glyph>`

`tsz/compiler/smith/parse/children/inline_glyph.js` parses inline:

```tsx
<Text>
  Save <Glyph d="M..." fill="#fff" stroke="#000" strokeWidth={1} scale={1} />
</Text>
```

Supported attributes:

- `d`
- `fill`
- `fillEffect`
- `stroke`
- `strokeWidth`
- `scale`

It returns:

```js
{
  nodeExpr: '.{ .text = "\\x01" }',
  isGlyph: true,
  glyphExpr,
  glyphData
}
```

`tsz/compiler/smith/parse/build_node.js` then combines mixed text and glyph
children into:

```zig
.text = "Save \\x01"
.inline_glyphs = &[_]layout.InlineGlyph{ ... }
```

So the legacy `<Glyph>` path lowers to the same runtime model: sentinel text
plus `InlineGlyph` descriptors.

### Named `<name glyph>` Blocks

`tsz/compiler/smith/collect/classifiers.js` scans classifier/glyph files for:

```text
<check glyph>
  d is "M..."
  fill is "#ffffff"
</check>
```

It stores definitions in `ctx._glyphRegistry`.

`tsz/compiler/smith/parse/children/text.js` resolves shortcodes:

```text
Status :check: ok
Status :star[plasma]: ok
```

Resolved shortcodes produce a sentinel text node plus glyph data. Unknown
shortcodes stay text and log a hint.

`manifest/s00c_manifest.glyphs.tsz` is a named-glyph design manifest with
concepts such as `shape`, `layers`, `clip`, `subtract`, `currentColor`, and
named effect fills. Those higher-level shape concepts are not decoded by the
live V8 `inlineGlyphs` prop today.

### Lua Map Emit

`tsz/compiler/smith/emit_atoms/maps_lua/lua_map_node.js` serializes
`inline_glyphs` into Lua node fields and emits sentinel text when the node has
glyphs but no explicit text. This is another compiler-era route into the same
shape: text sentinel plus inline glyph descriptor list.

## Effects Integration

There are two effect entry points:

| API | Applies to | Runtime path |
| --- | --- | --- |
| `textEffect="name"` | normal FreeType glyphs in a text node | `drawNodeTextCommon` -> `gpu.setTextEffect` -> per-font-glyph RGB sample |
| `inlineGlyphs={[{ fillEffect: 'name' }]}` | inline SVG glyph fill | `paintInlineGlyphs` -> `effects.getEffectFill` -> `svg_path.drawFillFromEffect` |

Effect fills used by glyphs must be named CPU effect fills. See
`docs/v8/effects.md`.

## Telemetry And Diagnostics

GPU telemetry exposes:

| Field | Meaning |
| --- | --- |
| `glyph_count` | Last frame's queued font glyph instances. |
| `glyph_capacity` | `framework/gpu/text.zig` `MAX_GLYPHS` (`131072`). |
| `atlas_glyph_count` | Number of cached atlas glyph entries. |
| `atlas_capacity` | `MAX_ATLAS_GLYPHS` (`2048`). |
| `atlas_row_x` | Currently reported as `0` in telemetry. |
| `atlas_row_y` | Current atlas row y position. |

Inline SVG glyphs are not counted as `glyph_count`. They become curve/polygon
work through `svg_path.zig`, depending on the path fill/stroke.

Witness/snapshot code strips or flags unresolved glyph placeholder bytes. A text
node that still contains visible `\x01`, `\\1`, or `\\x01` data without a
painted glyph is treated as a failure signal in that path.

## Limits And Edge Cases

### No V8 `<Glyph>` Element

The supported V8 API is `GLYPH_SLOT` plus `inlineGlyphs`. A literal `<Glyph />`
in a V8 React cart is just an unknown host type unless a user component named
`Glyph` handles it.

### Slot Limit

Only `MAX_INLINE_SLOTS == 8` inline slots are recorded per text draw. Additional
sentinels still affect measurement/advance, but inline SVG glyph painting stops
after the recorded slots.

### Descriptor/Slot Mismatch

Painting uses `min(recorded slot count, inlineGlyphs.length)`.

- Missing descriptor: reserved empty space.
- Missing sentinel: descriptor ignored.

### `currentColor` Is Not Live In V8 Inline Glyphs

`applyInlineGlyphs` parses `fill` and `stroke` with `parseColor`. If a value is
not a parseable color string, the default remains. The TSZ manifest's
`currentColor` convention is not implemented by the V8 prop decoder.

### Named Shapes Are Not Live In V8 Inline Glyphs

`shape`, `layers`, `clip`, and `subtract` from `.glyphs.tsz` manifests do not
cross into the V8 runtime. Runtime glyphs need raw SVG path data in `d`.

### Font Atlas Capacity

The font atlas holds up to `2048` distinct `(codepoint, size, font id)` entries.
After that, uncached glyphs fail to queue. Existing cached glyphs continue to
draw.

### Per-Frame Glyph Capacity

The font glyph instance queue holds `131072` entries per frame. Once full, later
font glyphs are silently skipped.

### Large Glyph Bitmaps

`uploadGlyphToAtlas` uses a stack RGBA buffer sized for up to `256 x 256`
glyphs. Larger rasterized glyph bitmaps are skipped.

### Text And Paint Ordering

Font glyphs are part of the text batch. Inline SVG glyphs queue curve/polygon
work after text slot recording. Final draw order is still governed by the GPU
primitive batching and scissor segment boundaries described in `docs/v8/paint.md`.

## Change Checklist

When changing glyph behavior, verify all of these stay aligned:

1. Sentinel recognition in `framework/text.zig`.
2. Sentinel recognition in `framework/gpu/text.zig`.
3. Measurement width/word-wrap/truncation behavior.
4. `drawTextLine` slot recording and pen advancement.
5. `paintInlineGlyphs` slot-to-descriptor matching.
6. `v8_app.zig` allocation/free behavior for `inlineGlyphs`.
7. Host prop docs in `runtime/host_props.ts`.
8. Telemetry expectations if glyph queues or atlas limits change.

The most important invariant is that measurement and paint must treat each
sentinel with the same width. If one side changes and the other does not, inline
glyphs will wrap, truncate, select, and paint at different positions.
