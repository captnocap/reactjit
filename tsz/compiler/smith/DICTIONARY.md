# Smith Compiler Dictionary

Reference for the live Smith compiler after the current refactor. This is the document to read before moving code between legacy coordinator files and `refactor/*`.

## Architecture

```text
.tsz source
  -> Forge (Zig host)
     - resolves imports and merges app/component/script/classifier source
     - lexes merged source into token triplets
     - sets QuickJS globals (__source, __tokens, __file, __scriptContent, __clsContent, flags)
     - calls Smith compile()

  -> Smith (JS compiler bundle running inside QuickJS)
     - lane dispatch: soup / module / page / app
     - collection pass fills ctx
     - parse pass builds node tree + dynamic metadata
     - preflight validates ctx
     - emit builds Zig, or split-output payloads

  -> Forge receives Zig source
     - stamps body hash into integrity header
     - writes generated output file(s)
```

Smith authoring source lives in two places:

- `compiler/smith/*.js` for the still-live coordinator files and standalone lanes
- `compiler/smith/refactor/**/*.js` for extracted ownership seams

QuickJS does not resolve runtime imports. Forge embeds one generated bundle.

## Bundle Model

Authoritative load order:

- `compiler/smith/refactor/LOAD_ORDER.txt`

Generated bundle:

- `compiler/smith/dist/smith.bundle.js`

Bundle builder:

- `compiler/smith/refactor/build_bundle.mjs`

Sync scanner:

- `compiler/smith/refactor/sync_scan.mjs`

Use these commands when checking refactor health:

- `zig build smith-sync` checks manifest coverage, bundle staleness, and dirty active compiler files.
- `zig build smith-bundle` rebuilds the embedded bundle from `LOAD_ORDER.txt`.
- `zig build forge` rebuilds the host binary that embeds the bundle.

`smith-sync` is the fastest answer to "is this slice ready to lift against the current compiler in place?"

## Ownership Map

| Path | Current role |
|------|--------------|
| `rules.js` | Token enum and constant lookup tables: style keys, colors, enums, HTML tag aliases, soup constants |
| `logs.js` | Structured Smith logging and debug bridging through `globalThis.__dbg` |
| `index.js` | Top-level `compile()` entry, integrity stamping, line-based `--mod` transpilers |
| `attrs.js` | Still-heavy style, color, handler, and expression parsing logic shared by JSX parsing |
| `parse.js` | JSX coordinator: tag dispatch, component inlining entry, child dispatch |
| `parse_map.js` | Compatibility shim for map entrypoints; now forwards to refactor map parsing |
| `preflight.js` | Rule runner only |
| `emit.js` | Top-level emit coordinator only |
| `emit_split.js` | Split-output emission, effect transpile, JS/Lua logic block emission |
| `mod.js` | Block-based module compiler for `<module>` sources |
| `page.js` | Block-based page compiler for `<page>` sources |
| `soup_smith.js` | Separate soup/web lane compiler |
| `refactor/core.js` | Shared primitives: cursor, ctx reset, slot helpers, prop access helpers |
| `refactor/collect/*` | Collection pass ownership |
| `refactor/lanes/*` | Lane detection and lane composition |
| `refactor/parse/*` | Refactored JSX/map/brace/element parsing helpers |
| `refactor/preflight/*` | Preflight intent derivation and grouped rules |
| `refactor/emit/*` | Refactored emit helpers |
| `refactor/REFACTOR_CHECKLIST.md` | Migration sequencing and remaining seams |

## Active Compile Flow

### Entry

`index.js` owns:

- `compile()` -> reads Forge globals and calls `compileLane(source, tokens, file)`
- `stampIntegrity(out)` -> prefixes the generated source with the integrity header Forge later finalizes

`refactor/lanes/dispatcher.js` owns lane selection:

1. soup lane if `isSoupLaneSource(source, file)`
2. module lane if `isModuleLaneBuild()`
3. page lane if `isPageLaneSource(source)`
4. app lane otherwise

This dispatcher chooses the compiler entry path. Surface tiering is now a second concept layered on top:

- `soup` for React/HTML/CSS-shaped source
- `mixed` for primitive JSX with inline styles / direct scripting
- `chad` for intent/classifier/resource syntax

