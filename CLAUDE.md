# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# HARD RULE: DO NOT CHMOD, UNLOCK, OR MODIFY FROZEN DIRECTORIES

The following directories are READ-ONLY and FROZEN:
- `archive/` — old compiler iterations (v1 tsz, v2 tsz-gen). Reference only.
- `love2d/` — Lua reference stack. Read for porting, do not modify.

The active codebase is `tsz/`. The active `.tsz` compiler path is Forge + Smith inside `tsz/`: rebuild with `zig build forge`, then use `./scripts/build` for end-to-end cart builds or `./zig-out/bin/forge build` for direct compiler runs.

# HARD RULE: DO NOT USE EXPLORE IN THIS REPOSITORY
For feature verification, compiler capability checks, and architecture comparisons in this repo:
- NEVER invoke the built-in Explore agent.
- Read files directly with Read / Grep / Glob / Bash.
- Treat "does this exist?" and "what is missing?" as source-verification tasks.
Measured evidence in this repo:
- Direct Opus read: ~1m13s, correct result
- Explore-agent path: ~3m46s, incorrect result
- Explore has already produced materially false feature reports here (example: claimed tsz had .map() when it did not)
- Prior tested feature audit showed ~57.5% false-claim rate from Explore on this codebase
Why:
- This repo contains a custom compiler, DSL, and runtime not represented in training data.
- Explore summaries are less reliable than direct source inspection here.
- Delegation is slower and increases hallucination risk.

## Who Maintains This

**You do.** Bugs are from other versions of yourself in parallel instances. If a bug from another Claude is blocking you, fix it — it is your code. All of it.

**Committing:** If you commit on your own, only commit your own work. If prompted to commit, commit everything unaccounted for.

## What This Is

ReactJIT is a TS-to-native compiler and UI framework. `.tsz` is compiled by **Forge + Smith** (Smith runs in **QuickJS** at compile time). The **runtime** links **Zig** (SDL3, wgpu, flex layout, paint, stamping) with **LuaJIT** (`luajit_runtime` — **`LUA_LOGIC`** is the default app emit) and **QuickJS** (`qjs_runtime` — `<script>` / `JS_LOGIC` when present, plus `__eval` / `evalLuaMapData`). See [tsz/docs/ARCHITECTURE.md](tsz/docs/ARCHITECTURE.md).

- **`tsz/`** — The active engine: compiler, framework, carts. See `tsz/CLAUDE.md`.
- **`love2d/`** — Lua reference stack (React reconciler → QuickJS → Lua → Love2D). Read for porting reference.
- **`os/`** — CartridgeOS + Exodia (future). App shell and distribution layer.

**All active development happens in `tsz/`.** Read `tsz/CLAUDE.md` before working there.

### The tsz Rule

**If it's not generating code, it should be generated code.** The runtime is written in `.mod.tsz`. The compiler turns `.mod.tsz` into `.zig`. Hand-written `.zig` in the runtime is temporary — it means the compiler hasn't caught up. Fix the compiler, don't write more `.zig`.

### File Extensions

| Extension | What | Example |
|-----------|------|---------|
| `.app.tsz` | App → binary | `counter.app.tsz` |
| `.mod.tsz` | Runtime module → `.gen.zig` | `state.mod.tsz` |
| `.tsz` | Component import | `Button.tsz` |
| `.cls.tsz` | Shared styles/classifiers | `styles.cls.tsz` |

## The Primitives (shared)

`Box`, `Text`, `Image`, `Pressable`, `ScrollView`, `TextInput`, `Cartridge`, `ascript`

Everything is composed from these. A dashboard is Boxes and Text. `<Cartridge src="app.so">` embeds a dynamically loaded .so app inline. `<ascript>` runs AppleScript on macOS (see below).

## Layout Rules (shared)

The flex layout engine is pixel-perfect and shared between Lua (`love2d/lua/layout.lua`) and the Zig runtime (`tsz/framework/layout.zig`).

### Sizing tiers (first match wins)
1. **Explicit dimensions** — `width`, `height`, `flexGrow`, `flexBasis`
2. **Content auto-sizing** — containers shrink-wrap children, text measures from font metrics
3. **Proportional fallback** — empty surfaces get 1/4 of parent (cascades)

### Rules that still cause bugs
- Root containers need `width: '100%', height: '100%'`
- Use `flexGrow: 1` for space-filling elements, never hardcoded pixel heights
- ScrollView needs explicit height (excluded from proportional fallback)
- Don't mix text and expressions in `<Text>` — use template literals

### Layout anti-patterns
- Hardcoding pixel heights to fit a known window size → use `flexGrow: 1`
- Manual pixel budgeting → let flex handle distribution
- Fixed dimensions where auto-sizing works → let containers shrink-wrap

## Build (tsz stack)

Use the `tsz/` build path that the active compiler actually uses:

