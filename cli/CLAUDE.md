# CLI CLAUDE.md

This is the `reactjit` CLI — a tightly integrated build system, not a general-purpose tool
runner. Every command here is load-bearing. Before touching anything, understand what it owns
and what it guards.

---

## What This Directory Is

The CLI is the single deployment unit for the framework. It bundles:
- the build pipeline (`commands/build.mjs`)
- the static linter (`commands/lint.mjs`)
- the project scaffolder (`commands/init.mjs`)
- the runtime syncer (`commands/update.mjs`)
- the TypeScript-to-Lua transpiler (`lib/tsl.mjs`)
- all runtime files (`runtime/`) that get distributed to user projects

When a user runs `reactjit build`, this is what runs. It is the framework's face to the world.

---

## The Three Invariants You Must Never Break

### 1. Lint gates compilation

Every build path — dev, dist:love, dist:sdl2, screenshot — runs `runLint()` before esbuild.
Lint errors exit(1) before the bundle runs. This is intentional and non-negotiable. If you
add a new build path, it must also call `runLint()` first.

Post-build checks (`runPostBuildChecks()`) catch things esbuild can't — like duplicate
`createContext` calls from divergent import paths. These run after the bundle exists. Both
gates must be respected.

### 2. Symlinks are protected, not clobbered

`commands/update.mjs` checks whether a destination path is a symlink before copying. If it
is, it skips and prints a message. This protects the storybook, which reads Lua source
directly via `storybook/love/lua → ../../lua`. Never remove this check. Never add a copy
operation that bypasses it.

### 3. `targets.mjs` is the single source of truth for target config

esbuild flags, output paths, entry point priority, and platform metadata live in
`targets.mjs`. No command should hardcode `--format=iife`, output paths, or platform strings
— all of that must come from the target registry. If a new target is needed, add it there
first, then wire the build logic in `build.mjs`.

---

## Source-of-Truth Hierarchy (Know This Before Editing Runtime Files)

```
lua/          (monorepo root — authoritative)
packages/     (monorepo root — authoritative)
      ↓  make cli-setup
cli/runtime/  (CLI's copy — distributed to projects)
      ↓  reactjit init / reactjit update
<project>/    (user's copy — disposable)
```

**Never edit `cli/runtime/` directly.** It is populated by `make cli-setup` from the monorepo
root. Editing it directly means your change disappears on the next `make cli-setup`. Edit the
source of truth (`lua/`, `packages/`), then run `make cli-setup` to propagate.

---

## Command Architecture

All commands are async functions exported from `commands/*.mjs` and dispatched by
`bin/reactjit.mjs` via a switch statement. Pattern:

```javascript
export async function fooCommand(args) {
  const cwd = process.cwd();
  // 1. parse args
  // 2. validate (exit(1) early if invalid, before any side effects)
  // 3. execute
}
```

Rules:
- **No thrown exceptions propagated to the dispatcher.** Commands catch and log, then
  `process.exit(1)`.
- **Validation before side effects.** If a required file is missing, exit before touching
  the filesystem.
- **`process.exit()` is how commands signal failure.** Don't return error codes or throw.

---

## The Build Command (`commands/build.mjs`)

This is the largest and most complex file (~1000 lines). Before modifying it, understand the
three execution paths:

### Dev build (`buildDevTarget`)
- Resolves entry point from `target.entries` priority list (first that exists wins)
- Calls `esbuildArgs(target)` from `targets.mjs` to get flags
- Adds project-specific aliases via `buildAliases()`
- Outputs to `target.output`

### Dist:love (`buildDistLove`)
- Stages files into a temp directory
- Bundle goes to `love/bundle.js` — this path is what `main.lua` expects
- Creates `.love` zip archive, then embeds it in a self-extracting shell script
- Video conversion (mp4/mkv → ogv via ffmpeg) happens in staging — ffmpeg absence is silent
- libmpv has a dep skiplist (~30+ entries) to strip encoder/TTS/math libs from the binary

### Dist:sdl2 (`buildDistSdl2`)
- Uses zig build system + `build-luajit-cross.sh` for cross-compilation
- Platform config comes from `PLATFORMS` in `targets.mjs`
- Verifies artifact existence before packaging — do not skip these checks
- Linux: self-extracting shell script; Windows/macOS: tar.gz

If you add a new dist format, follow the same staging-then-packaging pattern. No side effects
in the project directory during staging.

---

## The Lint Command (`commands/lint.mjs`)

~1800 lines. The linter uses TypeScript's `createSourceFile()` for AST parsing without a
full type checker. It is fast by design — no `tsc`, no language server.

Key concepts:
- **`JsxContext`**: one per JSX element, tracks parent/children links, flex depth, style
  literals, shorthand props. Only inline `style={{ ... }}` literals are analyzed; dynamic
  styles are invisible to the linter.
- **`// rjit-ignore-next-line`**: suppresses the rule on the following line. This is the
  only escape hatch. Don't add new suppression mechanisms.