### App lane

`refactor/lanes/app.js` is the default pipeline:

1. `mkCursor(tokens, source)`
2. `resetCtx()`
3. `collectCompilerInputs(c)`
4. `findAppStart(c)`
5. `collectRenderLocals(c, appStart)`
6. `moveToAppReturn(c, appStart)`
7. `parseJSXElement(c)`
8. `finishParsedLane(root.nodeExpr, file, opts)`

`finishParsedLane()` in `refactor/lanes/shared.js` runs:

1. `preflight(ctx)`
2. `preflightErrorZig(...)` on failure
3. `emitOutput(nodeExpr, file)` on success
4. `stampIntegrity(...)` unless split output already bypassed wrapping

### Page lane

`refactor/lanes/page.js` detects `<page ...>`. It builds a cursor, resets `ctx`, then delegates to `compilePage(source, c, file)` in `page.js`.

`page.js` owns source-level page blocks:

- `<var>` -> primitive state slots, object-array vars, ambient reads
- `<state>` -> setter name validation
- `<functions>` -> JS logic assembly
- `<timer>` -> interval wiring into JS logic
- `return (...)` -> parsed through the normal JSX machinery

### Module lane

`refactor/lanes/module.js` delegates to `index.js` line mode or `mod.js` block mode.

- `compileMod(source, file)` is the simple line-based `--mod` transpiler
- `compileModBlock(source, file)` handles `<module>` blocks with `<ffi>`, `<types>`, `<state>`, and `<functions>`

### Soup lane

`refactor/lanes/soup.js` delegates to `compileSoup(source, file)` in `soup_smith.js`. This remains a separate compiler with its own tokenizer, tree builder, and emitter.

## ctx: Compiler State

`refactor/core.js` owns `ctx` and `resetCtx()`. Most compiler phases read and write the same shared object.

Important fields:

| Field | Owner | Meaning |
|------|-------|---------|
| `stateSlots` | `collect/state.js`, component inlining | Scalar state slots: `{ getter, setter, initial, type }` |
| `components` | `collect/components.js` | Component bodies and per-component slot metadata |
| `handlers` | `attrs.js`, parse element helpers | Event handlers with Zig body, Lua body, and map ownership |
| `conditionals` | `parse/brace/*` | `{cond && <X>}` and `{cond ? <A> : <B>}` metadata |
| `dynTexts` | `parse/template_literal.js`, child parsing | Dynamic text buffers and target array/index wiring |
| `dynColors` | `attrs.js` | Runtime color updates for text/color fields |
| `dynStyles` | `attrs.js` | Runtime style updates for non-static style expressions |
| `objectArrays` | `collect/state.js`, page vars, map inference | Structure-of-arrays backing for `.map()` data |
| `maps` | `parse/map/*` | Map templates, pool metadata, nested/inline relationships |
| `arrayDecls` / `arrayComments` / `arrayCounter` | `build_node.js`, map parse helpers | Static node-tree arrays and source breadcrumbs |
| `scriptBlock` / `scriptFuncs` | `collect/script.js`, `page.js` | JS logic source and discovered callable names |
| `classifiers` | `collect/classifiers.js` | `.cls.tsz` classifier definitions |
| `variantNames` / `variantBindings` | classifier collect + element postprocess | Theme variant names and element bindings |
| `_sourceTier` | lane shared helpers | Explicit source-tier label: `soup`, `mixed`, or `chad` |
| `renderLocals` | `collect/render_locals.js` | Values declared before `return` that can be folded into JSX |
| `propStack` / `slotRemap` / `componentChildren` | component inline helpers | Per-inline-call prop and slot substitution state |
| `_preflight` | `finishParsedLane()` | Cached preflight result used by emit |
| `_debugLines` and `_...` diagnostics arrays | multiple phases | Deferred diagnostics that preflight or emit consume |

Fields added lazily during parse/emission and not initialized directly in `resetCtx()` include:

- `currentMap`
- `nameRemap`
- `mapDynCount`
- `terminalCount`
- `inputCount`
- `_orphanColors`

## Refactor File Dictionary

### `refactor/core.js`

Shared primitives used everywhere:

- `zigEscape(name)`
- `leftFoldExpr(expr)`
- `utf8ByteLen(str)`
- `mkCursor(raw, source)`
- `resetCtx()`
- `findSlot(name)`, `isGetter(name)`, `isSetter(name)`, `slotGet(name)`
- `peekPropsAccess(c)`, `skipPropsAccess(c)`

### `refactor/collect/*`

Collection pass ownership:

| File | Key functions | Purpose |
|------|---------------|---------|
| `collect/pipeline.js` | `collectCompilerInputs`, `collectVariantNames` | One-call collection pipeline used by app lane |
| `collect/script.js` | `collectScript`, `scanScriptFunctionNames`, `isScriptFunc` | Extract `<script>` blocks and imported script names |
| `collect/components.js` | `collectComponents`, `findComponent` | Record component boundaries, props, and local state |
| `collect/state.js` | `collectState`, `collectObjectArrayState`, `collectConstArrays`, nested helpers | Discover scalar state, SoA object arrays, const arrays |
| `collect/classifiers.js` | `collectClassifiers`, `resolveThemeToken`, `clsStyleFields`, `clsNodeFields`, `mergeFields` | Load classifier definitions and translate them into field lists |
| `collect/render_locals.js` | `collectRenderLocals` and helpers | Resolve locals declared before `return` for JSX substitution |

### `refactor/lanes/*`

Lane ownership:

| File | Key functions | Purpose |
|------|---------------|---------|
| `lanes/dispatcher.js` | `compileLane` | Route into soup/module/page/app |
| `lanes/shared.js` | `detectSurfaceTier`, `assignSurfaceTier`, `finishParsedLane` | Surface-tier scan plus preflight/emit/integrity wrapping |
| `lanes/app.js` | `findAppStart`, `moveToAppReturn`, `compileAppLane` | Main app compile path |
| `lanes/page.js` | `isPageLaneSource`, `compilePageLane` | Page mode entry |
| `lanes/module.js` | `isModuleLaneBuild`, `compileModuleLane` | Module mode entry |
| `lanes/soup.js` | `isSoupLaneSource`, `compileSoupLane` | Soup mode entry |

### `refactor/parse/*`

Parsing is split by responsibility, but `parse.js` is still the public coordinator.

| Area | Files | Role |
|------|-------|------|
| Utilities | `parse/utils.js` | Tag reading, closing-tag reads, brace skipping, source offsets |
| Node assembly | `parse/build_node.js` | Build final `Node` struct literals and child arrays |
| Template literals | `parse/template_literal.js` | Convert JS template strings into Zig format strings and args |
| Brace children | `parse/brace/conditional.js`, `parse/brace/ternary.js` | Conditional JSX/text lowering |
| Child dispatch | `parse/children/elements.js`, `brace.js`, `text.js`, `inline_glyph.js` | `parseChildren()` resolution order |
| Map lowering | `parse/map/header.js`, `info.js`, `context.js`, `plain.js`, `nested.js`, `for_loop.js`, `infer_oa.js` | `.map(...)`, nested maps, `<For>`, OA inference, context swap/restore |
| Element flow | `parse/element/flow.js`, `tags.js`, `defaults.js`, `postprocess.js` | Fragment/script handling, tag normalization, element lifecycle |
| Element attrs | `parse/element/attrs_dispatch.js`, `attrs_basic.js`, `attrs_text_color.js`, `attrs_handlers.js`, `attrs_spatial.js`, `attrs_canvas.js`, `value_readers.js` | Ordered attribute parsing and specialized attr handlers |
| Component props | `parse/element/component_props.js`, `component_spread.js`, `component_brace_values.js`, `component_handlers.js`, `component_inline.js` | Prop collection, spreads, brace values, handler props, inline component expansion |
| Press handlers | `parse/handlers/press.js` | Forwarded and inline press handler capture helpers |

Current public parse entrypoints:

- `parseJSXElement(c)` in `parse.js`
- `parseChildren(c)` in `parse.js`
- `tryParseMap(c, oa)` in `parse_map.js`, which now forwards to `tryParsePlainMap(c, oa)`

### `attrs.js`

`attrs.js` is still a real logic owner, not a shell. It contains:

