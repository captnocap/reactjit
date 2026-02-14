# CLAUDE.md

This is React stripped of browser magic and rendered as raw geometry.

If you didn't say how wide it is, it's zero.
If you said grow, it grows exactly.
If you nested flex containers, you own the consequences.
If text wraps, it's because you gave it nowhere to go.

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Who Maintains This

**You do.** When you encounter bugs, they are from other versions of yourself in another parallel instance. If a bug from another Claude is preventing you from progressing forward, help yourself, do not dismiss as 'not my code'; it is your code. It is all your code.

**Commiting Work:** If you choose to commit work on your own, then do not commit the work of other Claudes. If I prompt you to commit work, I expect you to commit all the work left unaccounted for, its from you in a parallel universe who forgot to anyways.

## Model Selection

**Always use Opus 4.6 (`claude-opus-4-6`) for debugging.** Sonnet is fine for scaffolding, writing new components, and routine tasks. But when tracking down layout bugs, inspector issues, coordinate mismatches, or anything where the real problem is structural and not obvious — use Opus. It finds the actual bug instead of proposing workarounds that mask it.

## What This Is

iLoveReact is a multi-target React rendering framework. Write React components once, render them on Love2D, terminals, Neovim, ComputerCraft, Hammerspoon, AwesomeWM, or web browsers.

**Rendering pipeline:** React reconciler → mutation commands → transport layer → layout engine → target-specific painter.

## CLI-First Workflow (IMPORTANT)

**Always use the `ilovereact` CLI tool instead of manual esbuild commands.** The CLI
encodes correct esbuild flags, enforces lint gates before builds, handles runtime file
placement, and produces correct distribution packages. Running raw esbuild commands
directly will use wrong flags, skip linting, and produce broken builds.

```bash
ilovereact init <name>            # Scaffold new project (do NOT mkdir + copy manually)
ilovereact dev [target]           # Watch mode (default: love). Do NOT run esbuild --watch manually.
ilovereact build [target]         # Lint gate + dev build (default: love). Do NOT run esbuild manually.
ilovereact build dist:<target>    # Production build for any target
ilovereact lint                   # Static layout linter — run after ANY component change
ilovereact screenshot [--output]  # Headless capture — verify layouts visually
```

**Targets:** `love`, `terminal`, `cc`, `nvim`, `hs`, `awesome`, `web`

**Dist formats:**
- `dist:love` — Self-extracting Linux binary (Love2D + bundled glibc)
- `dist:terminal` / `dist:cc` / `dist:nvim` / `dist:hs` / `dist:awesome` — Single-file Node.js executable (shebang + CJS)
- `dist:web` — Production ESM bundle

**After writing or modifying any component:** run `ilovereact lint`, then
`ilovereact screenshot --output /tmp/preview.png` and inspect the result.

The CLI handles all targets. The npm scripts in root package.json are for monorepo
development convenience only — never use raw esbuild commands for project builds.

## Source-of-Truth Architecture (CRITICAL)

There are two categories of files: **globally distributed** (framework internals) and **project-specific** (user application code). Editing the wrong copy is the #1 source of "it builds but doesn't work" bugs.

### Globally distributed files (framework)

These live at the **monorepo root** and get copied into projects via the CLI:

| Source of truth | Copied to by `make cli-setup` | Copied to projects by `ilovereact init/update` |
|---|---|---|
| `lua/*.lua` | `cli/runtime/lua/` | `<project>/lua/` |
| `packages/shared/` | `cli/runtime/ilovereact/shared/` | `<project>/ilovereact/shared/` |
| `packages/native/` | `cli/runtime/ilovereact/native/` | `<project>/ilovereact/native/` |
| `quickjs/libquickjs.so` | `cli/runtime/lib/` | `<project>/lib/` |

**Rules:**
- **ALWAYS edit the source-of-truth files** (`lua/`, `packages/shared/`, `packages/native/`). NEVER edit `cli/runtime/` or `<project>/lua/` or `<project>/ilovereact/` directly — those are disposable copies.
- After editing any source-of-truth file, run the full sync pipeline:
  ```bash
  make cli-setup              # source → cli/runtime/
  cd examples/<project>
  ilovereact update           # cli/runtime/ → project's local copies
  ilovereact build dist:love  # rebuild
  ```
