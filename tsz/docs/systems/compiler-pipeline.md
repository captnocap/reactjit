# Compiler Pipeline

How `.tsz` source becomes a native binary.

## Overview

The **active** compiler is **Forge** (Zig) + **Smith** (JavaScript running inside **QuickJS** at compile time). Forge tokenizes; Smith parses, runs **preflight** checks, and **emits** artifacts.

**Outputs:**

- **`generated_*.zig`** — glue, lifecycle, imports (may be **split across several files** per concern).
- **`LUA_LOGIC`** — embedded Lua for **LuaJIT**; **current default** for app UI (lua-tree: Lua builds tables, Zig stamps `layout.Node`).
- **`JS_LOGIC`** — embedded string for **QuickJS** when `<script>` / `_script.tsz` is present (optional alongside `LUA_LOGIC`).

See [ARCHITECTURE.md](../ARCHITECTURE.md) (especially **Where runtime work actually happens**) and [LUA_TREE_ARCHITECTURE.md](../../compiler/smith/emit_atoms/maps_lua/LUA_TREE_ARCHITECTURE.md).

```
.tsz → Forge (lex) → Smith (collect, preflight, parse, emit) → generated Zig + LUA_LOGIC (+ JS_LOGIC if script) → zig build → native binary
```

## Forge + Smith (authoritative path)

| Stage | Where | Role |
|-------|--------|------|
| Lex | `forge.zig`, `lexer.zig` | Flat token arrays (`kinds`, `starts`, `ends`) |
| Bridge | `smith_bridge.zig` | QuickJS VM; load Smith bundle; `compile(path)` → string(s) |
| Intelligence | `compiler/smith/` | `smith_collect/`, `smith_preflight/`, `smith_parse/`, `smith_emit/`, `smith_lanes/` |
| Write | Forge | Writes `/tmp/tsz-gen/` or `--out-dir` (copy into cart for link) |

After Smith returns, the **cart build** (e.g. `./scripts/build`) links `generated_*.zig` against `tsz/framework/`.

**Rebuild Forge** after editing Smith JS: `zig build forge` (bundle is embedded).

## Legacy reference: v1 Zig `codegen.zig` pipeline

An older **all-in-Zig** pipeline (`codegen.zig` `Generator.generate()`, 9 phases) described the **Zig-tree-only** world. It is **not** the full story today. Phases for historical comparison:

| Phase | Name | What it did (legacy) |
|-------|------|----------------------|
| 1–4.x | collect* | FFI, classifiers, components, utils |
| 5 | extractComputeBlock | `<script>` → JS_LOGIC |
| 6–7.x | hooks, conditionals | useState, useEffect, validate |
| 8 | parseJSXElement | JSX → node tree |
| 9 | emitZigSource | Single `generated_app.zig` |

Smith replaces and extends this with lanes (chad, mixed, soup, lua-tree, modules, …).

## Generated output (typical)

Varies by lane and emit backend. Commonly includes:

1. **Imports** — `engine`, `layout`, `state`, `qjs_runtime`, `luajit_runtime`, …
2. **State / manifest** — slots, dynamic text buffers, conditionals (Zig-tree) or bridge hooks (lua-tree)
3. **Node tree** — static `Node{…}` **or** Lua that calls `__declareChildren`
4. **Handlers** — Zig fns and/or `lua_on_*` / `js_on_*` strings
5. **`JS_LOGIC` / `LUA_LOGIC`** — embedded script strings
6. **`_appInit` / `_appTick` / `main`** — lifecycle

## Compilation modes

### App mode (default)

```bash
cd tsz && ./scripts/build carts/path/to/App.tsz
```

Produces a native binary (and generated sources under the cart / tmp per script).

### Direct Forge

```bash
./zig-out/bin/forge build --single carts/path/to/App.tsz
```

### Module mode (`.mod.tsz`)

Emits `.gen.zig` fragments for runtime modules (`pub fn render() Node` or equivalent).

### Embed mode (`--embed`)

If used, output may target **`framework/devtools.zig`** for engine-embedded stubs. **Full inspector** is often a **separate tools cart + IPC** — see [`devtools.zig`](../../framework/devtools.zig) header comment.

### Imperative / block module modes

TypeScript modules without JSX (Smith `--mod`, `_zscript.tsz`, etc.) follow Smith module emit rules.

## Import resolution

Smith resolves `from './path'`:

1. Strip `./`, try suffixes (`_cls.tsz`, `_c.tsz`, `_script.tsz`, …)
2. `_script.tsz` → concatenated **JS_LOGIC**
3. Other imports merged/inlined per lane rules

**App** vs **module** worlds (`.tsz` vs `.mod.tsz`) stay isolated.

## CLI

Prefer **`rjit`** (repo `bin/`) or **`./scripts/build`** for end-to-end cart builds. Forge flags include `--strict` (preflight warnings → errors), `--out-dir=`, `--single`.

See [Dev Mode](dev-mode.md) for hot reload.

## Self-extracting binaries

Optional packaging via dist tooling after `zig build` (platform-specific).

## Known limitations

- Max **1600** lines per `.zig` or `.tsz` (enforced)
- Caps on slots, dynamic texts, components (see preflight / Smith)
- `<` inside script blocks can interact badly with JSX parsing — use word comparisons in `.tsz` where required