- style parsing: `parseColor`, `parseStyleValue`, `parseTernaryBranch`, `parseStyleBlock`
- handler parsing: `parseHandler`, `parseValueExpr`, `luaParseHandler`, `luaParseValueExpr`
- runtime setter helper: `slotSet`

If a refactor slice touches style expressions or handler-body syntax, this file is still part of the critical path.

### `refactor/preflight/*` and `preflight.js`

Preflight ownership is split cleanly:

| File | Key functions | Purpose |
|------|---------------|---------|
| `preflight/context.js` | `derivePreflightIntents`, `detectPreflightLane`, `buildPreflightScanState` | Shared scan state and lane classification |
| `preflight/rules/handlers.js` | handler checks and warnings | Empty handlers, dispatch, duplicate names, Lua leaks, handler refs |
| `preflight/rules/dyn.js` | dynamic value checks | color placeholders, OA field refs, unresolved dynTexts, item leaks |
| `preflight/rules/maps.js` | `checkMapObjectArrays` | Map-to-OA validation |
| `preflight/rules/state.js` | `warnOnUnreadStateSlots` | State-read coverage |
| `preflight/rules/classifiers.js` | tag leaks, JS leaks, unresolved classifiers, dropped expressions, unknown subsystem tags | Classifier/text and leakage checks |
| `preflight/rules/js_logic.js` | ignored module blocks, undefined JS calls, duplicate JS vars | JS-logic-specific validation |
| `preflight.js` | `preflight`, `preflightErrorZig` | Rule runner and failure payload |

### `refactor/emit/*` and emit coordinators

Emission ownership:

| File | Key functions | Purpose |
|------|---------------|---------|
| `emit/preamble.js` | `emitPreamble` | imports and lane header |
| `emit/state_manifest.js` | `emitStateManifest`, `emitInitState` | slot manifest and state init |
| `emit/node_tree.js` | `emitNodeTree` | static arrays and root node |
| `emit/dyn_text.js` | `emitDynamicTextBuffers` | dynText backing buffers |
| `emit/handlers.js` | `emitNonMapHandlers` | non-map Zig handler fns |
| `emit/effects.js` | `emitEffectRenders` | effect render transpilation entry |
| `emit/object_arrays.js` | `emitObjectArrayInfrastructure` | SoA storage and QJS unpack bridge |
| `emit/map_pools.js` | `computePromotedMapArrays`, `emitMapPoolDeclarations`, `emitMapPoolRebuilds`, `appendOrphanedMapArrays` | map pool ownership |
| `emit/runtime_updates.js` | `emitRuntimeSupportSections` | `_updateDynamicTexts`, `_updateConditionals`, variant updates, runtime support |
| `emit/entrypoints.js` | `emitRuntimeEntrypoints` | `_appInit`, `_appTick`, exports, `main` wiring |
| `emit/finalize.js` | `appendEmitDebugSections`, `finalizeEmitOutput` | final cleanup and split-output handoff |
| `emit.js` | `emitOutput` | top-level composition only |

`emit_split.js` still owns:

- `transpileEffectBody`
- `transpileExpr`
- `splitArgs`
- `splitOutput`
- `emitLogicBlocks`
- `luaTransform`
- `jsTransform`

That file is still important for split-output mode and JS/Lua logic string emission.

## Standalone Lane Files

### `page.js`

Important functions:

- `extractPageBlock`, `extractPageBlocks`
- `parsePageVarBlock`
- `parsePageStateBlock`
- `parsePageFunctionsBlock`
- `transpilePageExpr`
- `transpilePageLine`
- `buildPageJSLogic`
- `compilePage`

### `mod.js`

Important functions:

- `compileModBlock`
- `emitFfiBlock`
- `emitTypesBlock`, `emitEnumDecl`, `emitStructDecl`, `emitUnionDecl`
- `emitStateBlock`
- `emitFunctionsBlock`, `emitOneFunction`
- `emitModBody`, `emitArmBodyV2`, `emitForLoopV2`
- `modTranspileType`, `modTranspileExpr`, `modTranspileForExprV2`
- `transpileStringConcat`
- `emitMapFunction`

### `soup_smith.js`

Important functions:

- `isSoupSource`
- `soupParseState`
- `soupCollectHandlers`
- `soupExtractReturn`
- `soupTokenize`
- `soupParseTag`
- `soupBuildTree`
- `soupExprToZig`
- `soupParseStyle`
- `compileSoup`

