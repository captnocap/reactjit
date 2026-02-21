# Angle 07 — Default Style Systems

## Claims (with confidence)

- Claim (high): Every major UI framework provides a hardcoded default font size so bare text elements render without configuration. React Native defaults to 14px, Flutter's `bodyMedium` defaults to 14.0, SwiftUI defaults to `Font.body` (17pt on iOS), Jetpack Compose M3's `bodyLarge` defaults to 16sp. The specific value is always platform-tuned, not arbitrary.
- Claim (high): Font/text style inheritance propagates through the tree via a framework-specific ambient mechanism, NOT through CSS-style property inheritance on arbitrary elements. Flutter uses `DefaultTextStyle` (an InheritedWidget), SwiftUI uses `.font()` as an environment modifier, Jetpack Compose uses `LocalTextStyle` (a CompositionLocal), and React Native limits style inheritance to nested `<Text>` subtrees only (a `<View>` interrupts the chain).
- Claim (high): All four frameworks use a layered resolution order: explicit prop > local style/modifier > ambient inherited style > theme default > framework hardcoded fallback. This is not CSS cascade — it is a strict priority chain with no specificity rules.
- Claim (high): React's `createContext` with a `defaultValue` maps directly to the CompositionLocal/Environment pattern. A `ThemeContext` provider at the root can supply target-specific defaults (fontSize, fontFamily), and any component calling `useContext(ThemeContext)` gets the closest ancestor's value — identical to how Compose's `LocalTextStyle.current` and SwiftUI's `@Environment(\.font)` work.
- Claim (medium): Flutter's `DefaultTextStyle` is the cleanest model for ReactJIT. It is a widget in the tree (not a global), it provides a full `TextStyle` that children merge with, and `DefaultTextStyle.merge()` lets intermediate containers override specific properties while inheriting the rest. MaterialApp/Scaffold set it up implicitly, but it works standalone.
- Claim (medium): React Native deliberately chose NOT to implement CSS-style inheritance across the tree. The rationale (per RN docs) is that full inheritance creates implicit coupling and makes component isolation harder. Instead, RN recommends creating custom wrapper components (e.g., `<AppText>`) that encode defaults — a composition-over-inheritance approach. The `Text.defaultProps` hack for global defaults was deprecated in React 19.
- Claim (medium): NativeScript is the closest prior art to a "CSS for native" approach — it uses actual CSS files with cascading, element selectors, and inheritance for properties like font-size. Its theme system applies base styles via element selectors (no class names needed) so bare `<Label>` elements get default typography. This works because NativeScript controls the style resolution pipeline.
- Claim (medium): Tamagui (React Native) demonstrates a token-based default system where `SizableText` uses `defaultVariants` with a spread variant (`...fontSize`) that reads from font tokens. This gives a sensible default size that is theme-configurable without requiring explicit fontSize on every usage.
- Claim (low): The ReactJIT linter enforcing explicit fontSize on every `<Text>` is working against the grain of how every major framework operates. All studied frameworks make bare text work out of the box. The linter rule exists because the Lua layout engine's default (14) is a magic number with no theme-awareness — fixing the default system would let the linter rule be relaxed.
- Claim (low): A per-target default configuration (Love2D = 16px, terminal = 1 cell, web = 16px) should be set at the reconciler/root level, not in the Lua layout engine. This mirrors how Flutter's MaterialApp sets ThemeData and how Compose's MaterialTheme provides Typography — the rendering target configures defaults before any user code runs.

## Evidence

