# CLAUDE.md

## Self-Audit Protocol (MANDATORY)

At the START of every context window, run `date +%H` via Bash. If the hour is >= 12 (past noon), read `didifuckup.md` in this repo root. Check if today's date is marked. If it is NOT marked, spawn a background agent to audit your own recent changes — grep for anything in `.ts`/`.tsx` files that isn't tree-diffing or structure declaration. That means: math, formatting, string manipulation, parsing, animation logic, timers, input handling, data transformation — any of that living in TypeScript is a fuckup. Log the results in `didifuckup.md` with today's date so the next context window knows the audit already ran. If today IS already marked, skip the audit and continue. React diffs trees and declares structure. That is ALL it does. Everything else is Lua. No exceptions. No excuses.

---

This is React stripped of browser magic and rendered as raw geometry.

STOP MAKING INPUT-BASED BEHAVIORS HAVE ANY REASON TO SEE THE LIGHT OF DAY IN A JAVASCRIPT LIFECYCLE. REACT IS NOT GOOD AT INPUT. INFACT IT SUCKS REALLY BAD. REACT IS HERE TO DECLARE A LAYOUT AND SOME STATE MUTATIONS. OTHERWISE ITS JUST A PRETTY FACE FOR LUA TO DO ALL THE ACTUAL PROGRAMMING HERE. THATS WHY THE TYPESCRIPT SIDE LOOKS LIKE A BUNCH OF ONE LINERS. IF YOU ARE EFFECTIVELY NOT SETTING UP FOR A ONE LINER IN TSX YOU ARE PROBABLY WRONG.

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Who Maintains This

**You do.** When you encounter bugs, they are from other versions of yourself in another parallel instance. If a bug from another Claude is preventing you from progressing forward, help yourself, do not dismiss as 'not my code'; it is your code. It is all your code.

**Commiting Work:** If you choose to commit work on your own, then do not commit the work of other Claudes. If I prompt you to commit work, I expect you to commit all the work left unaccounted for, its from you in a parallel universe who forgot to anyways.

## One-Liner Design Philosophy

When adding a new capability, feature, or integration — always ask: **can someone who doesn't code use this in one line?** If the answer is no, wrap it until it is. The target user is someone who knows their domain (music, art, data, games) but doesn't know bridges, RPCs, or Lua internals. An AI should be able to discover and control it without documentation.

The pattern is the **declarative capability system** (`lua/capabilities.lua` + `lua/capabilities/` for multi-file capabilities):
1. Lua side: `Capabilities.register("Audio", { schema, create, update, tick, destroy })`
2. React side: `<Audio src="beat.mp3" playing volume={0.8} />`
3. AI discovery: `useCapabilities()` returns schemas for everything registered

Every new Lua-side feature (audio, timers, sensors, file watchers, notifications, whatever) should follow this pattern. The Lua module does the work, the React component is a one-liner, and the schema is the documentation. If you're adding something that requires the user to call `bridge.rpc()` or understand the transport layer, you haven't finished — wrap it in a capability.

## The Proxy Input Rule (NON-NEGOTIABLE)

**The ClaudeCanvas (PTY/vterm) is the single source of truth for ALL text state.** The semantic classifier scrapes it every frame into classified tokens. Every piece of UI that displays text from the session — input bars, prompt displays, conversation views, ALL of it — reads from classified tokens. Period.

**An input bar is NOT an input.** It is a rectangle that displays the `user_input` classified token's text via `value={promptText}`. It holds focus so keystrokes route to ClaudeCanvas via `keystrokeTarget`/`submitTarget`. It has ZERO local text state. It does not accumulate characters. It does not interpret Enter or Escape. It forwards keystrokes to the canvas and displays what the classifier says. That's it.

**The pattern (memorize this):**
1. `usePromptText()` hook polls `claude:classified`, finds the prompt token, returns the text
2. `<Input autoFocus keystrokeTarget="ClaudeCanvas" submitTarget="ClaudeCanvas" value={promptText} />`
3. Lua proxy mode: keystrokes forward to target, TextInput never touches its own buffer

**If you are ever tempted to:**
- Sync text between two buffers → STOP. Read from the classified token.
- Make a TextInput manage its own text AND forward to a target → STOP. One SSoT.
- Add "proxy mode" or "forwarding" logic for text content → STOP. The display reads from the classifier. Keystrokes go to the canvas. Two separate concerns. Don't mix them.

**This is exactly how BlankSlateCanvas works.** It polls `claude:classified` and renders tokens. The input bar does the same thing for the prompt token. Same pipe. Same SSoT. No special cases.

