# Angle 01 — Yoga/Taffy/Stretch

## Claims (with confidence)

- Claim (high): Yoga, Taffy, and Stretch all use **measure functions** (callbacks) on leaf nodes to delegate intrinsic sizing to external systems (text engines, image loaders, etc.). The layout engine never hard-codes how to measure content -- it asks. Yoga's C signature: `YGSize (*YGMeasureFunc)(YGNodeRef node, float width, YGMeasureMode widthMode, float height, YGMeasureMode heightMode)`. Taffy's closure receives `known_dimensions: Size<Option<f32>>`, `available_space: Size<AvailableSpace>`, `node_id`, `node_context`, and `style`.

- Claim (high): Yoga enforces that **only leaf nodes** (nodes with no children) can have measure functions. A node with a measure function cannot have children -- Yoga asserts on this. This means the tree is split cleanly: branch nodes use flexbox to size children, leaf nodes use measure functions to report intrinsic size. This is the architectural pattern ReactJIT's layout.lua would need to adopt.

- Claim (high): Yoga passes **three MeasureMode values** to the measure callback per axis: **Exactly** (use this exact size, analogous to stretch-fit), **AtMost** (return up to this size, analogous to fit-content), and **Undefined** (return your natural/max-content size, no upper bound). These three modes are sufficient to express all the constraint scenarios flexbox needs from leaf nodes.

- Claim (high): Taffy models available space with three enum variants: **Definite(f32)** (known pixel budget), **MinContent** (lay out as small as possible), and **MaxContent** (lay out as large as content wants). Taffy additionally passes `known_dimensions` where `Some(width)` means "assume this width is fixed, tell me the height" -- enabling **width-dependent-height** queries critical for text wrapping.

- Claim (high): Yoga does **not** support `min-content` sizing constraints for performance reasons (expensive for text nodes). It uses `max-content` for intrinsic item size calculations instead. This is a deliberate trade-off documented in the CSS Grid PR for Yoga.

- Claim (medium): The measure function is called **as few times as possible** by Yoga -- ideally once per leaf per layout pass. Yoga caches results and skips measurement when a node already has a definite dimension. The dirty-marking system (`YGNodeMarkDirty`) propagates up to ancestors when content changes, triggering re-measurement only where needed.

- Claim (medium): **LuaJIT FFI bindings for Yoga exist** (`lyoga` by Planimeter) with precompiled shared libraries. This means replacing ReactJIT's hand-rolled Lua layout engine with Yoga via FFI is technically feasible, though ReactJIT uses QuickJS (not LuaJIT), so the FFI path would require C bindings rather than LuaJIT's FFI.

