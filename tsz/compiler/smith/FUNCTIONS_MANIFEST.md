# Smith Functions Manifest

Every function still living in a monolith file is cataloged here. When decomposition happens, each function moves to its target and this manifest tracks the migration. If a function isn't here, it's either already in an atom or it doesn't exist.

The emit_atoms MANIFEST tracks output atoms. The patterns MANIFEST tracks intake patterns. This manifest tracks the **pipeline functions** that connect them — the ones currently stuffed into oversized root files.

## Status Key

- `monolith` — still in original file, not yet extracted
- `atomized` — an emit_atom exists that replaces this function's output
- `migrated` — moved to target file
- `dead` — superseded by atom, safe to delete after verification

---

## ~~soup.js~~ DELETED — migrated to `lanes/soup/` (27 functions)

Target: `lanes/soup/` directory. Each group becomes one file.

### Detection

| Function | Line | Target | Status | Notes |
|----------|------|--------|--------|-------|
| `isSoupSource` | 10 | `lanes/soup/detect.js` | migrated | Detection gate — checks for React/HTML soup markers |
| `compileSoup` | 1257 | `lanes/soup/index.js` | migrated | Top-level orchestrator — calls all other soup functions in sequence |

### Parsing

| Function | Line | Target | Status | Notes |
|----------|------|--------|--------|-------|
| `soupTokenize` | 328 | `lanes/soup/parse.js` | migrated | JSX tokenizer for soup HTML |
| `soupBalanced` | 365 | `lanes/soup/parse.js` | migrated | Balanced brace/paren checker |
| `soupParseTag` | 379 | `lanes/soup/parse.js` | migrated | Single tag parser (open/close/self-close) |
| `soupBuildTree` | 411 | `lanes/soup/parse.js` | migrated | Token stream → tree structure |
| `soupBlock` | 117 | `lanes/soup/parse.js` | migrated | Extract balanced block from source |
| `_soupFindMatchingClose` | 306 | `lanes/soup/parse.js` | migrated | Find matching close tag for component expansion |

### State Extraction

| Function | Line | Target | Status | Notes |
|----------|------|--------|--------|-------|
| `soupParseState` | 32 | `lanes/soup/state.js` | migrated | Extract useState/state declarations |
| `_soupParseObjectFields` | 85 | `lanes/soup/state.js` | migrated | Parse object literal fields in state init |
| `soupCollectHandlers` | 103 | `lanes/soup/state.js` | migrated | Collect event handler functions |
| `soupExtractReturn` | 133 | `lanes/soup/state.js` | migrated | Find return statement JSX |

### Component Expansion

| Function | Line | Target | Status | Notes |
|----------|------|--------|--------|-------|
| `soupExpandComponents` | 151 | `lanes/soup/components.js` | migrated | Inline component definitions into call sites |
| `_soupSubstituteProps` | 224 | `lanes/soup/components.js` | migrated | Replace prop references in inlined component |
| `_soupExtractComponentReturns` | 240 | `lanes/soup/components.js` | migrated | Extract return JSX from component body |

### Handlers

| Function | Line | Target | Status | Notes |
|----------|------|--------|--------|-------|
| `soupExtractInlineHandlers` | 433 | `lanes/soup/handlers.js` | migrated | Extract onClick/onChange → handler functions |

### Zig Codegen

| Function | Line | Target | Status | Notes |
|----------|------|--------|--------|-------|
| `soupToZig` | 469 | `lanes/soup/codegen.js` | migrated | Node tree → Zig struct emission (308 lines!) |
| `soupExprToZig` | 974 | `lanes/soup/codegen.js` | migrated | JS expression → Zig expression. **SHARED CANDIDATE** → `resolve/expr_to_zig.js` (overlaps `modTranspileExpr`, `transpileExpr`) |
| `soupPushJsDynText` | 953 | `lanes/soup/codegen.js` | migrated | Dynamic text → QJS eval bridge |
| `soupFindTopLevelAnd` | 923 | `lanes/soup/codegen.js` | migrated | Find top-level && for conditional splitting. **SHARED CANDIDATE** → `resolve/top_level_scan.js` |
| `soupFindTopLevelChar` | 938 | `lanes/soup/codegen.js` | migrated | Find unbracketed char at top level. **SHARED CANDIDATE** → `resolve/top_level_scan.js` |
| `soupWireDynTextsInArray` | 777 | `lanes/soup/codegen.js` | migrated | Wire dynamic text entries in array context |

