# AGENTS.md — Instructions for Sandboxed AI Agents (Codex, etc.)

This file is for AI agents running in sandboxed environments without network
access or installed toolchains (npm, node_modules, rjit CLI, etc.).

## DO NOT BUILD

You are in a sandbox. You do not have:
- Network access (npm install will fail with EAI_AGAIN)
- The `rjit` CLI installed globally
- `node_modules/` populated
- Any build tools (esbuild, tsx, etc.)

**Do not attempt to build, compile, or bundle anything.** Do not run:
- `npm run build:*`
- `npx esbuild ...`
- `rjit build`
- `rjit dev`
- `make build*`

If your task requires verification, verify by **reading code** — check imports
resolve, types are consistent, patterns match the rest of the codebase. The
project owner will build and test after your changes are merged.

## DO NOT WORK AROUND BUILD FAILURES

If a command fails, **stop**. Do not:
- Install packages manually
- Copy binaries from elsewhere in the repo
- Create ad-hoc build scripts
- Modify the build pipeline, Makefile, CLI commands, or package.json scripts
- Delete or modify `lua/` symlinks

Your job is to edit source files cleanly. That's it.

## Source-of-Truth Rules

These are critical — violating them causes silent breakage:

- **Lua runtime**: Edit files in `lua/` at the monorepo root. Never edit
  `cli/runtime/lua/` or any project's local `lua/` copy — those are generated.
- **TypeScript packages**: Edit in `packages/*/src/`. Never edit `cli/runtime/reactjit/`.
- **Storybook**: The `storybook/` directory reads from source via symlinks.
  Never create `storybook/lua/` or `storybook/reactjit/` as real directories.
  Never run `reactjit update` from the storybook directory.

## What You CAN Do

- Edit source files (`src/`, `lua/`, `packages/*/src/`, `storybook/src/`)
- Read any file to understand the codebase
- Run the linter: `node cli/bin/reactjit.mjs lint` (works offline, no npm needed)
- Run `git` commands
- Create or modify files that are clearly part of the task you were given

## Style Rules

- Follow existing patterns in the codebase
- Use `useThemeColors()` for colors in storybook stories, never hardcode
- Every `<Text>` must have `fontSize` in its `style` prop
- No Unicode symbols in `<Text>` elements (they won't render)
- No `paddingHorizontal`/`paddingVertical` — use explicit `paddingLeft`/`paddingRight`/`paddingTop`/`paddingBottom`
- No `flex: 1` shorthand — use `flexGrow: 1`