## Model Selection

**Always use Opus 4.6 (`claude-opus-4-6`) for debugging.** Sonnet is fine for scaffolding, writing new components, and routine tasks. But when tracking down layout bugs, inspector issues, coordinate mismatches, or anything where the real problem is structural and not obvious — use Opus. It finds the actual bug instead of proposing workarounds that mask it.

## React's Role (NON-NEGOTIABLE)

React is a **layout declaration engine and tree diffing algorithm.** That's it. It is not a runtime. It is not an input handler. It is not a state manager. It is a proxy for Lua.

- **React declares layout and diffs the tree.** Components return geometry descriptions (Box, Text, Image) that become Lua nodes with position, size, color, and text. React's job ends when the mutation commands flush to Lua.
- **React does NOT handle input.** All keyboard, mouse, and touch events are owned by Lua. React event handlers (onPress, onKeyDown) are callbacks that Lua invokes — React never polls the OS event pump.
- **React does NOT manage runtime state well.** `useHotState()` stores state in Lua memory and survives hot reload. `useLocalStore()` persists to SQLite. React's `useState` is for ephemeral UI state only.
- **react-dom does not exist in this framework.** There is no DOM target. There never will be. Components do not render `<div>`, `<span>`, `<input>`, or any HTML element. If you see a component branching on renderer mode to produce DOM elements, that code is wrong and must be removed.
- **If React is doing anything beyond declaring layout + forwarding to Lua = massive problem.** Late frames, input lag, state desync — all symptoms of React trying to be a runtime instead of a proxy.

## What This Is

ReactJIT is a Love2D rendering framework that uses React as its layout declaration layer. The pipeline: React reconciler → mutation commands → QuickJS bridge → Lua layout engine → Love2D painter (OpenGL 2.1).

**Love2D is the only renderer.** LuaJIT + Love2D + OpenGL 2.1. Multi-window support via subprocess IPC (each `<Window>` spawns a child Love2D process connected over TCP). Entry point: `love .`. Love2D owns the run loop, the GL context, the font rasterizer, and the event pump.

**WASM builds** use love.js (Emscripten) to compile the same Love2D pipeline to run in a browser `<canvas>`. It is still Love2D rendering — not DOM, not CSS, not react-dom. The WASM build uses Module.FS as the bridge transport instead of QuickJS FFI, but the rendering pipeline is identical.

The target interface is formalized in `lua/target_love2d.lua`. A target is a `{ name, measure, painter, images?, videos? }` table — the rest of the framework never needs to know which one is active.

## CLI-First Workflow (IMPORTANT)

**Always use the `reactjit` CLI tool instead of manual esbuild commands.** The CLI
encodes correct esbuild flags, enforces lint gates before builds, handles runtime file
placement, and produces correct distribution packages. Running raw esbuild commands
directly will use wrong flags, skip linting, and produce broken builds.

```bash
rjit dev                        # Watch + HMR (Love2D). Do NOT run esbuild --watch manually.
rjit build                      # Dev build (Love2D). Do NOT run esbuild manually.
rjit build linux                # Production: self-extracting Linux binary (x64)
rjit build macos                # Production: macOS bundle (Intel x64)
rjit build macmseries           # Production: macOS bundle (Apple Silicon arm64)
rjit build windows              # Production: Windows archive (x64)
rjit build dist:love            # Production: self-extracting Linux binary (Love2D + glibc)
rjit init <name>                # Scaffold new project (do NOT mkdir + copy manually)
rjit lint                       # Static layout linter — run after ANY component change
rjit screenshot [--output]      # Headless capture — verify layouts visually
```

**After writing or modifying any component:** run `rjit lint`, then
`rjit screenshot --output /tmp/preview.png` and inspect the result.

The CLI handles all targets. The npm scripts in root package.json are for monorepo
development convenience only — never use raw esbuild commands for project builds.

## Testing with `rjit test` (USE THIS)

ReactJIT has a built-in test runner. You own the full stack — the instance tree, layout results, and event system — so tests run *inside* the Love2D process with direct access to everything. No browser automation. No ports. No sockets.

**Workflow:**
```bash
cd examples/<project>
rjit build                        # app must be built first
rjit test tests/my.test.ts        # run the spec
```

