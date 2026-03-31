# Smith Compiler Dictionary

Reference for the live Smith compiler after promotion out of `refactor/`.

## Architecture

```text
.tsz source
  -> Forge (Zig host)
     - resolves imports and merges source
     - lexes merged source into flat token triplets
     - sets QuickJS globals (__source, __tokens, __file, __scriptContent, __clsContent, flags)
     - calls Smith compile()

  -> Smith (JS compiler bundle in QuickJS)
     - entry-lane dispatch: soup / module / page / app
     - surface-tier scan: soup / mixed / chad
     - collection + parse fill ctx
     - preflight validates ctx
     - emit returns Zig or split-output payloads

  -> Forge
     - stamps integrity header
     - writes generated output
```

QuickJS does not resolve runtime imports. Forge embeds one generated Smith bundle from [LOAD_ORDER.txt](/home/siah/creative/reactjit/tsz/compiler/smith/LOAD_ORDER.txt).

## Active Layout

Active Smith source now lives directly under `compiler/smith/`:

- [core.js](/home/siah/creative/reactjit/tsz/compiler/smith/core.js)
- [collect/](/home/siah/creative/reactjit/tsz/compiler/smith/collect)
- [lanes/](/home/siah/creative/reactjit/tsz/compiler/smith/lanes)
- [parse/](/home/siah/creative/reactjit/tsz/compiler/smith/parse)
- [preflight/](/home/siah/creative/reactjit/tsz/compiler/smith/preflight)
- [emit/](/home/siah/creative/reactjit/tsz/compiler/smith/emit)
- top-level coordinators: [index.js](/home/siah/creative/reactjit/tsz/compiler/smith/index.js), [parse.js](/home/siah/creative/reactjit/tsz/compiler/smith/parse.js), [parse_map.js](/home/siah/creative/reactjit/tsz/compiler/smith/parse_map.js), [attrs.js](/home/siah/creative/reactjit/tsz/compiler/smith/attrs.js), [preflight.js](/home/siah/creative/reactjit/tsz/compiler/smith/preflight.js), [emit.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit.js), [page.js](/home/siah/creative/reactjit/tsz/compiler/smith/page.js), [mod.js](/home/siah/creative/reactjit/tsz/compiler/smith/mod.js), [soup_smith.js](/home/siah/creative/reactjit/tsz/compiler/smith/soup_smith.js), [rules.js](/home/siah/creative/reactjit/tsz/compiler/smith/rules.js), [logs.js](/home/siah/creative/reactjit/tsz/compiler/smith/logs.js)

Frozen reference snapshot:

- [refactor/](/home/siah/creative/reactjit/tsz/compiler/smith/refactor)

`refactor/` is no longer part of the active manifest. It is kept only as a historical snapshot. `smith-sync` reports if the active manifest still points there.

## Bundle Model

Authoritative manifest:

- [LOAD_ORDER.txt](/home/siah/creative/reactjit/tsz/compiler/smith/LOAD_ORDER.txt)

Bundle builder:

- [build_bundle.mjs](/home/siah/creative/reactjit/tsz/compiler/smith/build_bundle.mjs)

Sync scanner:

- [sync_scan.mjs](/home/siah/creative/reactjit/tsz/compiler/smith/sync_scan.mjs)

Generated bundle:

- `compiler/smith/dist/smith.bundle.js`

Useful commands:

- `zig build smith-sync`
- `zig build smith-bundle`
- `zig build forge`

`smith-sync` now checks:

- missing manifest sources
- active authored JS missing from the manifest
- manifest entries still pointing at frozen `refactor/`
- bundle staleness
- dirty active Smith files
- dirty frozen reference files

## Entry Lanes Vs Surface Tiers

This is the key distinction.

Compiler entry lanes are still:

- `soup`
- `module`
- `page`
- `app`

Surface tiers are the three source shapes the project is aiming at:

- `soup`
- `mixed`
- `chad`

The entry lane decides which compiler path runs. The surface tier describes the source family that preflight and emitted metadata should report.

Current ownership:

| Concept | File | Meaning |
|---|---|---|
| Entry dispatch | [lanes/dispatcher.js](/home/siah/creative/reactjit/tsz/compiler/smith/lanes/dispatcher.js) | Routes into `soup`, `module`, `page`, or default `app` |
| Surface-tier scan | [lanes/shared.js](/home/siah/creative/reactjit/tsz/compiler/smith/lanes/shared.js) | Detects and assigns `ctx._sourceTier` as `soup`, `mixed`, or `chad` |
| Cached tier | [core.js](/home/siah/creative/reactjit/tsz/compiler/smith/core.js) | `resetCtx()` initializes `_sourceTier` |
| Preflight lane label | [preflight/context.js](/home/siah/creative/reactjit/tsz/compiler/smith/preflight/context.js) | Uses `ctx._sourceTier` first, then falls back |

