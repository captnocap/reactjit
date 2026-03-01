# AGENTS.md — Instructions for AI Agents (Codex, Claude, etc.)

This file is for AI agents working in this repository.

## Environment Detection

Before doing anything, figure out what you can actually run:

- **Sandboxed** (no network, no node_modules, no `rjit` CLI): You can only edit source files and verify by reading code. Skip all build/sync steps — leave a note in your PR description listing which sync commands the maintainer needs to run.
- **Full environment** (npm works, `make` works, `rjit` CLI is installed): You MUST run the sync pipeline after framework-level changes. No excuses.

## Source-of-Truth Architecture (CRITICAL)

This is a monorepo with a **two-stage copy pipeline**. Editing the right file is only half the job — you must also propagate changes or they silently do nothing.

### The pipeline

```
Source of truth          Stage 1              Stage 2
─────────────────────    ──────────────────   ─────────────────────
lua/*.lua            ──► cli/runtime/lua/  ──► <project>/lua/
packages/core/src/   ──► cli/runtime/reactjit/shared/ ──► <project>/reactjit/shared/
packages/native/src/ ──► cli/runtime/reactjit/native/ ──► <project>/reactjit/native/
```

- **Stage 1**: `make cli-setup` copies source-of-truth into `cli/runtime/`
- **Stage 2**: `cd <project> && reactjit update` copies `cli/runtime/` into the project's local dirs

**If you skip these steps, the project keeps running the OLD code.** Your edits exist at the source level but the running project never sees them.

### What to edit (and what NOT to)

| Edit HERE (source of truth) | NEVER edit these (generated copies) |
|---|---|
| `lua/*.lua`, `lua/masks/*.lua` | `cli/runtime/lua/`, `<project>/lua/` |
| `packages/core/src/` | `cli/runtime/reactjit/shared/` |
| `packages/native/src/` | `cli/runtime/reactjit/native/` |
| `storybook/src/` | (reads source directly — no copies) |

### After editing framework files: the sync pipeline

If you touched ANY file in `lua/`, `packages/core/`, or `packages/native/`, you MUST run:

```bash
# Stage 1: source → cli/runtime/
make cli-setup

# Stage 2: cli/runtime/ → project's local copies
cd examples/<project>
reactjit update

# Rebuild the project
reactjit build
```

**If you are sandboxed and cannot run these commands**, you MUST leave a clear note in your commit message or PR description:

```
⚠️ SYNC REQUIRED: This PR edits framework source files.
After merging, run:
  make cli-setup
  cd examples/<project> && reactjit update && reactjit build
```

Do NOT assume the maintainer will know. Spell it out every time.

### Storybook is special

The storybook (`storybook/`) reads from source directly via symlinks and workspace resolution. It does NOT need `make cli-setup` or `reactjit update`. Changes to `lua/` and `packages/*/src/` are picked up automatically after a rebuild:

```bash
make build-storybook-native
```

**Never** create `storybook/lua/` or `storybook/reactjit/` as real directories. Never run `reactjit update` from the storybook directory.

## DO NOT WORK AROUND BUILD FAILURES

If a command fails, **stop**. Do not:
- Install packages manually
- Copy binaries from elsewhere in the repo
- Create ad-hoc build scripts
- Modify the build pipeline, Makefile, CLI commands, or package.json scripts
- Delete or modify `lua/` symlinks

Your job is to edit source files cleanly and run the sync pipeline. That's it.

## What You CAN Do

- Edit source files (`src/`, `lua/`, `packages/*/src/`, `storybook/src/`)
- Read any file to understand the codebase
- Run the linter: `node cli/bin/reactjit.mjs lint` (works offline, no npm needed)
- Run `git` commands
- Run the sync pipeline (`make cli-setup`, `reactjit update`, `reactjit build`)
- Create or modify files that are clearly part of the task you were given

## Style Rules

- Follow existing patterns in the codebase
- Use `useThemeColors()` for colors in storybook stories, never hardcode
- Every `<Text>` must have `fontSize` in its `style` prop
- No Unicode symbols in `<Text>` elements (they won't render)
- No `paddingHorizontal`/`paddingVertical` — use explicit `paddingLeft`/`paddingRight`/`paddingTop`/`paddingBottom`
- No `flex: 1` shorthand — use `flexGrow: 1`