**Writing specs — no imports, globals are injected:**
```typescript
// tests/my-app.test.ts
// Globals: test(), page, expect() — no import needed

test('submit button is visible', async () => {
  const btn = page.find('Pressable', { testId: 'submit' });
  await expect(btn).toBeVisible();
});

test('typing in the search box updates results', async () => {
  const input = page.find('TextInput', { testId: 'search' });
  await input.type('hello');
  await expect(page.find('Text', { testId: 'result-count' })).toContainText('hello');
});

test('clicking a button triggers state change', async () => {
  await page.find('Pressable', { testId: 'toggle' }).then(l => l.click());
  await expect(page.find('Text', { testId: 'status' })).toHaveText('on');
});
```

**Selectors — `page.find(componentName, props?)`:**
- `page.find('Pressable', { testId: 'submit' })` — by component type + prop
- `page.find('Text')` — any Text node
- `page.find('TextInput', { placeholder: 'Search...' })` — by any prop value
- Component name matches `debugName` (e.g. `'Pressable'`, `'Box'`, `'ScrollView'`) or raw type (`'View'`, `'Text'`)
- Add `testId` props to components you want to target: `<Box testId="sidebar">` — they flow through to the node tree automatically

**Available actions:**
```typescript
await locator.click()             // mouse press + release at element center + 1 frame wait
await locator.type('hello')       // click to focus + inject chars + 1 frame wait
await locator.key('return')       // inject keypressed/keyreleased (for Enter, Escape, arrows)
await locator.text()              // returns text content of the element
await locator.rect()              // returns { x, y, w, h }
await locator.all()               // returns array of all matching nodes
await page.wait()                 // wait 1 frame explicitly (after animations)
await page.wait(3)                // wait N frames
await page.screenshot('/tmp/s.png') // capture current frame
```

**Available matchers:**
```typescript
await expect(locator).toBeVisible()           // element exists and has non-zero size
await expect(locator).toBeFound()             // element exists in the tree
await expect(locator).toHaveText('exact')     // exact text match
await expect(locator).toContainText('substr') // substring match
await expect(locator).toHaveRect({ x, y, w, h }) // pixel rect within ±1px tolerance
```

**Timing model — each `await rpc()` = one frame:**
- Every `await` in a test naturally waits one frame for the bridge round-trip
- `click()` and `type()` add an extra `wait` automatically so React has time to re-render before the next assertion
- If a state change triggers an animation or async work, use `await page.wait(N)` to give it time

**When to write tests:**
- After implementing any interactive feature (button → state change, input → filter, etc.)
- When debugging a layout: write a `toHaveRect()` test to pin the geometry
- When fixing a regression: write the test first, watch it fail, fix it, watch it pass
- Treat `rjit test` the same way you'd treat `rjit lint` — run it before calling a feature done

**Implementation files (do not confuse these):**
- `lua/testrunner.lua` — Lua engine: tree query, event injection, screenshot, report
- `cli/lib/test-shim.js` — JS globals (test/page/expect/_runTests) eval'd into QuickJS before spec
- `cli/commands/test.mjs` — CLI: bundles spec, launches Love2D, streams results
- `lua/init.lua` — RJIT_TEST=1 detection, RPC handler registration, frame counter
- `packages/renderer/src/Love2DApp.ts` — exposes `globalThis.__rjitBridge` for the shim

## Source-of-Truth Architecture (CRITICAL)

There are two categories of files: **globally distributed** (framework internals) and **project-specific** (user application code). Editing the wrong copy is the #1 source of "it builds but doesn't work" bugs.

### Globally distributed files (framework)

These live at the **monorepo root** and get copied into projects via the CLI:

| Source of truth | Copied to by `make cli-setup` | Copied to projects by `reactjit init/update` |
|---|---|---|
| `lua/*.lua` | `cli/runtime/lua/` | `<project>/lua/` |
| `packages/core/` | `cli/runtime/reactjit/shared/` | `<project>/reactjit/shared/` |
| `packages/renderer/` | `cli/runtime/reactjit/renderer/` | `<project>/reactjit/renderer/` |
| `quickjs/libquickjs.so` | `cli/runtime/lib/` | `<project>/lib/` |

**Rules:**
- **ALWAYS edit the source-of-truth files** (`lua/`, `packages/core/`, `packages/renderer/`). NEVER edit `cli/runtime/` or `<project>/lua/` or `<project>/reactjit/` directly — those are disposable copies.
- After editing any source-of-truth file, run the full sync pipeline:
  ```bash
  make cli-setup              # source → cli/runtime/
  cd examples/<project>
  reactjit update             # cli/runtime/ → project's local copies
  reactjit build               # rebuild
  ```
