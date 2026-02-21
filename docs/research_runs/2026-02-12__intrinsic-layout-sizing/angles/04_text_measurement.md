# Angle 04 — Text Layout & Measurement

## Claims (with confidence)

- Claim (high): Yoga's measure function protocol is the industry standard for integrating text measurement into flexbox layout engines. The function receives `(width, widthMode, height, heightMode)` where each mode is one of `Exactly`, `AtMost`, or `Undefined`, and returns `{width, height}`. Taffy (Rust) follows the same pattern. ReactJIT's current `measureText(text, fontSize, availW, ...)` is a simplified version that only handles `Undefined` (no availW) and `AtMost` (availW provided), missing `Exactly` mode entirely.

- Claim (high): Every major UI framework provides a default font size so that text nodes never require explicit sizing. CSS uses `medium` keyword mapped to 16px. React Native defaults to 14. Love2D's default font is 12px (pre-12.0) or 13px (12.0+). ReactJIT's `resolveFontSize()` already falls back to 14 — the infrastructure exists, but the linter currently requires explicit `fontSize` on every `<Text>`, which is the real friction point. Removing the lint rule and relying on the default would immediately eliminate most manual size declarations on text.

- Claim (high): Text measurement is the critical "height depends on width" problem in layout engines. When width is unconstrained, text renders on a single line and returns its natural width. When width is constrained, text wraps and height grows. This bidirectional dependency is why Yoga calls measure functions potentially multiple times per layout pass, and why Yoga's three MeasureMode values exist — they tell the measure function what kind of constraint it's operating under.

- Claim (medium): Font-size inheritance via the style tree (not just parent-child) is how CSS and React Native handle text sizing ergonomics. CSS inherits `font-size` through the entire ancestor chain. ReactJIT's `resolveFontSize()` currently only walks up one level (from `__TEXT__` to its parent `Text` node). Extending this to walk the full ancestor chain would allow setting fontSize once at a container level and having all nested Text nodes inherit it, matching CSS behavior.

- Claim (medium): Text measurement caching is critical for performance. Yoga's documentation explicitly states that "labels and text views, which typically take a long time to measure, are measured as few times as possible, ideally just once." ReactJIT's current LRU-style cache (512 entries, full eviction) is a reasonable starting point but could be improved with per-frame invalidation rather than size-based eviction.

- Claim (medium): The full text layout pipeline (as described by Raph Levien) is a hierarchy of segmentation: paragraph segmentation, rich text/BiDi analysis, font itemization, script segmentation, and shaping. For ReactJIT's use case (single font, LTR text, no complex shaping), the pipeline collapses to just "measure string width at given font size + wrap at word boundaries," which is what Love2D's `font:getWrap()` already does. The current approach is appropriate for the scope.

- Claim (medium): For terminal/character-grid targets, text measurement is fundamentally different: each character occupies exactly 1 cell (or 2 for East Asian/emoji). The "font size" concept doesn't map — a cell is a cell. The measure function for grid targets should return dimensions in cell units (width = string length accounting for wide chars, height = 1 for unwrapped). This means the measure function abstraction needs to be target-aware, or targets need to provide their own measure implementation.

- Claim (low): HarfBuzz + FreeType is the gold standard stack for text shaping and measurement in custom renderers, but it's overkill for ReactJIT. Love2D already uses FreeType internally and exposes `Font:getWidth(text)` and `Font:getWrap(text, width)`. Going below Love2D's API to HarfBuzz would only matter for complex scripts (Arabic, Devanagari, CJK vertical) which aren't a current priority.

## Evidence