Soup sources still use their own compiler, but the emitted lane label now comes from the shared surface-tier detection so the generated artifacts line up with the README tiers.

## Key Runtime Patterns

### Component inlining

Components are not emitted as separate runtime units. The parser:

1. records component body positions during collection
2. captures call-site props and children
3. allocates fresh slot remaps for per-instance state
4. jumps into the component body and parses it inline
5. restores the outer cursor afterward

### Structure-of-arrays object arrays

`useState([{...}])` and page object-array vars compile into SoA storage:

- one array per field
- nested arrays become linked child OA entries
- QJS bridge code unpacks field-by-field into the flat buffers

### Map pools

Maps compile into preallocated node pools plus rebuild functions:

- flat pools for top-level `.map()`
- nested pools for `item.children.map(...)`
- inline pools for map-driven subtrees owned by another map

`emit/map_pools.js` is the source of truth for declaration order, promoted per-item arrays, handler field refs, and orphan-array recovery.

### Split output

Smith can return one monolith or a split payload. Split mode is driven by `emit_split.js` and currently partitions output into:

- `nodes.zig`
- `handlers.zig`
- `state.zig`
- `maps.zig`
- `logic.zig`
- `app.zig`

### JS and Lua logic coexist

Handlers and script logic may exist in both forms:

- Zig handlers for direct runtime calls
- Lua logic strings for legacy dispatch paths
- JS logic strings for QuickJS-backed carts and page mode

That is why handler parsing and logic emission still span `attrs.js`, `emit_split.js`, and map-pool emission.

## Lift Readiness Checklist

A refactor seam is ready to lift only when all of these are true:

1. The source of truth is under `refactor/*`, not duplicated in a legacy master file.
2. `LOAD_ORDER.txt` contains every authored file needed for that seam.
3. `zig build smith-sync` reports:
   - no missing manifest sources
   - no authored JS missing from the manifest
   - no unexpected drift in active legacy files for the seam you are lifting
4. `zig build smith-bundle` succeeds, so the authored sources concatenate cleanly.
5. `zig build forge` succeeds, so the embedded compiler matches the authored bundle.
6. The legacy public entry file is composition-only or a documented compatibility shim.

Current examples:

- `parse_map.js` is effectively lifted; it is now just a compatibility forwarder.
- `preflight.js` is effectively lifted; it is now a rule runner over `refactor/preflight/*`.
- `emit.js` is effectively lifted at the top level; real ownership is in `refactor/emit/*`.
- `attrs.js`, `page.js`, `mod.js`, `emit_split.js`, and `soup_smith.js` are not fully lifted; they still contain primary logic.

Current lane model:

- `module` remains a separate compiler family and is not part of the three surface tiers.
- `app`, `page`, and `soup` are entry paths.
- `soup`, `mixed`, and `chad` are explicit surface tiers carried in `ctx._sourceTier` and surfaced through preflight/emit.

## Forge Globals and Flags

Forge-provided globals:

| Global | Meaning |
|--------|---------|
| `__source` | merged `.tsz` source text |
| `__tokens` | flat `"kind start end\n..."` token payload |
| `__file` | current input path |
| `__scriptContent` | merged imported `.script.tsz` source |
| `__clsContent` | merged imported `.cls.tsz` source |

Important build flags surfaced as globals:

| CLI flag | Global | Meaning |
|----------|--------|---------|
| `--fast` | `__fastBuild=1` | fast build import path |
| `--mod` | `__modBuild=1` | module mode |
| `--target=X` | `__modTarget="X"` | module target selection |
| `--split` | `__splitOutput=1` | force split output |
| `--single` | unset `__splitOutput` | force monolith |
| `--strict` | `__strict=1` | warnings become errors |
| `--logs` | `__SMITH_LOGS=1` | enable structured logs |
| `--logs=find:X` | `__SMITH_LOGS_FIND="X"` | filter structured logs |

## Practical Rule

When you are unsure where behavior lives now, trust the refactor seams first, then confirm whether the legacy file is still only a coordinator or still owns real logic. Use `rg '^function '` across `compiler/smith` before moving code.