- `reactjit update` syncs `lua/`, `lib/`, and `reactjit/` from the CLI runtime into the current project without touching `src/`. Use it to hydrate existing projects after framework changes.
- `reactjit update` is symlink-aware: if a destination (e.g. `lua/`) is a symlink, it skips the copy and prints a message. This protects the storybook's source-of-truth symlinks.
- `reactjit build` has a fallback: if no local `lua/` exists, it reads from `cli/runtime/lua/`. But `reactjit dev` requires local copies, so always run `reactjit update` for dev workflows.

### The storybook reads from source directly (NEVER copy into it)

The storybook is NOT a consumer project — it IS the framework. It reads from source-of-truth directly:
- **TypeScript**: esbuild resolves `packages/*/src/` via relative imports and npm workspace symlinks. `storybook/reactjit/` does not exist and must never be created.
- **Lua**: `storybook/love/lua` is a symlink → `../../lua` (the monorepo root `lua/`). Never replace this symlink with a real directory.
- **`make cli-setup` does NOT sync into the storybook.** Only `cli/runtime/` is populated.
- **Do NOT run `reactjit update` from the storybook directory.** The symlink guard will skip `lua/`, but there's no reason to run it.
- **Do NOT create `storybook/lua/` or `storybook/reactjit/` as real directories.** Both are gitignored. If they appear, something is wrong.

### Project-specific files (application code)

These are unique to each project and are NOT managed by the CLI:

- `src/` — user application code (App.tsx, stories, etc.)
- `main.lua`, `conf.lua` — Love2D entry points (if using Love2D target)
- `package.json` — project dependencies
- `packaging/` — build customizations

**Rules:**
- These files are safe to edit directly in any project.
- `reactjit init` creates starter versions; `reactjit update` never touches them.
- To copy app code between projects, copy only `src/` and any custom entry points.

### Adding a new Lua-side feature (checklist)

1. Edit/create files in `lua/` (the source of truth)
2. Edit/create files in `packages/core/src/` and `packages/renderer/src/` as needed
3. The storybook picks up both changes automatically (Lua via symlink, TS via esbuild). Rebuild the storybook bundle: `make build-storybook-love`
4. `make cli-setup` — propagates to `cli/runtime/` for consumer projects
5. For each example project that needs the feature:
   - `cd examples/<project> && reactjit update` — syncs runtime files
   - `reactjit build` — rebuilds
6. For new projects: `reactjit init <name>` — gets everything automatically

## Other Build Commands

```bash
npm install                       # Install dependencies

# QuickJS setup
make setup                        # Clones quickjs-ng, builds libquickjs.so
make build                        # Builds all targets
make dist-storybook               # Self-extracting Linux binary with bundled glibc
```

The root package.json still has `npm run build:*` scripts for monorepo example builds,
but prefer `cd examples/<project> && reactjit build <target>` for consistency.

## Monorepo Structure

npm workspaces monorepo. Path aliases (`@reactjit/*`) defined in `tsconfig.base.json`.

| Package | Import | Role |
|---------|--------|------|
| `packages/core` | `@reactjit/core` | Primitives (Box, Text, Image), components, hooks, animation, types |
| `packages/renderer` | `@reactjit/renderer` | react-reconciler host config, instance tree, event dispatch |
| `packages/3d` | `@reactjit/3d` | 3D scene, lighting, materials (Scene3D) |
| `packages/ai` | `@reactjit/ai` | LLM agent integration |
| `packages/apis` | `@reactjit/apis` | External API wrappers |
| `packages/audio` | `@reactjit/audio` | Audio playback, synth capabilities |
| `packages/controls` | `@reactjit/controls` | Higher-level UI controls |
| `packages/crypto` | `@reactjit/crypto` | Cryptographic utilities |
| `packages/geo` | `@reactjit/geo` | Geolocation, maps |
| `packages/media` | `@reactjit/media` | Video, media playback |
| `packages/router` | `@reactjit/router` | Navigation / routing |
| `packages/rss` | `@reactjit/rss` | RSS feed parsing |
| `packages/server` | `@reactjit/server` | HTTP server capabilities |
| `packages/storage` | `@reactjit/storage` | Persistent storage (SQLite, docstore) |
| `packages/theme` | `@reactjit/theme` | Theming system |
| `packages/webhooks` | `@reactjit/webhooks` | Webhook handling |

**Lua runtime** (`lua/`): Layout engine (`layout.lua`), painter (`painter.lua`), QuickJS FFI bridge (`bridge_quickjs.lua`), instance tree (`tree.lua`), event system (`events.lua`), text measurement (`measure.lua`), error overlay, visual inspector (F12), multi-window manager (`window_manager.lua`).

**Target interface** — `lua/target_love2d.lua` (uses `painter.lua` + `measure.lua` + Love2D backend). Love2D entry point: `love .`. Multi-window support: `lua/window_manager.lua`.