- React Native default fontSize is 14 logical pixels on both iOS and Android — [Understanding Default Font Sizes in React Native](https://copyprogramming.com/howto/understanding-default-font-sizes-in-react-native)
- React Native style inheritance is limited to nested Text subtrees; a View breaks the chain — [Style Inheritance of React Native](https://medium.com/@fullsour/style-inheritance-of-react-native-eca1c974f02b)
- React Native recommends custom wrapper components over `Text.defaultProps` (deprecated in React 19) — [Default Props in React Native After React 19](https://www.technetexperts.com/rn-default-props-fix/amp/)
- React Native issue #1768 discusses the deliberate absence of global default styling — [Issue #1768: Defining a default style for components](https://github.com/facebook/react-native/issues/1768)
- Flutter `DefaultTextStyle.fallback()` returns an empty `TextStyle()` when no ancestor provides one; MaterialApp and Scaffold each inject their own `DefaultTextStyle` — [DefaultTextStyle class](https://api.flutter.dev/flutter/widgets/DefaultTextStyle-class.html)
- Flutter `DefaultTextStyle.merge()` creates a merged style inheriting from the current default and overriding specific properties — [DefaultTextStyle.merge()](https://api.flutter.dev/flutter/widgets/DefaultTextStyle/merge.html)
- Flutter Text widget: if style is null or `inherit: true`, it merges with the closest enclosing `DefaultTextStyle` — [Text class](https://api.flutter.dev/flutter/widgets/Text-class.html)
- Flutter's default `bodyMedium` is 14.0pt, defined in Material Design 2018 spec defaults — [Flutter default text themes](https://therdm.medium.com/flutter-default-text-themes-922df071633b)
- SwiftUI Text defaults to `Font.body` when no `.font()` modifier is applied — [SwiftUI under the Hood: Fonts](https://movingparts.io/fonts-in-swiftui)
- SwiftUI `.font()` modifier writes to the environment; all children inherit unless they override — [Environment modifiers](https://www.hackingwithswift.com/books/ios-swiftui/environment-modifiers)
- Jetpack Compose `Text` reads from `LocalTextStyle.current` (a CompositionLocal) for its default style; `ProvideTextStyle` merges with the current value — [Text in Material 3 Compose](https://composables.com/material3/text)
- Jetpack Compose M3 `bodyLarge` defaults to 16sp fontSize, 24sp lineHeight — [Material Design 3 in Compose](https://developer.android.com/develop/ui/compose/designsystems/material3)
- Compose style resolution: explicit parameter > style argument > LocalTextStyle > LocalContentColor fallback — [Locally scoped data with CompositionLocal](https://developer.android.com/develop/ui/compose/compositionlocal)
- Android View style resolution order: AttributeSet > style attribute > defStyleAttr > defStyleRes > theme — [Resolving View Attributes on Android](https://ataulm.com/2019/10/28/resolving-view-attributes.html)
- CSS user agent stylesheet provides 16px default font-size on `<html>`; `font-size` is inherited by default — [CSS inheritance](https://piccalil.li/blog/css-inheritance/)
- NativeScript theme applies base styles via element selectors so bare components get typography without class names — [NativeScript Styling](https://docs.nativescript.org/guide/styling)
- Tamagui `SizableText` uses `defaultVariants` + spread variant `...fontSize` to pull from theme font tokens — [Tamagui styled()](https://tamagui.dev/docs/core/styled)
- React `createContext` default value is used when no matching provider exists in the tree — [createContext](https://react.dev/reference/react/createContext)

## What I'm unsure about

- Exact implementation details of how Flutter's `DefaultTextStyle` interacts with `TextTheme` from `Theme.of(context)` — there is a known Flutter issue (#115310) calling this interaction "unintuitive," and multiple Material widgets (Scaffold, Card, ListTile) override `DefaultTextStyle` in ways that surprise developers. The dual-system complexity is a cautionary tale.
- Whether React Native's 14px default is truly hardcoded in the native platform layer or if it comes from the system font metrics. Some sources say it is platform-dependent, others say it is always 14. The truth likely varies by platform (iOS vs Android).
- How Compose handles `Text` when there is NO `MaterialTheme` wrapper at all — whether `LocalTextStyle` has a meaningful built-in default or if it falls back to an empty/platform TextStyle. The docs imply Typography has defaults but I could not confirm the exact fallback chain without reading source code.
- Whether NativeScript's CSS inheritance model has measurable performance implications compared to the provider/ambient approaches — the fact that React Native explicitly rejected CSS inheritance suggests there may be costs, but NativeScript seems to work fine.
- The exact performance characteristics of React Context for style propagation at scale — frequent context value changes cause re-renders of all consumers, which is why Compose uses `CompositionLocal` (which has static and dynamic variants with different propagation costs). For ReactJIT, where theme values change rarely, this is likely not a concern.

## Sources

- [React Native Text docs](https://reactnative.dev/docs/text)
- [Style Inheritance of React Native](https://medium.com/@fullsour/style-inheritance-of-react-native-eca1c974f02b)
- [Implementing CSS Style Inheritance in React Native](https://www.builder.io/blog/implementing-css-style-inheritance-in-react-native)
- [Default Props in React Native After React 19](https://www.technetexperts.com/rn-default-props-fix/amp/)
- [Issue #1768: Defining a default style for components](https://github.com/facebook/react-native/issues/1768)
- [DefaultTextStyle class — Flutter](https://api.flutter.dev/flutter/widgets/DefaultTextStyle-class.html)
- [DefaultTextStyle.merge() — Flutter](https://api.flutter.dev/flutter/widgets/DefaultTextStyle/merge.html)
- [DefaultTextStyle.fallback() — Flutter](https://api.flutter.dev/flutter/widgets/DefaultTextStyle/DefaultTextStyle.fallback.html)
- [Text class — Flutter](https://api.flutter.dev/flutter/widgets/Text-class.html)
- [TextTheme class — Flutter](https://api.flutter.dev/flutter/material/TextTheme-class.html)
- [Flutter default text themes](https://therdm.medium.com/flutter-default-text-themes-922df071633b)
- [Issue #115310: TextTheme and DefaultTextStyle unintuitive interaction](https://github.com/flutter/flutter/issues/115310)
- [SwiftUI under the Hood: Fonts](https://movingparts.io/fonts-in-swiftui)
- [Environment modifiers — Hacking with Swift](https://www.hackingwithswift.com/books/ios-swiftui/environment-modifiers)
- [SwiftUI Environment propagation](https://www.fivestars.blog/articles/swiftui-environment-propagation/)
- [Font — Apple Developer Documentation](https://developer.apple.com/documentation/swiftui/font)
- [Text in Material 3 Compose](https://composables.com/material3/text)
- [ProvideTextStyle — Material 3 Compose](https://composables.com/material3/providetextstyle)
- [Material Design 3 in Compose](https://developer.android.com/develop/ui/compose/designsystems/material3)
- [Locally scoped data with CompositionLocal](https://developer.android.com/develop/ui/compose/compositionlocal)
- [Resolving View Attributes on Android](https://ataulm.com/2019/10/28/resolving-view-attributes.html)
- [Theming: Default Styles on Android](https://www.valueof.io/blog/configuring-default-styles)
- [CSS inheritance — Piccalilli](https://piccalil.li/blog/css-inheritance/)
- [Inheritance — MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Cascade/Inheritance)
- [NativeScript Styling](https://docs.nativescript.org/guide/styling)
- [NativeScript Theme — GitHub](https://github.com/NativeScript/theme)
- [Tamagui styled()](https://tamagui.dev/docs/core/styled)
- [Tamagui Configuration](https://tamagui.dev/docs/core/configuration)
- [createContext — React](https://react.dev/reference/react/createContext)
- [useContext — React](https://react.dev/reference/react/useContext)
