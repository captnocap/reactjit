# Phase 4: Decomposition Map

Every high-fragility function broken into named sub-operations. Intentionally redundant — dedup is Phase 5.

---

## 1. buildSourceContract (contract_build.mod.fart:12-112)

Currently 100 lines of flat-array copying. Sub-operations:

| Sub-op | What it does | In tree model |
|--------|-------------|---------------|
| `copyStateSlots` | `ctx.stateSlots.slice()` → contract | Tree root carries state vars |
| `copyObjectArrays` | `ctx.objectArrays.slice()` → contract | Each `<for>` node carries its OA |
| `copyHandlers` | `ctx.handlers.slice()` → contract | Each pressable node carries its handler |
| `copyConditionals` | `ctx.conditionals.slice()` → contract | Each `<if>/<during>` node carries its condition |
| `copyMaps` | `ctx.maps.slice()` → contract | Each `<for>` node IS a map |
| `copyDynTexts` | `ctx.dynTexts.slice()` → contract | Each `Text` node with `{expr}` carries its dyn text |
| `copyDynColors` | `ctx.dynColors.slice()` → contract | Each styled node carries its dyn color |
| `copyDynStyles` | `ctx.dynStyles.slice()` → contract | Each styled node carries its dyn style |
| `copyScriptFuncs` | `ctx.scriptFuncs.slice()` → contract | Script block is a child of the entry node |
| `copyVariantBindings` | `ctx.variantBindings.slice()` → contract | Each variant node carries its binding |
| `copyComponents` | `ctx.components.slice()` → contract | Each component is a child of its page |
| `attachLuaRootNode` | `ctx._luaRootNode` → contract (ref) | This IS the tree — becomes the contract itself |
| `attachMetadata` | version, file, tier, entry, pages | Root node metadata |

**Tree replacement:** The entire function becomes `contract.tree is ctx._luaRootNode` plus root metadata. Zero array copies.

---

## 2. _contractEntry (contract_build.mod.fart:114-129)

| Sub-op | What it does | In tree model |
|--------|-------------|---------------|
| `searchBlocksForEntry` | Walk `intentBlocks` backwards for app/widget/page | Tree root IS the entry — `tree.name`, `tree.type` |
| `fallbackToAppContract` | Use `ctx._appContract.entry` if blocks miss | Unnecessary — tree root has the answer |

**Tree replacement:** `tree.name` and `tree.type`. One field read, not a backward search.

---

## 3. _contractScopedBlocks (contract_build.mod.fart:157-191)

| Sub-op | What it does | In tree model |
|--------|-------------|---------------|
| `filterRuntimeBlocks` | Skip blocks without `.runtime` | Tree walk: only visit nodes with runtime content |
| `copyPrimitiveSlots` | `.runtime.primitiveSlots.slice()` | Node carries its own slots |
| `copyBlockOAs` | `.runtime.objectArrays.slice()` | Node carries its own OAs |
| `copyBlockScriptFuncs` | `.runtime.scriptFuncs.slice()` | Node carries its own script fns |
| `assembleBlockEntry` | Build `{name, type, slots, oas, scriptBlock, props, bindings}` | The node IS this entry — no assembly |

**Tree replacement:** The tree nodes already have this structure. Walking the tree and reading `.runtime` from each node IS the scoped block list.

---

## 4. validateContractSchema (contract_schema.mod.fart:13-86)

| Sub-op | What it does | In tree model |
|--------|-------------|---------------|
| `checkVersion` | `contract.version exact CONTRACT_VERSION` | Same — root metadata |
| `checkRequiredStrings` | file, tier must be strings | Same — root metadata |
| `checkEntry` | entry.name, entry.type must be strings | `tree.name`, `tree.type` |
| `checkRequiredArrays` | stateSlots, objectArrays, handlers, conditionals, scriptFuncs must be arrays | Walk tree: check that content collections exist at appropriate nodes |
| `checkPageSelector` | pageSelector.varName, .slot, .type must be valid | Walk up from page nodes to find the selector var |
| `runCoherence` | Cross-field invariants (slot range, page count, scoped block collisions, luaRootNode misses) | Tree coherence: parent-child relationships are structural, not cross-referenced by index |