**Storybook** (`storybook/`): Top-level reference app — component library, documentation, playground. Not an example project.

**Examples** (`examples/`): Consumer projects that demonstrate framework features. Includes `native-hud/`, `neofetch/`, `playground/`, `wallet/`, `dvd/`, `audio-synth/`, `browser/`, `ai-box/`, `weather/`, and others. Each is self-contained with its own `package.json` and local runtime copies via `reactjit update`.

## esbuild Formats by Target

These are encoded in `cli/targets.mjs` — you should never need to specify them manually:

- **Love2D**: `--format=iife --global-name=ReactJIT` (bundle runs inside QuickJS in-process). Launched via `love .`.

## Critical Layout Rules

**The flex layout engine is pixel-perfect.** It has been exhaustively verified — flex distribution math, cursor positions, and post-layout sizes are all exact to the pixel. If you encounter a layout overflow or sizing problem, it is almost certainly **not** a layout engine bug. Look at the component itself first: does it hardcode a width that overflows its parent? Does it ignore its container's bounds? The Slider component once hardcoded `width: 200` regardless of parent size — that caused a month of debugging that blamed the flex engine when the engine was correct all along. Check components before blaming layout.

### How sizing works (know this before writing layouts)

The layout engine has three sizing tiers. They resolve in order — the first one that applies wins:

1. **Explicit dimensions** — you set `width`, `height`, `flexGrow`, or `flexBasis`. This always takes priority.
2. **Content auto-sizing** — containers with children auto-size from their content. Text nodes measure from font metrics. This is the default for any element with children.
3. **Proportional surface fallback** — empty surface nodes (Box, Image, Video, Scene3D) with no explicit dimensions and no children fall back to **1/4 of their parent's available space**. This cascades: in an 800px window, an unsized Box is 200px; a nested unsized Box inside it is 50px. Interactive elements (Text, TextInput, Pressable, CodeBlock) and ScrollView are NOT surfaces — they size from content or require explicit dimensions.

**What this means in practice:** Stop hardcoding pixel heights on panels, sidebars, and sections that contain children. Use `flexGrow: 1` on the element that should absorb remaining space, and let everything else auto-size. The only things that need explicit dimensions are the root container and opaque leaves (images, empty decorative boxes, scroll containers).

### Rules that still cause bugs

1. **Root containers** need `width: '100%', height: '100%'` — the proportional fallback doesn't apply at the root because the root IS the viewport
2. **Use `flexGrow: 1` for space-filling elements** — in a column of header + content + footer, the content should have `flexGrow: 1` to absorb remaining space. Do NOT hardcode pixel heights to "fill" a known window size — that creates deadspace at different resolutions
3. **ScrollView needs explicit height** — scroll containers are excluded from the proportional fallback. They need `height` or `flexGrow` to define their viewport
4. **Don't mix text and expressions in `<Text>`** — `<Text>Hello {name}!</Text>` creates 3 separate `__TEXT__` nodes that stack vertically instead of rendering inline. Use a template literal: `{`Hello ${name}!`}`. The linter enforces this via `no-mixed-text-children` (pending reconciler-level fix to make this just work)

### The Scissor Rule (NON-NEGOTIABLE)

**Never use raw `love.graphics.setScissor(x, y, w, h)` with content-space coordinates inside a Lua renderer.** `setScissor` operates in screen/window coordinates and ignores the current transform stack. When a node is inside a ScrollView, the painter applies `love.graphics.translate(-scrollX, -scrollY)` — drawing coordinates shift correctly, but a raw scissor stays in the wrong position. The chart elements lived with this bug for weeks.

**The correct pattern** (used by `codeblock.lua`, `painter.lua`, and `chart.lua`):

```lua
-- Save previous scissor and convert content coords → screen coords
local psx, psy, psw, psh = love.graphics.getScissor()
local sx, sy = love.graphics.transformPoint(x, y)
local sx2, sy2 = love.graphics.transformPoint(x + w, y + h)
love.graphics.intersectScissor(sx, sy, math.max(0, sx2 - sx), math.max(0, sy2 - sy))

-- ... draw content ...

-- Restore previous scissor
if psx then
  love.graphics.setScissor(psx, psy, psw, psh)
else
  love.graphics.setScissor()
end
```

**Why `intersectScissor` not `setScissor`:** Parent nodes (ScrollView, overflow:hidden containers) may already have an active scissor region. `intersectScissor` respects that; `setScissor` clobbers it.

