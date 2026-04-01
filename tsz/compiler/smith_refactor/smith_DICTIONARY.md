# Smith Compiler Dictionary

Reference for the live Smith compiler after promotion to `tsz/compiler/`.

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

QuickJS does not resolve runtime imports. Forge embeds one generated Smith bundle from [smith_LOAD_ORDER.txt](/home/siah/creative/reactjit/tsz/compiler/smith_LOAD_ORDER.txt).

## Active Layout

Active Smith source now lives directly under [tsz/compiler](/home/siah/creative/reactjit/tsz/compiler):

- [smith_core.js](/home/siah/creative/reactjit/tsz/compiler/smith_core.js)
- [smith_collect/](/home/siah/creative/reactjit/tsz/compiler/smith_collect)
- [smith_lanes/](/home/siah/creative/reactjit/tsz/compiler/smith_lanes)
- [smith_parse/](/home/siah/creative/reactjit/tsz/compiler/smith_parse)
- [smith_preflight/](/home/siah/creative/reactjit/tsz/compiler/smith_preflight)
- [smith_emit/](/home/siah/creative/reactjit/tsz/compiler/smith_emit)
- root coordinators: [smith_index.js](/home/siah/creative/reactjit/tsz/compiler/smith_index.js), [smith_parse.js](/home/siah/creative/reactjit/tsz/compiler/smith_parse.js), [smith_parse_map.js](/home/siah/creative/reactjit/tsz/compiler/smith_parse_map.js), [smith_attrs.js](/home/siah/creative/reactjit/tsz/compiler/smith_attrs.js), [smith_preflight.js](/home/siah/creative/reactjit/tsz/compiler/smith_preflight.js), [smith_emit.js](/home/siah/creative/reactjit/tsz/compiler/smith_emit.js), [smith_page.js](/home/siah/creative/reactjit/tsz/compiler/smith_page.js), [smith_mod.js](/home/siah/creative/reactjit/tsz/compiler/smith_mod.js), [smith_soup.js](/home/siah/creative/reactjit/tsz/compiler/smith_soup.js), [smith_rules.js](/home/siah/creative/reactjit/tsz/compiler/smith_rules.js), [smith_logs.js](/home/siah/creative/reactjit/tsz/compiler/smith_logs.js)

Archived frozen compiler material now lives outside `tsz/`:

- [archive/frozen-compilers/smith-prepromotion/](/home/siah/creative/reactjit/archive/frozen-compilers/smith-prepromotion)
- [archive/frozen-compilers/zig-reference/](/home/siah/creative/reactjit/archive/frozen-compilers/zig-reference)

## Bundle Model

Authoritative manifest:

- [smith_LOAD_ORDER.txt](/home/siah/creative/reactjit/tsz/compiler/smith_LOAD_ORDER.txt)

Bundle builder:

- [smith_bundle.zig](/home/siah/creative/reactjit/tsz/compiler/smith_bundle.zig)

Sync scanner:

- [smith_sync.zig](/home/siah/creative/reactjit/tsz/compiler/smith_sync.zig)

Generated bundle:

- `compiler/dist/smith.bundle.js`

Useful commands:

- `zig build smith-sync`
- `zig build smith-bundle`
- `zig build forge`

`smith-bundle` and `smith-sync` are native Zig host tools. No Node runtime is required for active Smith builds.

`smith-sync` now checks:

- missing manifest sources
- active authored JS missing from the manifest
- manifest entries still pointing at legacy `smith/` paths
- bundle staleness
- dirty active Smith files
- dirty legacy `compiler/smith/` files

## Entry Lanes Vs Surface Tiers

Compiler entry lanes are still:

- `soup`
- `module`
- `page`
- `app`

Surface tiers are the three source shapes the project is aiming at:

- `soup`
- `mixed`
- `chad`

The entry lane decides which compiler path runs. The surface tier describes the source family that preflight and emitted metadata report.

Current ownership:

| Concept | File | Meaning |
|---|---|---|
| Entry dispatch | [smith_lanes/dispatcher.js](/home/siah/creative/reactjit/tsz/compiler/smith_lanes/dispatcher.js) | Routes into `soup`, `module`, `page`, or default `app` |
| Surface-tier scan | [smith_lanes/shared.js](/home/siah/creative/reactjit/tsz/compiler/smith_lanes/shared.js) | Detects and assigns `ctx._sourceTier` as `soup`, `mixed`, or `chad` |
| Cached tier | [smith_core.js](/home/siah/creative/reactjit/tsz/compiler/smith_core.js) | `resetCtx()` initializes `_sourceTier` |
| Preflight lane label | [smith_preflight/context.js](/home/siah/creative/reactjit/tsz/compiler/smith_preflight/context.js) | Uses `ctx._sourceTier` first, then falls back |

Current model:

- `module` is orthogonal to the three surface tiers.
- `soup` entry lane always compiles the `soup` surface tier.
- `page` is an entry lane, not a tier. It usually carries `chad`-style source.
- `app` is the default entry lane for primitive JSX sources and can scan as `mixed` or `chad`.

## Compile Flow

### Entry

[smith_index.js](/home/siah/creative/reactjit/tsz/compiler/smith_index.js) owns:

- `compile()` -> reads Forge globals and calls `compileLane(source, tokens, file)`
- `stampIntegrity(out)` -> prefixes generated output before Forge finalizes the body hash
- `compileMod(...)` / `compileModLua(...)` -> line-based module transpilers

### App lane

