# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# HARD RULE: DO NOT CHMOD, UNLOCK, OR MODIFY FROZEN DIRECTORIES

The following directories are READ-ONLY and FROZEN:
- `archive/` — old compiler iterations (v1 tsz, v2 tsz-gen). Reference only.
- `love2d/` — Lua reference stack. Read for porting reference, do not modify.
- `tsz/` — Smith-era stack (.tsz compiler, d-suite conformance, cockpit/Sweatshop .tsz carts, InspectorTsz tools). Read for porting reference, do not modify. Same treatment as `love2d/`.

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

## What This Is (active shape)

ReactJIT is a React-reconciler-driven UI framework. Apps are written in `.tsx` (standard React), bundled by esbuild, and run inside the framework's **QuickJS** VM via `qjs_app.zig`. The reconciler emits CREATE/APPEND/UPDATE mutation commands against a Zig-owned Node pool; the Zig framework handles layout, paint, hit-test, text, input, events, effects, and GPU.

- **`framework/`** — Zig runtime. Layout, engine, GPU, events, input, state, effects, text, windows, QuickJS bridge.
- **`qjs_app.zig`** — Host entry. Loads `bundle.js` into QuickJS, wires events, owns Node pool.
- **`runtime/`** — JS entry point (`index.tsx`), JSX shim, primitives, host globals.
- **`renderer/`** — React-reconciler host config. Emits mutation commands to `__hostFlush`.
- **`cart/`** — `.tsx` apps.
- **`scripts/build-bundle.mjs`** — esbuild bundler. Takes a cart path, produces `bundle.js`.
- **`tsz/`** — FROZEN. Smith compiler + Smith-era carts. Reference only.
- **`love2d/`** — FROZEN. The proven reconciler-on-Lua stack. Reference for every runtime pattern we need.
- **`os/`** — CartridgeOS + Exodia (future).

## Ship Path (the only path)

1. Write/edit a `.tsx` cart in `cart/`.
2. Bundle: `node scripts/build-bundle.mjs cart/<name>.tsx` → writes `bundle.js`.
3. Build: `zig build app -Dapp-source=qjs_app.zig -Dapp-name=<name>` → `zig-out/bin/<name>`.
4. Run: `./zig-out/bin/<name>`.

Long-running goal: a single `scripts/ship <name>` that does steps 2+3.

**No `.tsz`. No Smith. No d-suite conformance.** When you need a feature — inspector, classifier, theme, custom primitive — port the pattern from `love2d/packages/core/src/` or `love2d/lua/` by hand into `runtime/`, or regenerate it fresh in `.tsx` from a description. `love2d/` already solved every runtime pattern we need.

## The Primitives

`Box`, `Text`, `Image`, `Pressable`, `ScrollView`, `TextInput`. Custom host-handled types (Cartridge, Audio, Video, Canvas, etc.) use the `<Native type="X" {...props} />` pattern from love2d — the reconciler emits CREATE with that type, the Zig host handles it.

## Layout Rules

Pixel-perfect flex, shared logic with love2d's layout engine.

### Sizing tiers (first match wins)
1. **Explicit dimensions** — `width`, `height`, `flexGrow`, `flexBasis`
2. **Content auto-sizing** — containers shrink-wrap children, text measures from font metrics
3. **Proportional fallback** — empty surfaces get 1/4 of parent (cascades)

### Rules that still cause bugs
- Root containers need `width: '100%', height: '100%'`
- Use `flexGrow: 1` for space-filling elements, never hardcoded pixel heights
- ScrollView needs explicit height (excluded from proportional fallback)
- Don't mix text and expressions in `<Text>` — use template literals

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
- Descriptive conventional-commit messages: `feat: add inspector elements panel`
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

Love2D-specific skills live in `love2d/.claude/` and only apply when working inside the frozen love2d/ tree. The Smith-era skills (`flight-check-loop`, `chad-audit`, `conformance`) are retained only for reference while touching the frozen `tsz/` tree; do not invoke them against root-level work.
