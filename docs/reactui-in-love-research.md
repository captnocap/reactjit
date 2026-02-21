# React-like UI in Love2D: a landscape assessment

**No single library gives you the full React experience in Love2D today, but the ecosystem offers fragments that collectively get close.** The gap between web-style declarative UI and Lua game frameworks remains wide — you can get hooks and state management (Luact), CSS-like flexbox layout (FlexLöve), or even literal JSX via TypeScript transpilation (Armastus), but no project unifies all three into a mature, production-ready package. The most promising path forward likely involves combining two or three libraries, or porting Roblox's battle-tested react-lua with a custom Love2D renderer.

---

## FlexLöve brings CSS layout to Love2D, but not React's component model

FlexLöve (https://github.com/mikefreno/FlexLove) is the starting point repo and the most comprehensive CSS-like layout engine built natively for Love2D. At **v0.7.3 with 361 commits**, it demonstrates substantial development effort from a single author, though community adoption remains minimal (**2 stars, 0 forks**).

The library's core design philosophy treats everything as a `<div>`. There are no prebuilt components — every UI element is a generic `Element` configured through a declarative property table: `FlexLove.new({ width = "20vw", height = "10vh", flexDirection = "horizontal", justifyContent = "center" })`. This feels familiar to web developers but is fundamentally different from React's component composition model. FlexLöve implements its **own pure-Lua flexbox and grid engine** (not Yoga bindings), supporting `justifyContent`, `alignItems`, `gap`, `gridRows`/`gridColumns`, responsive viewport units (`vw`, `vh`, `%`), and even a `calc()` function for dynamic expressions like `"50% - 10vw"`.

Where FlexLöve diverges sharply from React is state management. It offers **dual rendering modes** — retained (objects persist, you mutate properties directly) and immediate (recreate elements each frame) — but neither provides reactive state, hooks, virtual DOM diffing, or automatic re-rendering. The event system uses `onEvent` callbacks similar to React's `onClick`, and the theming system supports 9-patch rendering with state-based variants (normal, hover, pressed, disabled). Distribution via LuaRocks (`luarocks install flexlove`) and modular build profiles (minimal at ~60% size to full at 100%) show architectural maturity beyond its star count. FlexLöve is best understood as **"CSS-in-Lua"** rather than "React-in-Lua" — strong on layout, weak on reactivity.

---

## Three libraries that get closest to actual React DX

**Luact** (https://github.com/lxsmnsyc/luact) is the most faithful React port targeting Love2D. With **35 stars and 298 commits**, it implements React's Fiber Architecture for consistent 16ms frame scheduling, a full hooks system (`use_state`, `use_effect`, `use_memo`, `use_constant`), functional components via `component()`, a custom reconciler pattern (analogous to `react-dom` vs. `react-native`), error boundaries, and fragment support. Its `luact-love` sub-package provides Love2D-specific elements and hooks. The API closely mirrors React:

```lua
local Counter = Love.component(function()
  local count, setCount = Luact.use_state(0)
  return Love.Element("button", {
    onClick = function() setCount(count + 1) end,
    text = "Count: " .. count
  })
end)
```

Luact achieves roughly **75–80% of React's DX** — missing JSX syntax (inherent Lua limitation), class components, and a complete context API. The critical caveat: **development appears stalled**, and the author (LXSMNSYC, a prolific open-source developer) has moved to other projects. There is no layout engine built in.

**Inky** (https://github.com/Keyslam/Inky) is the most actively maintained React-inspired option, with **82 stars and 8 forks**. It provides a hooks-based widget creation system using `Inky.defineElement(function(self) ... end)`, with `useEffect` for watching prop changes, pointer event hooks (`onPointer`, `onPointerEnter`), state stored on `self.props`, and component composition through element nesting. Inky deliberately provides **zero prebuilt widgets** — you build everything yourself, which mirrors React's philosophy of composition over convention. It's input-agnostic (mouse, touch, gamepad, keyboard). Inky reaches about **50–60% of React's DX**: it has the hooks concept and component definition pattern, but lacks virtual DOM reconciliation, automatic re-rendering on state change, and a layout engine.

**Helium** (https://github.com/qeffects/helium) is the most starred option at **120 stars and 9 forks**, providing a retained-mode framework with component factories, a `hooks/` module, and canvas-backed rendering for performance. Elements receive parameter tables (like props) and support state that triggers re-renders. Helium reaches about **40–50% of React's DX** but has a more Lua-idiomatic API. Its **18 open issues** and uncertain maintenance status are concerns.

---

## The Roblox ecosystem holds the most mature React-Lua implementation

The single most complete React implementation in any Lua variant is **react-lua** (https://github.com/jsdotlua/react-lua), a comprehensive translation of **React 17.x** maintained by Roblox and the community. It includes `useState`, `useEffect`, `useReducer`, `useContext`, `useMemo`, `useCallback`, `useRef`, `useLayoutEffect`, `createContext`, `forwardRef`, `React.memo`, a full Fiber reconciler, concurrent mode via `createRoot`, error boundaries, and testing utilities including `act()`. This is **production-grade software** powering millions of Roblox experiences.

The challenge is portability. react-lua is written in **Luau** (Roblox's typed Lua variant) and its renderer (`ReactRoblox`) targets Roblox's UI primitives (`ScreenGui`, `TextLabel`, `Frame`). Adapting it for Love2D would require writing a `ReactJIT2D` renderer package — significant effort, but the core `React` package is relatively platform-agnostic. The predecessor project **Roact** (https://github.com/Roblox/roact) is simpler (React 15-era API, no hooks) but similarly Roblox-coupled and now officially deprecated.

A companion library worth noting is **Fusion** (https://github.com/dphfox/Fusion), which takes a signals-based approach (more SolidJS than React) with reactive `State()` containers and `Computed()` derived values. Its core reactive primitives are conceptually portable even if the UI construction layer is Roblox-specific.

---

## Layout engines, web views, and the flexbox gap

Beyond FlexLöve, several projects have attempted CSS-like layout for Love2D with varying success. **DOMinatrix** (https://github.com/karai17/DOMinatrix) was the most ambitious circa 2015 — a full DOM-like framework with CSS selectors, box model, and MVC architecture — but it's **effectively abandoned**. **Layouter** (https://github.com/nekromoff/layouter, ~20 stars) offers a simpler Bootstrap-inspired 12-column grid. **LURE** (https://github.com/rdlaitila/LURE) attempted a full HTML/CSS renderer in pure Lua but never reached the point of producing rendered content — a cautionary tale about the complexity of even partial CSS implementation.

The most interesting untapped opportunity is **Clay** (https://github.com/nicbarker/clay), a high-performance C layout library (~4K lines, flexbox-like, renderer-agnostic) that went viral in late 2024. It has bindings for Rust, C#, and Odin but **no Lua bindings exist yet**. Creating LuaJIT FFI bindings for Clay would give Love2D a battle-tested layout engine with minimal effort. Similarly, **Yoga** (Facebook's flexbox engine) has been bound to Lua via the Defold game engine (https://github.com/farism/defold-yoga), proving the FFI path is viable, but no one has created Love2D-specific bindings.

**Embedding web views inside Love2D is effectively unsolved.** LuaCEF (https://github.com/nomi-san/luacef) provides Lua bindings to Chromium Embedded Framework but creates separate windows incompatible with Love2D's rendering pipeline. lua-webview (https://github.com/javalikescript/lua-webview) has the same separate-window limitation. The Love2D community consensus across multiple forum threads is that rendering HTML/CSS inside a game window is impractical — the overhead of even a subset CSS renderer is enormous, and results never match browser quality. The practical workaround is `love.system.openURL()` for external links or a hybrid architecture with separate tool windows.

---

## Lua dialects and alternative approaches to React-like DX

**Fennel** (https://fennel-lang.org/) is the most promising Lua dialect for declarative UI patterns in Love2D. As a Lisp that compiles directly to Lua, Fennel's S-expression syntax naturally produces declarative tree structures, and its **macro system enables JSX-like syntax transformations at compile time with zero runtime overhead**. The Fennel+Love2D ecosystem is the most active of any Lua dialect pairing, with dozens of shipped games, an official starter template (https://gitlab.com/technomancy/min-love2d-fennel), hot-reloading support, and the annual Spring Lisp Game Jam as a community focal point. No dedicated React-like framework exists for Fennel+Love2D, but any Lua UI library works directly from Fennel code, and building a virtual DOM reconciler in Fennel is arguably more natural than in raw Lua.

**Armastus** (https://github.com/praisethemoon/armastus) takes the most radical approach: actual **JSX/TSX syntax** compiled to Lua via `typescript-to-lua`. You write React-style components in TypeScript with `useState`, routing (`Switch`/`Router`), and CSS-like inline styles, then the toolchain transpiles everything to Love2D-compatible Lua. This delivers the closest authoring experience to React (~70% DX), but the author describes it as **"still very impractical to use"** — debugging transpiled Lua from TypeScript source is painful, and the project is in early experimental stages.

**MoonScript** has a functional but declining ecosystem. MeowUI (https://github.com/MoonGameLab/MeowUI, 12 stars) is written entirely in MoonScript and provides extensible GUI control modules for Love2D, but MoonScript's creator (leafo, who also built itch.io) has moved on, and the language sees diminishing community investment. **Teal** (typed Lua) adds valuable type safety for enforcing prop types and state shapes but contributes nothing to declarative UI patterns.

Two additional libraries worth noting: **Badar** (https://github.com/Nabeel20/Badar) offers a custom UI syntax specifically designed for easy component composition, and **YALG** (https://github.com/sasszem/yalg) is described as a "reactive UI for last minute UIs" — both are small projects but signal community demand for more declarative approaches.

---

## Practical comparison and recommended paths forward

| Library | React DX | Layout | State/Hooks | Maturity | Stars |
|---------|----------|--------|-------------|----------|-------|
| **Luact** | ~75% | None | Full hooks + Fiber | Stalled | 35 |
| **Armastus** | ~70% (TSX) | Basic CSS | useState | Experimental | Low |
| **Inky** | ~55% | None | Hooks-inspired | Active | 82 |
| **Helium** | ~45% | Basic | State + factories | Uncertain | 120 |
| **FlexLöve** | ~35% | Full flexbox/grid | None | Active | 2 |
| **react-lua** | ~95% | None (Roblox) | Full React 17.x | Production | High |

The most practical strategies for achieving React-like DX in Love2D today are:

- **Combine Inky + FlexLöve**: Use Inky's hooks-based component model for state and composition, paired with FlexLöve's layout engine for flexbox positioning. This requires glue code but yields the best balance of actively maintained libraries.
- **Fork and extend Luact**: If you can tolerate maintaining a fork, Luact's Fiber architecture and hooks system are architecturally sound. Add a layout engine (perhaps Clay via FFI bindings) and you'd have the closest thing to a complete React-for-Love2D.
- **Port react-lua's core**: The highest-effort but highest-reward approach. Write a `ReactJIT2D` renderer targeting Love2D's drawing primitives, adapting the Luau type annotations to standard Lua. This gives you a production-tested React implementation with the full hooks API.
- **Fennel + custom framework**: If you're open to Lisp syntax, Fennel's macros let you build JSX-like declarative trees with compile-time transformation, and its active community provides the best long-term ecosystem support of any approach.

The fundamental tension is that **React's paradigm assumes a retained DOM that the framework owns**, while Love2D's architecture is built around a `love.draw()` callback that runs every frame. Bridging this gap requires either an immediate-mode reconciler (what Luact does) or a retained-mode element tree with dirty-checking (what Helium approximates). Neither approach is as clean as React-DOM's relationship with the browser, which is why every Love2D solution feels like a partial approximation rather than a native fit.