[smith_lanes/app.js](/home/siah/creative/reactjit/tsz/compiler/smith_lanes/app.js) is the default JSX pipeline:

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

[smith_lanes/page.js](/home/siah/creative/reactjit/tsz/compiler/smith_lanes/page.js) delegates to [smith_page.js](/home/siah/creative/reactjit/tsz/compiler/smith_page.js).

`smith_page.js` still owns:

- `<var>`
- `<state>`
- `<functions>`
- `<timer>`
- `return (...)` extraction before normal JSX parsing

### Module lane

[smith_lanes/module.js](/home/siah/creative/reactjit/tsz/compiler/smith_lanes/module.js) delegates to:

- line mode in [smith_index.js](/home/siah/creative/reactjit/tsz/compiler/smith_index.js)
- block mode in [smith_mod.js](/home/siah/creative/reactjit/tsz/compiler/smith_mod.js)

### Soup lane

[smith_lanes/soup.js](/home/siah/creative/reactjit/tsz/compiler/smith_lanes/soup.js) delegates to [smith_soup.js](/home/siah/creative/reactjit/tsz/compiler/smith_soup.js).

Soup remains its own compiler path with its own tokenizer, tree builder, and emitter behavior.

### Finish path

[smith_lanes/shared.js](/home/siah/creative/reactjit/tsz/compiler/smith_lanes/shared.js) owns `finishParsedLane()`:

1. `preflight(ctx)`
2. `preflightErrorZig(...)` on failure
3. `emitOutput(nodeExpr, file)` on success
4. `stampIntegrity(...)` unless split output already bypassed wrapping

## Ownership Map

| Path | Role |
|---|---|
| [smith_rules.js](/home/siah/creative/reactjit/tsz/compiler/smith_rules.js) | Token enums, style keys, color tables, soup constants |
| [smith_logs.js](/home/siah/creative/reactjit/tsz/compiler/smith_logs.js) | Logging and debug helpers |
| [smith_core.js](/home/siah/creative/reactjit/tsz/compiler/smith_core.js) | Shared cursor helpers, ctx reset, slot helpers, runtime-log wrappers |
| [smith_collect/](/home/siah/creative/reactjit/tsz/compiler/smith_collect) | Collection pass |
| [smith_lanes/](/home/siah/creative/reactjit/tsz/compiler/smith_lanes) | Entry-lane dispatch plus surface-tier assignment |
| [smith_parse/](/home/siah/creative/reactjit/tsz/compiler/smith_parse) | Refactored JSX/map/element parsing helpers |
| [smith_preflight/](/home/siah/creative/reactjit/tsz/compiler/smith_preflight) | Intent derivation and grouped validation rules |
| [smith_emit/](/home/siah/creative/reactjit/tsz/compiler/smith_emit) | Preamble, node tree, runtime updates, finalization |
| [smith_parse.js](/home/siah/creative/reactjit/tsz/compiler/smith_parse.js) | Public JSX coordinator |
| [smith_parse_map.js](/home/siah/creative/reactjit/tsz/compiler/smith_parse_map.js) | Compatibility shim for map entry |
| [smith_attrs.js](/home/siah/creative/reactjit/tsz/compiler/smith_attrs.js) | Shared style/color/handler/expression parsing still used by JSX parsing |
| [smith_preflight.js](/home/siah/creative/reactjit/tsz/compiler/smith_preflight.js) | Top-level preflight runner |
| [smith_emit.js](/home/siah/creative/reactjit/tsz/compiler/smith_emit.js) | Top-level emit coordinator |
| [smith_emit_split.js](/home/siah/creative/reactjit/tsz/compiler/smith_emit_split.js) | Split-output emission and runtime logic block assembly |
| [smith_page.js](/home/siah/creative/reactjit/tsz/compiler/smith_page.js) | `<page>` block compiler |
| [smith_mod.js](/home/siah/creative/reactjit/tsz/compiler/smith_mod.js) | `<module>` block compiler |
| [smith_soup.js](/home/siah/creative/reactjit/tsz/compiler/smith_soup.js) | Soup compiler |

## ctx: Important State

[smith_core.js](/home/siah/creative/reactjit/tsz/compiler/smith_core.js) owns `ctx` and `resetCtx()`.

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

Public parse entrypoints:

- `parseJSXElement(c)` in [smith_parse.js](/home/siah/creative/reactjit/tsz/compiler/smith_parse.js)
- `parseChildren(c)` in [smith_parse.js](/home/siah/creative/reactjit/tsz/compiler/smith_parse.js)
- `tryParseMap(c, oa)` in [smith_parse_map.js](/home/siah/creative/reactjit/tsz/compiler/smith_parse_map.js)

Top-level preflight runner:

- [smith_preflight.js](/home/siah/creative/reactjit/tsz/compiler/smith_preflight.js)

Top-level emit coordinator:

- [smith_emit.js](/home/siah/creative/reactjit/tsz/compiler/smith_emit.js)

## Archive Boundary

Frozen compiler code is no longer inside `tsz/`.

Archive roots:

- [archive/frozen-compilers/smith-prepromotion/](/home/siah/creative/reactjit/archive/frozen-compilers/smith-prepromotion)
- [archive/frozen-compilers/zig-reference/](/home/siah/creative/reactjit/archive/frozen-compilers/zig-reference)

Rules:

- do not add new active compiler work under `archive/`
- do not reintroduce a live `tsz/compiler/smith/` source tree
- if behavior changes, update the active `smith_*` files under [tsz/compiler](/home/siah/creative/reactjit/tsz/compiler)