**Tree replacement:** Most array-length and index-range checks become tree-shape checks. "Does this node have children?" replaces "is this array non-empty?" Coherence checks become tree walks instead of flat-array cross-references.

---

## 5. _validateCoherence (contract_schema.mod.fart:88-158)

| Sub-op | What it does | In tree model |
|--------|-------------|---------------|
| `checkPageSelectorSlotRange` | `ps.slot < stateSlots.length` | Walk up from page to app, find var by name — no index |
| `checkPageSelectorNameMatch` | `stateSlots[ps.slot].getter exact ps.varName` | Walk up, find by name — structural match |
| `checkPagesHaveRouting` | Count show_hide conditionals vs page count | Each page node carries its own visibility condition |
| `checkScopedBlockCollisions` | Detect duplicate function names across scoped blocks | Tree walk: each node's functions are scoped — collision = two siblings with same function name |
| `checkLuaRootNodeMisses` | Recursive tree walk counting children missing luaNode shape | Same tree walk — already tree-based! |

**Tree replacement:** `_countNodeMisses` (lines 160-202) is ALREADY a tree walk. It's the one function in the contract system that works the way the whole system should work. The other coherence checks migrate from index-based to tree-walk.

---

## 6. resolveIdentity (identity.mod.fart:42-79+)

| Sub-op | What it does | In tree model |
|--------|-------------|---------------|
| `findSlot` | Search `stateSlots` array for getter name | `resolve(node, name)` — walk up tree, find var with matching name |
| `findOA` | Search `objectArrays` for getter name | Same resolve — OA is content of a `<for>` node |
| `findRenderLocal` | Check `renderLocals` map | Same resolve — render local is content of the node that declared it |
| `findProp` | Check `propStack` | Same resolve — prop is on the component node |
| `findMapItem` | Check `currentMap.itemParam` | Same resolve — map item is scoped to the `<for>` node |
| `findMapIndex` | Check `currentMap.indexParam` | Same resolve — map index is scoped to the `<for>` node |
| `findParentMapIndex` | Check `currentMap.parentMap.indexParam` | Walk up one more level |
| `findScriptFn` | Check `scriptFuncs` array | Same resolve — script fn is content of the script block node |

**Tree replacement:** ALL 8 search paths become one: `resolve(currentNode, name)`. Walk up the tree from the current node until a node's content contains the name. The kind is determined by what the node IS (var node → slot, for node → map item, component node → prop). One function replaces 8 searches across 4 different flat structures.

---

## 7. buildMeta (emit.mod.fart:28-77)

| Sub-op | What it does | In tree model |
|--------|-------------|---------------|
| `deriveBasename` | `file.split('/').last` | Same — file metadata |
| `deriveHasState` | `stateSlots.length > 0` | Tree walk: does any node have state vars? |
| `deriveHasDynText` | `dynCount > 0` | Tree walk: does any Text node have `{expr}`? |
| `computeHasDynamicOA` | Any OA is non-const, non-nested | Tree walk: does any `<for>` have a dynamic data source? |
| `derivePfLane` | Read from preflight | Same — preflight metadata |
| `computePromotedToPerItem` | Check promoted map arrays | Tree walk: which map nodes promoted arrays |
| `deriveHasConds` | `conditionals.length > 0` | Tree walk: does any node have `<if>` children? |
| `deriveHasVariants` | `variantBindings.length > 0` | Tree walk: does any node have variant binding? |
| `deriveHasDynStyles` | `dynStyles.length > 0` | Tree walk: does any node have dynamic style? |
| `computeHasFlatMaps` | Any map is non-nested, non-inline | Tree walk: any `<for>` that's top-level? |
| `deriveHasLuaMaps` | `_luaMapRebuilders.length > 0` | Tree walk: any `<for>` with lua rebuild? |
| `buildMetaObject` | Assemble 16-field object | Assemble from tree walks |

**Tree replacement:** 16 boolean flags derived from flat array lengths → 16 boolean flags derived from tree content queries. The queries are more natural: "does the tree contain any X?" is a `<for>` walk with `<if>` at each node. The flags could even be lazy — compute on demand instead of precomputing all 16.