**When this applies:** Any Lua module that renders content inside a node's bounds (chart.lua, codeblock.lua, texteditor.lua, latex.lua, any future canvas-like renderer). If you're drawing in overlay/inspector/devtools code that uses absolute screen coordinates, raw `setScissor` is fine.

### Layout anti-patterns (DO NOT DO)

- **Hardcoding pixel heights to fit a known window size.** `<Scene style={{ height: 260 }}/>` in a 600px-tall parent leaves 340px of dead air. Use `flexGrow: 1` instead and let the element fill available space.
- **Budgeting pixels manually.** Don't add up `48 + 260 + 80 + gaps` to hit a target height. Let flex do this — one element grows, the rest auto-size from content.
- **Using fixed dimensions where auto-sizing works.** If a panel contains text and buttons, it knows its own size. Don't constrain it with a hardcoded height — let it shrink-wrap, and give a sibling `flexGrow: 1` to fill the gap.

The static linter (`cli/commands/lint.mjs`) catches remaining issues (mixed text children, missing props, invalid style properties) as build-blocking errors. Escape hatch: `// rjit-ignore-next-line`.

## Auto-Sizing and Proportional Fallback

The layout engine resolves dimensions through three tiers:

### Tier 1: Content auto-sizing (containers with children)

Containers automatically size to fit their content. Text measures from font metrics. This is the most common case — don't override it with hardcoded dimensions.

```jsx
// No explicit sizing needed — container wraps its content
<Box>
  <Text fontSize={16}>Title</Text>
  <Text fontSize={14}>Subtitle</Text>
</Box>
```

- **Column**: height = sum of children + gaps + padding, width = max child width + padding
- **Row**: width = sum of children + gaps + padding, height = max child height + padding

### Tier 2: Proportional surface fallback (empty surfaces)

Empty surface nodes (Box, Image, Video, Scene3D) with no children and no explicit dimensions get **1/4 of their parent's available space** instead of zero. This cascades:

```
Window: 800×600
  └─ Unsized Box → 200×150 (parent/4)
       └─ Unsized Box → 50×37 (parent/4)
```

**Surfaces** (get fallback): Box, Image, Video, VideoPlayer, Scene3D
**Not surfaces** (size from content or need explicit): Text, TextInput, Pressable, CodeBlock, ScrollView

### Tier 3: `flexGrow` (fill remaining space)

Use `flexGrow: 1` on the element that should absorb whatever space is left after siblings are measured:

```jsx
<Box style={{ width: '100%', height: '100%' }}>
  <Header />                              {/* auto-sizes to content */}
  <Box style={{ flexGrow: 1 }}>          {/* absorbs remaining space */}
    <MainContent />
  </Box>
  <Footer />                              {/* auto-sizes to content */}
</Box>
```

### When to use explicit sizing

- Root containers (`width: '100%', height: '100%'` to fill viewport)
- Containers with percentage-sized children (percentages need a known parent)
- ScrollView (needs explicit height to define its scroll viewport)
- When you want a specific pixel size that differs from auto or proportional

### Limitations