- `ilovereact update` syncs `lua/`, `lib/`, and `ilovereact/` from the CLI runtime into the current project without touching `src/`. Use it to hydrate existing projects after framework changes.
- `ilovereact build dist:love` has a fallback: if no local `lua/` exists, it reads from `cli/runtime/lua/`. But `ilovereact dev` and `love .` require local copies, so always run `ilovereact update` for dev workflows.

### Project-specific files (application code)

These are unique to each project and are NOT managed by the CLI:

- `src/` — user application code (App.tsx, stories, etc.)
- `main.lua`, `conf.lua` — Love2D entry points
- `package.json` — project dependencies
- `packaging/` — build customizations

**Rules:**
- These files are safe to edit directly in any project.
- `ilovereact init` creates starter versions; `ilovereact update` never touches them.
- To copy app code between projects, copy only `src/` and any custom `main.lua`/`conf.lua`.

### Adding a new Lua-side feature (checklist)

1. Edit/create files in `lua/` (the source of truth)
2. Edit/create files in `packages/shared/src/` and `packages/native/src/` as needed
3. `make cli-setup` — propagates to `cli/runtime/`
4. For each example project that needs the feature:
   - `cd examples/<project> && ilovereact update` — syncs runtime files
   - `ilovereact build dist:love` — rebuilds
5. For new projects: `ilovereact init <name>` — gets everything automatically

## Other Build Commands

```bash
npm install                       # Install dependencies

# QuickJS setup (needed for Love2D target)
make setup                        # Clones quickjs-ng, builds libquickjs.so
make build                        # Builds all targets
make dist-storybook               # Self-extracting Linux binary with bundled glibc
```

The root package.json still has `npm run build:*` scripts for monorepo example builds,
but prefer `cd examples/<project> && ilovereact build <target>` for consistency.

## Monorepo Structure

npm workspaces monorepo. Path aliases (`@ilovereact/*`) defined in `tsconfig.base.json`.

| Package | Import | Role |
|---------|--------|------|
| `packages/shared` | `@ilovereact/core` | Primitives (Box, Text, Image), components, hooks, animation, types |
| `packages/native` | `@ilovereact/native` | react-reconciler host config, instance tree, event dispatch |
| `packages/web` | `@ilovereact/web` | DOM overlay renderer |
| `packages/grid` | `@ilovereact/grid` | Shared layout engine for character-grid targets |
| `packages/terminal` | `@ilovereact/terminal` | Pure JS terminal renderer (ANSI truecolor) |
| `packages/cc` | `@ilovereact/cc` | ComputerCraft target (WebSocket, 16-color) |
| `packages/nvim` | `@ilovereact/nvim` | Neovim target (stdio, floating windows) |
| `packages/hs` | `@ilovereact/hs` | Hammerspoon target (WebSocket, pixel canvas) |
| `packages/awesome` | `@ilovereact/awesome` | AwesomeWM target (stdio, Cairo) |
| `packages/components` | `@ilovereact/components` | Re-exports layout helpers (Card, Badge, FlexRow, etc.) |

**Lua runtime** (`lua/`): Layout engine (`layout.lua`), painter (`painter.lua`), QuickJS FFI bridge (`bridge_quickjs.lua`), instance tree, event handling, text measurement, error overlay, visual inspector (F12).

**Examples** (`examples/`): `storybook/`, `native-hud/`, `terminal-demo/`, `cc-demo/`, `nvim-demo/`, `hs-demo/`, `awesome-demo/`, `neofetch/`, `playground/`, `web-overlay/`.

## esbuild Formats by Target

These are encoded in `cli/targets.mjs` — you should never need to specify them manually:

- **Love2D**: `--format=iife --global-name=ReactLove` (runs inside QuickJS)
- **Grid targets** (terminal, nvim, cc, hs, awesome): `--platform=node --format=esm`
- **Web**: `--format=esm`
- WebSocket targets (cc, hs) additionally need `--external:ws`
- **Dist builds** (grid): `--format=cjs --platform=node --external:ws` + shebang

## Critical Layout Rules

These cause the most bugs:

1. **Root containers** need `width: '100%', height: '100%'` — NOT `flexGrow: 1`
2. **Every `<Text>` MUST have explicit `fontSize`** — the linter enforces this
3. **No `flexGrow` without sibling sizing context** — needs a parent with known dimensions
4. **Pre-compute grid dimensions** — don't rely on child content to infer container size
5. **Keep flex trees shallow** — prefer `<Box flexDirection='row'>` over deep wrapper hierarchies
6. **Fill the viewport** — Love2D is a fixed canvas, not a scrolling page
7. **Row Boxes NEED explicit width for `justifyContent` to work** — Box nodes have no intrinsic width (only Text nodes do via measurement). A `flexDirection: 'row'` Box without an explicit width won't respond to `justifyContent: 'center'` or other justify values. Always add `width: '100%'` (or a fixed width) to row Boxes that need horizontal content distribution.
8. **Never put Unicode symbols in `<Text>`** — characters like `▶` `⏸` `█` `●` `✓` arrows, dingbats, geometric shapes, etc. won't render in Love2D's default font. Convert them to Box-based geometry: boolean grids with `backgroundColor` for block art (see NeofetchDemo heart), colored `<Box>` elements for shapes (play triangles, pause bars, checkmarks). The `usePixelArt` hook can convert Unicode art strings to Box grids automatically. The linter enforces this via `no-unicode-symbol-in-text`.

The static linter (`cli/commands/lint.mjs`) catches these as build-blocking errors. Escape hatch: `// ilr-ignore-next-line`.

## Auto-Sizing (Content-Based Layout)

Containers automatically size to fit their content when dimensions are not specified:

**How it works:**
- Bottom-up measurement: deepest children measure first, dimensions propagate upward
- Text nodes measure themselves using font metrics
- Container nodes sum (main axis) or max (cross axis) their children
- Padding, margins, and gaps are added at each level

**Column containers** (default `flexDirection: "column"`):
- Width: max of children's widths + padding
- Height: sum of children's heights + gaps + padding

**Row containers** (`flexDirection: "row"`):
- Width: sum of children's widths + gaps + padding
- Height: max of children's heights + padding

**Example** (no explicit sizing needed):
```jsx
<Box>
  <Text fontSize={16}>Title</Text>
  <Text fontSize={14}>Subtitle</Text>
</Box>
```
Container auto-sizes to fit both text elements with proper stacking.

**When to use explicit sizing:**
- Root containers (use `width: '100%', height: '100%'` to fill viewport)
- Containers with percentage-sized children (percentages need explicit parent)
- Performance-critical layouts (10+ direct children)
- When you need precise control over alignment/distribution

**When to use auto-sizing:**
- Cards, badges, buttons (size to content)
- Text labels, headings, captions
- Icon containers
- Nested layout components

**Limitations:**
- Percentage-based children in auto-sized parents resolve to 0
- `aspectRatio` requires at least one explicit dimension
- ScrollView containers need explicit height for scrolling
- Deep nesting (6+ levels) may impact performance (use explicit sizing at key levels)

## Primitives by Target

**Love2D / Web:** Import from `@ilovereact/core` — `Box`, `Text`, `Image`, `Pressable`, `ScrollView`, `TextInput`, `Modal`, etc.

**Grid targets:** Use lowercase JSX intrinsics (`<view>`, `<text>`) and define local `Box`/`Text` wrappers.

## Git Discipline (IMPORTANT)

Commit early and often. This project has no test suite, so git history is the safety net. Follow these rules:

- **Commit after every meaningful change** — finished a feature, fixed a bug, refactored something? Commit it before moving on. Don't batch unrelated changes into one mega-commit.
- **Commit before risky operations** — about to refactor a core file, change the build pipeline, or touch Lua runtime code? Commit your current working state first so there's a clean rollback point.
- **Use descriptive commit messages** — say what changed and why. `feat: add scroll support to grid layout engine` not `update stuff`.
- **Don't let work pile up uncommitted** — if you've touched 3+ files, that's a commit. If you've been working for a while, that's a commit. The working tree should rarely have more than one logical change uncommitted.

## TypeScript

- Target: ES2020, JSX: react-jsx (automatic), Module resolution: bundler
- React 18.3+, react-reconciler 0.29
- No test framework configured