### Map Handling

| Function | Line | Target | Status | Notes |
|----------|------|--------|--------|-------|
| `soupHandleMap` | 799 | `lanes/soup/maps.js` | migrated | .map() → Zig for loop (124 lines) |

### Style

| Function | Line | Target | Status | Notes |
|----------|------|--------|--------|-------|
| `soupParseStyle` | 1122 | `lanes/soup/style.js` | migrated | Inline style object → Zig style fields. **OVERLAPS** with `parseStyleValue` in attrs.js |
| `soupStyleColorToRgb` | 1211 | `lanes/soup/style.js` | migrated | Named color → RGB. **SHARED CANDIDATE** → `resolve/color.js` |
| `soupParseTextStyle` | 1226 | `lanes/soup/style.js` | migrated | Text-specific style extraction |
| `soupHexRgb` | 1248 | `lanes/soup/style.js` | migrated | #hex → {r,g,b}. **SHARED CANDIDATE** → `resolve/color.js` |

---

## ~~mod.js~~ DELETED — migrated to `mod/` (50 functions)

Target: `mod/` directory. Split by block type.

### Orchestrator

| Function | Line | Target | Status | Notes |
|----------|------|--------|--------|-------|
| `compileModBlock` | 51 | `mod/index.js` | migrated | Top-level orchestrator — detects blocks, dispatches |
| `extractModBlock` | 116 | `mod/index.js` | migrated | Extract `<tag>...</tag>` block content |

### Imports

| Function | Line | Target | Status | Notes |
|----------|------|--------|--------|-------|
| `emitImportsBlock` | 122 | `mod/imports.js` | migrated | `<imports>` block → Zig @import statements |

### FFI

| Function | Line | Target | Status | Notes |
|----------|------|--------|--------|-------|
| `emitFfiBlock` | 139 | `mod/ffi.js` | migrated | `<ffi>` block → Zig extern declarations |

### Types

| Function | Line | Target | Status | Notes |
|----------|------|--------|--------|-------|
| `emitTypesBlock` | 175 | `mod/types.js` | migrated | `<types>` block → Zig type declarations |
| `emitTypeAliasDecl` | 250 | `mod/types.js` | migrated | Single type alias |
| `emitEnumDecl` | 254 | `mod/types.js` | migrated | Enum declaration |
| `emitStructDecl` | 265 | `mod/types.js` | migrated | Struct declaration |
| `emitUnionDecl` | 315 | `mod/types.js` | migrated | Tagged union declaration |
| `inferDefault` | 291 | `mod/types.js` | migrated | Infer zero-value for type |

### State

| Function | Line | Target | Status | Notes |
|----------|------|--------|--------|-------|
| `emitStateBlock` | 345 | `mod/state.js` | migrated | `<state>` block → Zig module-level vars |
| `emitConstBlock` | 385 | `mod/state.js` | migrated | `<const>` block → Zig const declarations |

### Functions

| Function | Line | Target | Status | Notes |
|----------|------|--------|--------|-------|
| `emitFunctionsBlock` | 398 | `mod/functions.js` | migrated | `<functions>` block → Zig fn declarations |
| `emitOneFunction` | 420 | `mod/functions.js` | migrated | Single function signature + body |
| `prescanModFunctionSigs` | 487 | `mod/functions.js` | migrated | Pre-scan to collect function signatures for forward refs |
| `emitFunctionBody` | 504 | `mod/functions.js` | migrated | Function body emission (112 lines) |
| `emitArmBody` | 616 | `mod/functions.js` | migrated | Switch arm body |
| `emitForBody` | 653 | `mod/functions.js` | migrated | For loop body |
| `emitModBody` | 824 | `mod/functions.js` | migrated | General body emission — if/else/for/switch/return (103 lines) |
| `emitArmBodyV2` | 1065 | `mod/functions.js` | migrated | V2 arm body with improved ctx |
| `emitForLoopV2` | 1087 | `mod/functions.js` | migrated | V2 for loop with spec parsing |
| `emitMapFunction` | 1117 | `mod/functions.js` | migrated | .map() inside module functions |

### Params

