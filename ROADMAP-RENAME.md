# ReactJIT Rename & Reframing Roadmap

This is the operational roadmap for renaming iLoveReact to **ReactJIT** and
reframing the project around the SDL2 renderer as the primary target, with
WASM as the web delivery mechanism.

---

## Phase 0: Prep (do first, touch nothing else)

- [ ] Register `reactjit.com` domain
- [ ] Create `@reactjit` npm org (reserve the scope even if we don't publish yet)
- [ ] Decide short alias: `rjit` (replaces `ilr`)
- [ ] Commit all outstanding work on `main` — clean tree before the rename branch
- [ ] Create branch: `rename/reactjit`

---

## Phase 1: Lua runtime (the core identity)

The Lua module table `ReactLove` becomes `ReactJIT`. This is the public API
surface that every `main.lua` calls into.

**Source of truth edits (root `lua/`):**

- [ ] `lua/init.lua` — rename module table `ReactLove` to `ReactJIT` (~52 occurrences)
- [ ] `lua/init.lua` — change `[react-love]` log prefix to `[reactjit]`
- [ ] `lua/bridge_quickjs.lua` — `[react-love]` → `[reactjit]` (~10 occurrences)
- [ ] `lua/console.lua` — `ReactLove` → `ReactJIT`
- [ ] `lua/browse.lua` — `[react-love]` → `[reactjit]`
- [ ] `lua/texteditor_tooltips.lua` — `iLoveReact` → `ReactJIT`, `@ilovereact/core` → `@reactjit/core`
- [ ] All other `lua/*.lua` files with `[react-love]` prefix (grep to catch stragglers)

**Downstream consumers of the Lua API (update `ReactLove.*` calls):**

- [ ] `storybook/love/main.lua` — `ReactLove.*` → `ReactJIT.*`
- [ ] `storybook/love/conf.lua` — identity and window title
- [ ] `cli/template/main.lua` — `ReactLove.*` → `ReactJIT.*`
- [ ] `cli/template/conf.lua` — identity and window title
- [ ] `packaging/storybook/main.lua` + `conf.lua`
- [ ] `packaging/neofetch/main.lua` + `conf.lua`
- [ ] All `examples/*/main.lua` and `examples/*/conf.lua`

**SDL2 entry point:**

- [ ] `lua/sdl2_init.lua` — `ReactLove` → `ReactJIT` (if present)

---

## Phase 2: TypeScript packages

### 2a. Package names (`package.json`)

Every `packages/*/package.json` `name` field: `@ilovereact/*` → `@reactjit/*`

```
@reactjit/core          (was @ilovereact/core, package dir: packages/shared)
@reactjit/native        @reactjit/grid        @reactjit/terminal
@reactjit/web           @reactjit/cc           @reactjit/nvim
@reactjit/hs            @reactjit/awesome      @reactjit/components
@reactjit/3d            @reactjit/ai           @reactjit/apis
@reactjit/audio         @reactjit/controls     @reactjit/crypto
@reactjit/game          @reactjit/geo          @reactjit/media
@reactjit/router        @reactjit/rss          @reactjit/server
@reactjit/storage       @reactjit/theme        @reactjit/webhooks
```

### 2b. Import paths (all source files)

Global find-replace across `packages/*/src/**/*.ts(x)`:
- `@ilovereact/` → `@reactjit/`

Same in `storybook/src/**/*.ts(x)`.

### 2c. tsconfig path aliases

- [ ] `tsconfig.base.json` — all 25 `@ilovereact/*` paths → `@reactjit/*`

### 2d. Root package.json

- [ ] `name`: `"ilovereact"` → `"reactjit"`
- [ ] Any npm script strings referencing old names

### 2e. Misc source strings

- [ ] `packages/native/src/errorReporter.ts` — `[react-love]` log prefix
- [ ] `packages/ai/src/mcp/protocol.ts` — MCP client name
- [ ] `packages/storage/src/adapters/web.ts` — `dbName: 'ilovereact-storage'`

---

## Phase 3: CLI

### 3a. Binary rename

- [ ] `cli/bin/ilovereact.mjs` → `cli/bin/reactjit.mjs`
- [ ] `cli/package.json` `bin` field: `{ "reactjit": "./bin/reactjit.mjs", "rjit": "./bin/reactjit.mjs" }`
- [ ] `cli/package.json` `name`: `"reactjit"`

### 3b. CLI internals

- [ ] All help strings, error messages, user-facing text in `cli/commands/*.mjs`
- [ ] `cli/commands/init.mjs` — all `@ilovereact/*` refs → `@reactjit/*`
- [ ] `cli/commands/build.mjs` — temp dirs: `/tmp/ilovereact-*` → `/tmp/reactjit-*`
- [ ] `cli/commands/build.mjs` — cache dirs: `~/.cache/ilovereact-*` → `~/.cache/reactjit-*`
- [ ] `cli/commands/lint.mjs` — client name, help strings
- [ ] `cli/lib/aliases.mjs` — `@ilovereact/*` → `@reactjit/*`
- [ ] `cli/targets.mjs` — `globalName: 'ReactLove'` → `globalName: 'ReactJIT'`

### 3c. Runtime directory

- [ ] Rename `cli/runtime/ilovereact/` → `cli/runtime/reactjit/`
- [ ] Update every path reference in CLI code that constructs `ilovereact/` paths
- [ ] All `package.json` and `tsconfig.json` inside `cli/runtime/reactjit/` get updated names

### 3d. Template

- [ ] `cli/template/src/App.tsx` — display strings
- [ ] `cli/template/src/main.tsx` — import from `@reactjit/native`
- [ ] `cli/template/tsconfig.json` — path aliases

---

## Phase 4: Directory structure rename

### 4a. Project-local runtime dirs

The convention `<project>/ilovereact/` (where CLI syncs runtime packages) → `<project>/reactjit/`

- [ ] `cli/commands/init.mjs` — scaffold `reactjit/` not `ilovereact/`
- [ ] `cli/commands/update.mjs` — sync into `reactjit/` not `ilovereact/`
- [ ] `cli/commands/build.mjs` — resolve from `reactjit/`
- [ ] `cli/commands/dev.mjs` — resolve from `reactjit/`
- [ ] Update `.gitignore` patterns in template and root

### 4b. Storybook

- [ ] Delete `storybook/ilovereact/` (it's a copy that shouldn't exist per CLAUDE.md)
- [ ] Verify storybook resolves packages via workspace symlinks, not local copies

### 4c. Examples

- [ ] Rename `examples/*/ilovereact/` → `examples/*/reactjit/` (ai-box, tor-irc, terminal-pty-demo)
- [ ] Update any local tsconfig/path refs in examples

---

## Phase 5: Build system

### 5a. Makefile

- [ ] Header comment
- [ ] `DIST_BINARY` → `reactjit-demo`
- [ ] All staging/payload/cache dir names
- [ ] `--global-name=ReactLove` → `--global-name=ReactJIT` (all esbuild invocations)
- [ ] `--global-name=ReactLoveStorybook` → `--global-name=ReactJITStorybook`
- [ ] Dist filenames: `.love`, `.tar.gz`, `.exe`

### 5b. Packaging

- [ ] `packaging/storybook/conf.lua` — identity, window title
- [ ] `packaging/neofetch/conf.lua` — identity, window title
- [ ] Any packaging scripts

---

## Phase 6: Storybook display strings

- [ ] `storybook/src/App.tsx` — sidebar brand label
- [ ] `storybook/src/native-main.tsx` — sidebar brand text, console log
- [ ] `storybook/src/playground/templates.ts` — template names
- [ ] Story files with visible brand text:
  - `BlackholeStory.tsx` — `"After (iLoveReact)"` → `"After (ReactJIT)"`
  - `CryptoStory.tsx` — demo strings, section headings
  - `MediaStory.tsx` — package name displays
  - `ControlsStory.tsx` — package name display

---

## Phase 7: Documentation

- [ ] `CLAUDE.md` — full rewrite of all `iLoveReact`/`ilovereact`/`@ilovereact` refs
  - Also update CLI command examples: `ilovereact` → `reactjit`
  - Update the "What This Is" section to lead with SDL2, not Love2D
  - Frame Love2D as "also supported" rather than co-primary
- [ ] `docs/TARGETS.md` — update throughout
- [ ] `docs/LLMS_TXT_STRATEGY.md` — update throughout
- [ ] `docs/conversation.md` — update rename history
- [ ] `scripts/docs/build.ts` — builder name
- [ ] `scripts/docs/plaintext-renderer.ts` — all `iLoveReact` display strings
- [ ] `scripts/poly-pizza-fetch.mjs` — user agent string
- [ ] `scripts/clean-dormant-demos.sh` — CLI command refs
- [ ] Regenerate `llms.txt` files after all renames

---

## Phase 8: Git repo rename

- [ ] Rename GitHub repo from `react-love` to `reactjit` (or create new)
- [ ] Update any GitHub URLs in source
- [ ] Update `package.json` `repository` fields

---

## Phase 9: SDL2-first reframing

This isn't a rename — it's updating the mental model everywhere.

### CLAUDE.md reframing

- [ ] "What This Is" leads with: ReactJIT is a React rendering framework with a
      hand-rolled SDL2+OpenGL renderer running on LuaJIT
- [ ] SDL2 is listed first in native targets, Love2D second
- [ ] CLI default target discussion: `reactjit dev` defaults to `sdl2` not `love`
- [ ] Build commands section leads with SDL2 examples
- [ ] Love2D framed as: "also available for game developers who want Love2D's ecosystem"

### CLI defaults

- [ ] `cli/commands/dev.mjs` — default target: `sdl2` (was `love`)
- [ ] `cli/commands/build.mjs` — default target: `sdl2` (was `love`)
- [ ] `cli/template/main.lua` — keep for Love2D compat, but `sdl2_init.lua` becomes the
      primary entry point
- [ ] Consider: `cli/template/` ships both `main.lua` (love) and `sdl2_init.lua` (sdl2)

### Storybook default

- [ ] Storybook should launch via SDL2 by default
- [ ] `make build-storybook-native` and `make run-storybook` target SDL2

---

## Phase 10: WASM web target (future, not part of rename)

Documented here for completeness — this is the next major workstream after the rename.

- [ ] Emscripten toolchain: compile SDL2+OpenGL+LuaJIT/QuickJS to WASM+WebGL
- [ ] New CLI target: `reactjit build dist:wasm`
- [ ] Output: single HTML page with `<canvas>` + WASM module
- [ ] Easter egg: `<!-- You opened DevTools on a ReactJIT app. There's no DOM to inspect — just a <canvas> and a dream. -->`
- [ ] Retire `packages/web/` (DOM overlay renderer) — or keep as legacy escape hatch
- [ ] Update CLAUDE.md web target documentation

---

## Execution order

**Do phases 0-6 in one branch, one PR.** This is a mechanical rename — no logic changes.
The entire thing can be done with global find-replace + careful verification.

**Phase 7** (docs) can be a follow-up commit on the same branch.

**Phase 8** (repo rename) happens after merge.

**Phase 9** (SDL2-first reframing) is a separate PR — it changes defaults and behavior,
not just strings.

**Phase 10** (WASM) is a separate workstream entirely.

---

## Verification checklist (run after all renames)

```bash
# Everything builds
make cli-setup
cd storybook && reactjit build sdl2 && cd ..
cd examples/native-hud && reactjit update && reactjit build dist:love && cd ../..

# No old names remain in source
grep -r "ilovereact\|iLoveReact\|react-love\|ReactLove" --include="*.lua" lua/
grep -r "@ilovereact" --include="*.ts" --include="*.tsx" packages/ storybook/src/
grep -r "ilovereact\|iLoveReact" --include="*.mjs" cli/
grep -r "ilovereact\|iLoveReact" Makefile

# Storybook runs
make run-storybook

# CLI works
reactjit --help
reactjit init /tmp/test-project
cd /tmp/test-project && reactjit build sdl2
```
