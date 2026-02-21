# Angle 03 — Style Inheritance & Cascade

## Claims (with confidence)

- Claim (high): CSS divides properties into two categories -- "inherited" (font-size, color, font-family, line-height, text-align, letter-spacing, font-weight, font-style) and "non-inherited" (width, height, margin, padding, border, background). A minimal style inheritance system for ReactJIT only needs to handle the inherited category (~10-15 text/typography properties), not the full cascade. This is exactly what react-native-inherit does. — [MDN Inheritance](https://developer.mozilla.org/en-US/docs/Web/CSS/Inheritance), [react-native-inherit](https://github.com/ozziexsh/react-native-inherit)

- Claim (high): React Context is the standard mechanism for implementing style inheritance in non-browser React renderers. Both react-native-inherit (StyleProvider wrapping a context) and Flutter's DefaultTextStyle (InheritedWidget, which is the Flutter equivalent of React Context) use this pattern. The approach is: wrap a context provider around any node that sets inheritable styles, and have leaf Text components read from the nearest ancestor context. — [react-native-inherit](https://github.com/ozziexsh/react-native-inherit), [Flutter DefaultTextStyle](https://api.flutter.dev/flutter/widgets/DefaultTextStyle-class.html)

- Claim (high): React Native intentionally restricts style inheritance to text subtrees only (nested `<Text>` inside `<Text>`), NOT across `<View>` boundaries. This is a deliberate design choice for component isolation -- "text properties that could inherit from outside of the props would break this isolation." ReactJIT's current `__TEXT__` parent-lookup in `painter.lua` already follows this exact same model. — [React Native Text docs](https://reactnative.dev/docs/text)

- Claim (medium): Flutter's DefaultTextStyle.merge() pattern is the most directly applicable model for ReactJIT. It works as: (1) `DefaultTextStyle.of(context)` reads the nearest ancestor's text style, (2) the current node's explicit style is merged on top (explicit values win, unset values fall through to inherited), (3) the merged result is provided to children via a new context provider. This is a single O(depth) context lookup per Text node, not a tree walk. — [Flutter DefaultTextStyle.merge](https://api.flutter.dev/flutter/widgets/DefaultTextStyle/merge.html), [Flutter TextStyle inherit property](https://api.flutter.dev/flutter/painting/TextStyle/inherit.html)

- Claim (medium): The react-reconciler's `getChildHostContext(parentContext, type, rootContainer)` hook provides a built-in mechanism for propagating inherited styles through the instance tree without React Context overhead. When a `Text` node is created, `getChildHostContext` can inject inherited text styles into the host context, which is then available to all descendants. This avoids React re-renders entirely since host context is reconciler-internal. — [react-reconciler host config](https://github.com/facebook/react/tree/main/packages/react-reconciler), [GitHub issue #24138](https://github.com/facebook/react/issues/24138)

- Claim (medium): For ReactJIT's dual-layer architecture (React side + Lua side), there are two viable inheritance implementation points: (a) React-side via Context/host-context, where the JS reconciler resolves inherited styles before sending mutations to Lua, or (b) Lua-side, where the layout engine walks up the parent chain at paint/layout time. Option (a) is cleaner but requires changes to the reconciler host config. Option (b) is simpler to implement (just extend the existing `__TEXT__` parent-lookup pattern in painter.lua) but means the Lua side is doing work that could be resolved once in JS. — [Servo style system](https://doc.servo.org/style/index.html)

- Claim (medium): Performance of context-based inheritance is not a concern for typical UI trees. React Context re-renders all consumers when the provider value changes, but text style contexts change rarely (theme changes, not per-frame). Splitting into a dedicated `TextStyleContext` separate from layout/theme contexts avoids unnecessary re-renders. The real performance concern is object identity -- the merged style object must be memoized (useMemo) to prevent cascading re-renders. — [React Context performance](https://www.developerway.com/posts/how-to-write-performant-react-apps-with-context), [Kent C. Dodds context optimization](https://kentcdodds.com/blog/how-to-optimize-your-context-value)

- Claim (low): Servo's two-phase style resolution (early properties like font-size resolved first because other properties like `em` units depend on them) hints at a subtlety: if ReactJIT ever supports relative units (em, rem), font-size must be resolved before other properties that reference it. For now this is irrelevant since ReactJIT uses only pixel values, but it's a design consideration for the inheritance system's future extensibility. — [Servo computed values](https://doc.servo.org/style/values/computed/index.html)

## Evidence

- React Native's Text component uses `TextAncestorContext` (a boolean context) to detect nesting, but style inheritance only happens within the native text rendering pipeline, not via React Context for styles themselves. The JS side just passes styles down; the native side (NSAttributedString on iOS, SpannableString on Android) handles merging. — [React Native Text.js source](https://github.com/facebook/react-native/blob/main/packages/react-native/Libraries/Text/Text.js)

- react-native-inherit defines exactly these inheritable properties: `color, fontSize, fontFamily, fontWeight, fontVariant, fontStyle, lineHeight, letterSpacing, textAlign, textTransform`. This matches CSS's inherited text properties closely. — [react-native-inherit README](https://github.com/ozziexsh/react-native-inherit)

- Flutter's `TextStyle.inherit` property (default: true) controls whether merge happens. When true, `TextStyle.merge()` combines parent + child styles (child wins on conflicts). When false, the child's style is used standalone. This on/off toggle is a useful API design -- it lets components opt out of inheritance when needed. — [Flutter TextStyle.inherit](https://api.flutter.dev/flutter/painting/TextStyle/inherit.html)

- ReactJIT's current painter.lua already does parent-lookup inheritance for `__TEXT__` nodes: fontFamily, lineHeight, letterSpacing, textOverflow, numberOfLines, color, and shadow properties all check `node.parent` when the current node is `__TEXT__`. But this only works for the direct `__TEXT__` -> parent `Text` relationship, not for arbitrarily nested `Text` -> `Box` -> `Text` chains. — [painter.lua lines 222-280 in the local codebase]

- Yoga (used by React Native) and Taffy (used by Dioxus) explicitly do NOT implement style inheritance. They are pure layout engines. Style inheritance is the responsibility of the layer above the layout engine. This confirms that ReactJIT's Lua layout engine should NOT be the place to implement a full cascade -- it should receive already-resolved styles. — [Yoga GitHub](https://github.com/facebook/yoga), [Taffy docs](https://docs.rs/taffy)

- Blink's style engine uses a "Matched Properties Cache" that copies the parent's entire computed style to a child when inheritance is the only source of values, avoiding per-property resolution. For ReactJIT's scale this optimization is unnecessary, but the principle is sound: if a node has no explicit text styles, just copy the parent's resolved text style object reference. — [Blink style performance](https://blogs.igalia.com/jfernandez/2020/08/13/improving-css-custom-properties-performance/)

- The W3C CSS Cascade Level 4 spec defines the inheritance algorithm precisely: "If there is no cascaded value and the property is inherited, the specified value is the computed value of the parent element." This is the formal basis for the merge-with-parent approach. — [W3C CSS Cascade 4](https://www.w3.org/TR/css-cascade-4/)

## What I'm unsure about

- **Host context vs. React Context tradeoff**: The react-reconciler's `getChildHostContext` seems ideal for propagating inherited styles without React re-render cost, but I could not find concrete examples of renderers using it for style inheritance specifically. The API docs are sparse. It may have limitations (e.g., does it update when props change, or only on mount?) that make it unsuitable for dynamic style changes.

- **Cross-boundary inheritance scope**: Should `<Box><Text fontSize={20}><Box><Text>child</Text></Box></Text></Box>` inherit the fontSize=20 through the intermediate Box? React Native says no (View breaks the text subtree). CSS says yes (font-size inherits through all elements). ReactJIT needs to make a design choice here, and I don't have data on which is more ergonomic for the typical ReactJIT use case.

- **Lua-side vs JS-side resolution**: The current `__TEXT__` inheritance in painter.lua is simple and works. Extending it to a full inherited-style system on the Lua side (walking up the parent chain at paint time) might be more pragmatic than adding React Context, since it avoids changing the reconciler and the mutation protocol. But I haven't benchmarked whether Lua parent-chain walks at paint time have measurable cost for deep trees.

- **Default fontSize value**: The research shows React Native does not define a global default fontSize -- each platform has its own native default. Flutter's DefaultTextStyle provides a fallback. For ReactJIT, where the linter currently requires explicit fontSize on every Text, the question is what the default should be (14px is used ad-hoc in many components). This is a design decision, not a technical one.

- **Interaction with the linter**: The `no-missing-font-size` lint rule currently requires explicit fontSize on every `<Text>`. If inheritance is implemented, this rule needs to be relaxed to "fontSize must be resolvable (either explicit or inherited)" -- but static analysis can't easily determine if a context provider exists upstream. The linter may need to become aware of a `<TextStyleProvider>` or simply trust that a root-level default exists.

## Sources

- [MDN — CSS Inheritance](https://developer.mozilla.org/en-US/docs/Web/CSS/Inheritance)
- [W3C — CSS Cascading and Inheritance Level 4](https://www.w3.org/TR/css-cascade-4/)
- [React Native — Text component docs](https://reactnative.dev/docs/text)
- [React Native — Text.js source code](https://github.com/facebook/react-native/blob/main/packages/react-native/Libraries/Text/Text.js)
- [react-native-inherit — GitHub](https://github.com/ozziexsh/react-native-inherit)
- [Builder.io — Implementing CSS Style Inheritance in React Native](https://www.builder.io/blog/implementing-css-style-inheritance-in-react-native)
- [Flutter — DefaultTextStyle class](https://api.flutter.dev/flutter/widgets/DefaultTextStyle-class.html)
- [Flutter — DefaultTextStyle.merge](https://api.flutter.dev/flutter/widgets/DefaultTextStyle/merge.html)
- [Flutter — TextStyle.inherit property](https://api.flutter.dev/flutter/painting/TextStyle/inherit.html)
- [react-reconciler — npm / GitHub](https://github.com/facebook/react/tree/main/packages/react-reconciler)
- [GitHub issue #24138 — host context in React 18](https://github.com/facebook/react/issues/24138)
- [Yoga layout engine — GitHub](https://github.com/facebook/yoga)
- [Taffy layout engine — docs.rs](https://docs.rs/taffy)
- [Servo — style crate documentation](https://doc.servo.org/style/index.html)
- [Servo — computed values](https://doc.servo.org/style/values/computed/index.html)
- [Blink — Improving CSS Custom Properties Performance](https://blogs.igalia.com/jfernandez/2020/08/13/improving-css-custom-properties-performance/)
- [React Context performance — developerway.com](https://www.developerway.com/posts/how-to-write-performant-react-apps-with-context)
- [Kent C. Dodds — How to optimize your context value](https://kentcdodds.com/blog/how-to-optimize-your-context-value)
- [React Native for Web — Styling docs](https://necolas.github.io/react-native-web/docs/styling/)
- [Contextual Typography Styling in React Native — Lewis Barnes](https://medium.com/@lewie9021/contextual-typography-styling-in-react-native-30d22df063a1)