| Function | Line | Target | Status | Notes |
|----------|------|--------|--------|-------|
| `modTranspileParams` | 449 | `mod/params.js` | migrated | Parameter list transpilation |
| `parseModParams` | 453 | `mod/params.js` | migrated | Parse TS-style param declarations |
| `emitModParams` | 467 | `mod/params.js` | migrated | Emit Zig param list |
| `isModPointerParamType` | 478 | `mod/params.js` | migrated | Detect pointer param types |
| `registerModPtrParam` | 482 | `mod/params.js` | migrated | Register param needing pointer pass |

### Expression Transpiler

| Function | Line | Target | Status | Notes |
|----------|------|--------|--------|-------|
| `modTranspileExpr` | 701 | `mod/expr.js` | migrated | JS expr → Zig expr (81 lines). **SHARED CANDIDATE** → `resolve/expr_to_zig.js` (overlaps `soupExprToZig`, `transpileExpr`) |
| `modTranspileType` | 12 | `mod/expr.js` | migrated | TS type annotation → Zig type |
| `modTranspileFnType` | 45 | `mod/expr.js` | migrated | Function type transpilation |
| `modTranspileDefault` | 327 | `mod/expr.js` | migrated | Default value transpilation |
| `modTranspileForExpr` | 693 | `mod/expr.js` | migrated | For-loop expression transpilation |
| `modTranspileForExprV2` | 1132 | `mod/expr.js` | migrated | V2 for-loop expr with spec |
| `modTranspileValue` | 1058 | `mod/expr.js` | migrated | General value transpilation |
| `transpileStringConcat` | 782 | `mod/expr.js` | migrated | `a + b` → Zig string concat. **SHARED CANDIDATE** → `resolve/string_concat.js` |
| `transpileStructLiteral` | 940 | `mod/expr.js` | migrated | `{k: v}` → `.{.k = v}`. **SHARED CANDIDATE** → `resolve/struct_literal.js` |
| `isComparison` | 927 | `mod/expr.js` | migrated | Detect comparison expression |
| `inferTypeFromValue` | 931 | `mod/expr.js` | migrated | Infer Zig type from JS value |

### Statements

| Function | Line | Target | Status | Notes |
|----------|------|--------|--------|-------|
| `emitStatementList` | 964 | `mod/statements.js` | migrated | Semicolon-separated statement list |
| `emitInlineStatements` | 986 | `mod/statements.js` | migrated | Inline statement expansion |
| `emitSingleStatement` | 995 | `mod/statements.js` | migrated | Single statement emission |

### Helpers

| Function | Line | Target | Status | Notes |
|----------|------|--------|--------|-------|
| `localIsReassigned` | 1040 | `mod/helpers.js` | migrated | Check if local var is mutated |
| `extractNullGuardedVars` | 1195 | `mod/helpers.js` | migrated | Find vars in null-guard patterns |
| `extractNonNullVars` | 1199 | `mod/helpers.js` | migrated | Find vars compared to non-null |
| `extractNullComparedVars` | 1204 | `mod/helpers.js` | migrated | Find vars in null comparisons |
| `addUniqueVars` | 1214 | `mod/helpers.js` | migrated | Deduplicate var list |
| `isEarlyExitBranch` | 1222 | `mod/helpers.js` | migrated | Detect early-return branch |
| `applyOptionalUnwraps` | 1231 | `mod/helpers.js` | migrated | Rewrite optional access to `.?` |
| `replaceVarDotAccessWithUnwrap` | 1243 | `mod/helpers.js` | migrated | `x.field` → `x.?.field` for optionals |
| `replaceExactVarWithUnwrap` | 1268 | `mod/helpers.js` | migrated | Exact var name → unwrapped |
| `replaceNeedleWithBoundary` | 1272 | `mod/helpers.js` | migrated | Word-boundary-safe replacement |
| `isModIdentChar` | 1292 | `mod/helpers.js` | migrated | Identifier character check |
| `rewriteKnownFunctionCalls` | 1296 | `mod/helpers.js` | migrated | JS stdlib → Zig stdlib mapping (indexOf→indexOf, etc) |
| `findMatchingParen` | 1324 | `mod/helpers.js` | migrated | Balanced paren finder |
| `splitCallArgs` | 1346 | `mod/helpers.js` | migrated | Split function call arguments |
| `argIsPointerLike` | 1382 | `mod/helpers.js` | migrated | Detect pointer-like argument |
| `escapeRegExp` | 1390 | `mod/helpers.js` | migrated | Regex special char escape |
| `rewriteExpressionTernary` | 1394 | `mod/helpers.js` | migrated | `a ? b : c` → Zig if/else |
| `splitTopLevelTernary` | 1400 | `mod/helpers.js` | migrated | Split ternary at top level |
| `parseForExprSpec` | 1139 | `mod/helpers.js` | migrated | Parse for-loop expression spec |
| `buildReverseIndexExpr` | 1163 | `mod/helpers.js` | migrated | Build reverse index expression |
| `substituteForLoopVars` | 1168 | `mod/helpers.js` | migrated | Replace loop vars in body |
| `extendModCtx` | 1178 | `mod/helpers.js` | migrated | Extend compilation context |