- Yoga measure function takes `(width, widthMode, height, heightMode)` with three MeasureMode values: Exactly, AtMost, Undefined — [Yoga Issue #999](https://github.com/facebook/yoga/issues/999)
- Yoga docs: "Yoga will call a node's measure function if the node does not otherwise have a definite dimension. This measure function is given the available space in each axis if constrained, with border and padding already subtracted." — [Yoga External Layout Systems](https://www.yogalayout.dev/docs/advanced/external-layout-systems)
- Yoga docs: "labels and text views, which typically take a long time to measure, are measured as few times as possible, ideally just once" — [Yoga Engineering Blog](https://engineering.fb.com/2016/12/07/android/yoga-a-cross-platform-layout-engine/)
- Taffy's `compute_layout_with_measure` accepts a closure that receives `(known_dimensions, available_space, node_id, node_context, style)` — can borrow external context like a font registry — [Taffy docs](https://docs.rs/taffy)
- CSS default font-size is `medium` keyword, mapped to 16px by browsers. Historical reason: 12pt print at 96dpi = 16px — [MDN font-size](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/font-size)
- React Native default fontSize is 14 — [React Native Text docs](https://reactnative.dev/docs/text)
- Love2D default font is Bitstream Vera Sans at size 12 (pre-12.0) or Noto Sans at size 13 (12.0+) — [Love2D newFont](https://love2d.org/wiki/love.graphics.newFont)
- ReactJIT's `resolveFontSize()` already defaults to 14, only walks one parent level — source: `/home/siah/creative/reactjit/lua/layout.lua` line 124-135
- ReactJIT's `Measure.measureText()` defaults fontSize to 14 via `fontSize = fontSize or 14` — source: `/home/siah/creative/reactjit/lua/measure.lua` line 121
- Raph Levien's text layout hierarchy: paragraph, rich text/BiDi, itemization, script, shaping clusters — [Text layout is a loose hierarchy of segmentation](https://raphlinus.github.io/text/2020/10/26/text-layout.html)
- FreeType font metrics: ascent (positive), descent (negative), height = baseline-to-baseline distance, with rounding inconsistencies between ascent+descent vs height — [FreeType Glyph Metrics](https://freetype.org/freetype2/docs/glyphs/glyphs-3.html)
- Terminal character width agreement problem: "both the client program and the terminal have to somehow share the same database of character properties and the same algorithm for computing string lengths in cells" — [Kitty Text Sizing Protocol](https://sw.kovidgoyal.net/kitty/text-sizing-protocol/)
- Yoga issue #1045 documents the "height depends on width" problem for text nodes specifically — [Yoga Issue #1045](https://github.com/facebook/yoga/issues/1045)
- Font-size is unexpectedly complex in CSS: inherited as a computed value that can change meaning when font-family or language changes — [Manish Goregaokar's blog](https://manishearth.github.io/blog/2017/08/10/font-size-an-unexpectedly-complex-css-property/)

## What I'm unsure about

- Whether ReactJIT's linter rule requiring explicit `fontSize` on every `<Text>` was added to prevent bugs or just as an early-stage guard rail. Removing it would be the single highest-leverage change for ergonomics, but there may be edge cases where the default 14 causes layout surprises.
- How the grid-target packages (terminal, cc, nvim) currently handle text measurement — do they have their own measure function, or do they share the same interface? The research focused on Love2D's `measure.lua` but the multi-target story is unclear.
- Whether the current single-level parent walk in `resolveFontSize()` is sufficient for real-world component trees, or whether users are hitting cases where they want to set fontSize on a `<Box>` and have it cascade to all `<Text>` descendants (true CSS inheritance).
- The performance characteristics of Love2D's `Font:getWrap()` — is it fast enough that the 512-entry measurement cache is unnecessary, or is caching genuinely needed? No benchmarks found.
- Whether `Exactly` mode (Yoga's term for when the parent dictates the exact size) matters for text in practice — in most cases text is either unconstrained or has a max width, not a forced exact width.
- How FreeType's rounding behavior (ceiling for ascender, floor for descender) affects pixel-perfect layout at small font sizes in Love2D, and whether this causes the off-by-one-pixel issues mentioned in FreeType docs.

## Sources

- [Yoga: External Layout Systems](https://www.yogalayout.dev/docs/advanced/external-layout-systems)
- [Yoga Issue #999: MeasureMode values](https://github.com/facebook/yoga/issues/999)
- [Yoga Issue #1045: Height depending on width](https://github.com/facebook/yoga/issues/1045)
- [Yoga Engineering Blog](https://engineering.fb.com/2016/12/07/android/yoga-a-cross-platform-layout-engine/)
- [Taffy Layout Engine (Rust)](https://github.com/DioxusLabs/taffy)
- [Taffy measure example](https://github.com/DioxusLabs/taffy/blob/main/examples/measure.rs)
- [Taffy docs.rs](https://docs.rs/taffy)
- [MDN: font-size](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/font-size)
- [React Native Text docs](https://reactnative.dev/docs/text)
- [Love2D Font:getHeight](https://love2d.org/wiki/Font:getHeight)
- [Love2D Font:getWidth](https://love2d.org/wiki/Font:getWidth)
- [Love2D love.graphics.newFont](https://love2d.org/wiki/love.graphics.newFont)
- [Raph Levien: Text layout is a loose hierarchy of segmentation](https://raphlinus.github.io/text/2020/10/26/text-layout.html)
- [Raph Levien: Minikin retrospective](https://raphlinus.github.io/text/2022/11/08/minikin.html)
- [FreeType Glyph Metrics](https://freetype.org/freetype2/docs/glyphs/glyphs-3.html)
- [Kitty Text Sizing Protocol](https://sw.kovidgoyal.net/kitty/text-sizing-protocol/)
- [Manish Goregaokar: Font-size: An Unexpectedly Complex CSS Property](https://manishearth.github.io/blog/2017/08/10/font-size-an-unexpectedly-complex-css-property/)
- [HarfBuzz FreeType Integration](https://harfbuzz.github.io/integration-freetype.html)
- [Flutter TextPainter class](https://api.flutter.dev/flutter/painting/TextPainter-class.html)
- [Android Intrinsic Measurements in Compose](https://developer.android.com/develop/ui/compose/layouts/intrinsic-measurements)
- [tchayen: How to Write a Flexbox Layout Engine](https://tchayen.com/how-to-write-a-flexbox-layout-engine)