- **Errors block builds. Warnings do not.** When adding a new rule, decide carefully which
  it is. Err toward warning unless the layout consequence is guaranteed broken.
- **TSL rules** are conditionally applied — only to `.tsl` files, not `.tsx`.
- **MCP async discovery**: if `useMCPServer()` calls are found, the linter connects to the
  MCP server during lint and writes `mcp.tools.json`. This is async and side-effectful —
  treat it carefully.

When adding a lint rule:
1. Add the rule function (takes `JsxContext`, returns `LintError | null`)
2. Add it to the appropriate category array
3. Assign it an error or warning severity
4. Test with `// rjit-ignore-next-line` to confirm suppression works

---

## The Alias Resolver (`lib/aliases.mjs`)

Short file, high impact. This is what prevents the duplicate `createContext` bug — where two
separate copies of `@reactjit/core` end up in the bundle with independent React contexts.

The resolver checks if `packages/*/src/` exists relative to cwd (monorepo scenario). If so,
it resolves `@reactjit/*` imports directly to source. Otherwise it resolves to the project's
local `reactjit/` copies.

**Never hardcode package paths in `build.mjs` or `dev.mjs`.** Always call `buildAliases()`
and pass the result to esbuild.

---

## TSL — TypeScript-to-Lua (`lib/tsl.mjs`)

The transpiler is a full AST walker (~1000+ lines). It converts `.tsl` files (TypeScript
subset) to valid Lua.

Convention:
- Source: `src/tsl/foo.tsl`
- Output: `lua/tsl/foo.lua`
- Relative path is preserved

Transpilation runs **before lint and before the bundle** — the generated `.lua` files may be
referenced by the Lua runtime. In dev mode, `.tsl` changes are watched and re-transpiled
incrementally.

TSL-specific lint rules (`tsl-no-js-globals`, `tsl-no-zero-index`, `tsl-no-any`) are applied
only to `.tsl` files during lint. If you add new TSL restrictions, add a lint rule — don't
rely on transpiler errors alone.

---

## The Template (`template/`)

This is what `reactjit init` copies to new projects. Changes here affect every project
created going forward.

- `src/App.tsx` and `src/main.tsx` are the starter app
- `tsconfig.json` is a template — path aliases are generated dynamically by `init.mjs` based
  on selected packages
- `main.lua` and `conf.lua` are Love2D entry points
- Do not add framework-specific boilerplate here. Keep it minimal.

---

## The Test Suite (`test/cli.test.mjs`)

Uses Node.js built-in `node:test`. Tests spawn `reactjit.mjs` as a child process and check
exit codes and output.

- Tests run against real filesystem (temp directory created per suite)
- `NO_COLOR=1` is set to strip ANSI from output comparisons
- These are smoke tests, not unit tests — they verify the CLI doesn't crash

When adding a new command, add at minimum:
- A smoke test that verifies it exits 0 on valid input
- A test that verifies it exits 1 on invalid/missing input

---

## Patterns to Follow When Adding Features

### New command
1. Create `commands/foo.mjs` exporting `async function fooCommand(args)`
2. Add a case to the switch in `bin/reactjit.mjs`
3. Add it to the help text
4. Add smoke tests in `test/cli.test.mjs`

### New lint rule
1. Add rule function to `commands/lint.mjs` in the appropriate category
2. Use `JsxContext` — don't walk the raw AST in the rule function itself
3. Assign error or warning severity deliberately
4. Document the rule name in the function (used in `// rjit-ignore-next-line` suppression)

### New build target
1. Add entry to `TARGETS` in `targets.mjs` with `format`, `globalName`, `entries`,
   `output`, `kind`
2. Add build logic in `commands/build.mjs` following the existing staging pattern
3. Add platform metadata to `PLATFORMS` if cross-compilation is needed

### New runtime package
1. Create the package at `packages/<name>/` in the monorepo root (the source of truth)
2. Add it to the optional packages list in `commands/init.mjs`
3. Add path alias generation for it in `init.mjs`'s tsconfig generation
4. Update `commands/update.mjs` to sync it if it doesn't fall under `reactjit/`
5. Run `make cli-setup` to propagate into `cli/runtime/reactjit/` — never edit `cli/runtime/` directly

---

## What Not to Do

- **Don't run esbuild directly** — always go through `buildDevTarget()` or the dist
  functions. Raw esbuild skips aliases, skips lint, and uses wrong flags.
- **Don't add config files** — the CLI has no config file format by design. Options are
  flags and project metadata (`package.json`, `tsconfig.json`).
- **Don't bypass the lint gate** — if you find yourself adding `--skip-lint` or
  conditionally skipping `runLint()`, stop and reconsider.
- **Don't edit `cli/runtime/` files** — they are overwritten by `make cli-setup`. Your
  change will be lost.
- **Don't hardcode target output paths in commands** — use `target.output` from
  `targets.mjs`.
- **Don't swallow errors silently** — if a child process fails, log the stderr and
  `exit(1)`. Silent failures cause impossible-to-debug issues downstream.
