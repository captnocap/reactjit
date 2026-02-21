# Angle 10 — Migration Path

## Claims (with confidence)

- Claim (high): Intrinsic sizing can be added as a non-breaking enhancement to the existing Lua engine. The current engine already computes intrinsic sizes for Text nodes (lines 328-355 of layout.lua) and falls through to `explicitW or pw or 0` for Box nodes (line 292). Changing the fallback for Box nodes from "inherit parent width" to "measure children" when no explicit width is given would only affect nodes that currently rely on inheriting the full parent width by default — which is the majority of existing layouts, making it a breaking change unless gated behind a flag or style property.

- Claim (high): Yoga's Errata API is the gold standard for backward-compatible layout engine migration. Yoga 2.0 introduced `YGConfigSetErrata()` allowing per-config (and thus per-subtree) control over which conformance behaviors are active. `YGErrataClassic` preserves pre-2.0 behavior; `YGErrataNone` gets full W3C compliance. React Native intentionally ships with some errata enabled by default to avoid breaking existing apps. This pattern — new behavior as default with per-tree opt-out — is directly applicable to ReactJIT.

- Claim (high): Flutter's `IntrinsicHeight`/`IntrinsicWidth` widgets demonstrate that intrinsic sizing has O(N^2) worst-case cost. Flutter requires an explicit opt-in widget to trigger a speculative layout pass for intrinsic measurement. The performance penalty is a second layout pass per intrinsic widget, compounding exponentially with nesting depth. This suggests ReactJIT should limit intrinsic measurement to leaf or shallow nodes, not apply it recursively by default.

- Claim (medium): Replacing the Lua engine with Yoga via LuaJIT FFI is feasible but introduces a hard C dependency. The `lyoga` project (Planimeter/lyoga) demonstrates working LuaJIT FFI bindings to Yoga's C API (libyogacore.so). However, ReactJIT's Love2D target runs JS inside QuickJS embedded via LuaJIT FFI — adding a second native dependency (Yoga .so) increases the packaging complexity for `dist:love` and requires cross-compilation for each target platform.

