# CLAUDE.md

This is React stripped of browser magic and rendered as raw geometry.
If you didn't say how big it is, surfaces take a quarter of their parent.
If you said grow, it grows exactly.
If you nested flex containers, you own the consequences.
If text wraps, it's because you gave it nowhere to go.

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Who Maintains This

**You do.** When you encounter bugs, they are from other versions of yourself in another parallel instance. If a bug from another Claude is preventing you from progressing forward, help yourself, do not dismiss as 'not my code'; it is your code. It is all your code.

**Commiting Work:** If you choose to commit work on your own, then do not commit the work of other Claudes. If I prompt you to commit work, I expect you to commit all the work left unaccounted for, its from you in a parallel universe who forgot to anyways.

## One-Liner Design Philosophy

When adding a new capability, feature, or integration — always ask: **can someone who doesn't code use this in one line?** If the answer is no, wrap it until it is. The target user is someone who knows their domain (music, art, data, games) but doesn't know bridges, RPCs, or Lua internals. An AI should be able to discover and control it without documentation.

The pattern is the **declarative capability system** (`lua/capabilities.lua`):
1. Lua side: `Capabilities.register("Audio", { schema, create, update, tick, destroy })`
2. React side: `<Audio src="beat.mp3" playing volume={0.8} />`
3. AI discovery: `useCapabilities()` returns schemas for everything registered

Every new native feature (audio, timers, sensors, file watchers, notifications, whatever) should follow this pattern. The Lua module does the work, the React component is a one-liner, and the schema is the documentation. If you're adding something that requires the user to call `bridge.rpc()` or understand the transport layer, you haven't finished — wrap it in a capability.

## Model Selection

**Always use Opus 4.6 (`claude-opus-4-6`) for debugging.** Sonnet is fine for scaffolding, writing new components, and routine tasks. But when tracking down layout bugs, inspector issues, coordinate mismatches, or anything where the real problem is structural and not obvious — use Opus. It finds the actual bug instead of proposing workarounds that mask it.

## What This Is

ReactJIT is a React rendering framework with a hand-rolled renderer. The core pipeline — reconciler, tree, layout engine, component library — is target-agnostic. Each target supplies two modules: `measure` (text metrics) and `painter` (how to turn `{x, y, w, h, color, text}` into visible output on that surface). Swap the target table, change the renderer entirely.

**Rendering pipeline:** React reconciler → mutation commands → transport layer → layout engine → target-specific painter.

**Primary renderer — SDL2 / OpenGL:**
LuaJIT + SDL2 + OpenGL 2.1 + FreeType via FFI. No game engine dependency. We own the run loop, the GL context, the font rasterizer, and the event pump. Entry point: `luajit sdl2_init.lua`. This is the focus — everything else is secondary.

**Also supported:**
- **Love2D** — The original proving ground. Still available for game developers who want Love2D's ecosystem (images, video, audio, binary dist). Entry point: `love .`
- **Web (planned)** — WASM build from SDL2/OpenGL via Emscripten. Renders to `<canvas>`, not DOM.

The target interface is formalized in `lua/target_sdl2.lua` (primary) and `lua/target_love2d.lua` (legacy). A target is a `{ name, measure, painter, images?, videos? }` table — the rest of the framework never needs to know which one is active.

## CLI-First Workflow (IMPORTANT)

**Always use the `reactjit` CLI tool instead of manual esbuild commands.** The CLI
encodes correct esbuild flags, enforces lint gates before builds, handles runtime file
placement, and produces correct distribution packages. Running raw esbuild commands
directly will use wrong flags, skip linting, and produce broken builds.

```bash
reactjit init <name>            # Scaffold new project (do NOT mkdir + copy manually)
reactjit dev [target]           # Watch mode (default: sdl2). Do NOT run esbuild --watch manually.
reactjit build [target]         # Lint gate + dev build (default: sdl2). Do NOT run esbuild manually.
reactjit build dist:<target>    # Production build for any target
reactjit lint                   # Static layout linter — run after ANY component change
reactjit screenshot [--output]  # Headless capture — verify layouts visually
```

**Targets:** `sdl2`, `love`

**Dist formats:**
- `dist:sdl2` — Native binary (SDL2 + OpenGL + LuaJIT)
- `dist:love` — Self-extracting Linux binary (Love2D + bundled glibc)
- `dist:web` — WASM + WebGL bundle (planned — Emscripten compilation of SDL2 renderer)

**After writing or modifying any component:** run `reactjit lint`, then
`reactjit screenshot --output /tmp/preview.png` and inspect the result.

