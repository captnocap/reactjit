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

One command — no steps to remember:

```bash
./scripts/ship <cart-name>          # cart/<name>.tsx → zig-out/bin/<name> (self-extracting)
./scripts/ship <cart-name> -d       # debug build, raw ELF
./scripts/ship <cart-name> --raw    # release, raw ELF (for ldd inspection)
```

What happens: esbuild bundles `cart/<name>.tsx` → `bundle.js`, Zig compiles `qjs_app.zig` with `bundle.js` embedded via `@embedFile`, Linux packaging wraps the ELF + all its `.so` deps + `ld-linux` into a self-extracting tarball that extracts to `~/.cache/reactjit-<name>/<sig>/` on first run. macOS produces a `.app` bundle with `Frameworks/` dylib rewrites. Result: a single-file shippable binary with zero system dependencies.

**No `.tsz`. No Smith. No d-suite conformance.** When you need a feature — inspector, classifier, theme, custom primitive — port the pattern from `love2d/packages/core/src/` or `love2d/lua/` by hand into `runtime/`, or regenerate it fresh in `.tsx` from a description. `love2d/` already solved every runtime pattern we need.

## Dev Path (iterate without rebuilding)

```bash
./scripts/dev <cart-name>       # launches the dev host + watches <cart> for saves
./scripts/dev <other-cart>      # from another terminal: pushes to running host, adds a tab
```

The dev host is a single persistent ReleaseFast binary with:
- **Hot reload for React / TSX / TS** — editing any file under `cart/` or `runtime/` re-bundles through esbuild and pushes the new JS over `/tmp/reactjit.sock`. The host tears down the QJS context and re-evals in ~300ms. **You do NOT re-run `scripts/dev` or rebuild the binary for cart code changes.**
- **Rebuild required for Zig / framework / build-pipeline changes** — anything under `framework/`, `qjs_app.zig`, `build.zig`, or `scripts/` needs the binary rebuilt (delete `zig-out/bin/reactjit-dev` then run `./scripts/dev <cart>` again, or `zig build app -Ddev-mode=true -Doptimize=ReleaseFast -Dapp-name=reactjit-dev`).
- **Tabs in the titlebar** — the host is borderless; the top strip IS the window chrome. Each `./scripts/dev <cart>` push shows as a tab. Click a tab to switch active cart (full QJS teardown + re-eval each time). Double-click empty chrome toggles maximize. Drag empty chrome to move. Window controls (minimize / maximize / close) on the right.
- **Debug builds silently crash on click.** Always use `ReleaseFast` (default in `scripts/dev`). Pre-existing framework bug in the Debug-mode click path; out of scope for dev-mode work.

**State preservation across reloads is NOT working yet.** `useHotState` + `framework/hotstate.zig` are wired but in practice state still resets on every reload. Treat HMR as "save → see your change, lose local useState". Full fix is pending — don't assume atoms persist.

See `runtime/hooks/README.md` for the async-subsystem tick-drain design, host bindings status, and the remaining pending hooks (websocket, process streaming, sqlite).

## Primitives

`Box`, `Row`, `Col`, `Text`, `Image`, `Pressable`, `ScrollView`, `TextInput`, `TextArea`, `TextEditor`, `Canvas`/`Canvas.Node`/`Canvas.Path`/`Canvas.Clamp`, `Graph`/`Graph.Path`/`Graph.Node`, and `Native` (universal escape hatch).

`Canvas` and `Graph` pan-zoomable and static-viewport surfaces respectively, with `gx/gy/gw/gh` coordinate-space positioning and SVG `d`/`stroke`/`strokeWidth`/`fill` props on paths.

Custom host-handled types (Audio, Video, Cartridge, LLMAgent, etc.) use `<Native type="X" {...props} />` — the reconciler emits CREATE with that type, the Zig host handles it.

### HTML tags work too

`renderer/hostConfig.ts` has `HTML_TYPE_MAP` that remaps all common HTML tags before CREATE. You can copy-paste standard React markup and it just works:

```tsx
<div className="p-4 flex-row gap-2">
  <h1>Hello</h1>
  <p>World</p>
  <button onClick={...}>Go</button>
</div>
```

Mapped: `div/section/article/main/nav/header/footer/form/ul/li/table/tr/td/a/button/dialog/menu → View`; `span/p/label/h1-6/strong/b/em/i/code/small → Text`; `img → Image`; `input/textarea → TextInput/TextEditor`; `pre → CodeBlock`; `video → Video`. HTML-only attrs (`alt`, `htmlFor`, `aria-*`, `data-*`, `tabIndex`, etc.) are stripped before the bridge. Headings get auto font-sizes (h1=32, h2=28, …, h6=16).

### Tailwind via `className`

`className` strings are parsed by `runtime/tw.ts` (ported from `love2d/packages/core/src/tw.ts`) and merged into `style` at CREATE time. Full utility coverage: spacing (`p-4`, `mx-8`), sizing (`w-full`, `h-[300]`), flex (`flex-row`, `gap-2`, `justify-center`, `items-start`), colors (`bg-blue-500`, `text-slate-200`), radius (`rounded-lg`), borders (`border-2`, `border-blue-400`), typography (`text-xl`, `font-bold`), and arbitrary values via brackets (`p-[20]`, `bg-[#ff6600]`, `w-[240]`).

`style` props win on conflicts — mix them freely:

```tsx
<Box className="p-4 bg-blue-500 rounded-lg" style={{ borderWidth: 2 }}>
```

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
