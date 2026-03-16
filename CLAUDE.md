# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Who Maintains This

**You do.** Bugs are from other versions of yourself in parallel instances. If a bug from another Claude is blocking you, fix it — it is your code. All of it.

**Committing:** If you commit on your own, only commit your own work. If prompted to commit, commit everything unaccounted for.

## What This Is

ReactJIT is a rendering framework with **two stacks** that share the same layout engine and primitives:

- **`love2d/`** — React reconciler → QuickJS → Lua → Love2D (OpenGL 2.1). Full-featured legacy stack. See `love2d/CLAUDE.md`.
- **`tsz/`** — `.tsz` source → Zig compiler → SDL2 + wgpu + FreeType. Zero-dependency native stack. See `tsz/CLAUDE.md`.

**The native engine is where the energy is.** The Love2D stack is maintained but not where innovation happens.

**Read the subdirectory CLAUDE.md for whichever stack you're working in.** The stacks have completely different languages, tools, and workflows.

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

`Box`, `Text`, `Image`, `Pressable`, `ScrollView`, `TextInput`

Everything is composed from these. A dashboard is Boxes and Text. There are no special node types.

## Layout Rules (shared)

The flex layout engine is pixel-perfect and shared between Lua (`love2d/lua/layout.lua`) and tsz (`tsz/runtime/tsz/layout.tsz` → compiles to `tsz/runtime/compiled/layout.zig`).

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

## Build (root level)

`build.zig` at the repo root compiles all native artifacts:

```bash
zig build                    # libquickjs + blake3 (Love2D deps)
zig build tsz-compiler       # .tsz compiler
zig build engine-app         # Compiled .tsz app
zig build engine             # Standalone runtime
zig build all                # Everything
```

## One-Liner Design Philosophy

Every capability should be usable in one line by someone who doesn't code. The target user knows their domain (music, art, data, games) but doesn't know internals. An AI should be able to discover and control it without documentation.

## Model Selection

**Always use Opus 4.6 (`claude-opus-4-6`) for debugging.** Sonnet is fine for scaffolding and routine tasks. When tracking down layout bugs, coordinate mismatches, or anything structural — use Opus.

## Git Discipline (CRITICAL)

**Commit early and often. Do not leave work uncommitted.**

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