The CLI handles all targets. The npm scripts in root package.json are for monorepo
development convenience only — never use raw esbuild commands for project builds.

## Source-of-Truth Architecture (CRITICAL)

There are two categories of files: **globally distributed** (framework internals) and **project-specific** (user application code). Editing the wrong copy is the #1 source of "it builds but doesn't work" bugs.

### Globally distributed files (framework)

These live at the **monorepo root** and get copied into projects via the CLI:

| Source of truth | Copied to by `make cli-setup` | Copied to projects by `reactjit init/update` |
|---|---|---|
| `lua/*.lua` | `cli/runtime/lua/` | `<project>/lua/` |
| `packages/shared/` | `cli/runtime/reactjit/shared/` | `<project>/reactjit/shared/` |
| `packages/native/` | `cli/runtime/reactjit/native/` | `<project>/reactjit/native/` |
| `quickjs/libquickjs.so` | `cli/runtime/lib/` | `<project>/lib/` |

**Rules:**
- **ALWAYS edit the source-of-truth files** (`lua/`, `packages/shared/`, `packages/native/`). NEVER edit `cli/runtime/` or `<project>/lua/` or `<project>/reactjit/` directly — those are disposable copies.
- After editing any source-of-truth file, run the full sync pipeline:
  ```bash
  make cli-setup              # source → cli/runtime/
  cd examples/<project>
  reactjit update             # cli/runtime/ → project's local copies
  reactjit build dist:sdl2    # rebuild
  ```
- `reactjit update` syncs `lua/`, `lib/`, and `reactjit/` from the CLI runtime into the current project without touching `src/`. Use it to hydrate existing projects after framework changes.
- `reactjit update` is symlink-aware: if a destination (e.g. `lua/`) is a symlink, it skips the copy and prints a message. This protects the storybook's source-of-truth symlinks.
- `reactjit build dist:sdl2` has a fallback: if no local `lua/` exists, it reads from `cli/runtime/lua/`. But `reactjit dev` requires local copies, so always run `reactjit update` for dev workflows.

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
2. Edit/create files in `packages/shared/src/` and `packages/native/src/` as needed
3. The storybook picks up both changes automatically (Lua via symlink, TS via esbuild). Rebuild the storybook bundle: `make build-storybook-native`
4. `make cli-setup` — propagates to `cli/runtime/` for consumer projects
5. For each example project that needs the feature:
   - `cd examples/<project> && reactjit update` — syncs runtime files
   - `reactjit build dist:sdl2` — rebuilds
6. For new projects: `reactjit init <name>` — gets everything automatically

## Other Build Commands