- Claim (medium): Taffy via WASM is not viable for the QuickJS runtime path. QuickJS is itself the JS engine embedded in Love2D — it does not have a WASM runtime. WASM bindings for Taffy (PR #394) target browser/Node.js environments, not embedded QuickJS. Using Taffy in ReactJIT would require either Lua FFI to a Taffy .so (which doesn't have stable C bindings yet) or compiling Taffy to a native .so via `cbindgen`, which is custom work with no existing precedent.

- Claim (medium): The safest migration path is enhancing the existing Lua engine with an opt-in intrinsic sizing mode per node, rather than replacing it. The engine is only 945 lines and already handles text measurement correctly. Box intrinsic sizing requires a two-pass approach (measure children first, then lay out) that can be added incrementally. Chrome's LayoutNG migration proves that coexistence of old and new layout algorithms (with per-subtree selection) is the standard approach for large-scale engine transitions.

- Claim (medium): A `sizeToContent` or `width: 'auto'` style property is the cleanest opt-in mechanism. This avoids changing the default behavior (`explicitW or pw or 0` at line 292) while letting new components say "measure my children to determine my width." Existing apps with explicit `width: '100%'` or pixel widths would be completely unaffected.

- Claim (low): Adding a default `fontSize` is low-risk because the engine already has a hardcoded fallback of `fontSize = 14` (line 134 of layout.lua). Changing this value or making it configurable at the root level would not break any Text node that already specifies its own `fontSize`. The linter enforces explicit `fontSize` on all `<Text>` nodes, so existing compliant apps would not be affected.

- Claim (low): Bevy's Taffy upgrade history suggests that layout engine replacements in game/rendering engines are typically small diffs (28 lines added, 23 removed for Taffy 0.2) when the style API surface stays stable. The risk is concentrated in default value mismatches (e.g., `gap: Size::AUTO` vs `0.0`) rather than fundamental algorithmic differences.

## Evidence

- Yoga 2.0 introduced the Errata API: `YGConfigSetErrata(config, YGErrataClassic)` preserves legacy behavior per-config, with `YGErrataNone` for full W3C compliance. The API allows different subtrees to use different conformance levels. — [Announcing Yoga 2.0](https://www.yogalayout.dev/blog/announcing-yoga-2.0)
- Yoga's Errata RFC formalizes that new behavior changes must initially be guarded by errata settings, alongside telemetry to measure real-world impact before removing the errata branch. — [RFC: Yoga Errata Policy](https://github.com/facebook/yoga/issues/1247)
- React Native 0.74 shipped Yoga 3.0, intentionally preserving some incorrect layout behaviors where fixing them would affect significant real-world components. Layout conformance is configurable per-node. — [React Native 0.74 Release](https://reactnative.dev/blog/2024/04/22/release-0.74)
- Flutter's `IntrinsicHeight` widget "is relatively expensive, because it adds a speculative layout pass before the final layout phase" with O(N^2) complexity in nested usage. Flutter recommends `Expanded`/`Flexible` as single-pass alternatives. — [Flutter IntrinsicHeight API](https://api.flutter.dev/flutter/widgets/IntrinsicHeight-class.html)
- `lyoga` provides LuaJIT FFI bindings to Yoga's C API, demonstrating feasibility of calling Yoga from Love2D/LuaJIT. Last updated October 2019 (Yoga 1.x era). — [Planimeter/lyoga](https://github.com/Planimeter/lyoga)
- Taffy WASM bindings are WIP (PR #394, opened March 2023), targeting browser/Node.js via wasm-bindgen. Binary size ~200KB. Performance was initially 14x slower than Yoga for 10K node creation (600ms vs 43ms). — [Taffy WASM PR](https://github.com/DioxusLabs/taffy/pull/394)
- Chrome's LayoutNG migration used per-subtree coexistence: legacy engine was used as fallback for content types not yet supported by LayoutNG (flex, grid, tables). Full migration completed by Chrome 108. — [LayoutNG Deep Dive](https://developer.chrome.com/docs/chromium/layoutng)
- Bevy upgraded from Taffy 0.1 to 0.2 with a 4-file, ~50-line diff. The main issue was default value mismatches (e.g., `gap` defaulting to `Size::AUTO` instead of `0.0`). — [Bevy Taffy 0.2 PR](https://github.com/bevyengine/bevy/pull/6743)
- ReactJIT's layout.lua line 292: `local w = explicitW or pw or 0` — Box nodes without explicit width inherit parent width. Line 497: flex basis falls back to `cw or 0` for children without explicit dimensions. — Source: layout.lua in this repo
- Yoga's measure function callback allows leaf nodes to delegate to external sizing systems. Yoga calls the measure function only when the node lacks a definite dimension, with three constraint modes: Exactly, Undefined, AtMost. — [Yoga Measure Functions](https://www.yogalayout.dev/docs/advanced/external-layout-systems)
- JetBrains Compose Multiplatform has a `sizeToIntrinsics` flag to control whether Image components use intrinsic dimensions, defaulting to current behavior for backward compatibility. — [Compose Multiplatform Issue #3727](https://github.com/JetBrains/compose-multiplatform/issues/3727)

## What I'm unsure about

- Whether the existing `w = explicitW or pw or 0` fallback is actually load-bearing in all 10 example apps, or whether most Box nodes already have explicit widths (the grep shows 85 occurrences of `width: '100%'` or `flexGrow: 1` across 42 files — but I haven't verified how many Box nodes omit width entirely and rely on the parent-width inheritance).
- The actual binary size of Yoga's C library compiled as a .so for Linux x86_64. The search results emphasize "small binary" but never give a concrete number. This matters for the `dist:love` self-extracting binary format.
- Whether QuickJS-ng (the fork ReactJIT uses) has any WASM execution capabilities that could enable a Taffy-via-WASM path. Standard QuickJS does not, but forks may differ.
- How much performance budget exists for a two-pass layout in the Love2D hot loop. The current engine does single-pass layout with text re-measurement; adding a speculative pass for intrinsic box sizing could affect frame time. No benchmarks exist for the current engine.
- Whether Yoga's errata pattern (default = correct, opt-out = legacy) or the inverse (default = legacy, opt-in = new) is more appropriate for ReactJIT given its smaller user base (~10 example apps vs. millions of React Native apps).
- Whether the `lyoga` LuaJIT FFI bindings work with Yoga 3.x or only the 1.x API they were written for. The project hasn't been updated since 2019.

## Sources

- [Announcing Yoga 2.0](https://www.yogalayout.dev/blog/announcing-yoga-2.0)
- [RFC: Yoga Errata Policy](https://github.com/facebook/yoga/issues/1247)
- [React Native 0.74 Release](https://reactnative.dev/blog/2024/04/22/release-0.74)
- [Announcing Yoga 3.0](https://www.yogalayout.dev/blog/announcing-yoga-3.0)
- [Flutter IntrinsicHeight API](https://api.flutter.dev/flutter/widgets/IntrinsicHeight-class.html)
- [Flutter IntrinsicWidth Alternatives](https://www.logique.co.id/blog/en/2025/03/25/intrinsic-widget-alternatives/)
- [Planimeter/lyoga - LuaJIT FFI bindings for Yoga](https://github.com/Planimeter/lyoga)
- [Taffy WASM bindings PR #394](https://github.com/DioxusLabs/taffy/pull/394)
- [Taffy GitHub](https://github.com/DioxusLabs/taffy)
- [LayoutNG Deep Dive](https://developer.chrome.com/docs/chromium/layoutng)
- [Chrome LayoutNG Blog](https://developer.chrome.com/blog/layoutNg-2)
- [Bevy Taffy 0.2 Upgrade PR](https://github.com/bevyengine/bevy/pull/6743)
- [Bevy 0.15 to 0.16 Migration Guide](https://bevy.org/learn/migration-guides/0-15-to-0-16/)
- [Yoga Measure Functions - External Layout Systems](https://www.yogalayout.dev/docs/advanced/external-layout-systems)
- [Yoga Configuring](https://www.yogalayout.dev/docs/getting-started/configuring-yoga)
- [QuickJS C Module Guide](https://gist.github.com/kaosat-dev/ea9126a5c9f09b55e2dd6828c698849a)
- [Compose Multiplatform sizeToIntrinsics](https://github.com/JetBrains/compose-multiplatform/issues/3727)
- [Flutter Breaking Changes](https://docs.flutter.dev/release/breaking-changes)
- [Unity Yoga Layout Discussion](https://discussions.unity.com/t/yoga-layout-engine-version-update/1556536)
- [Yoga Height Depends on Width Issue](https://github.com/facebook/yoga/issues/1045)
