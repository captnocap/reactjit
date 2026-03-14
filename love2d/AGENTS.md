# AGENTS.md — Instructions for AI Agents (Codex, Claude, etc.)

This file is for AI agents working in this repository.

## Environment Detection

Before doing anything, figure out what you can actually run:

- **Sandboxed** (no network, no node_modules, no `rjit` CLI): You can only edit source files and verify by reading code. Skip all build/sync steps — leave a note in your PR description listing which sync commands the maintainer needs to run.
- **Full environment** (npm works, `make` works, `rjit` CLI is installed): You MUST run the sync pipeline after framework-level changes. No excuses.
- **Zig sandbox caveat**: In Codex's sandbox, Zig may partially work but `zig build ...` can still fail with `AccessDenied` on Zig's stdlib install path even when the files are world-readable on the real filesystem. Treat that as a sandbox filesystem restriction, not a repo/ownership issue. If a Zig build matters, rerun it outside the sandbox before concluding the repo is broken.

## Source-of-Truth Architecture (CRITICAL)

This is a monorepo with a **two-stage copy pipeline**. Editing the right file is only half the job — you must also propagate changes or they silently do nothing.

### The pipeline

```
Source of truth          Stage 1              Stage 2
─────────────────────    ──────────────────   ─────────────────────
lua/*.lua            ──► cli/runtime/lua/  ──► <project>/lua/
packages/core/src/   ──► cli/runtime/reactjit/shared/ ──► <project>/reactjit/shared/
packages/renderer/src/ ──► cli/runtime/reactjit/renderer/ ──► <project>/reactjit/renderer/
```

- **Stage 1**: `make cli-setup` copies source-of-truth into `cli/runtime/`
- **Stage 2**: `cd <project> && reactjit update` copies `cli/runtime/` into the project's local dirs

**If you skip these steps, the project keeps running the OLD code.** Your edits exist at the source level but the running project never sees them.

### What to edit (and what NOT to)

| Edit HERE (source of truth) | NEVER edit these (generated copies) |
|---|---|
| `lua/*.lua`, `lua/masks/*.lua` | `cli/runtime/lua/`, `<project>/lua/` |
| `packages/core/src/` | `cli/runtime/reactjit/shared/` |
| `packages/renderer/src/` | `cli/runtime/reactjit/renderer/` |
| `storybook/src/` | (reads source directly — no copies) |

### After editing framework files: the sync pipeline

If you touched ANY file in `lua/`, `packages/core/`, or `packages/renderer/`, you MUST run the full sync pipeline:

```bash
# Stage 1: source → cli/runtime/
make cli-setup

# Stage 2: cli/runtime/ → project's local copies (only if the project uses the framework)
cd examples/<project>
reactjit update

# Rebuild the project
reactjit build
```

**For the storybook specifically,** rebuild after `make cli-setup`:

```bash
make build-storybook-love
```

The storybook reads source files directly (no `reactjit update` needed) — it just needs the bundle rebuilt.

**If you are sandboxed and cannot run these commands**, you MUST leave a clear note in your commit message or PR description:

```
⚠️ SYNC REQUIRED: This PR edits framework source files.
After merging, run:
  make cli-setup
  make build-storybook-love          (to rebuild the storybook)
  cd examples/<project> && reactjit update && reactjit build  (for each consumer project)
```

Do NOT assume the maintainer will know. Spell it out every time.

### Monorepo builds vs. project builds

**`make build`** — Builds the monorepo's own targets (web overlay demo, storybook). Use this if you modified framework code and want to rebuild the storybook. The command rebuilds:
- `examples/web-overlay/dist/app.js` (web demo)
- `storybook/love/bundle.js` (storybook React bundle)

```bash
make build
```

**`rjit build`** or **`reactjit build`** — Builds consumer projects (examples, user apps). Use this for projects that depend on the framework. Always use this workflow:

```bash
cd examples/<project>
reactjit update         # Sync framework files from cli/runtime/
reactjit build          # Bundle + lint the project
```

**Do NOT run `make build` for consumer projects.** Always use `rjit build` instead.

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

## Test Parity (NON-NEGOTIABLE)

If you add or expand a package test under `packages/*/test/*.test.mjs`, you MUST classify it in `cli/lib/test-parity.mjs`.