```bash
npm install                       # Install dependencies

# QuickJS setup (needed for native targets)
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
| `packages/shared` | `@reactjit/core` | Primitives (Box, Text, Image), components, hooks, animation, types |
| `packages/native` | `@reactjit/native` | react-reconciler host config, instance tree, event dispatch |
| `packages/components` | `@reactjit/components` | Re-exports layout helpers (Card, Badge, FlexRow, etc.) |

**Lua runtime** (`lua/`): Layout engine (`layout.lua`), painter (`painter.lua`), QuickJS FFI bridge (`bridge_quickjs.lua`), instance tree (`tree.lua`), event system (`events.lua`), text measurement (`measure.lua`), error overlay, visual inspector (F12).

**Target interface** — `lua/target_sdl2.lua` (primary; uses `sdl2_painter.lua` + `sdl2_measure.lua` + `sdl2_font.lua`) and `lua/target_love2d.lua` (legacy; uses `painter.lua` + `measure.lua`). SDL2 run loop: `lua/sdl2_init.lua`. OpenGL bindings: `lua/sdl2_gl.lua`.

**Storybook** (`storybook/`): Top-level reference app — component library, documentation, playground. Not an example project.

**Examples** (`examples/`): `native-hud/`, `neofetch/`, `playground/`.

## esbuild Formats by Target

These are encoded in `cli/targets.mjs` — you should never need to specify them manually:

- **SDL2 / Love2D**: `--format=iife --global-name=ReactJIT` (bundle runs inside QuickJS in-process). SDL2: launched via `luajit sdl2_init.lua`. Love2D: launched via `love .`. Same bundle format, different run loop.

## Critical Layout Rules

### How sizing works (know this before writing layouts)

The layout engine has three sizing tiers. They resolve in order — the first one that applies wins:

1. **Explicit dimensions** — you set `width`, `height`, `flexGrow`, or `flexBasis`. This always takes priority.
2. **Content auto-sizing** — containers with children auto-size from their content. Text nodes measure from font metrics. This is the default for any element with children.
3. **Proportional surface fallback** — empty surface nodes (Box, Image, Video, Scene3D) with no explicit dimensions and no children fall back to **1/4 of their parent's available space**. This cascades: in an 800px window, an unsized Box is 200px; a nested unsized Box inside it is 50px. Interactive elements (Text, TextInput, Pressable, CodeBlock) and ScrollView are NOT surfaces — they size from content or require explicit dimensions.

**What this means in practice:** Stop hardcoding pixel heights on panels, sidebars, and sections that contain children. Use `flexGrow: 1` on the element that should absorb remaining space, and let everything else auto-size. The only things that need explicit dimensions are the root container and opaque leaves (images, empty decorative boxes, scroll containers).

### Rules that still cause bugs

1. **Root containers** need `width: '100%', height: '100%'` — the proportional fallback doesn't apply at the root because the root IS the viewport
2. **Every `<Text>` MUST have explicit `fontSize`** — the linter enforces this
3. **Use `flexGrow: 1` for space-filling elements** — in a column of header + content + footer, the content should have `flexGrow: 1` to absorb remaining space. Do NOT hardcode pixel heights to "fill" a known window size — that creates deadspace at different resolutions
4. **Row Boxes NEED explicit width for `justifyContent` to work** — a `flexDirection: 'row'` Box without an explicit width won't respond to `justifyContent: 'center'`. Add `width: '100%'` (or a fixed width) to row Boxes that need horizontal content distribution
5. **ScrollView needs explicit height** — scroll containers are excluded from the proportional fallback. They need `height` or `flexGrow` to define their viewport
6. **Never put Unicode symbols in `<Text>`** — characters like `▶` `⏸` `█` `●` `✓` arrows, dingbats, geometric shapes, etc. won't render in the default font. Convert them to Box-based geometry: boolean grids with `backgroundColor` for block art (see NeofetchDemo heart), colored `<Box>` elements for shapes (play triangles, pause bars, checkmarks). The `usePixelArt` hook can convert Unicode art strings to Box grids automatically. The linter enforces this via `no-unicode-symbol-in-text`

### Layout anti-patterns (DO NOT DO)

- **Hardcoding pixel heights to fit a known window size.** `<Scene style={{ height: 260 }}/>` in a 600px-tall parent leaves 340px of dead air. Use `flexGrow: 1` instead and let the element fill available space.
- **Budgeting pixels manually.** Don't add up `48 + 260 + 80 + gaps` to hit a target height. Let flex do this — one element grows, the rest auto-size from content.
- **Using fixed dimensions where auto-sizing works.** If a panel contains text and buttons, it knows its own size. Don't constrain it with a hardcoded height — let it shrink-wrap, and give a sibling `flexGrow: 1` to fill the gap.

The static linter (`cli/commands/lint.mjs`) catches many of these as build-blocking errors. Escape hatch: `// ilr-ignore-next-line`.

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

The `Box` component in `packages/shared/src/primitives.tsx` uses an **explicit whitelist** for event handlers. It destructures each `on*` prop by name and passes them individually to `React.createElement('View', { ... })`. If you add a new event type (e.g. `onFileDrop`), you must:

1. Add the handler type to `BoxProps` in `packages/shared/src/types.ts`
2. Add it to the destructure list in `Box()` in `primitives.tsx`
3. Add it to the `createElement` props object in the native mode branch of `Box()`
4. Subscribe to the bridge event in `packages/native/src/eventDispatcher.ts`

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

### How to commit

- **Use descriptive conventional-commit messages.** Say what changed and why: `feat(3d): add Blinn-Phong lighting shader with directional + ambient lights` not `update stuff`.
- **Don't batch unrelated changes.** One logical change per commit. If you added a feature AND fixed a bug, that's two commits.
- **Never leave a session with uncommitted work.** If the conversation is winding down and there are unstaged changes, commit them. The next Claude instance that picks up this repo should start from a clean tree.

### What NOT to do

- Do not accumulate a dozen file changes across multiple features and dump them in one mega-commit.
- Do not assume the user will commit for you. They won't. That's your job.
- Do not skip committing because "it's just a small change." Small changes are the easiest to commit and the hardest to reconstruct later.

## TypeScript

- Target: ES2020, JSX: react-jsx (automatic), Module resolution: bundler
- React 18.3+, react-reconciler 0.29
- No test framework configured
