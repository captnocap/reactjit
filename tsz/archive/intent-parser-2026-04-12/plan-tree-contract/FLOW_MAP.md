# Phase 3: Flow Map — Source Contract Data Flow

## The Two Emission Paths

Smith has TWO live emission paths. Both consume the same flat-array contract. Both must migrate to the tree.

### Path A: Lua-Tree (modern — most carts)

```
source.fart
  → lexer (Zig) → tokens
  → index.compile()
    → detectFileKind(file) → app/widget/page/component
    → chad.compileChadLane(source, tokens, file)
      → parse phase:
        → collect_state → ctx.stateSlots, ctx.objectArrays
        → collect_components → ctx.components
        → parseChildren (recursive) → ctx.handlers, ctx.conditionals, ctx.dynTexts,
                                       ctx.maps, ctx.dynColors, ctx.dynStyles,
                                       ctx.variantBindings, ctx.arrayDecls
        → builds ctx._luaRootNode (tree!) during parse
      → preflight phase:
        → context.derivePreflightIntents(ctx) → intent bitmap
        → context.buildPreflightScanState(ctx, intents) → scan state
        → preflight_rules.runAllPreflight(ctx, scan) → errors/warnings
      → contract phase:
        → contract_build.buildSourceContract(ctx, file) → flat contract
        → contract_schema.validateContractSchema(contract) → ok/errors
      → emit phase:
        → emit.emitOutput(rootExpr, file)
          → DETECTS ctx._luaRootNode exists
          → sanitizeLuaNodeTree(luaRootNode)
          → validateContract(luaRootNode) → coherence checks
          → emitLuaTreeApp(luaRootNode, rootExpr, file) → Zig output
          → finalizeEmitOutput(out, file) → final Zig string
```

**Key observation:** Path A builds `ctx._luaRootNode` during parse — **this IS a tree**. The tree already exists. But then `buildSourceContract` ALSO flattens ctx into arrays, and the contract schema validates the FLAT arrays. The Lua-tree emitter reads from `_luaRootNode` (the tree) but ALSO reads `ctx.stateSlots`, `ctx.maps`, `ctx._luaMapRebuilders` from the flat arrays for state/map/handler emission.

### Path B: Atom-Based (legacy — non-lua-tree carts, split output)

```
source.fart
  → lexer → tokens
  → index.compile()
    → chad.compileChadLane(source, tokens, file)
      → same parse + preflight + contract as Path A
      → emit phase:
        → emit.emitOutput(rootExpr, file)
          → NO ctx._luaRootNode (or canEmitLuaTree is false)
          → buildMeta(rootExpr, file) → meta object (flags derived from flat arrays)
          → runEmitAtoms(meta)
            → for each atom a001-a056:
              → atom._applies(ctx, meta) → boolean (checks flat array lengths/flags)
              → atom._emit(ctx, meta) → Zig code string
            → concatenate all atom outputs
          → finalizeEmitOutput(out, file)
```

**Key observation:** Path B is the one that fully depends on flat arrays. Each emit atom reads from `ctx.stateSlots[i]`, `ctx.maps[mi]`, `ctx.handlers[hi]` etc. The `buildMeta` function derives boolean flags from flat array lengths (`hasState is stateSlots.length above 0`).

### Path C: Module (`.mod.fart` files)

```
source.mod.fart
  → lexer → tokens
  → index.compile()
    → detectFileKind(file) → 'module'
    → mod_intent_functions.compileIntentModuleContract(contract, file)
      → builds module contract from parsed blocks
      → emit atoms a047-a056 handle module-specific emission
    → OR lanes_cli.compileCliLane(source, file) for .cli.fart
```

**Key observation:** Module path has its own contract format — already more tree-like (blocks, not flat arrays). Module atoms (a047-a056) read from module contract blocks, not the 12 flat arrays. This path is already closer to the target shape.

## Data Flow: Parse → Flat Arrays

```
                              ┌─ ctx.stateSlots
                              ├─ ctx.objectArrays
collect_state ────────────────┤
                              └─ ctx.scriptFuncs

                              ┌─ ctx.handlers
parse_handler ────────────────┤
attrs_handlers ───────────────┘

                              ┌─ ctx.conditionals
conditional_blocks ───────────┤
parse_brace_ternary ──────────┘

                              ┌─ ctx.maps
parse_map* ───────────────────┤
for_loop ─────────────────────┘

                              ┌─ ctx.dynTexts
parse_build_node ─────────────┤
parse_children_text ──────────┤
                              ├─ ctx.dynColors (from parse_attrs_style_value)
                              ├─ ctx.dynStyles (from parse_pending_style)
                              └─ ctx.variantBindings

collect_components ───────────── ctx.components

app_contract ─────────────────── ctx.pages
```

Each arrow is a `.push()` or `.concat()` to a flat array on ctx. The tree information (which handler belongs to which component on which page) is lost at the push site — the handler goes into `ctx.handlers[N]` and its location in the tree is encoded only as `handler.mapIdx` (an integer back-reference).

