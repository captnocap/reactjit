# AGENTS.md

Context for AI agents (Codex, Claude, etc.) working in this repository. Last updated: 2026-04-18.

## What This Is

ReactJIT is a React-reconciler-driven UI framework. Apps are written in plain `.tsx` (standard React — hooks, JSX, TypeScript), bundled by esbuild, and run inside the framework's **QuickJS** VM via `qjs_app.zig`. The reconciler emits CREATE/APPEND/UPDATE mutation commands against a Zig-owned `layout.Node` pool; the Zig framework handles layout, paint, hit-test, text, input, events, effects, and GPU.

This is the root-level active stack. It replaced a 50-day Smith-compiler experiment (`tsz/`) that attempted to compile a `.tsz` DSL to Zig ahead of time. That experiment proved the reconciler-over-QuickJS shape matches its runtime perf (`benchmark_bridge_perf.md`: QJS bridge is 52M calls/s, layout is the bottleneck, not JS execution), so AOT compilation buys nothing user-facing and has been shelved as a future optimization lane.

## Repository Layout

```
framework/      <- ACTIVE. Zig runtime (layout, engine, GPU, events, input, state,
                   effects, text, windows, QuickJS bridge).
qjs_app.zig     <- ACTIVE. Host entry. Loads embedded bundle.js, owns Node pool.
runtime/        <- ACTIVE. JS entry (index.tsx), timer subsystem, primitives,
                   classifier, theme, tw (tailwind parser), JSX shim.
renderer/       <- ACTIVE. React-reconciler host config. Emits CMD JSON via
                   __hostFlush. HTML tag remap, tailwind className parsing.
cart/           <- ACTIVE. .tsx apps live here. One file = one app.
scripts/        <- ACTIVE. `ship` = one-command build. `build-bundle.mjs` = esbuild step.
build.zig       <- ACTIVE. Root build (linking parity with Smith-era app target).
stb/            <- ACTIVE. stb_image headers (copied from tsz/stb/).

tsz/            <- FROZEN. Smith-era stack. Read-only reference, like love2d/.
                   Contains the `.tsz` compiler, d-suite conformance, cockpit's
                   Smith-compiled pages, InspectorTsz tools, and ~1500 lines of
                   build.zig machinery. Useful for porting reference.
love2d/         <- FROZEN. The proven reconciler-on-Lua stack. 30+ packages,
                   a full storybook, classifier + theme + tw + hooks all
                   battle-tested. THE reference for any runtime pattern.
archive/        <- FROZEN. Old compiler iterations (v1/v2 tsz). Do not modify.
os/             <- Future (CartridgeOS). Mostly stubs.
game/           <- Dead Internet Game. Separate project.
```

## DO NOT TOUCH

- `love2d/` — Read-only reference stack
- `tsz/` — Frozen Smith-era stack (same treatment as love2d/)
- `archive/` — Frozen old compilers
- Any file inside `tsz/` or `love2d/` — copy OUT of these for porting, never write INTO them

## Ship Path (the only path)

```bash
./scripts/ship <cart-name>          # cart/<name>.tsx → zig-out/bin/<name> (self-extracting)
./scripts/ship <cart-name> -d       # debug build, raw ELF
./scripts/ship <cart-name> --raw    # release, raw ELF (for ldd inspection)
```

What happens:
1. esbuild bundles `cart/<name>.tsx` + `runtime/` + `renderer/` → `bundle.js`.
2. Zig compiles `qjs_app.zig` with `bundle.js` embedded via `@embedFile` — the binary carries its own JS, no runtime file lookup.
3. Linux: ldd walk → bundle every non-system `.so` + `ld-linux` → tarball → prepend self-extracting shell wrapper. Output file reports "POSIX shell script executable (binary data)". Ships anywhere with zero system deps.
4. macOS: `.app` bundle with `Frameworks/` dylib rewrites + ad-hoc codesign.

**No `.tsz`. No Smith. No d-suite.** When you need a feature — inspector, classifier, theme, custom primitive — port the pattern from `love2d/packages/core/src/` or `love2d/lua/` by hand into `runtime/`, or regenerate it fresh in `.tsx` from a description. `love2d/` already solved every runtime pattern we need.

## Dev Path (iterate without rebuilding)

