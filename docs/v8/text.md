# V8 Text and font pipeline

Last updated: 2026-05-04.

This document traces text and fonts end to end in the V8 runtime. Text is not
browser text: there is no DOM layout engine, no CSS font cascade, no HarfBuzz
shaping, and no browser font fallback. React emits host mutations; Zig stores
text on `layout.Node`, measures it with FreeType-backed helpers, queues glyphs
into a wgpu atlas pipeline, and paints instanced textured quads.

For inline SVG glyph slots inside text, see `docs/v8/glyph.md`. This document
covers normal font glyphs and the text/font surface they share.

## Mental model

```text
<Text>Hello</Text>
  -> runtime/primitives.tsx Text wrapper
  -> renderer/hostConfig.ts CREATE for host Text
  -> renderer/hostConfig.ts CREATE_TEXT for string child
  -> v8_app.zig stores node.text and inherited typography
  -> framework/layout.zig asks measureCallback(...)
  -> framework/text.zig wraps/measures with FreeType advances
  -> engine.zig drawNodeTextCommon(...)
  -> framework/gpu/text.zig caches glyphs in an atlas
  -> gpu frame uploads GlyphInstance batch
  -> text WGSL samples the atlas and composites glyph quads
```

The important invariant is that layout measurement and paint both route through
`TextEngine` wrapping logic. Glyph advances come from `framework/gpu/text.zig`,
so the same FreeType face, size, family, and bold state drive measurement and
paint.

## Public TSX surface

`runtime/primitives.tsx` exposes:

```tsx
import { Text } from '@reactjit/runtime/primitives';

<Text style={{ fontSize: 14, color: '#eef5ff' }}>Hello</Text>

// Shorthand accepted by the wrapper:
<Text size={12} bold>Caption</Text>
```

The wrapper emits a host node of type `"Text"`. It also flattens text children
before React creates host text instances:

- adjacent string/number children are coalesced into one text run.
- nested Text-like children are spliced inline as plain text.
- non-text child elements remain block siblings.

This is closer to React Native text behavior than browser inline layout.
Nested text loses its own inline styling in the current phase.

Lowercase `<text>` works through `runtime/jsx_shim.ts`:

```tsx
<text>Hello</text>
```

HTML-ish text tags are normalized in `renderer/hostConfig.ts`:

| JSX tag | Host type | Extra behavior |
| --- | --- | --- |
| `span`, `p`, `label`, `li`, `a` | `Text` | no browser inline layout |
| `h1`..`h6` | `Text` | heading `fontSize` plus bold style |
| `strong`, `b` | `Text` | bold style |
| `em`, `i`, `small`, `code`, `pre` | `Text` | no true italic/pre shaping; just host Text |

`className` is parsed by `runtime/tw.ts` and merged into `style` before host
mutation emission. Tailwind-like text utilities can set color, font size,
font weight, line height, letter spacing, and text alignment.

## Props

Live text props decoded by `v8_app.zig`:

| Prop | Storage | Notes |
| --- | --- | --- |
| `fontSize` | `node.font_size` | Integer, clamped to at least 1. Default 16. |
| `fontFamily` | `node.font_family_id` | CSS-ish family string mapped to a small runtime id. |
| `fontWeight` | `node.font_weight` | `bold`/`bolder` or numeric >= 600 selects bold. Default 400. |
| `color` | `node.text_color` | Parsed color. Default paint color is white for normal Text. |
| `letterSpacing` | `node.letter_spacing` | Pixels between glyphs. |
| `lineHeight` | `node.line_height` | Pixels. `0` means FreeType natural metrics. |
| `numberOfLines` | `node.number_of_lines` | `0` means unlimited. Clamps wrapped paint/measure. |
| `noWrap` | `node.no_wrap` | Single-line measure/paint path; width can be clamped by layout. |
| `textAlign` | `node.style.text_align` | `left`, `center`, `right`; `justify` parses but does not justify text. |
| `inlineGlyphs` | `node.inline_glyphs` | SVG slot descriptors; see `docs/v8/glyph.md`. |
| `textEffect` | `node.text_effect` | Named effect sampled per font glyph. |
| `href` | `node.href` | Text paints an underline; link opening is host behavior elsewhere. |

Input text props share the same font pipeline when painted:

| Input prop | Storage | Notes |
| --- | --- | --- |
| `value` | `node.text` plus input slot sync | Controlled text value. |
| `contentHandle` | `node.text` points to content store buffer | Avoids giant string prop round-trips. |
| `placeholder` | `node.placeholder` | Painted with dim placeholder color. |
| `paintText` | `node.input_paint_text` | Toggle input text painting. |
| `colorRows` | `node.input_color_rows` | Per-row colored spans for editor highlighting. |