## Data Flow: Flat Arrays → Contract

```
buildSourceContract(ctx, file):
  contract.stateSlots   = ctx.stateSlots.slice()     // copy
  contract.objectArrays = ctx.objectArrays.slice()    // copy
  contract.handlers     = ctx.handlers.slice()        // copy
  contract.conditionals = ctx.conditionals.slice()    // copy
  contract.maps         = ctx.maps.slice()            // copy
  contract.dynTexts     = ctx.dynTexts.slice()        // copy
  contract.dynColors    = ctx.dynColors.slice()       // copy
  contract.dynStyles    = ctx.dynStyles.slice()       // copy
  contract.scriptFuncs  = ctx.scriptFuncs.slice()     // copy
  contract.variantBindings = ctx.variantBindings.slice() // copy
  contract.components   = ctx.components.slice()      // copy
  contract.pages        = ctx.pages (from app contract) // copy
  contract.luaRootNode  = ctx._luaRootNode            // ref (THE TREE — already exists)
  contract.luaMapRebuilders = ctx._luaMapRebuilders   // ref
```

This is 100 lines of `<if ctx.thing> contract.thing is ctx.thing.slice() </if> <else> contract.thing is array </else>`.

**Critical finding:** `contract.luaRootNode` ALREADY carries the tree. The flat arrays are a parallel representation of the same data. The tree and the flat arrays coexist in the contract — the flat arrays are redundant for any emitter that can walk the tree.

## Data Flow: Contract → Emit Atoms

```
emit atom reads ctx.* directly (NOT contract.*):
  a004: ctx.stateSlots[i].getter, .type, .initial
  a005: ctx.stateSlots[i].slotIdx
  a009: ctx.handlers[i].name, .body, .luaBody
  a013: ctx.objectArrays[i].fields, .getter
  a019: ctx.maps[mi].oaIdx → ctx.objectArrays[oaIdx]
  a026: ctx.maps[mi].innerCount, .perItemDecls, .conditionals
        ctx.maps[mi].oaIdx → ctx.objectArrays[oaIdx].getter → len ref
        ctx.handlers.where(h.mapIdx == mi) → handler cross-ref
  a035: ctx.dynTexts[i].fmtString, .fmtArgs
        ctx.conditionals[condIdx].condExpr
  a036: ctx.conditionals[i].condExpr, .luaCondExpr
```

**Critical finding:** Emit atoms read from `ctx.*` directly, NOT from the contract. The contract is built but many atoms bypass it and read ctx. This means the contract is partially ceremonial — it's validated but not always the actual data source for emission.

## Cross-Reference Index Map

These are the fragile integer links between flat arrays:

```
child.condIdx ──────────────→ ctx.conditionals[condIdx]
child.ternaryCondIdx ───────→ ctx.conditionals[ternaryCondIdx]
child.dynBufId ─────────────→ ctx.dynTexts[dynBufId]
child.dynColorId ───────────→ ctx.dynColors[dynColorId]
child.dynStyleId ───────────→ ctx.dynStyles[dynStyleId]
child.variantBindingId ─────→ ctx.variantBindings[variantBindingId]
handler.mapIdx ─────────────→ ctx.maps[mapIdx]
map.oaIdx ──────────────────→ ctx.objectArrays[oaIdx]
map.parentMapIdx ───────────→ ctx.maps[parentMapIdx]
pageSelector.slot ──────────→ ctx.stateSlots[slot]
```

10 integer cross-references. Each is a point where adding/removing an element from one array silently corrupts all references from other arrays. In the tree model, ALL of these become path-based: the handler lives INSIDE the map node, the conditional lives INSIDE the component node, the state slot is found by walking up from the reference site.

## Dead Paths

- `buildMeta.hasFlatMaps` / `computeHasFlatMaps` — checks for non-lua maps. All maps are lua_runtime now. This flag is always false.
- `buildMeta.zigMapCount` — always 0. Dead field.
- Path B atom-based emission for non-lua-tree carts — increasingly unused as all carts move to lua-tree.

## Summary: Where the Tree Wins

| Current (flat) | Target (tree) |
|----------------|---------------|
| `ctx.handlers[7]` — handler at index 7 | `my.home.card.onPress` — handler at its address |
| `handler.mapIdx = 2` — belongs to map 2 | Handler is a child of the map node — structural |
| `condIdx = 3` → `ctx.conditionals[3]` | Conditional is a child of the `<if>` node — structural |
| `map.oaIdx = 1` → `ctx.objectArrays[1]` | OA is a child of the `<for>` node — structural |
| `resolveIdentity` searches 4 flat lists | `resolve(node, name)` walks up the tree |
| `buildSourceContract` copies 12 arrays | Contract IS the tree — zero copy |
| `buildMeta` derives 16 boolean flags | Walk tree, check node content shapes |