```bash
./scripts/dev <cart-name>       # launches persistent dev host + watches for saves
./scripts/dev <other-cart>      # second terminal: pushes to running host, adds tab
```

**When to rebuild:**
- Cart `.tsx` / `.ts`, anything under `runtime/` or `renderer/` — **no rebuild needed**. The dev host watches saves, re-bundles via esbuild, pushes the new JS over `/tmp/reactjit.sock`, and re-evals. ~300ms save → visible change.
- Zig (`framework/`, `qjs_app.zig`, `build.zig`), `scripts/` — **rebuild required**. Delete `zig-out/bin/reactjit-dev` and re-run `./scripts/dev <cart>`, or explicitly: `zig build app -Ddev-mode=true -Doptimize=ReleaseFast -Dapp-name=reactjit-dev`.

**Dev host is always `-Doptimize=ReleaseFast`.** The Debug build has a pre-existing framework bug that silently crashes on any click. Do not switch the dev compile to Debug without fixing that first.

**Window chrome.** The host is borderless; the top strip IS the OS titlebar. Each `scripts/dev <cart>` invocation registers a tab (bootstrap `main` tab is hidden). Click a tab to switch (full QJS teardown + re-eval). Double-click chrome → maximize/restore toggle. Drag empty chrome → move window. Min/Max/Close buttons on the right. Resize edges at 6px left/right/bottom, 3px top.

**useHotState state preservation: NOT working yet.** The scaffold exists (`runtime/hooks/useHotState.ts` + `framework/hotstate.zig` + `__hot_get/__hot_set` host fns) but in practice state still resets on every hot reload. Do NOT assume atoms persist. Tell users if they ask.

See `runtime/hooks/README.md` for the current matrix of which host bindings are live (fs / localstore / crypto / sqlite / http sync+async / env / exit all live; websocket + process spawn streaming pending).

## Primitives (runtime/primitives.tsx)

`Box`, `Row`, `Col`, `Text`, `Image`, `Pressable`, `ScrollView`, `TextInput`, `TextArea`, `TextEditor`, `Canvas`/`Canvas.Node`/`Canvas.Path`/`Canvas.Clamp`, `Graph`/`Graph.Path`/`Graph.Node`, `Native`.

`Canvas` is pan/zoomable, `Graph` is a lightweight static-viewport chart surface. Both support `gx/gy/gw/gh` coordinate-space positioning on Nodes and SVG `d`/`stroke`/`strokeWidth`/`fill` on Paths. (Note: `viewX`/`viewY`/`viewZoom` on the root tag aren't wired to camera yet — Canvas props are dropped silently until that's done.)

`<Native type="X" {...props} />` is the universal escape hatch for any host-handled node type (Audio, Video, Cartridge, LLMAgent, RigidBody, etc.). The reconciler emits CREATE with that type; the Zig host handles it.

### HTML tags work

`renderer/hostConfig.ts` has `HTML_TYPE_MAP` that remaps standard HTML tags before CREATE. You can copy-paste React markup from anywhere:

```tsx
<div className="p-4 flex-row gap-2">
  <h1>Hello</h1>
  <p>World</p>
  <button onClick={...}>Go</button>
</div>
```

Maps: `div/section/article/main/nav/header/footer/form/ul/li/table/tr/td/a/button/dialog/menu → View`; `span/p/label/h1-6/strong/b/em/i/code/small → Text`; `img → Image`; `input/textarea → TextInput/TextEditor`; `pre → CodeBlock`; `video → Video`. HTML-only attrs (`alt`, `htmlFor`, `aria-*`, `data-*`, etc.) are stripped before the bridge. Headings get auto font-sizes (h1=32, h2=28, …, h6=16).

### Tailwind via `className`

`runtime/tw.ts` (ported from `love2d/packages/core/src/tw.ts`) parses utility class strings at CREATE time and merges them into `style`. Full coverage: spacing (`p-4`, `mx-8`), sizing (`w-full`, `h-[300]`), flex (`flex-row`, `gap-2`, `justify-center`, `items-start`), colors (`bg-blue-500`, `text-slate-200`), radius (`rounded-lg`), borders (`border-2`, `border-blue-400`), typography (`text-xl`, `font-bold`), arbitrary values via brackets (`p-[20]`, `bg-[#ff6600]`).

