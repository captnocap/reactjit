# love2d/ — Legacy Stack (full-featured, maintained)

React reconciler → QuickJS bridge → Lua layout engine → Love2D painter (OpenGL 2.1).
Full storybook, CLI, 30+ packages, HMR, test runner, .tslx compiler. This is the mature stack.

## CLI Workflow

```bash
rjit dev          # Watch + HMR
rjit build        # Dev build
rjit build linux  # Production binary
rjit lint         # Static linter
rjit test <spec>  # Test runner (inside Love2D process)
```

CLI commands live in `cli/commands/`.

## Source-of-Truth Architecture

- Edit `lua/` and `packages/` (source of truth)
- Run `make cli-setup` → `cli/runtime/`
- Run `reactjit update` in each project → local copies
- The storybook reads source directly via symlinks — never copy into it

## React's Role

React is a **layout declaration engine**. It declares geometry and diffs the tree. That's it.

Input, state, and compute run in Lua via hooks:
- `useLuaEffect` — side effects in Lua
- `useHotState` — hot-reloadable state
- `useLoveEvent` — Love2D event handlers
- `useMount` — one-time setup
- `useLuaInterval` — periodic Lua callbacks

**`useEffect` is banned.** The linter enforces this.

## The TS/Lua Split

**TypeScript does exactly 4 things. Nothing else.**
1. Return JSX (`<Box>`, `<Text>`, `<Native type="X">`)
2. Choose which JSX to return (`if`/`map`/ternary)
3. Hold a boolean/enum that controls #2
4. Call `React.createElement` for a Lua host element

**Everything else is Lua.** QuickJS is an interpreter. LuaJIT is a JIT compiler.
The bridge is an in-process FFI call. JS compute is always slower.

## .tslx / .tsl

**.tslx** = React components that compile to Lua. Write like React, compose from primitives.
**.tsl** = TypeScript compute modules that compile to Lua. Write like TS, runs in LuaJIT.

Both compile to `lua/generated/` (gitignored build output). Never hand-write Lua for app code.
Compute scoped to one component → inline in .tslx `compute()` block. Shared compute → .tsl file.

## Key Rules

- `useEffect` is banned — use `useLuaEffect`, `useMount`, `useLuaInterval`
- The scissor rule: use `intersectScissor` with `transformPoint`, never raw `setScissor`
- Box event handlers use explicit whitelist in `primitives.tsx`
- No `paddingHorizontal`/`paddingVertical` — linter rejects these. Use `paddingLeft`/`paddingRight`/`paddingTop`/`paddingBottom`
- Never remove an import BEFORE removing all usages (HMR fires between edits)
- Always `rjit build` after changes to verify lint+bundle before relying on HMR

## Monorepo Structure

npm workspaces. Path aliases (`@reactjit/*`) in `tsconfig.base.json`.

| Package | Role |
|---------|------|
| `packages/core` | Primitives, hooks, animation, types |
| `packages/renderer` | react-reconciler host config, instance tree, events |
| `packages/3d` | 3D scene, lighting |
| `packages/audio` | Audio playback, synth |
| `packages/ai` | LLM integration |
| Other packages | Domain-specific (storage, router, theme, etc.) |

**Lua runtime** (`lua/`): Layout engine, painter, bridge, tree, events, measure, videos, BSOD.

**Storybook** (`storybook/`): IS the framework. Every user-facing feature gets a story.

## Directory Structure

```
lua/              — Lua runtime (layout, painter, bridge, capabilities)
packages/         — npm packages (@reactjit/core, renderer, 3d, audio, ai, ...)
storybook/        — The storybook (IS the framework)
cli/              — CLI tool (rjit command)
tslx/             — .tslx compiler
examples/         — Example projects
native/           — C code (QuickJS shim, overlay hook, win-launcher)
deps/             — Love2D engine (submodule)
quickjs/          — QuickJS-ng source
fonts/            — Bundled fonts
scripts/          — Build scripts
Makefile          — Build orchestration
```

## Input Pattern

**TextInput is a normal input.** Use `onChangeText` for state updates and `onSubmit` for submission. See `examples/hot-code/src/App.tsx` for the pattern.