Current model:

- `module` is orthogonal to the three surface tiers.
- `soup` entry lane always compiles the `soup` surface tier.
- `page` is an entry lane, not a tier. It usually carries `chad`-style source.
- `app` is the default entry lane for primitive JSX sources and can scan as `mixed` or `chad`.

## Compile Flow

### Entry

[index.js](/home/siah/creative/reactjit/tsz/compiler/smith/index.js) owns:

- `compile()` -> reads Forge globals and calls `compileLane(source, tokens, file)`
- `stampIntegrity(out)` -> prefixes generated output before Forge finalizes the body hash
- `compileMod(...)` / `compileModLua(...)` -> line-based module transpilers

### App lane

[lanes/app.js](/home/siah/creative/reactjit/tsz/compiler/smith/lanes/app.js) is the default JSX pipeline:

1. `mkCursor(tokens, source)`
2. `resetCtx()`
3. `assignSurfaceTier(source, file)`
4. `collectCompilerInputs(c)`
5. `findAppStart(c)`
6. `collectRenderLocals(c, appStart)`
7. `moveToAppReturn(c, appStart)`
8. `parseJSXElement(c)`
9. `finishParsedLane(root.nodeExpr, file, opts)`

### Page lane

[lanes/page.js](/home/siah/creative/reactjit/tsz/compiler/smith/lanes/page.js) delegates to [page.js](/home/siah/creative/reactjit/tsz/compiler/smith/page.js).

`page.js` still owns:

- `<var>`
- `<state>`
- `<functions>`
- `<timer>`
- `return (...)` extraction before normal JSX parsing

### Module lane

[lanes/module.js](/home/siah/creative/reactjit/tsz/compiler/smith/lanes/module.js) delegates to:

- line mode in [index.js](/home/siah/creative/reactjit/tsz/compiler/smith/index.js)
- block mode in [mod.js](/home/siah/creative/reactjit/tsz/compiler/smith/mod.js)

### Soup lane

[lanes/soup.js](/home/siah/creative/reactjit/tsz/compiler/smith/lanes/soup.js) delegates to [soup_smith.js](/home/siah/creative/reactjit/tsz/compiler/smith/soup_smith.js).

Soup remains its own compiler path with its own tokenizer, tree builder, and emitter behavior. It now still reports the explicit `soup` surface tier.

### Finish path

[lanes/shared.js](/home/siah/creative/reactjit/tsz/compiler/smith/lanes/shared.js) owns `finishParsedLane()`:

1. `preflight(ctx)`
2. `preflightErrorZig(...)` on failure
3. `emitOutput(nodeExpr, file)` on success
4. `stampIntegrity(...)` unless split output already bypassed wrapping

## Ownership Map

| Path | Role |
|---|---|
| [rules.js](/home/siah/creative/reactjit/tsz/compiler/smith/rules.js) | Token enums, style keys, color tables, soup constants |
| [logs.js](/home/siah/creative/reactjit/tsz/compiler/smith/logs.js) | Logging and debug helpers |
| [core.js](/home/siah/creative/reactjit/tsz/compiler/smith/core.js) | Shared cursor helpers, ctx reset, slot helpers, runtime-log wrappers |
| [collect/](/home/siah/creative/reactjit/tsz/compiler/smith/collect) | Collection pass |
| [lanes/](/home/siah/creative/reactjit/tsz/compiler/smith/lanes) | Entry-lane dispatch plus surface-tier assignment |
| [parse/](/home/siah/creative/reactjit/tsz/compiler/smith/parse) | Refactored JSX/map/element parsing helpers |
| [preflight/](/home/siah/creative/reactjit/tsz/compiler/smith/preflight) | Intent derivation and grouped validation rules |
| [emit/](/home/siah/creative/reactjit/tsz/compiler/smith/emit) | Preamble, node tree, runtime updates, finalization |
| [parse.js](/home/siah/creative/reactjit/tsz/compiler/smith/parse.js) | Public JSX coordinator |
| [parse_map.js](/home/siah/creative/reactjit/tsz/compiler/smith/parse_map.js) | Compatibility shim for map entry |
| [attrs.js](/home/siah/creative/reactjit/tsz/compiler/smith/attrs.js) | Shared style/color/handler/expression parsing still used by JSX parsing |
| [preflight.js](/home/siah/creative/reactjit/tsz/compiler/smith/preflight.js) | Top-level preflight runner |
| [emit.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit.js) | Top-level emit coordinator |
| [emit_split.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_split.js) | Split-output emission and runtime logic block assembly |
| [page.js](/home/siah/creative/reactjit/tsz/compiler/smith/page.js) | `<page>` block compiler |
| [mod.js](/home/siah/creative/reactjit/tsz/compiler/smith/mod.js) | `<module>` block compiler |
| [soup_smith.js](/home/siah/creative/reactjit/tsz/compiler/smith/soup_smith.js) | Soup compiler |