- Percentage-based children in auto-sized parents resolve to 0
- `aspectRatio` requires at least one explicit dimension
- ScrollView needs explicit height (excluded from proportional fallback)
- The proportional fallback doesn't apply when the parent's size is indefinite (auto-sizing containers that haven't resolved yet)

## Adding Event Handlers to Primitives (IMPORTANT)

The `Box` component in `packages/core/src/primitives.tsx` uses an **explicit whitelist** for event handlers. It destructures each `on*` prop by name and passes them individually to `React.createElement('View', { ... })`. If you add a new event type (e.g. `onFileDrop`), you must:

1. Add the handler type to `BoxProps` in `packages/core/src/types.ts`
2. Add it to the destructure list in `Box()` in `primitives.tsx`
3. Add it to the `createElement` props object in `Box()`
4. Subscribe to the bridge event in `packages/renderer/src/eventDispatcher.ts`

If you skip steps 2-3, the handler silently disappears — `extractHandlers` in hostConfig never sees it, `hasHandlers` is false on the Lua node, and hit testing skips it. The symptom is events being pushed correctly from Lua but never reaching React.

## Primitives

Import from `@reactjit/core` — `Box`, `Text`, `Image`, `Pressable`, `ScrollView`, `TextInput`, `Modal`, etc.

## The Storybook IS the Framework (CRITICAL)

The storybook (`storybook/`) lives at the monorepo root, not in `examples/`. It is not a demo — it is the canonical reference implementation of ReactJIT. Every framework capability is demonstrated there. The long-term vision is that the storybook, the CLI, the docs, the playground, and the visual editor all converge into a single binary: `reactjit`.

This has two non-negotiable consequences:

**1. What is true of the storybook is true of the framework.** If a configuration change, build flag, library filter, packaging rule, or runtime behavior is established in the storybook, it must be applied at the framework level (CLI templates, dist pipeline, `packaging/storybook/`, `cli/targets.mjs`, etc.) — not left as a one-off in a single project's files. The storybook is where things are proven; the framework is where they become permanent. Never solve something only for the storybook and call it done.

**2. Every new feature gets a storybook story.** When you implement a new capability — a new component, hook, event type, Lua-side feature, layout behavior, anything user-facing — you must also create or update a story in `storybook/src/stories/` that demonstrates it. Do not wait to be asked. The story is part of the feature, not a follow-up task.

## Git Discipline (CRITICAL)

Commit early and often. This project has no test suite, so git history IS the safety net. **You must commit your own work as you go. Do not leave it for the user or another Claude to deal with.**

### When to commit (non-negotiable)

- **After completing each logical unit of work.** Finished a feature? Commit. Fixed a bug? Commit. Added a new component? Commit. Do NOT move on to the next thing with uncommitted changes sitting in the working tree.
- **Before risky operations.** About to refactor a core file, change the build pipeline, or touch Lua runtime code? Commit your current working state first so there's a clean rollback point.
- **When you've touched 3+ files.** That's already a commit-sized change. Stop and commit before continuing.
- **At natural breakpoints in multi-step work.** If a task has phases (e.g., add types → add Lua shader → add React component → update story), commit after each phase, not all at the end.
- **When debugging: commit on confirmation, not between attempts.** Do NOT commit after every debug iteration — that pollutes history. But when the human says something positive ("nice", "thanks", "cool", "ok", "that works", "good", thumbs up, or moves on to a new topic), that IS the approval signal. Commit immediately. Do not wait for a more explicit signal — casual acknowledgment IS confirmation.
- **When in doubt, commit.** Uncommitted work is lost work. It is always safer to commit too often than too rarely. If you finished something and it works, commit it. Don't wait to be told.

### How to commit

- **Use descriptive conventional-commit messages.** Say what changed and why: `feat(3d): add Blinn-Phong lighting shader with directional + ambient lights` not `update stuff`.
- **Don't batch unrelated changes.** One logical change per commit. If you added a feature AND fixed a bug, that's two commits.
- **Never leave a session with uncommitted work.** If the conversation is winding down and there are unstaged changes, commit them. The next Claude instance that picks up this repo should start from a clean tree.
- **When the human approves, commit immediately + update docs.** Once you hear "yes, this works" or similar confirmation, that is the signal to: (1) run `git status` and `git diff` to prepare the commit, (2) create the commit with a descriptive message, (3) emit the CHANGESET brief, (4) invoke `/docs` to update documentation. Do not wait or ask for permission again — the approval already happened.

### Parallel sessions and the "empty fridge" problem (READ THIS)

Multiple Claude instances work on this repo simultaneously. This causes a specific failure mode:

1. You make changes to files A, B, C
2. Another Claude session (which is also you) commits those files to clean the tree
3. You run `git status` expecting to see your dirty files — but the tree is clean
4. **DO NOT LOOP.** Do not run `git status` again. Do not run `git diff` again. The fridge is empty. Opening it again will not make food appear.

**When `git status` shows a clean tree but you expected uncommitted work:**
- Run `git log --oneline -5` ONCE. Your changes are almost certainly in a recent commit by another session.
- If you see a commit covering your files, **your work is already committed. Move on.**
- Do not investigate further. Do not try to understand "what happened." Another you committed it. That's the whole story.

**To prevent this from happening:**
- Commit your own work immediately after completing it — don't leave dirty files sitting around for another session to scoop up.
- If you are explicitly told to commit everything dirty, do it. But if you are committing on your own initiative, only commit files you personally modified in this session.

### What NOT to do

- Do not accumulate a dozen file changes across multiple features and dump them in one mega-commit.
- Do not assume the user will commit for you. They won't. That's your job.
- Do not skip committing because "it's just a small change." Small changes are the easiest to commit and the hardest to reconstruct later.
- Do not run the same git command more than twice expecting different results. If `git status` is clean, it's clean. Check `git log` and move on.

## Documentation Workflow (CRITICAL)

**Documentation is a completion criterion, not an afterthought.** After completing a major feature, architectural change, or significant addition:

1. **Emit a structured CHANGESET brief** — capture the essence of what changed while context is fresh:
   ```markdown
   # CHANGESET: [Feature Name]

   **What:** [One-liner description of what was added/changed]
   **Why:** [The problem it solves or capability it enables]
   **Affects:** [List of docs sections, or areas that need updates]
   **Breaking Changes:** [If any; else "None"]
   **New APIs:** [List of new components, hooks, capabilities, or patterns users need to know about]
   ```

2. **Run a scoped docs update** — use the `/docs` skill in single-item mode (not full regeneration):
   - Read the CHANGESET you just emitted
   - Read `references/content-format.md` to understand the style and structure
   - Update only the affected `.txt` file(s) in `content/sections/` directly
   - Run `npm run validate:docs` to verify formatting
   - Commit both code and docs together as the final step

3. **Include docs in your definition of done** — do not consider the implementation complete until documentation has been updated. The moment of highest fidelity for docs is during implementation, when the full design context is in memory.

**Why this matters:** Documentation decays rapidly after the moment of implementation. A feature built at 3am with full context understanding becomes a mystery three weeks later when someone (including a parallel Claude) needs to debug it. By treating docs as part of the feature, not a follow-up, you preserve the knowledge graph while it's hot.

## TypeScript

- Target: ES2020, JSX: react-jsx (automatic), Module resolution: bundler
- React 18.3+, react-reconciler 0.29
- Test framework: `rjit test <spec.ts>` — see Testing section above

## Domain-Specific Invariants

### CLI (`cli/`)

**Three non-negotiable rules:**
1. **Lint gates compilation** — every build path (`buildDevTarget`, `buildDistLove`, `buildDistSdl2`) runs `runLint()` before esbuild. Lint errors exit(1) before the bundle runs. If you add a new build command, it must call `runLint()` first.
2. **Symlinks are protected, not clobbered** — `commands/update.mjs` checks if a destination is a symlink before copying. If it is, it skips and prints a message. Never remove this check. This protects the storybook's Lua symlink.
3. **`targets.mjs` is the single source of truth** — esbuild flags, output paths, entry point priority, and platform metadata live there. Never hardcode these in commands. Always call `buildAliases()` for path resolution.

### Packages (`packages/`)

- **`core` and `renderer` are load-bearing** — they form the rendering pipeline. Everything else is domain-specific (audio, 3d, storage, etc.).
- **Edit source-of-truth, run `make cli-setup`** — never edit `cli/runtime/` directly. It gets overwritten on the next `make cli-setup`.
- **Box event handlers use explicit whitelist** — to add a new event type (e.g. `onFileDrop`): (1) add type to `BoxProps` in types.ts, (2) add to destructure in `Box()` in primitives.tsx, (3) add to createElement props in Box(), (4) subscribe in eventDispatcher.ts. Skipping steps 2-3 means the handler silently disappears.
- **Capabilities are the right place for new features** — if you need users to call `bridge.rpc()` or understand transport, wrap it in a capability. Pattern: register on Lua side, consume as component on React side, schema auto-discovered via `useCapabilities()`.

### Examples (`examples/`)

- **Never edit local copies** — always fix at source (`lua/`, `packages/`), then `make cli-setup` and `reactjit update`. Local copies are disposable.
- **Use `flexGrow: 1` not hardcoded heights** — `flexGrow` adapts to any window size. Pixel heights leave dead air or clip content.
- **Unicode symbols work in `<Text>`** — the default font (DejaVu Sans) has full coverage for arrows, geometric shapes, dingbats, block elements, math symbols, etc. `usePixelArt()` is available for pixel-perfect custom icons but is no longer required.
- **Color palette in one place** — define it as `const C = { ... }` at the top of the file, use `C.accent` throughout. Never naked hex strings in style props.

### Storybook (`storybook/`)

- **IS the framework, not a demo** — every user-facing feature gets a story here. Stories prove it works and teach how to use it.
- **Use the scaffolds** — content stories (with sections) use `StoryPage` and `StorySection` from `_shared/StoryScaffold.tsx`. Full-viewport stories (dashboards, games) fill the viewport directly without scaffolds.
- **Always `useThemeColors()`** — never hardcode colors. Tokens: `c.text`, `c.bg`, `c.bgElevated`, `c.surface`, `c.primary`, `c.border`, `c.muted`.
- **Register in `src/stories/index.ts`** — unregistered stories are invisible. Section categories: `'Core'` | `'Packages'` | `'Demos'` | `'Stress Test'` | `'Dev'`.
- **Never create `storybook/lua/` or `storybook/reactjit/`** — both are gitignored. Lua reads via symlink from monorepo root, TS via relative imports from source.