Typography props are accepted both at the top level and inside `style`.

## React host mutations

`renderer/hostConfig.ts` always returns `false` from `shouldSetTextContent`, so
strings become separate React text instances instead of a `textContent` prop.

For this JSX:

```tsx
<Text style={{ fontSize: 17 }}>Hello</Text>
```

the reconciler emits a host element and a text instance:

```text
CREATE      id=<parent> type="Text" props={style:{fontSize:17}}
CREATE_TEXT id=<child>  text="Hello"
APPEND      parentId=<parent> childId=<child>
```

Text updates emit:

```text
UPDATE_TEXT id=<child> text="new text"
```

`v8_app.zig` stores `CREATE_TEXT` / `UPDATE_TEXT` payloads as `node.text`.
Because text content lives on the child text instance, `inheritTypography`
copies parent typography into bare text children on `APPEND`, `INSERT_BEFORE`,
and parent `UPDATE`:

- `font_size`
- `font_family_id`
- `font_weight`
- `text_color`
- `letter_spacing`
- `number_of_lines`
- `no_wrap`
- `line_height` when the parent explicitly set one

This is why changing `<Text fontSize={...}>` updates the child text instance
even though the string is stored on a separate host node.

## V8 prop decode

`v8_app.zig:applyProps` and `applyStyleEntry` decode typography into
`layout.Node`:

```zig
fontSize      -> node.font_size
fontFamily    -> node.font_family_id
fontWeight    -> node.font_weight
color         -> node.text_color
letterSpacing -> node.letter_spacing
lineHeight    -> node.line_height
numberOfLines -> node.number_of_lines
noWrap        -> node.no_wrap
textAlign     -> node.style.text_align
textEffect    -> node.text_effect
```

`fontFamilyIdFor` uses the first comma-separated family token, trims quotes and
spaces, lowercases it, then maps broad CSS family names to ids:

| Id | Matched names |
| --- | --- |
| `0` | default face |
| `1` | `sans-serif`, `DejaVu Sans` |
| `2` | `serif`, `Times`, `Roman` |
| `3` | `monospace`, `mono`, `Courier` |
| `4` | `Noto` |
| `5` | `Arial`, `Helvetica`, `Liberation Sans` |
| `6` | `Segoe`, `Ubuntu`, `SF Pro`, `Inter` |
| `7` | `Roboto`, `Quicksand` |

This is not a CSS font cascade. It is a small family-id selector for the native
font table loaded by `framework/gpu/text.zig`.

## Font initialization

`framework/engine.zig` initializes the text engine after GPU init:

```zig
var te = TextEngine.initHeadless("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf") catch
    TextEngine.initHeadless("/System/Library/Fonts/Supplemental/Arial.ttf") catch
    TextEngine.initHeadless("C:/Windows/Fonts/segoeui.ttf") catch
    return error.FontNotFound;

gpu.initText(te.library, te.face, te.fallback_faces, te.fallback_count);
if (te.face_bold != null) gpu.setBoldFace(te.face_bold);
g_text_engine = &te;
layout.setMeasureFn(measureCallback);
input.setMeasureWidthFn(measureWidthOnly);
```

`TextEngine.initHeadless` creates one FreeType library, loads a primary regular
face, probes a bold companion face, and loads fallback faces for CJK, emoji,
symbols, WQY, Arial Unicode, Apple Color Emoji, and Courier New when present.

`gpu.initText` creates the GPU text resources and loads additional family slots:

| Id | Regular candidates | Bold candidates |
| --- | --- | --- |
| `0` | engine primary face | engine bold face if found |
| `1` | DejaVu Sans, Liberation Sans, Nimbus Sans | matching bold |
| `2` | DejaVu Serif, Liberation Serif, Nimbus Roman | matching bold |
| `3` | DejaVu Sans Mono, Liberation Mono, Nimbus Mono | matching bold |
| `4` | Noto Sans, Noto Sans Display, Liberation Sans | matching bold |
| `5` | Liberation Sans, Nimbus Sans | matching bold |
| `6` | Ubuntu, UbuntuSans variable file | matching bold or same variable file |
| `7` | Roboto Condensed, Quicksand | matching bold |

If a requested family id was not loaded, `gpu.setFontFamily` falls back to id
0. If bold face is missing, bold text renders regular.

## Layout measurement

`framework/layout.zig` stores the measurement callback type:

```zig
pub const MeasureTextFn = *const fn (
    text: []const u8,
    font_size: u16,
    font_family_id: u8,
    max_width: f32,
    letter_spacing: f32,
    line_height: f32,
    max_lines: u16,
    no_wrap: bool,
    bold: bool,
) TextMetrics;
```

