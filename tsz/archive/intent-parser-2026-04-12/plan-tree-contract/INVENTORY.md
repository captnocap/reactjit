# Phase 1: Inventory — Source Contract Tree Migration

## Scope

The source contract system: how parsed intent source gets structured into an intermediate representation that emit atoms consume to produce Zig/Lua output.

## Ownership Categories

| Category | Meaning |
|----------|---------|
| `contract` | Contract building, schema validation, serialization |
| `parse` | Parse-time context accumulation (producers of flat arrays) |
| `emit` | Emit atoms (consumers of flat arrays) |
| `entry` | Entry points that orchestrate parse → contract → emit |
| `resolve` | Identity/scope resolution that cross-references flat arrays |

## Contract Files (producers — build the contract from parse ctx)

| File | Lines | Purpose | Fragility | Callers |
|------|-------|---------|-----------|---------|
| `contract_build.mod.fart` | 217 | Build source contract from ctx flat arrays | high | `index`, `lanes_shared`, `lanes_cli` |
| `contract_contract_build.mod.fart` | 268 | Extended contract builder with scoped block support | high | `contract_build`, `module_contract` |
| `contract_schema.mod.fart` | 204 | Validate contract shape and cross-field coherence | high | `index`, `emit` |
| `contract_contract_schema.mod.fart` | ~200 | Extended schema with Lua tree coherence checks | high | `contract_schema` |
| `contract_module_contract.mod.fart` | ~180 | Module-specific contract building (.mod.fart files) | high | `mod_intent_functions`, `lanes_cli` |
| `contract_app_contract.mod.fart` | ~150 | App-specific contract building (pages, routing) | high | `index`, `chad` |
| `contract_emit_contract.mod.fart` | ~120 | Contract → JSON serialization for --contract mode | low | `index` |
| `contract_sanitize_for_lua.mod.fart` | ~100 | Sanitize contract for Lua-tree emit path | high | `contract_build` |
| `contract_node_contract.mod.fart` | ~100 | Node-level contract extraction from luaRootNode | high | `contract_build` |

## Entry Points (orchestrate parse → contract → emit)

| File | Lines | Purpose | Fragility |
|------|-------|---------|-----------|
| `index.mod.fart` | 611 | Main compiler entry: parse → contract → emit dispatch | high |
| `emit.mod.fart` | 199 | Emit atom runner: iterates atoms, calls applies + emit | high |
| `lanes_shared.mod.fart` | ~300 | Shared lane logic: builds contract, runs emit | high |
| `lanes_chad.mod.fart` | ~250 | Chad lane: intent parse → contract → emit | high |
| `lanes_cli.mod.fart` | ~200 | CLI lane: intent parse → module contract → emit | high |
| `context.mod.fart` | 135 | Parse context initialization (creates the flat arrays) | high |

## Flat Arrays in ctx (the data that gets flattened)

These are the arrays that buildSourceContract copies from ctx into the contract. Each is accumulated during parse and consumed by emit atoms via index.

| Array | Producers | Consumers (emit atoms) | Cross-references |
|-------|-----------|----------------------|-----------------|
| `ctx.stateSlots` | collect_state | a004, a005, a012, a033, a039 | pageSelector.slot indexes into this |
| `ctx.objectArrays` | collect_state, brace_maps | a013-a017, a019, a026-a028 | map.oaIdx indexes into this |
| `ctx.handlers` | parse_handler, attrs_handlers | a009, a025, a026-a028 | handler.mapIdx cross-refs maps |
| `ctx.conditionals` | conditional_blocks, parse_brace_ternary | a036 | child.condIdx indexes into this |
| `ctx.maps` | parse_map*, for_loop | a019-a032 | map.parentMapIdx cross-refs maps; map.oaIdx cross-refs OAs |
| `ctx.dynTexts` | parse_build_node, parse_children_text | a008, a035 | child.dynBufId indexes into this |
| `ctx.dynColors` | parse_attrs_style_value | a035 | child.dynColorId indexes into this |
| `ctx.dynStyles` | parse_pending_style | a035 | child.dynStyleId indexes into this |
| `ctx.scriptFuncs` | collect_state | a033 | Referenced by name, not index |
| `ctx.variantBindings` | parse_build_node | a037 | child.variantBindingId indexes into this |
| `ctx.components` | collect_components | component_inline | Referenced by name |
| `ctx.pages` | app_contract | a039, a040 | Indexed by page position |

## Emit Atoms (consumers — 56 total)

| Range | Group | Count | Reads from flat arrays |
|-------|-------|-------|----------------------|
| a001-a003 | preamble | 3 | None (banner, imports) |
| a004-a005 | state | 2 | stateSlots |
| a006-a007 | tree | 2 | Node tree (not flat arrays) |
| a008 | dyn_text | 1 | dynTexts |
| a009 | handlers | 1 | handlers |
| a010-a011 | effects | 2 | Effect registry (not flat arrays) |
| a012 | bridge | 1 | stateSlots, objectArrays |
| a013-a017 | OA | 5 | objectArrays |
| a018 | variant | 1 | variantBindings |
| a019-a032 | maps | 14 | maps, objectArrays, handlers, dynTexts |
| a033-a034 | logic | 2 | stateSlots, scriptFuncs |
| a035 | dyn_updates | 1 | dynTexts, dynColors, dynStyles, conditionals |
| a036 | conditionals | 1 | conditionals |
| a037 | variants | 1 | variantBindings |
| a038-a042 | app | 5 | stateSlots, handlers, pages |
| a043-a046 | split | 4 | Contract metadata |
| a047-a056 | module | 10 | Module contract (separate path) |

## Resolution Files (cross-reference flat arrays during parse)

| File | Purpose | Arrays accessed |
|------|---------|----------------|
| identity.mod.fart | Resolve name → slot/prop/renderLocal/mapItem | stateSlots, objectArrays, propStack |
| resolve_state_access.mod.fart | Resolve state getter/setter names | stateSlots |
| field_access.mod.fart | Resolve OA field references | objectArrays |
| const_oa.mod.fart | Resolve const OA field lookups | objectArrays |

## Summary

| Category | Files | Total lines (est.) |
|----------|-------|--------------------|
| Contract builders/schemas | 9 | ~1,600 |
| Entry points | 6 | ~1,700 |
| Emit atoms | 56 | ~8,000 |
| Parse-time accumulators | ~30 | ~6,000 |
| Resolution/identity | 4 | ~400 |
| **Total in scope** | **~105** | **~17,700** |

## Key Observation

12 flat arrays in ctx, accumulated by ~30 parse files, flattened into the contract by 9 contract files, consumed by 56 emit atoms via index cross-referencing. The fragility is concentrated in the cross-references: condIdx, dynBufId, mapIdx, oaIdx, variantBindingId — all integer indices into flat arrays that shift when elements are added or removed.

The postal model reframes this: the sender (parse) builds a tree with addresses. The postal service (contract) preserves the tree and validates addresses. The receiver (emit) dispatches by content shape at each tree node, not by flat array index. The address is structural (tree path), not positional (array index).