```bash
cd tsz
./scripts/build carts/path/to/app.tsz   # preferred end-to-end cart build
zig build forge                         # rebuild Forge after editing Smith compiler files
zig build smith-sync                    # verify Smith manifest/bundle coverage
zig build smith-bundle                  # rebuild Smith bundle only
./zig-out/bin/forge build --single carts/path/to/app.tsz  # direct compiler run when needed
```

Smith now lives directly under `tsz/compiler/` as `smith_*.js`, `smith_collect/`, `smith_lanes/`, `smith_parse/`, `smith_preflight/`, and `smith_emit/`.

**Do not use Node for active Smith builds.** The old `node compiler/build_smith_bundle.mjs` and `node compiler/sync_smith.mjs` path is removed. The active bundle/sync tools are native Zig: `tsz/compiler/smith_bundle.zig` and `tsz/compiler/smith_sync.zig`.

## Hot-Reload Dev Mode (PREFERRED FOR ITERATION)

**Use `tsz dev` instead of `tsz build` during development.** It's 63x faster.

```bash
# Start dev mode (compiles .tsz → .so, launches shell, watches for changes)
bin/tsz dev carts/path/to/app.tsz

# Or enter the cart directory and let tsz infer the entry file
cd tsz/carts/my-cart
../../zig-out/bin/tsz run dev
# ../../zig-out/bin/tsz dev works too

# The shell stays open. Edit any .tsz file in the cart directory.
# Changes auto-detect → recompile → hot-reload (186ms, no restart).
# State (counters, form values, etc.) survives reloads.
```

**Single instance:** If a dev shell is already running, `tsz dev` just rebuilds the .so and exits. The running shell auto-reloads. No duplicate windows.

**Entry inference:** When run without a file argument, `tsz run dev` and `tsz dev` use the current directory if it contains exactly one app entry. If there are multiple app files, pass one explicitly.

### Build targets

```bash
cd tsz
zig build tsz              # Lean compiler
zig build tsz-full         # Full compiler
zig build app              # Full binary (links everything — slow, for production)
zig build app-lib          # Shared library .so (pure Zig, no native deps — fast, for dev)
zig build dev-shell        # Dev shell binary (built once, cached)
zig build -Dcart-source=file.zig -Dcart-name=foo cart  # Custom Zig cartridge .so
```

### CartridgeOS (multi-app host)

The dev shell can load multiple .so cartridges in a tabbed interface:

```bash
tsz-dev app1.so app2.so app3.so    # Tabbed multi-app host
```

Each cartridge has independent state, event handlers, lifecycle. Cross-cartridge state access is available via the shell. Cartridges hot-reload independently.

### `<Cartridge>` component

Any .so can be embedded inline as a component:

```tsx
<Cartridge src="sidebar.so" style={{ width: 250 }} />
<Cartridge src="editor.so" style={{ flexGrow: 1 }} />
```

Any language that can produce a .so with C exports can be a cartridge (Zig, Rust, C, Go). The ABI is 6 functions: `app_get_root`, `app_get_init`, `app_get_tick`, `app_get_title`, `app_state_count`, `app_state_*`.

## Build (Love2D stack)

`build.zig` at the repo root compiles Love2D native deps:

```bash
zig build                    # libquickjs + blake3
```

## One-Liner Design Philosophy

Every capability should be usable in one line by someone who doesn't code. The target user knows their domain (music, art, data, games) but doesn't know internals. An AI should be able to discover and control it without documentation.

## Model Selection

**Always use Opus 4.6 (`claude-opus-4-6`) for debugging.** Sonnet is fine for scaffolding and routine tasks. When tracking down layout bugs, coordinate mismatches, or anything structural — use Opus.

## Git Discipline (CRITICAL)

**Commit early and often. Do not leave work uncommitted.**

### MAIN ONLY — NO BRANCHES

**Do not create branches. Do not checkout branches. Do not use git switch.** Commit and push to `main`. That's it. No feature branches, no PRs, no selective staging workflows. This is a solo project — branch workflows waste time and `git checkout` / `git stash` / `git reset` destroy work.

The only safe git commands are: `git add`, `git commit`, `git push`, `git status`, `git log`, `git diff`.

### When to commit
- After completing each logical unit of work
- Before risky operations (refactoring core files, changing build pipeline)
- When you've touched 3+ files
- At natural breakpoints in multi-step work
- When the human gives positive feedback ("nice", "cool", "ok", thumbs up) — that IS the approval signal
- When in doubt, commit

### How to commit
- Descriptive conventional-commit messages: `feat(tsz): add FFI support`
- One logical change per commit
- Never leave a session with uncommitted work

### Parallel sessions ("empty fridge" problem)
Multiple Claude instances work simultaneously. If `git status` is unexpectedly clean:
1. Run `git log --oneline -5` ONCE
2. Another you committed it. Move on.
3. Do NOT loop on `git status`

## Documentation Workflow

Documentation is a completion criterion. After major features:
1. Emit a CHANGESET brief (what, why, affects, breaking changes, new APIs)
2. Update affected docs
3. Commit code + docs together

## Skills & Agents

All skills and agents are Love2D-specific and live in `love2d/.claude/`. The `tsz/` stack has none yet.