`layout.setMeasureFn(measureCallback)` wires this to `engine.zig`.

`layout.measureNodeTextW` caches text metrics in a direct-mapped
`TEXT_CACHE_SIZE = 1024` cache keyed by:

- text pointer and length
- font size
- font family id
- font weight
- max width
- letter spacing
- line height
- max lines
- no-wrap flag

The engine callback sets active font family and bold state in `gpu/text.zig`
before measuring, then calls:

```zig
TextEngine.measureTextWrappedEx(...)
```

That path:

1. Uses `measureTextEx` for unwrapped or `noWrap` text.
2. Uses `wordWrap` when `max_width > 0`.
3. Applies `numberOfLines`.
4. Uses FreeType line metrics unless `lineHeight` overrides them.
5. Adds `letterSpacing`.
6. Treats inline glyph sentinels as `fontSize x fontSize` boxes.
7. Adds the last glyph's right overhang so auto-sized boxes do not clip ink.
8. Stores a second `MCACHE_SIZE = 512` measurement cache inside `TextEngine`.

`wordWrap` is UTF-8 aware. Spaces delimit words, newlines force breaks, and
very wide words can fall back to character-level wrapping when overflow is
large enough. `MAX_WRAP_LINES = 256`.

## Paint path

Normal text paints in `engine.zig:paintNodeVisuals` after selection highlights
and before input text:

```zig
if (node.text) |t| {
    if (t.len > 0 and node.input_id == null) {
        _ = drawNodeTextCommon(node, t, x, y, max_w, node.number_of_lines, color);
    }
}
```

`drawNodeTextCommon` is the shared normal text path:

1. Multiplies text alpha by global paint opacity.
2. Resets recorded inline glyph slots.
3. Enables `textEffect` if a named effect fill exists.
4. Sets line-height override, letter spacing, font family, and bold state.
5. Uses `draw_width = 0` for `noWrap`; otherwise uses the content width.
6. Calls `TextEngine.drawTextWrappedRGBA`.
7. Resets line-height, letter-spacing, bold, and font-family state.
8. Paints inline SVG glyphs into recorded slots.
9. Clears text effect state.
10. Paints an underline when `href` is set.

`TextEngine.drawTextWrappedRGBA` calls the same wrapping algorithm used by
measurement and then calls `gpu_text.drawTextLine` for each visible line.

`textAlign` is applied in the `drawLineWrapped` helper path, but
`drawTextWrappedRGBA` currently draws wrapped lines at the supplied `x` without
alignment adjustment. In practice, normal V8 text currently behaves as left
aligned for the primary paint path even though `textAlign` is parsed and
inherited through layout.

## Glyph atlas and GPU draw

`framework/gpu/text.zig` owns:

- `MAX_GLYPHS = 131072` per-frame `GlyphInstance` records.
- a `2048 x 2048` RGBA8 glyph atlas texture.
- `MAX_ATLAS_GLYPHS = 2048` cached glyph entries.
- a FreeType face table and fallbacks.
- a wgpu instance buffer, bind group, and text render pipeline.

For each codepoint in a line, `drawTextLine`:

1. Decodes UTF-8, using U+FFFD for invalid sequences.
2. Records inline glyph slot positions for sentinel bytes.
3. Chooses render size from font size, active canvas transform scale, and CSS
   node transform scale so scaled text stays crisp.
4. Selects the active FreeType face from family id and bold state.
5. Calls `cacheGlyph(codepoint, render_size)`.
6. Appends a `GlyphInstance` with screen position, size, atlas UVs, color, and
   optional CSS affine transform matrix.
7. Advances the pen by FreeType advance plus letter spacing.

`cacheGlyph`:

1. Packs `(codepoint, size_px, font_id)` into the atlas cache key.
2. Checks `g_atlas_index`, then the linear cache arrays.
3. Uses the active face, or scans fallback faces when the glyph is missing.
4. Calls `FT_Load_Char(..., FT_LOAD_RENDER)`.
5. Packs the bitmap into the row-based atlas.
6. Converts FreeType grayscale bitmap to RGBA white with alpha.
7. Uploads the glyph rectangle with `queue.writeTexture`.
8. Stores UVs, bearings, advance, width, and height.

The text shader samples the atlas alpha and tints it with per-instance color:

```wgsl
let atlas_sample = textureSample(atlas_tex, atlas_sampler, in.uv);
let alpha = atlas_sample.a * in.color.a;
let rgb = in.color.rgb * alpha;
return vec4f(rgb, alpha);
```

`gpu.frame` uploads the glyph instance buffer once per frame with
`text.upload(queue)`, then draws text batches in primitive order. With no
scissor/order boundaries, the order is rects, text, curves, capsules, polygons,
images. With scissor segments, each segment draws the queued ranges for each
primitive type under that segment's scissor rect.