- Claim (medium): Taffy has **work-in-progress WASM bindings** (PR #394) that could theoretically be consumed from QuickJS if compiled to a shared library, but this is not production-ready and would require significant integration work.

- Claim (medium): The **width-dependent-height** problem (text wrapping) is the hardest part of intrinsic sizing. Yoga's approach is to call the measure function with a constrained width (AtMost mode) and let the text engine report the resulting height. This is effectively a two-pass pattern: first determine width constraints from flexbox, then query the leaf for height given that width.

- Claim (low): Stretch (the predecessor to Taffy) is **unmaintained** and had known bugs with leaf nodes and measure functions. It evolved through stretch2 into Taffy. Stretch should not be considered for new integrations.

## Evidence

- Yoga measure function C signature: `typedef YGSize (*YGMeasureFunc)(YGNodeRef node, float width, YGMeasureMode widthMode, float height, YGMeasureMode heightMode)` -- [Yoga External Layout Systems docs](https://www.yogalayout.dev/docs/advanced/external-layout-systems)
- Three MeasureMode values: Exactly (stretch-fit), Undefined (max-content), AtMost (fit-content) -- [Yoga External Layout Systems docs](https://www.yogalayout.dev/docs/advanced/external-layout-systems)
- "Yoga allows leaf nodes to delegate to a different layout system via Measure Functions" and "Yoga is not guaranteed to call a node's measure function if the node already has a definite dimension" -- [Yoga External Layout Systems docs](https://www.yogalayout.dev/docs/advanced/external-layout-systems)
- Meaning of MeasureMode values: AtMost = "smallest size I can fit this text into, given the content, typeface, etc." -- [Yoga Issue #999](https://github.com/facebook/yoga/issues/999)
- Measure functions only on leaf nodes: "Only leaf Yoga nodes with custom measure functions should manually mark themselves as dirty" and assertion prevents adding children to measured nodes -- [Yoga YGNode.cpp source](https://github.com/facebook/yoga/blob/main/yoga/YGNode.cpp)
- Dirty marking: "Yoga will automatically mark a node and its ancestors as dirty if the node's style or children are changed. On subsequent layout, any nodes that are not dirty are skipped" -- [Yoga Incremental Layout docs](https://www.yogalayout.dev/docs/advanced/incremental-layout)
- Taffy AvailableSpace enum: Definite(f32), MinContent, MaxContent -- [Taffy AvailableSpace docs](https://docs.rs/taffy/latest/taffy/style/enum.AvailableSpace.html)
- Taffy known_dimensions: "if known_dimensions.width is set to Some(WIDTH) then this means: What would the height of this node be, assuming the width is WIDTH" -- [Taffy LayoutInput docs](https://docs.rs/taffy/latest/taffy/tree/struct.LayoutInput.html)
- Taffy measure function example with known_dimensions, available_space, node_context parameters -- [Taffy measure.rs example](https://github.com/DioxusLabs/taffy/blob/main/examples/measure.rs)
- Yoga does not support min-content constraint, uses max-content instead for intrinsic track sizing -- [Yoga CSS Grid PR #1865](https://github.com/facebook/yoga/pull/1865)
- LuaJIT FFI bindings for Yoga: lyoga project with precompiled .dylib/.dll -- [Planimeter/lyoga on GitHub](https://github.com/Planimeter/lyoga)
- Taffy WASM bindings WIP with ~350 lines of binding code -- [Taffy WASM PR #394](https://github.com/DioxusLabs/taffy/pull/394)
- Stretch is unmaintained with known measure function bugs; evolved into Taffy -- [Stretch Medium article](https://medium.com/visly/stretch-a-flexbox-implementation-in-rust-60762b5a3331)
- React Native Text shadow nodes delegate measurement to native platform via Yoga measure functions -- [Shadow Nodes and Layout DeepWiki](https://deepwiki.com/bluesky-social/react-native-uitextview/4.4-shadow-nodes-and-layout)
- Yoga 3.0 improved CSS spec compliance (position: static, align-content: space-evenly, row-reverse fixes) -- [Yoga 3.0 announcement](https://www.yogalayout.dev/blog/announcing-yoga-3.0)

## What I'm unsure about

- **Exact caching strategy**: How many times Yoga actually calls the measure function in practice during a single layout pass for complex trees. The docs say "ideally once" but real-world numbers for deep trees are not well-documented publicly.
- **QuickJS + Yoga integration path**: Whether Yoga's C API can be cleanly called from QuickJS via its C module system, or whether a custom bridge would be needed. lyoga targets LuaJIT FFI specifically, not plain Lua or QuickJS.
- **Taffy's actual maturity for non-Rust consumers**: The WASM bindings are WIP (PR #394). Whether they are stable enough for production use in 2026 is unclear from public sources.
- **Performance characteristics of measure callbacks across FFI boundaries**: If layout.lua were replaced by Yoga-via-FFI, each text measurement would cross Lua->C->Lua boundaries. Whether this is faster or slower than the current pure-Lua approach with explicit sizing is unknown without benchmarking.
- **How Yoga handles the "Box with no intrinsic width" problem specifically**: The docs focus on leaf node measurement. For intermediate containers (like a row Box), Yoga determines size from children's intrinsic sizes + flex rules. The exact algorithm for propagating intrinsic sizes upward through container nodes is not fully documented in public-facing materials -- it lives in the ~3000-line C++ implementation.
- **Whether Yoga's "no min-content" trade-off** would cause visible layout differences vs. web CSS for ReactJIT's use cases.

## Sources

- [Yoga - External Layout Systems docs](https://www.yogalayout.dev/docs/advanced/external-layout-systems)
- [Yoga - Incremental Layout docs](https://www.yogalayout.dev/docs/advanced/incremental-layout)
- [Yoga - Announcing Yoga 3.0](https://www.yogalayout.dev/blog/announcing-yoga-3.0)
- [Yoga Issue #999 - MeasureMode values meaning](https://github.com/facebook/yoga/issues/999)
- [Yoga Issue #1045 - Height depending on width](https://github.com/facebook/yoga/issues/1045)
- [Yoga Issue #1409 - Automatic minimum size](https://github.com/facebook/yoga/issues/1409)
- [Yoga PR #1865 - CSS Grid with intrinsic sizing](https://github.com/facebook/yoga/pull/1865)
- [Yoga YGNode.cpp source](https://github.com/facebook/yoga/blob/main/yoga/YGNode.cpp)
- [Yoga MeasureModeTest.cpp](https://github.com/facebook/yoga/blob/main/tests/YGMeasureModeTest.cpp)
- [Taffy docs.rs](https://docs.rs/taffy)
- [Taffy AvailableSpace enum](https://docs.rs/taffy/latest/taffy/style/enum.AvailableSpace.html)
- [Taffy LayoutInput struct](https://docs.rs/taffy/latest/taffy/tree/struct.LayoutInput.html)
- [Taffy measure.rs example](https://github.com/DioxusLabs/taffy/blob/main/examples/measure.rs)
- [Taffy PR #246 - Layout algorithm decoupling and sizing constraints](https://github.com/DioxusLabs/taffy/pull/246)
- [Taffy PR #394 - WASM bindings](https://github.com/DioxusLabs/taffy/pull/394)
- [Planimeter/lyoga - LuaJIT FFI bindings for Yoga](https://github.com/Planimeter/lyoga)
- [Stretch - A Flexbox Implementation in Rust (Medium)](https://medium.com/visly/stretch-a-flexbox-implementation-in-rust-60762b5a3331)
- [Shadow Nodes and Layout - DeepWiki](https://deepwiki.com/bluesky-social/react-native-uitextview/4.4-shadow-nodes-and-layout)
- [Meta Engineering Blog - Yoga cross-platform layout engine](https://engineering.fb.com/2016/12/07/android/yoga-a-cross-platform-layout-engine/)
- [LogRocket - React Native layout management with Yoga 3.0](https://blog.logrocket.com/react-native-layout-management-yoga-3/)
- [tchayen - How to Write a Flexbox Layout Engine](https://tchayen.com/how-to-write-a-flexbox-layout-engine)
- [Smashing Magazine - Flexbox: How Big Is That Flexible Box?](https://www.smashingmagazine.com/2018/09/flexbox-sizing-flexible-box/)
- [MDN - flex-basis](https://developer.mozilla.org/en-US/docs/Web/CSS/flex-basis)
- [MDN - Controlling ratios of flex items](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Flexible_box_layout/Controlling_flex_item_ratios)