- `nodeOnly` means the test covers behavior that exists only in JS/TS. Add a short rationale.
- `luaBacked` means the package behavior is mirrored or implemented in Lua. Add one or more Lua harnesses under `packages/*/test/*.lua` and list them as counterparts.

For `luaBacked` coverage, the Lua harness must mirror the behavioral contract being asserted on the JS side. Do not stop at the npm test if the runtime path goes through Lua.

Use `node cli/bin/reactjit.mjs test <packages/.../*.test.mjs>` when verifying a Lua-backed package test. The runner will execute the Node test and its declared Lua counterparts together.

## Dev Servers: Use `dv` CLI (NON-NEGOTIABLE)

**NEVER start dev servers directly.** No `love .`, no `npm run dev`, no direct spawning. Every dev server goes through the `dv` CLI (`~/.local/bin/dv`). Direct spawning causes duplicate processes that pile up and waste system resources.

### Quick reference

```bash
dv ls                          # List all registered servers + status. ALWAYS check this first.
dv run <name>                  # Start a registered server (auto-restarts if already running)
dv run <name> <script>         # Run a specific script (e.g., dv run storybook build)
dv stop <name>                 # Stop a server
dv logs <name>                 # Show recent logs for a server
dv gui                         # Open GUI dashboard (singleton window)
```

### Registering new servers

If a server is not registered:

```bash
cd /path/to/project
dv add                         # Register the project as a dev server
dv run <name>                  # Now you can start it
```

To remove a registration:

```bash
dv rm <name>
```

### Common workflows

**Check what's running:**
```bash
dv ls
```

**Start the storybook:**
```bash
dv run storybook
```

**Rebuild the storybook (one-shot):**
```bash
dv run storybook build
```

**Check logs while a server runs:**
```bash
dv logs storybook              # Show recent logs (doesn't block)
```

### Important rules

- **Always `dv ls` first** — before starting anything, check what's already running
- **`dv run` auto-restarts** — if a server is already running, it will restart it automatically (no need to `dv stop` first)
- **Do NOT chain `dv run` with sleep/timeout** — After starting a server, just let it run. Don't do `dv run storybook && sleep 5 && dv logs`. If you need logs, call `dv logs` separately without timeouts. Timeouts kill the server window.
- **Check the GUI for details** — `dv gui` opens a dashboard showing all servers, their status, ports, and recent logs

## Committing Your Work (NON-NEGOTIABLE)

**You MUST commit your changes.** This is not optional. Previous agents have left uncommitted work scattered across the tree. Do not repeat this.

### When to commit

- **After each logical unit of work** — Finished a feature? Commit. Fixed a bug? Commit. Added a component? Commit. Do NOT move to the next task with uncommitted changes.
- **After touching 3+ files** — That's a commit-sized change. Stop and commit before continuing.
- **After editing framework files** — If you ran `make cli-setup`, committed that work immediately after.
- **When the user approves** — If the user says "nice", "thanks", "cool", "ok", "that works", or thumbs up, that IS confirmation. Commit immediately.
- **At the end of your session** — Never leave uncommitted work. The next Claude instance should start with a clean tree.

### How to commit

```bash
# Check what changed
git status
git diff

# Stage your changes
git add <file1> <file2> ...

# Commit with a clear message
git commit -m "feat: add new component X with docs
- Implements feature Y
- Adds Z tests
- Updates storybook

Co-Authored-By: Claude Haiku 4.5 <noreply@anthropic.com>"
```

**Use conventional commit format:** `feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`. One logical change per commit.

### What NOT to do

- Do NOT leave a dozen files modified without committing
- Do NOT commit unrelated changes together (one feature = one commit)
- Do NOT assume the user will commit for you — they won't
- Do NOT skip committing because "it's small" — small changes are the easiest to commit and hardest to reconstruct

## Style Rules

- Follow existing patterns in the codebase
- Use `useThemeColors()` for colors in storybook stories, never hardcode
- Every `<Text>` must have `fontSize` in its `style` prop
- No Unicode symbols in `<Text>` elements (they won't render)
- No `paddingHorizontal`/`paddingVertical` — use explicit `paddingLeft`/`paddingRight`/`paddingTop`/`paddingBottom`
- No `flex: 1` shorthand — use `flexGrow: 1`