`style` props win on conflicts. Mix freely:

```tsx
<Box className="p-4 bg-blue-500 rounded-lg" style={{ borderWidth: 2 }}>
```

## Runtime Shims (runtime/)

Ported from love2d, available as of commit `9ce5dda60`:

- **`classifier.tsx`** — global `classifier()` registry + `classifiers` export. Static defaults, `'theme:*'` token resolution, hook-powered `use` field.
- **`theme.tsx`** — `<ThemeProvider colors={...}>` + `useThemeColors()` + `useThemeColorsOptional()`. Minimal (one colors map, no multi-theme switching).
- **`Native`** primitive for custom host-handled types.
- **Timer subsystem** (`runtime/index.tsx`) — real `setTimeout`/`setInterval`/`clearTimeout`/`clearInterval` against a frame-clock. The Zig host calls `globalThis.__jsTick(now)` each frame; __jsTick fires any due timers. `performance.now()` returns host tick time.

## Layout Rules

Flex layout engine in `framework/layout.zig`. Pixel-perfect, shared logic with love2d's engine.

Sizing tiers (first match wins):
1. Explicit dimensions (`width`, `height`, `flexGrow`, `flexBasis`)
2. Content auto-sizing (shrink-wrap children, text measures from font metrics)
3. Proportional fallback (empty surfaces get 1/4 of parent)

Common pitfalls:
- Root containers need `width: '100%', height: '100%'`
- Use `flexGrow: 1` for space-filling, never hardcoded pixel heights
- `ScrollView` needs explicit height (excluded from proportional fallback)
- Don't mix text and expressions in `<Text>` — use template literals

## Host Event Wiring

Events flow both directions through the QuickJS VM in-process:
- Press → Zig `input.zig` → `js_on_press` eval → `globalThis.__dispatchEvent(id, type)` → React handler → state change → new mutations → `__hostFlush` → same Node pool
- Registered per-id by `renderer/hostConfig.ts handlerRegistry`
- Input events: `__dispatchInputChange`, `__dispatchInputSubmit`, `__dispatchInputFocus`, `__dispatchInputBlur`, `__dispatchInputKey`
- Right-click: `__dispatchRightClick` (with prepared payload from `__getPreparedRightClick`)
- Scroll: `__dispatchScroll` (with prepared payload from `__getPreparedScroll`)

## Zig Version

This project uses **Zig 0.15.2**. Training data for most models covers 0.13/0.14. Key breaking changes — check actual source before assuming API shapes.

## Git Discipline

Commit early and often. Descriptive conventional-commit messages (`feat: ...`, `fix: ...`, `refactor: ...`). Multiple AI sessions run in parallel — if `git status` is unexpectedly clean, run `git log --oneline -5` ONCE, see who committed, move on. Do not loop on `git status`.

**Main only, no branches.** The only safe git commands: `git add`, `git commit`, `git push`, `git status`, `git log`, `git diff`. Never `git checkout`, `git stash`, `git reset --hard`, `git branch`, `git switch`. Solo project.

## Model Selection (Claude specifically)

Use Opus 4.6 (`claude-opus-4-6`) or Opus 4.7 (`claude-opus-4-7`) for debugging and anything structural. Sonnet is fine for scaffolding and mechanical work.

## Known Gaps (current)

- **No inspector yet** — planned, regenerate from love2d's `packages/core/src/CartridgeInspector.tsx` + `lua/inspector.lua` as reference. Don't port `tsz/carts/tools/Inspector*.tsz` (frozen, Smith-era).
- **Canvas/Graph viewport** — `viewX`/`viewY`/`viewZoom` on root tags are dropped silently. Needs `canvas.setCameraFor(...)` wiring at CREATE time in `qjs_app.zig`.
- **Cockpit is frozen** — `tsz/carts/cockpit/` still uses Smith. Port to `.tsx` when ready.
- **`runtime/index.ts` barrel export** — carts currently import from specific files (`../runtime/primitives`, `../runtime/classifier`, `../runtime/theme`). A barrel export would tidy that.

## When in doubt

Read `CLAUDE.md` for Claude-specific context. Read `love2d/CLAUDE.md` when touching love2d (though you shouldn't be modifying it). The per-directory `CLAUDE.md` files override or augment the root one inside their trees.
