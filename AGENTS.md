# AGENTS.md

Context for AI agents (Codex, etc.) working in this repository. Last updated: 2026-04-06.

## What This Is

ReactJIT is a `.tsz`-to-native compiler and UI framework. `.tsz` compiles via **Forge + Smith** to **generated Zig** plus **`LUA_LOGIC`** (default lua-tree) and often **`JS_LOGIC`**. **Before reasoning about “where state lives,”** read [tsz/docs/ARCHITECTURE.md](tsz/docs/ARCHITECTURE.md) § **Where runtime work actually happens**: **Zig** hosts the process (loop, hit-test, layout, paint, dirty bit, stamped `Node`s, optional slots); **LuaJIT** holds much **Lua heap** UI state and tree code; **QuickJS** holds **`JS_LOGIC`** vars and runs **`__eval`** / **`evalLuaMapData`** / **`js_on_press`**. These are **not** a single linear “QJS→Zig→Lua” pipeline. Also see [tsz/compiler/smith/emit_atoms/maps_lua/LUA_TREE_ARCHITECTURE.md](tsz/compiler/smith/emit_atoms/maps_lua/LUA_TREE_ARCHITECTURE.md).

## Repository Layout

```
tsz/            <- ALL ACTIVE DEVELOPMENT HAPPENS HERE
  compiler/     <- Forge (Zig host) + Smith (JS compiler, runs in QuickJS)
  framework/    <- Engine core: layout, GPU, events, state, text, windows, canvas
  carts/        <- Apps built with the framework
    conformance/  <- Test suite (d01-d135+, tiered: soup/mixed/chad)
  scripts/      <- Build scripts (build, flight-check, conformance-report)

love2d/         <- REFERENCE ONLY. Lua stack. Read for porting, do not modify.
archive/        <- FROZEN. Old compiler iterations. Do not modify.
os/             <- Future (CartridgeOS). Mostly stubs.
game/           <- Dead Internet Game. Separate project.
```

## DO NOT TOUCH

- `love2d/` — Read-only reference stack
- `archive/` — Frozen old compilers
- `bin/tsz` — Frozen reference binary (SHA256 verified). Never rebuild.
- Any `.gen.zig` file — These are build artifacts. Fix the `.tsz` source instead.

## Build Commands

From the `tsz/` directory:

```bash
# The one command you need to build a cart:
./scripts/build carts/conformance/d01_nested_maps.tsz

# Or with alias:
tsz-build carts/conformance/d01_nested_maps.tsz

# Debug build:
./scripts/build carts/path/to/app.tsz --debug

# Rebuild compiler after editing Smith JS files:
zig build forge

# Verify Smith manifest/bundle coverage:
zig build smith-sync

# Hot-reload dev mode (63x faster, preferred for iteration):
bin/tsz dev carts/path/to/app.tsz
```

**After editing any Smith JS file** (`compiler/smith_*.js`, `smith_collect/`, `smith_lanes/`, `smith_parse/`, `smith_preflight/`, `smith_emit/`), you MUST run `zig build forge` before those changes take effect. Forge embeds the JS bundle at build time.

## Build Pipeline (3 stages)

1. **Forge** (Zig binary) hosts Smith via QuickJS
2. **Smith** (JS) compiles `.tsz` → **`generated_*.zig`** and **`LUA_LOGIC`** (default); **`JS_LOGIC`** when the cart has script blocks
3. **Zig build** links generated output + `tsz/framework` into a native binary

## Compiler Structure

Smith is a JS compiler that runs inside QuickJS, hosted by Forge (a small Zig binary). Smith source lives at `tsz/compiler/`:

- `smith_*.js` — Root compiler files
- `smith_collect/` — Collection pass
- `smith_lanes/` — Entry lanes + surface tiering (soup/mixed/chad)
- `smith_parse/` — JSX/map/element parsing
- `smith_preflight/` — Validation rules
- `smith_emit/` — Zig code emission
- `smith_DICTIONARY.md` — Live map of the active Smith layout

The Intent Dictionary at `tsz/docs/INTENT_DICTIONARY.md` is the single source of truth for `.tsz` syntax.

## File Extensions

| Extension | What | Example |
|-----------|------|---------|
| `.app.tsz` | App entry point, compiles to binary | `counter.app.tsz` |
| `.mod.tsz` | Runtime module, compiles to `.gen.zig` | `state.mod.tsz` |
| `.tsz` | Component import | `Button.tsz` |
| `.cls.tsz` | Shared styles/classifiers | `styles.cls.tsz` |

## Primitives

`Box`, `Text`, `Image`, `Pressable`, `ScrollView`, `TextInput`, `Cartridge`, `ascript`

Everything is composed from these. `<Cartridge src="app.so">` embeds a dynamically loaded .so app inline.

## Key Rules

- **No hand-painted Zig UI.** `.tsz` compiles TO Zig. Write `.tsz`, not raw Zig UI code.
- **The tsz rule:** If it's not generating code, it should be generated code.
- **No `<` or `>` comparisons in .tsz.** Use word comparisons: `exact`, `not exact`, `above`, `below`, `exact or above`, `exact or below`.
- **Root Page never scrolls.** Scrollable content goes in nested `ScrollView` only.
- **File length limit:** Max 1600 lines per `.zig` or `.tsz` file (enforced by build).
- **Love2D reference first:** Before fixing any compiler bug, check `love2d/scripts/tslx_compile.mjs`. Port proven solutions.

## Layout Rules

Flex layout engine in `tsz/framework/layout.zig`. Sizing tiers (first match wins):

1. Explicit dimensions (`width`, `height`, `flexGrow`, `flexBasis`)
2. Content auto-sizing (shrink-wrap children, text measures from font metrics)
3. Proportional fallback (empty surfaces get 1/4 of parent)

Common pitfalls:
- Root containers need `width: '100%', height: '100%'`
- Use `flexGrow: 1` for space-filling, never hardcoded pixel heights
- ScrollView needs explicit height
- Don't mix text and expressions in `<Text>` — use template literals

## Conformance Suite

Tests live in `tsz/carts/conformance/` organized by tier:
- `soup/` — HTML-like syntax (slowest compile path)
- `mixed/` — Transitional syntax
- `chad/` — Clean classifier-based syntax (fastest compile path)

Every `scripts/build` run on a conformance cart auto-records pass/fail to `conformance.db`.

```bash
./scripts/conformance-report          # Summary
./scripts/conformance-report --fails  # Failures + untested
./scripts/conformance-report --lane chad  # Filter by tier
```

## Zig Version

This project uses **Zig 0.15.2**. Training data for most models covers 0.13/0.14. Key breaking changes exist — check actual source before assuming API shapes.

## Git Discipline

Commit early and often. Descriptive conventional-commit messages (`feat(tsz): ...`, `fix(smith): ...`). Multiple Claude sessions run in parallel — if `git status` is unexpectedly clean, check `git log` and move on.