---

## 8. emit atom interface: _applies + _emit (56 atoms)

Every atom has the same shape:

| Sub-op | What it does | In tree model |
|--------|-------------|---------------|
| `_applies(ctx, meta)` | Check boolean flags / array lengths | Check if tree contains the content shape this atom handles |
| `_emit(ctx, meta)` | Read flat arrays by index, produce Zig/Lua string | Walk tree, emit for each node whose content matches |

**Tree replacement:** Instead of `_applies` checking a precomputed flag, the atom walks the tree and emits for each matching node. `_applies` and `_emit` merge — the walk IS the applies check. If no nodes match, no output. If nodes match, emit for each.

Current: `a036._applies = conditionals.length > 0` → `a036._emit = for each conditional, emit update`
Tree: `a036.emit = walk tree, for each node with conditional content, emit update`

---

## 9. context.mod.fart — Parse context initialization

| Sub-op | What it does | In tree model |
|--------|-------------|---------------|
| `initFlatArrays` | Create empty stateSlots, handlers, maps, etc. | Create empty tree root |
| `derivePreflightIntents` | Check array lengths for boolean flags | Walk tree for content presence |
| `buildPreflightScanState` | Assemble allDecls, handlerNameSet | Walk tree to collect decls and handler names |
| `classifyMapBackends` | Set map.mapBackend for each map | Walk tree, set backend on each `<for>` node |

**Tree replacement:** `initFlatArrays` becomes `initTreeRoot`. Preflight queries walk the tree instead of checking array lengths. `allDecls` and `handlerNameSet` are collected by tree walk.

---

## 10. Cross-reference indices (the fragile links)

Each cross-reference is a sub-operation that the tree eliminates:

| Cross-ref | What it links | Tree replacement |
|-----------|--------------|-----------------|
| `child.condIdx → conditionals[i]` | Child node → its conditional | Conditional IS a child of the `<if>` node |
| `child.ternaryCondIdx → conditionals[i]` | Child node → ternary branch condition | Condition IS on the ternary node |
| `child.dynBufId → dynTexts[i]` | Text node → its dynamic text | Dyn text IS content of the Text node |
| `child.dynColorId → dynColors[i]` | Styled node → its dynamic color | Dyn color IS content of the styled node |
| `child.dynStyleId → dynStyles[i]` | Styled node → its dynamic style | Dyn style IS content of the styled node |
| `child.variantBindingId → variantBindings[i]` | Node → its variant binding | Variant binding IS content of the node |
| `handler.mapIdx → maps[i]` | Handler → its map | Handler IS a child of the `<for>` node |
| `map.oaIdx → objectArrays[i]` | Map → its data source | OA IS content of the `<for>` node |
| `map.parentMapIdx → maps[i]` | Nested map → parent map | Parent IS the tree parent — structural |
| `pageSelector.slot → stateSlots[i]` | Page selector → state var | Walk up tree, find var by name |

**Tree replacement:** ALL 10 become "the thing IS where it lives in the tree." Zero integer indices. Zero cross-referencing. The tree structure IS the relationship.

---

## Summary

| High-fragility unit | Sub-ops | Tree eliminates |
|---------------------|---------|-----------------|
| buildSourceContract | 13 copy operations | 13 → 0 (contract IS tree) |
| _contractEntry | 2 search operations | 2 → 1 field read |
| _contractScopedBlocks | 5 copy operations | 5 → tree walk |
| validateContractSchema | 6 check operations | 6 → tree shape checks |
| _validateCoherence | 5 cross-ref checks | 5 → tree walks |
| resolveIdentity | 8 search paths | 8 → 1 tree traverse |
| buildMeta | 12 flag derivations | 12 → tree content queries |
| emit atom interface | 2 ops x 56 atoms | Merge _applies + _emit into tree walk |
| context init | 4 init operations | 4 → tree root init |
| cross-ref indices | 10 fragile links | 10 → 0 (structural) |

Total: ~67 sub-operations across 10 units. The tree model eliminates ~50 of them entirely (they become structural), simplifies ~12 into tree walks, and keeps ~5 unchanged (version checks, file metadata).