## ctx: Important State

[core.js](/home/siah/creative/reactjit/tsz/compiler/smith/core.js) owns `ctx` and `resetCtx()`.

Important fields:

| Field | Meaning |
|---|---|
| `stateSlots` | Scalar state slots: `{ getter, setter, initial, type }` |
| `components` | Collected component bodies and slot metadata |
| `handlers` | Handler metadata for Zig / JS / Lua dispatch |
| `dynTexts` | Runtime text buffers and node targets |
| `dynColors` / `dynStyles` | Runtime-updated colors and styles |
| `objectArrays` | SoA backing for mapped data |
| `maps` | Map templates and rebuild metadata |
| `arrayDecls` / `arrayComments` / `arrayCounter` | Static node-array build state |
| `scriptBlock` / `scriptFuncs` | JS logic payload and callable names |
| `classifiers` | Loaded classifier definitions |
| `renderLocals` | Pre-return locals eligible for JSX substitution |
| `_sourceTier` | Explicit source tier: `soup`, `mixed`, or `chad` |
| `_preflight` | Cached preflight result consumed by emit |
| `_needsRuntimeLog` / `_runtimeLogCounter` | Generated Zig logging support bookkeeping |

## Parse / Preflight / Emit Seams

### Parse

Public parse entrypoints:

- `parseJSXElement(c)` in [parse.js](/home/siah/creative/reactjit/tsz/compiler/smith/parse.js)
- `parseChildren(c)` in [parse.js](/home/siah/creative/reactjit/tsz/compiler/smith/parse.js)
- `tryParseMap(c, oa)` in [parse_map.js](/home/siah/creative/reactjit/tsz/compiler/smith/parse_map.js)

Parse helper groups:

- [parse/utils.js](/home/siah/creative/reactjit/tsz/compiler/smith/parse/utils.js)
- [parse/build_node.js](/home/siah/creative/reactjit/tsz/compiler/smith/parse/build_node.js)
- [parse/template_literal.js](/home/siah/creative/reactjit/tsz/compiler/smith/parse/template_literal.js)
- [parse/brace/](/home/siah/creative/reactjit/tsz/compiler/smith/parse/brace)
- [parse/children/](/home/siah/creative/reactjit/tsz/compiler/smith/parse/children)
- [parse/map/](/home/siah/creative/reactjit/tsz/compiler/smith/parse/map)
- [parse/element/](/home/siah/creative/reactjit/tsz/compiler/smith/parse/element)
- [parse/handlers/](/home/siah/creative/reactjit/tsz/compiler/smith/parse/handlers)

### Preflight

Top-level runner:

- [preflight.js](/home/siah/creative/reactjit/tsz/compiler/smith/preflight.js)

Rule/context ownership:

- [preflight/context.js](/home/siah/creative/reactjit/tsz/compiler/smith/preflight/context.js)
- [preflight/rules/](/home/siah/creative/reactjit/tsz/compiler/smith/preflight/rules)

### Emit

Top-level coordinator:

- [emit.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit.js)

Emit helper ownership:

- [emit/preamble.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit/preamble.js)
- [emit/state_manifest.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit/state_manifest.js)
- [emit/node_tree.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit/node_tree.js)
- [emit/dyn_text.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit/dyn_text.js)
- [emit/handlers.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit/handlers.js)
- [emit/effects.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit/effects.js)
- [emit/object_arrays.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit/object_arrays.js)
- [emit/map_pools.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit/map_pools.js)
- [emit/runtime_updates.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit/runtime_updates.js)
- [emit/entrypoints.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit/entrypoints.js)
- [emit/finalize.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit/finalize.js)

## Frozen Snapshot

[refactor/](/home/siah/creative/reactjit/tsz/compiler/smith/refactor) is now reference-only.

Rules:

- Do not add new active compiler work there.
- Do not point [LOAD_ORDER.txt](/home/siah/creative/reactjit/tsz/compiler/smith/LOAD_ORDER.txt) back into it.
- If `smith-sync` reports manifest entries under `smith/refactor/`, promotion is incomplete.
- If behavior changes, update the promoted paths under `compiler/smith/`.