---

## ~~emit_split.js~~ DELETED — migrated to `emit/` (10 functions)

Partially atomized. 8 atoms claim code from this file. Remaining functions need extraction or pruning.

### Effect Transpilers

| Function | Line | Target | Status | Notes |
|----------|------|--------|--------|-------|
| `transpileEffectBody` | 9 | `emit/effect_transpile.js` | migrated | JS effect body → Zig code (96 lines) |
| `transpileExpr` | 105 | `emit/effect_transpile.js` | migrated | JS expr → Zig for effects. **SHARED CANDIDATE** → `resolve/expr_to_zig.js` (overlaps `soupExprToZig`, `modTranspileExpr`) |
| `_effectMathWGSL` | 165 | `emit/effect_wgsl.js` | migrated | Shared WGSL math function library |
| `transpileEffectToWGSL` | 232 | `emit/effect_wgsl.js` | migrated | JS effect → WGSL compute shader (112 lines) |
| `transpileExprWGSL` | 344 | `emit/effect_wgsl.js` | migrated | JS expr → WGSL expression |
| `splitArgs` | 393 | `emit/effect_transpile.js` | migrated | Utility: split function args respecting nesting |

### Output Splitting

| Function | Line | Target | Status | Notes |
|----------|------|--------|--------|-------|
| `splitOutput` | 410 | atomized (a043–a045) | atomized | Monolith → multi-file split. **Atoms a043, a044, a045 claim this** |
| `emitLogicBlocks` | 711 | atomized (a033, a034) | atomized | JS/Lua logic block emission. **Atoms a033, a034 claim this** |

### Transforms

| Function | Line | Target | Status | Notes |
|----------|------|--------|--------|-------|
| `luaTransform` | 1229 | `emit/transforms.js` | migrated | JS handler code → Lua syntax (96 lines) |
| `jsTransform` | 1325 | `emit/transforms.js` | migrated | JS handler code → QJS-safe syntax |

---

## emit/map_pools.js (1224 lines, 8 functions)

Authoritative map emit. Atoms a019–a028 stubbed (emit bodies removed, metadata retained). `runEmitAtoms` confirmed dead code.

| Function | Line | Target | Status | Notes |
|----------|------|--------|--------|-------|
| `_wrapMapCondition` | 4 | shared helper | migrated | Wrap conditional expression for map guards |
| `buildMapEmitOrder` | 22 | a019 (map_metadata) | atomized | Compute map emit ordering |
| `ensureMapHandlerFieldRefs` | 36 | a019 (map_metadata) | atomized | Ensure handler fields ref OA storage |
| `countTopLevelNodeDeclEntries` | 62 | a019 (map_metadata) | atomized | Count top-level node declarations |
| `computePromotedMapArrays` | 75 | a019 (map_metadata) | atomized | Compute promoted map array storage |
| `emitMapPoolDeclarations` | 140 | a020–a025 | atomized | Pool declarations (221 lines). **Atoms a020–a025 replace this** |
| `emitMapPoolRebuilds` | 361 | a026–a028 | atomized | Pool rebuilds (813 lines!). **Atoms a026–a028 replace this** |
| `appendOrphanedMapArrays` | 1174 | needs atom | migrated | Append orphaned arrays not in any pool |

---

## parse/children/brace.js (755 lines, 1 public entry — 20 helpers migrated to brace_*.js)

Brace expression parser — handles `{expr}` in JSX children. Heavy on computed field chains.

### Public Entry

