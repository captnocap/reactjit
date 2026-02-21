# Angle 02 — CSS Intrinsic Sizing Spec

## Claims (with confidence)

- Claim (high): The CSS spec defines exactly three intrinsic sizing keywords — `min-content`, `max-content`, and `fit-content` — each with a precise algorithmic definition. `min-content` is the smallest size without overflow (all soft-wrap opportunities taken; for text, the longest unbreakable word). `max-content` is the ideal size given infinite space (no wrapping). `fit-content` is `min(max-content, max(min-content, stretch-fit))`, a clamped shrink-to-fit. These three keywords are the complete vocabulary needed to eliminate explicit sizing in most cases. — [CSS Box Sizing Module Level 3](https://www.w3.org/TR/css-sizing-3/)

- Claim (high): The CSS2 "shrink-to-fit" algorithm (used for floats and inline-blocks) is the predecessor to these intrinsic keywords and follows the formula `min(max(preferred-minimum-width, available-width), preferred-width)`. The modern `fit-content` keyword is a direct formalization of this. This is what ReactJIT's layout engine needs for auto-width on containers. — [Box Sizing in CSS (Mixu)](https://book.mixu.net/css/2-box-model.html)

- Claim (high): Intrinsic sizing requires a **bottom-up propagation pass** — leaf nodes (text, images) report their min-content and max-content sizes, and these bubble up through the tree. Layout engines like Yoga implement this as a multi-pass algorithm: pass 1 top-down to build the queue, pass 2 bottom-up to resolve intrinsic/auto sizes, pass 3 top-down to resolve flex values, percentages, and alignment. — [How to Write a Flexbox Layout Engine (tchayen)](https://tchayen.com/how-to-write-a-flexbox-layout-engine)

- Claim (high): Yoga's measure function API is the practical pattern for intrinsic sizing in non-browser layout engines. Leaf nodes get a callback with `(availableWidth, widthMode, availableHeight, heightMode)` where mode is one of `Exactly` (definite constraint), `Undefined` (report natural size), or `AtMost` (min of available space and natural size). The mode `Undefined` maps to max-content, `AtMost` maps to fit-content. — [Yoga: External Layout Systems](https://www.yogalayout.dev/docs/advanced/external-layout-systems), [Yoga Issue #999](https://github.com/facebook/yoga/issues/999)

- Claim (high): In CSS flexbox, `min-width: auto` (the default) computes to the "content-based minimum size" — the min-content size of the item. This is what prevents flex items from shrinking below their content. ReactJIT currently lacks this; its boxes have zero intrinsic width, which is why row layouts with `justifyContent` fail without explicit width. Implementing the automatic minimum size would fix this. — [BigBinary: Automatic Minimum Size of Flex Items](https://www.bigbinary.com/blog/understanding-the-automatic-minimum-size-of-flex-items), [Flexbox Land](https://flexboxland.com/content/05-advanced-concepts/01-automatic-minimum-size-of-flex-items)

- Claim (high): The intrinsic size contribution of a flex item to its container is: the item's outer size if definite, otherwise its min-content or max-content size (depending on whether computing the container's min-content or max-content), plus margins/border/padding, clamped by min/max properties. This recursive definition is how sizes propagate upward through flex containers. — [CSS Box Sizing Module Level 3, Section 5.2](https://www.w3.org/TR/css-sizing-3/)

- Claim (medium): The flex container's own intrinsic main size uses a "flex fraction" inversion algorithm: for each item, compute what flex fraction would cause it to flex from its basis to its min/max-content size, pick the largest fraction, apply it to all items, sum the results. This is notably more complex than regular block intrinsic sizing and is known to have spec bugs and browser incompatibilities. — [CSSWG Issue #8884](https://github.com/w3c/csswg-drafts/issues/8884), [CSSWG Issue #7189](https://github.com/w3c/csswg-drafts/issues/7189)

- Claim (medium): CSS Sizing Level 4 adds the `stretch` keyword (formalizing what was previously `-webkit-fill-available`) and `contain-intrinsic-size` for content-visibility optimization. The `stretch` keyword does what ReactJIT's `width: '100%'` does today but works correctly in more layout contexts. — [CSS Box Sizing Module Level 4](https://drafts.csswg.org/css-sizing-4/)

- Claim (medium): The CSS spec distinguishes "replaced elements" (images, video — have natural/intrinsic dimensions from their content) from "non-replaced elements" (div, span — intrinsic size comes from children). For replaced elements, min-content === max-content === the natural size. For non-replaced elements, min-content and max-content are computed recursively from children. This maps directly to ReactJIT's distinction between Text/Image nodes (which have measurement functions) and Box nodes (which currently have zero intrinsic width). — [MDN: Intrinsic Size](https://developer.mozilla.org/en-US/docs/Glossary/Intrinsic_Size)

- Claim (low): A conformant implementation of intrinsic sizing in flex layout may require 1-to-N passes through the tree (not a fixed number), because min/max constraints can create cyclic dependencies. Practical engines (Yoga, Taffy) limit this with heuristics and cap the number of passes. — [How to Write a Flexbox Layout Engine (tchayen)](https://tchayen.com/how-to-write-a-flexbox-layout-engine)

## Evidence

- The shrink-to-fit formula `min(max(preferred-minimum-width, available-width), preferred-width)` from CSS2 is exactly what `fit-content` formalizes. This is the default auto-width behavior for inline-blocks and floats. — [Box Sizing in CSS (Mixu)](https://book.mixu.net/css/2-box-model.html)
- Yoga's three MeasureMode values (`Exactly`, `Undefined`, `AtMost`) map directly to the CSS constraint model: definite size, max-content query, fit-content query. Yoga deliberately does NOT call the measure function when a node already has definite dimensions, which is an optimization ReactJIT could adopt. — [Yoga: External Layout Systems](https://www.yogalayout.dev/docs/advanced/external-layout-systems)
- The min-content contribution formula: "the element's specified outer size if definite; otherwise min-content size + margin/border/padding, clamped by min and max" — this is the core recursive algorithm that propagates sizes upward. — [CSS Box Sizing Module Level 3](https://www.w3.org/TR/css-sizing-3/)
- Flex items default to `min-width: auto` which computes to content-based minimum. The longest unbreakable word in a Text node, or the widest child in a Box, becomes the floor. Setting `min-width: 0` overrides this. — [BigBinary: Automatic Minimum Size](https://www.bigbinary.com/blog/understanding-the-automatic-minimum-size-of-flex-items)
- The flex container intrinsic main size algorithm uses a "flex fraction" approach that inverts the normal flex distribution. Known to have spec-vs-reality disagreements. — [CSSWG Issue #8884](https://github.com/w3c/csswg-drafts/issues/8884), [CSSWG Issue #1435](https://github.com/w3c/csswg-drafts/issues/1435)
- Taffy (Rust layout engine used in Dioxus/Bevy) and Yoga (used in React Native) are the two main non-browser implementations of CSS intrinsic sizing. Both use measure callbacks for leaf nodes. — [Taffy GitHub](https://github.com/DioxusLabs/taffy), [Servo PR #32854](https://github.com/servo/servo/pull/32854)
- The tchayen flexbox engine tutorial describes the three-pass approach: (1) top-down queue building, (2) bottom-up intrinsic size resolution, (3) top-down flex distribution. This is the minimum viable approach for a layout engine that supports auto sizing. — [How to Write a Flexbox Layout Engine](https://tchayen.com/how-to-write-a-flexbox-layout-engine)

## What I'm unsure about

- **Exact algorithm for flex container intrinsic cross size**: The spec defines how to compute intrinsic main size with the flex fraction method, but the cross size computation (especially with wrapping) is less clear from what I found. Need to read the flex spec section 9.9.1 directly.
- **How cyclic percentage resolution interacts with intrinsic sizing in practice**: The spec says cyclic percentages resolve against zero for intrinsic contributions, but the practical implications for a layout engine (e.g., a child with `width: 50%` inside a parent with `width: auto`) need more investigation.
- **Performance cost of multi-pass intrinsic sizing**: The claim about 1-to-N passes is directional. I could not find concrete benchmarks comparing single-pass (current ReactJIT approach) vs. multi-pass intrinsic sizing in non-browser engines.
- **Whether Yoga actually implements the full CSS intrinsic sizing spec or a simplified subset**: Yoga issue #1409 suggests Yoga did NOT implement automatic minimum size for flex items for a long time. The current state of Yoga's spec conformance for intrinsic sizing is unclear.
- **How the "flex fraction" algorithm for container intrinsic main size actually performs in practice**: Multiple CSSWG issues suggest the spec text produces incorrect results for common cases. Browsers may use a different algorithm than what the spec says.

## Sources

- [CSS Box Sizing Module Level 3 (W3C)](https://www.w3.org/TR/css-sizing-3/)
- [CSS Box Sizing Module Level 4 (CSSWG Draft)](https://drafts.csswg.org/css-sizing-4/)
- [CSS Flexible Box Layout Module Level 1 (W3C)](https://www.w3.org/TR/css-flexbox-1/)
- [Yoga: Integrating with External Layout Systems](https://www.yogalayout.dev/docs/advanced/external-layout-systems)
- [Yoga Issue #999 — MeasureMode values](https://github.com/facebook/yoga/issues/999)
- [Yoga Issue #1409 — Automatic minimum size](https://github.com/facebook/yoga/issues/1409)
- [How to Write a Flexbox Layout Engine (tchayen)](https://tchayen.com/how-to-write-a-flexbox-layout-engine)
- [Flexbox: How Big Is That Flexible Box? (Smashing Magazine)](https://www.smashingmagazine.com/2018/09/flexbox-sizing-flexible-box/)
- [Understanding the Automatic Minimum Size of Flex Items (BigBinary)](https://www.bigbinary.com/blog/understanding-the-automatic-minimum-size-of-flex-items)
- [Automatic Minimum Size of Flex Items (Flexbox Land)](https://flexboxland.com/content/05-advanced-concepts/01-automatic-minimum-size-of-flex-items)
- [Box Sizing in CSS (Mixu)](https://book.mixu.net/css/2-box-model.html)
- [Intrinsic Sizing in CSS (Ahmad Shadeed)](https://ishadeed.com/article/intrinsic-sizing-in-css/)
- [MDN: Intrinsic Size Glossary](https://developer.mozilla.org/en-US/docs/Glossary/Intrinsic_Size)
- [Taffy Layout Engine (GitHub)](https://github.com/DioxusLabs/taffy)
- [Servo: Flex Intrinsic Sizes PR #32854](https://github.com/servo/servo/pull/32854)
- [CSSWG Issue #8884 — Flex intrinsic main size not web compatible](https://github.com/w3c/csswg-drafts/issues/8884)
- [CSSWG Issue #7189 — Intrinsic Main Size algo errors](https://github.com/w3c/csswg-drafts/issues/7189)
- [CSSWG Issue #1435 — Intrinsic sizing produces 0](https://github.com/w3c/csswg-drafts/issues/1435)
- [Understanding min-content, max-content, fit-content (LogRocket)](https://blog.logrocket.com/understanding-min-content-max-content-fit-content-css/)
- [fit-content (MDN)](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Values/fit-content)
