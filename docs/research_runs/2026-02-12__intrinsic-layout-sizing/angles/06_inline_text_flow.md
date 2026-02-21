# Angle 06 — Inline Flow & Text Runs

## Claims (with confidence)

- Claim (high): React Native solves the inline text problem by treating `<Text>` as a boundary between flexbox layout and text layout. Everything inside a `<Text>` subtree is flattened into a single attributed string (NSAttributedString on iOS, SpannableString on Android), with nested `<Text>` children becoming style annotations on ranges rather than separate layout nodes. The reconciler's child text fragments are concatenated via `attributedTextWithBaseTextAttributes:` which recursively walks `reactSubviews` and appends each child's attributed string to a mutable result. — [React Native Text docs](https://reactnative.dev/docs/text), [RCTText iOS rewrite commit](https://github.com/facebook/react-native/commit/2716f53220f947c690d5f627286aad51313256a0)

- Claim (high): Yoga (the layout engine React Native uses) enforces that nodes with measure functions cannot have children. This means a Text node in React Native is a leaf node in Yoga's tree — it uses a measure function to call into platform text measurement, and its React children (nested `<Text>`, raw strings) exist only in the shadow tree, not in Yoga's layout tree. The flattening from shadow tree children to a single measured leaf is the core mechanism that prevents overlap. — [Yoga external layout systems docs](https://www.yogalayout.dev/docs/advanced/external-layout-systems), [Yoga GitHub](https://github.com/facebook/yoga)

- Claim (high): The react-reconciler's `shouldSetTextContent(type, props)` is the hook that controls whether child text creates separate host nodes. If it returns `true`, React assumes the node handles its own text content and will NOT call `createTextInstance` for string children. The DOM renderer returns `true` for `textarea` or when `props.children` is a string. Most custom renderers return `false` and rely on `createTextInstance`. — [react-reconciler README](https://github.com/facebook/react/blob/main/packages/react-reconciler/README.md), [react-reconciler npm](https://www.npmjs.com/package/react-reconciler)

- Claim (high): Ink (React terminal renderer) uses a dual-type system: `ink-text` for top-level Text components and `ink-virtual-text` for Text nested inside other Text. The reconciler tracks an `isInsideText` boolean in host context. Text nodes created via `createTextInstance` are only allowed when `isInsideText` is true — otherwise it throws "Text string must be rendered inside `<Text>` component". The rendering phase then walks the tree and concatenates text children, but each text node still gets its own Yoga node for measurement. — [Ink reconciler.ts](https://github.com/vadimdemedes/ink/blob/master/src/reconciler.ts)

- Claim (medium): Flutter's approach is similar in spirit but different in mechanism. `RichText`/`RenderParagraph` uses a `TextSpan` tree (via `InlineSpan` hierarchy) that gets built into a `ParagraphBuilder` by calling `pushStyle`/`addText`/`pop` in sequence. The entire span tree is flattened into a single `Paragraph` object which is measured and laid out as one unit. Inline widgets are supported via `WidgetSpan`/`PlaceholderSpan` which reserve space within the paragraph. — [Flutter RichText class](https://api.flutter.dev/flutter/widgets/RichText-class.html), [Flutter TextSpan.build](https://api.flutter.dev/flutter/painting/TextSpan/build.html), [Flutter WidgetSpan PR #30069](https://github.com/flutter/flutter/pull/30069)

- Claim (medium): The CSS specification defines that any text directly contained inside a block container (not inside an inline element) generates an "anonymous inline box." In a real browser layout engine (Chromium/Blink, Servo), inline formatting contexts collect all inline-level content into line boxes, and text from adjacent DOM text nodes forms continuous text runs that are shaped together. A single DOM text node can be split across multiple line fragments. This is fundamentally different from flexbox — inline formatting context is a separate layout mode. — [CSS2 Visual Formatting Model](https://www.w3.org/TR/CSS2/visuren.html), [MDN Inline Formatting Context](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_inline_layout/Inline_formatting_context), [Servo Layout 2020](https://github.com/servo/servo/wiki/Layout-2020)

- Claim (medium): Taffy (Rust flexbox/grid engine used by Dioxus) does not implement inline text layout at all. It delegates to external text layout engines (e.g. Parley) via measure functions, following the same leaf-node pattern as Yoga. This confirms that flexbox-only layout engines universally treat text as opaque measured leaves, not as inline flow participants. — [Taffy GitHub](https://github.com/DioxusLabs/taffy), [Taffy docs](https://docs.rs/taffy)

- Claim (high): ReactJIT's current bug (mixed JSX children in `<Text>` creating overlapping `__TEXT__` nodes) is a direct consequence of treating the reconciler's text instances as flex children. When `<Text>Hello {name}</Text>` produces two `createTextInstance` calls ("Hello " and the value of `name`), those become two separate Yoga flex items at y=0, hence the overlap. The template literal workaround (`{`Hello ${name}`}`) produces a single string child, hence one `createTextInstance` call and one Yoga node. — [Project context from CLAUDE.md]

## Evidence

- React Native flattens nested `<Text>` to a single NSAttributedString/SpannableString — `attributedTextWithBaseTextAttributes:` recursively appends child attributed strings — [RCTText rewrite commit](https://github.com/facebook/react-native/commit/2716f53220f947c690d5f627286aad51313256a0)
- React Native docs explicitly state: "The `<Text>` element is unique relative to layout: everything inside is no longer using the Flexbox layout but using text layout" — [React Native Text docs](https://reactnative.dev/docs/text)
- Yoga docs: "Nodes with measure functions cannot have children" — measure functions are for leaf nodes only — [Yoga external layout systems](https://www.yogalayout.dev/docs/advanced/external-layout-systems)
- react-reconciler: `shouldSetTextContent` returning `true` prevents `createTextInstance` from being called on children — [react-reconciler README](https://github.com/facebook/react/blob/main/packages/react-reconciler/README.md)
- Ink uses `isInsideText` host context flag and distinguishes `ink-text` vs `ink-virtual-text` element types — [Ink reconciler source](https://github.com/vadimdemedes/ink/blob/master/src/reconciler.ts)
- Flutter's `TextSpan.build()` calls `pushStyle`/`addText`/`pop` on `ParagraphBuilder` to flatten the span tree — [Flutter TextSpan build docs](https://api.flutter.dev/flutter/painting/TextSpan/build.html)
- CSS2 spec: text directly in block containers generates anonymous inline boxes, forming inline formatting context — [W3C CSS2 visuren](https://www.w3.org/TR/CSS2/visuren.html)
- Servo: "A single DOM node may be split into multiple fragments" and uses glyph runs within text runs for caching — [Servo Layout Overview](https://github.com/servo/servo/wiki/Layout-Overview)
- react-pdf has the same problem: `display: 'inline'` on Text doesn't work, elements stack instead of flowing inline — [react-pdf issue #767](https://github.com/diegomura/react-pdf/issues/767)

## Recommended Solutions for ReactJIT (Three Tiers)

### Tier 1: Shadow tree text flattening (React Native pattern)
The reconciler intercepts `<Text>` children before they reach the layout engine. When a `<Text>` node has mixed children (strings + nested `<Text>`), the shadow tree collects all child text fragments, concatenates them with style annotations, and presents a single measured leaf to the Lua layout engine. The Yoga constraint ("measured nodes cannot have children") is the key insight: the `<Text>` Yoga node should use a measure function and have zero Yoga children, even though it has React children.

### Tier 2: Host context text mode (Ink pattern)
Track `isInsideText` in host context. When inside a `<Text>` subtree, `createTextInstance` creates virtual text nodes that don't get their own Yoga nodes. Instead, the parent `<Text>` component collects all descendant text content during commit and measures the concatenated result.

### Tier 3: `shouldSetTextContent` optimization
For the simplest case (no nested `<Text>`, just string children), return `true` from `shouldSetTextContent` when the component is `Text` and `props.children` is a string. This prevents `createTextInstance` from being called at all, and the text is set directly on the `Text` host instance.

## What I'm unsure about

- Exactly how React Native's Fabric (C++) implementation of `ParagraphShadowNode` differs from the older Obj-C `RCTBaseTextShadowView` — the newer C++ code was not accessible in search results.
- Whether Ink actually concatenates text from virtual text children during rendering or whether each still gets its own Yoga node (the reconciler creates them, but the rendering path for text squashing is in files I couldn't fully inspect).
- How ReactJIT's Lua layout engine currently handles the `__TEXT__` node type internally — whether it already has a concept of "leaf measured node" or whether text nodes are just regular flex children with measured intrinsic size. This determines which tier of solution is feasible.
- The performance implications of text flattening on the JS-to-Lua bridge — if the reconciler flattens text on the JS side, it sends fewer mutations across the bridge, but if it sends individual text fragments, the Lua side would need to do the flattening.
- How style inheritance should work for nested `<Text>` with different styles (bold, color) — React Native's attributed string approach naturally handles this, but a simpler concatenation approach would lose per-fragment styling.

## Sources

- [React Native Text docs](https://reactnative.dev/docs/text)
- [React Native RCTText iOS rewrite commit](https://github.com/facebook/react-native/commit/2716f53220f947c690d5f627286aad51313256a0)
- [react-reconciler README](https://github.com/facebook/react/blob/main/packages/react-reconciler/README.md)
- [react-reconciler npm](https://www.npmjs.com/package/react-reconciler)
- [Yoga GitHub](https://github.com/facebook/yoga)
- [Yoga: Integrating with external layout systems](https://www.yogalayout.dev/docs/advanced/external-layout-systems)
- [Yoga: A cross-platform layout engine (Meta Engineering)](https://engineering.fb.com/2016/12/07/android/yoga-a-cross-platform-layout-engine/)
- [Ink GitHub](https://github.com/vadimdemedes/ink)
- [Ink reconciler.ts source](https://github.com/vadimdemedes/ink/blob/master/src/reconciler.ts)
- [Ink output.ts source](https://github.com/vadimdemedes/ink/blob/master/src/output.ts)
- [Flutter RichText class](https://api.flutter.dev/flutter/widgets/RichText-class.html)
- [Flutter TextSpan class](https://api.flutter.dev/flutter/painting/TextSpan-class.html)
- [Flutter TextSpan.build](https://api.flutter.dev/flutter/painting/TextSpan/build.html)
- [Flutter WidgetSpan class](https://api.flutter.dev/flutter/widgets/WidgetSpan-class.html)
- [Flutter Text inline widgets PR #30069](https://github.com/flutter/flutter/pull/30069)
- [Flutter Text Rendering internals](https://flutter.megathink.com/text/text-rendering)
- [W3C CSS2 Visual Formatting Model](https://www.w3.org/TR/CSS2/visuren.html)
- [MDN Inline Formatting Context](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_inline_layout/Inline_formatting_context)
- [MDN Block and Inline Layout](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Display/Block_and_inline_layout)
- [CSS Inline Layout Module Level 3](https://www.w3.org/TR/css-inline-3/)
- [Servo Layout 2020 wiki](https://github.com/servo/servo/wiki/Layout-2020)
- [Servo Layout Overview wiki](https://github.com/servo/servo/wiki/Layout-Overview)
- [Chromium LayoutNG deep-dive](https://developer.chrome.com/docs/chromium/layoutng)
- [Taffy layout library](https://github.com/DioxusLabs/taffy)
- [Taffy docs.rs](https://docs.rs/taffy)
- [react-pdf inline display issue #767](https://github.com/diegomura/react-pdf/issues/767)
- [React Native for Web Text component](https://necolas.github.io/react-native-web/docs/text/)
- [Bluesky react-native-uitextview Shadow Nodes](https://deepwiki.com/bluesky-social/react-native-uitextview/4.4-shadow-nodes-and-layout)
- [Custom React Renderer guide (Atul R.)](https://blog.atulr.com/react-custom-renderer-2/)