| Function | Line | Target | Status | Notes |
|----------|------|--------|--------|-------|
| `tryParseBraceChild` | 488 | stays | migrated | Main entry — dispatches to specific brace handlers |

### Computed Field Chains

| Function | Line | Target | Status | Notes |
|----------|------|--------|--------|-------|
| `_syntheticFieldType` | 3 | `parse/children/brace_computed.js` | migrated | Infer field type for synthetic computed OA |
| `_sanitizeComputedGetter` | 11 | `parse/children/brace_computed.js` | migrated | Clean computed getter expression |
| `_findAliasPropertyPaths` | 17 | `parse/children/brace_computed.js` | migrated | Find alias paths in destructured patterns |
| `_aliasUsedBare` | 31 | `parse/children/brace_computed.js` | migrated | Check if alias used without property access |
| `_buildDestructuredComputedPlan` | 42 | `parse/children/brace_computed.js` | migrated | Build plan for destructured computed fields (53 lines) |
| `_ensureSyntheticComputedOa` | 95 | `parse/children/brace_computed.js` | migrated | Ensure synthetic OA exists for computed chain (93 lines) |

### Map Expression Parsing

| Function | Line | Target | Status | Notes |
|----------|------|--------|--------|-------|
| `_tryParseComputedChainMap` | 188 | `parse/children/brace_maps.js` | migrated | Computed chain ending in .map() (67 lines) |
| `_identifierStartsMapCall` | 255 | `parse/children/brace_maps.js` | migrated | Check if identifier leads to .map() |
| `_identifierMapHasBlockBody` | 282 | `parse/children/brace_maps.js` | migrated | Detect block-body map callback |
| `_tryParseIdentifierMapExpression` | 328 | `parse/children/brace_maps.js` | migrated | Parse identifier-based .map() |

### Expression Utilities

| Function | Line | Target | Status | Notes |
|----------|------|--------|--------|-------|
| `_joinTokenText` | 367 | `parse/children/brace_util.js` | migrated | Join token range into text |
| `_expandRenderLocalJs` | 373 | `parse/children/brace_util.js` | migrated | Expand render-local in JS expression |
| `_expandRenderLocalJsFully` | 390 | `parse/children/brace_util.js` | migrated | Full render-local expansion |
| `_makeEvalTruthyExpr` | 400 | `parse/children/brace_util.js` | migrated | Build truthy eval expression |
| `_normalizeJoinedJsExpr` | 404 | `parse/children/brace_util.js` | migrated | Normalize joined JS expression |
| `_findLastTopLevelAmpAmp` | 417 | `parse/children/brace_util.js` | migrated | Find last top-level && for conditional split |

### Stored Render Locals

| Function | Line | Target | Status | Notes |
|----------|------|--------|--------|-------|
| `_tryParseStoredRenderLocal` | 435 | `parse/children/brace_render_local.js` | migrated | Parse stored render-local expression (53 lines) |

---

## Cross-File Duplicates (Shared Candidates)

These functions appear in multiple monoliths doing the same thing. Extract once to `resolve/`.

| # | Pattern | Functions | Target |
|---|---------|-----------|--------|
| 1 | JS expr → Zig expr | `soupExprToZig` (soup:974), `modTranspileExpr` (mod:701), `transpileExpr` (emit_split:105) | `resolve/expr_to_zig.js` |
| 2 | Hex/color parsing | `soupHexRgb` (soup:1248), `soupStyleColorToRgb` (soup:1211) | `resolve/color.js` |
| 3 | String concat | `transpileStringConcat` (mod:782) | `resolve/string_concat.js` |
| 4 | Struct literal | `transpileStructLiteral` (mod:940) | `resolve/struct_literal.js` |
| 5 | Top-level char find | `soupFindTopLevelAnd` (soup:923), `soupFindTopLevelChar` (soup:938) | `resolve/top_level_scan.js` |

---

## Rules

1. Every function in a monolith must appear in this manifest before migration begins.
2. Functions marked `atomized` must be verified dead before deletion — grep for callers.
3. `SHARED CANDIDATE` functions get extracted to `resolve/` FIRST, then both lanes import them.
4. Migration order: shared candidates → atomized pruning → lane decomposition.
5. Update this manifest as functions move. A function with no `monolith` status remaining means the source file can be deleted.
