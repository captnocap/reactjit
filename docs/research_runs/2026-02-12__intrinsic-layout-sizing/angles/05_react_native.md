# Angle 05 — React Native's Approach

## Claims (with confidence)

- Claim (high): Yoga uses **measure functions** on leaf nodes to handle intrinsic sizing. A measure callback receives available space + a `MeasureMode` per axis (`Exactly`, `AtMost`, `Undefined`) and returns the node's natural dimensions. Only leaf nodes (no children) can have measure functions — this is an enforced constraint. Text is the canonical example: the native platform measures glyph layout and returns width/height to Yoga. — [Yoga docs: External Layout Systems](https://www.yogalayout.dev/docs/advanced/external-layout-systems), [Yoga issue #999](https://github.com/facebook/yoga/issues/999)

- Claim (high): React Native Views **do auto-size to their content** without explicit dimensions. The default value for `width` and `height` is `auto`, which means Yoga calculates dimensions based on children. A View with no explicit size wraps its children. The "everything needs explicit size" problem in ReactJIT is a deficiency of the hand-rolled Lua layout engine, not inherent to the flexbox model. — [React Native: Height and Width](https://reactnative.dev/docs/height-and-width), [React Native: Flexbox](https://reactnative.dev/docs/flexbox)

- Claim (high): React Native's default `alignItems` is `stretch`, which causes children to fill their parent's cross axis automatically. Combined with `flexDirection: column` (the default), this means children auto-expand to full parent width without any explicit `width: '100%'`. This eliminates the need for explicit width on row containers — they inherit parent width by default. — [React Native: Flexbox](https://reactnative.dev/docs/flexbox), [Manning: In-Depth Styling with RN and Flexbox](https://freecontent.manning.com/in-depth-styling-with-react-native-and-flexbox/)

- Claim (high): React Native deliberately limits style inheritance to **Text-only subtrees**. Nested `<Text>` components inherit `fontSize`, `fontFamily`, `color`, etc. from parent `<Text>` components, but this inheritance does not cross `<View>` boundaries. This was an explicit design decision for component isolation — preventing unexpected style leakage. The recommended pattern is creating a custom `AppText` wrapper that sets defaults. — [React Native: Text docs](https://reactnative.dev/docs/text), [Builder.io: CSS Style Inheritance in RN](https://www.builder.io/blog/implementing-css-style-inheritance-in-react-native), [Style Inheritance of React Native (Medium)](https://medium.com/@fullsour/style-inheritance-of-react-native-eca1c974f02b)

- Claim (high): React Native's `flex: 1` shorthand expands to `flexGrow: 1, flexShrink: 1, flexBasis: 0`. This differs from CSS `flex: 1` (which sets `flexBasis: 0%`). RN's `flexShrink` defaults to `0` (vs CSS default of `1`), meaning items won't shrink by default — an intentional divergence to make mobile layouts more predictable. — [React Native: Layout Props](https://reactnative.dev/docs/layout-props), [Yoga: Flex Basis, Grow, Shrink](https://www.yogalayout.dev/docs/styling/flex-basis-grow-shrink)

- Claim (high): In React Native's Fabric architecture, shadow nodes (C++ objects) hold Yoga layout nodes and perform layout calculation off the main thread. The `measureContent()` method on shadow nodes is what Yoga calls during layout for text/custom components. After measurement, computed layout is committed to native views. — [Deep Dive into RN New Architecture (Medium)](https://medium.com/@DhruvHarsora/deep-dive-into-react-natives-new-architecture-jsi-turbomodules-fabric-yoga-234bbdf853b4), [Bluesky react-native-uitextview DeepWiki](https://deepwiki.com/bluesky-social/react-native-uitextview/4.4-shadow-nodes-and-layout)

- Claim (medium): React Native Image components require explicit dimensions for network images. Local images can be auto-sized via `resolveAssetSource()`, but remote images have no intrinsic size until loaded. `Image.getSize()` / `onLoad` provide dimensions asynchronously, but you still need to set them explicitly. This is a deliberate limitation — async content can't participate in synchronous layout. — [React Native: Image](https://reactnative.dev/docs/image), [RN issue #2180](https://github.com/facebook/react-native/issues/2180)

- Claim (medium): Yoga 3.0 (shipped with RN 0.74) brought significant web-compliance improvements: `position: static` support, fixed `row-reverse` margin/padding behavior, multi-line flexbox improvements, and `align-content: space-evenly`. These changes indicate Yoga is converging toward CSS spec compliance rather than diverging. — [Announcing Yoga 3.0](https://www.yogalayout.dev/blog/announcing-yoga-3.0), [RN 0.74 blog post](https://reactnative.dev/blog/2024/04/22/release-0.74)

- Claim (medium): The `yoga-layout` npm package provides JavaScript/WASM bindings that can be used outside React Native. A custom renderer like ReactJIT could potentially use Yoga directly (via WASM or native bindings) instead of maintaining a hand-rolled layout engine. The API includes `Node.create()`, style setters, `setMeasureFunc()`, and `calculateLayout()`. — [yoga-layout npm](https://www.npmjs.com/package/yoga-layout/v/2.0.1), [yoga-layout-wasm npm](https://www.npmjs.com/package/yoga-layout-wasm)

- Claim (low): A custom React renderer using react-reconciler could integrate Yoga at the host config level by creating Yoga nodes in `createInstance()`, attaching measure functions in `finalizeInitialChildren()`, and running `calculateLayout()` before commit. The reconciler itself has no layout awareness — layout is entirely the host's responsibility. This is architecturally identical to what ReactJIT already does with its Lua engine. — [react-reconciler npm](https://www.npmjs.com/package/react-reconciler), [Making a Custom React Renderer](https://github.com/nitin42/Making-a-custom-React-renderer/blob/master/part-one.md)

## Evidence

- Yoga measure functions receive `(node, width, widthMode, height, heightMode)` and return `{width, height}`. MeasureModes: `Exactly` = use this size, `AtMost` = natural size capped at this, `Undefined` = use natural size. — [Yoga: External Layout Systems](https://www.yogalayout.dev/docs/advanced/external-layout-systems)
- Nodes with measure functions **cannot have children** — enforced by Yoga. This means only leaf nodes participate in intrinsic sizing. — [Yoga: External Layout Systems](https://www.yogalayout.dev/docs/advanced/external-layout-systems)
- RN defaults: `flexDirection: column`, `alignItems: stretch`, `flexShrink: 0` (all differ from CSS web defaults of `row`, `stretch`, `1`). — [React Native: Flexbox](https://reactnative.dev/docs/flexbox)
- `alignItems: stretch` only works when children have no fixed dimension on the cross axis (width must be `auto` or unset). — [React Native: Flexbox](https://reactnative.dev/docs/flexbox)
- Text style inheritance only works in `<Text>` subtrees, not across `<View>` boundaries. Design rationale: component isolation — a component should look the same regardless of where it's placed in the tree. — [React Native: Text](https://reactnative.dev/docs/text)
- Shadow nodes in Fabric are C++ objects that calculate layout via Yoga before native views are created. `measureContent()` is called by Yoga for leaf components needing platform-specific measurement. — [Bluesky react-native-uitextview DeepWiki](https://deepwiki.com/bluesky-social/react-native-uitextview/4.4-shadow-nodes-and-layout)
- `A component can only expand to fill available space if its parent has dimensions greater than 0. If a parent does not have either a fixed width and height or flex, the parent will have dimensions of 0 and the flex children will not be visible.` — [React Native: Height and Width](https://reactnative.dev/docs/height-and-width)
- Bottom-up layout pass: automatic sizes resolved from leaf text nodes upward through parents to root. Fixed sizes + text measurements provide the constraints for auto-sized containers. — [tchayen: How to Write a Flexbox Layout Engine](https://tchayen.com/how-to-write-a-flexbox-layout-engine)
- Yoga 3.0 made breaking changes to row-reverse behavior, absolute positioning with percentages, and added `position: static` — convergence toward CSS spec. — [Announcing Yoga 3.0](https://www.yogalayout.dev/blog/announcing-yoga-3.0)

## What I'm unsure about

- **Exact Yoga API for measure functions in the JS/WASM binding** — I found the C signature (`YGSize _measure(YGNodeRef, float, YGMeasureMode, float, YGMeasureMode)`) but couldn't access the Yoga docs page to confirm the exact JS API shape for `setMeasureFunc()`.
- **Whether Yoga's WASM build could be called from Lua via QuickJS** — ReactJIT uses QuickJS inside Love2D. It's unclear whether yoga-layout's WASM module could be loaded in QuickJS, or if a native C binding to Yoga would be needed instead.
- **Performance characteristics of Yoga vs a hand-rolled Lua engine** — Yoga is written in C++ and optimized for incremental layout. A Lua engine has FFI overhead for text measurement but avoids the WASM/native boundary. No benchmarks found comparing these approaches for a Love2D/QuickJS context.
- **How React Native handles the root node specifically** — I know RN requires root dimensions (from the native window), but I didn't find documentation on whether Yoga treats the root node specially or if it's just a regular node with explicit dimensions set by the platform.
- **Whether Yoga supports "style contexts" or theme-like defaults** — RN solves the "every Text needs fontSize" problem with custom wrapper components, not with engine-level style inheritance. It's unclear if there's a Yoga-level mechanism for default styles beyond what the host sets per-node.
- **Yoga's dirty-marking and incremental layout** — I found references to nodes being "marked dirty" for re-layout, but couldn't get details on how this optimization works and whether a hand-rolled engine could replicate it without significant complexity.

## Sources

- [Yoga: Integrating with External Layout Systems](https://www.yogalayout.dev/docs/advanced/external-layout-systems)
- [Yoga: Flex Basis, Grow, and Shrink](https://www.yogalayout.dev/docs/styling/flex-basis-grow-shrink)
- [Announcing Yoga 3.0](https://www.yogalayout.dev/blog/announcing-yoga-3.0)
- [Yoga GitHub: MeasureMode values (issue #999)](https://github.com/facebook/yoga/issues/999)
- [React Native: Flexbox](https://reactnative.dev/docs/flexbox)
- [React Native: Height and Width](https://reactnative.dev/docs/height-and-width)
- [React Native: Layout Props](https://reactnative.dev/docs/layout-props)
- [React Native: Text](https://reactnative.dev/docs/text)
- [React Native: Image](https://reactnative.dev/docs/image)
- [React Native 0.74 Release Blog](https://reactnative.dev/blog/2024/04/22/release-0.74)
- [Yoga: A Cross-Platform Layout Engine — Engineering at Meta](https://engineering.fb.com/2016/12/07/android/yoga-a-cross-platform-layout-engine/)
- [Deep Dive into RN New Architecture (Medium)](https://medium.com/@DhruvHarsora/deep-dive-into-react-natives-new-architecture-jsi-turbomodules-fabric-yoga-234bbdf853b4)
- [Shadow Nodes and Layout — Bluesky react-native-uitextview DeepWiki](https://deepwiki.com/bluesky-social/react-native-uitextview/4.4-shadow-nodes-and-layout)
- [Style Inheritance of React Native (Medium)](https://medium.com/@fullsour/style-inheritance-of-react-native-eca1c974f02b)
- [Implementing CSS Style Inheritance in React Native (Builder.io)](https://www.builder.io/blog/implementing-css-style-inheritance-in-react-native)
- [How to Write a Flexbox Layout Engine (tchayen.com)](https://tchayen.com/how-to-write-a-flexbox-layout-engine)
- [react-reconciler npm](https://www.npmjs.com/package/react-reconciler)
- [yoga-layout npm](https://www.npmjs.com/package/yoga-layout/v/2.0.1)
- [yoga-layout-wasm npm](https://www.npmjs.com/package/yoga-layout-wasm)
- [React Native Layout Management with Yoga 3.0 (LogRocket)](https://blog.logrocket.com/react-native-layout-management-yoga-3/)
- [Manning: In-Depth Styling with RN and Flexbox](https://freecontent.manning.com/in-depth-styling-with-react-native-and-flexbox/)
- [RN Windows: Custom Measure Function (issue #6411)](https://github.com/microsoft/react-native-windows/issues/6411)