## Text effects and inline glyphs

`textEffect` colors normal font glyphs. `drawNodeTextCommon` looks up a named
effect fill, calls `gpu.setTextEffect`, and `gpu/text.zig` samples the effect
pixel buffer at each glyph center. The sampled RGB replaces the text color;
alpha still comes from text color and paint opacity.

Inline SVG glyphs are separate:

- text contains `GLYPH_SLOT` (`\x01`) sentinel bytes.
- `gpu/text.zig` records slot positions while drawing font text.
- `engine.zig:paintInlineGlyphs` reads slots and paints `inlineGlyphs` path
  descriptors with `svg_path`.
- inline glyph `fillEffect` uses the glyph descriptor's effect, not `textEffect`.

Only `MAX_INLINE_SLOTS = 8` slot positions are recorded per text draw.

## TextInput, TextArea, and TextEditor

Input nodes use the same font machinery but have extra input-state plumbing:

1. `applyTypeDefaults` allocates/registers an input slot for input host types.
2. `value` syncs into both `node.text` and `framework/input.zig`.
3. During paint, normal `node.text` painting is skipped for input nodes.
4. `paintTextInput` syncs controlled value, paints selection rects, placeholder,
   typed text, syntax-highlight rows, and cursor.

Single-line inputs are vertically centered using measured text height.
Multiline inputs wrap and cursor hit-testing use `TextEngine.byteToPosLH` and
`hitTestWrappedAlignedLH` so custom `lineHeight` stays aligned with paint.

`colorRows` bypasses normal text wrapping by painting precomputed per-row spans
through `gpu.drawColorTextRow`. This is used for editor-style syntax coloring.

## Selection and clipboard text

Tree text selection lives in `framework/selection.zig`. It uses the same line
height and letter spacing overrides before drawing selection rects, and it
walks text nodes to collect selected bytes for clipboard APIs.

Selection hit-testing is byte-index based. UTF-8 decoding exists in the text
engine, but many selection paths still use byte offsets and simple word breaks,
so complex grapheme clusters are not first-class.

## API map

| Layer | File | Surface |
| --- | --- | --- |
| Public primitive | `runtime/primitives.tsx` | `Text`, lowercase `text`, `GLYPH_SLOT` |
| HTML/class props | `renderer/hostConfig.ts`, `runtime/tw.ts` | HTML tag normalization, heading defaults, className text utilities |
| Host mutations | `renderer/hostConfig.ts` | `CREATE`, `CREATE_TEXT`, `UPDATE`, `UPDATE_TEXT` |
| V8 decode | `v8_app.zig` | text props, text instance storage, typography inheritance |
| Node model/layout | `framework/layout.zig` | text fields, measurement callback, text cache, intrinsic sizing |
| Measurement/wrap | `framework/text.zig` | UTF-8 decode, FreeType metrics, word wrap, truncation, hit-test helpers |
| Paint orchestration | `framework/engine.zig` | `measureCallback`, `drawNodeTextCommon`, `paintTextInput`, inline glyph paint |
| GPU text | `framework/gpu/text.zig` | FreeType face table, glyph atlas, glyph instance queue |
| Shader | `framework/gpu/shaders.zig` | text WGSL atlas sampling |
| Selection | `framework/selection.zig` | selection rects, hit-test, selected text collection |
| Telemetry | `framework/telemetry.zig`, `framework/v8_bindings_telemetry.zig` | glyph queue and atlas counts |

## Known gaps and sharp edges

- No HarfBuzz shaping, bidi layout, kerning controls, ligatures, or browser CSS
  font cascade.
- Font family names map to small buckets, not arbitrary installed fonts.
- `fontWeight >= 600` only selects a loaded bold face; intermediate weights do
  not synthesize weight.
- Removing typography from `style` is not symmetric for every field. For
  example, `removeStyleKeys` resets `textAlign`, but style-level `fontSize` and
  `fontFamily` removals do not reset those node fields today. Top-level prop
  removal resets some text props, but not `fontFamily`, `textEffect`, or
  `inlineGlyphs`.
- `textAlign: "justify"` parses but does not justify text. The primary wrapped
  paint path currently behaves left-aligned.
- Nested `<Text>` styling is flattened away by the primitive wrapper.
- `noWrap` disables wrapping in paint by passing draw width `0`; clipping still
  depends on ancestor scissor/overflow behavior.
- The glyph atlas has a fixed capacity of 2048 cached glyph variants and does
  not evict within the current implementation.
- Per-frame glyph instances beyond `MAX_GLYPHS` are silently skipped.
- Selection and cursor math is byte-index based and does not model grapheme
  clusters as user-perceived characters.
