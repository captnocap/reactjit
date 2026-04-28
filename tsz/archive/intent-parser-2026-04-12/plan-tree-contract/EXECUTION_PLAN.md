# Phase 6: Execution Plan — Source Contract Tree Migration

## Sections

| Section | Range | Name | Steps | Parity contract |
|---------|-------|------|-------|-----------------|
| S1 | 001-015 | Tree Node Foundation | 15 | N/A (additive) |
| S2 | 016-035 | Parse Attachment Migration | 20 | Flat arrays still populated (dual-write) |
| S3 | 036-050 | Resolve Unification | 15 | Identity resolution returns same results |
| S4 | 051-065 | Contract Builder Migration | 15 | Contract carries tree + flat arrays (both) |
| S5 | 066-090 | Emit Atom Migration | 25 | Byte-identical Zig/Lua output per atom |
| S6 | 091-105 | Flat Array Severance | 15 | Full conformance suite passes |
| S7 | 106-115 | Schema & Coherence Migration | 10 | All contract validations pass |
| S8 | 116-125 | Cleanup & Closure | 10 | Final verification |

---

## S1: Tree Node Foundation (001-015)

001. Create file `compiler/smith/intent/tree_node.mod.fart`. Write the `<tree node module>` with `<types>` block containing `TreeNode` type: `name is string`, `type is string`, `path is string`, `parent`, `children is array`, `content is object`. Write to disk. Reopen and confirm the type has all 6 fields.

002. In `tree_node.mod.fart`, add `<functions>` block with function `createNode(name, type, parentNode)`. Body: create TreeNode, set name, type, path from `parentNode.path + '.' + name` (or just name if no parent), set parent to parentNode, set children to empty array, set content to empty object. Return node. Reopen and confirm function exists.

003. In `tree_node.mod.fart`, add function `addChild(parentNode, childNode)`. Body: set `childNode.parent is parentNode`, update `childNode.path is parentNode.path + '.' + childNode.name`, push childNode to `parentNode.children`. Reopen and confirm.

004. In `tree_node.mod.fart`, add function `resolve(node, name)`. Body: check `node.content.has(name)`, if yes return `node.content.get(name)`, if no and `node.parent` exists, recurse `resolve(node.parent, name)`, else return null. Reopen and confirm.

005. In `tree_node.mod.fart`, add function `walkTree(node, visitor)`. Body: call `visitor(node)`, then `<for node.children as child>` recurse `walkTree(child, visitor)`. Reopen and confirm.

006. In `tree_node.mod.fart`, add function `collectFromTree(node, predicate)`. Body: init result array, if `predicate(node)` is true push node, for each child recurse and concat results. Return result. Reopen and confirm.

007. In `tree_node.mod.fart`, add function `attachContent(node, key, value)`. Body: `node.content.set(key, value)`. Reopen and confirm.

008. In `tree_node.mod.fart`, add function `pushContent(node, key, item)`. Body: if `node.content.has(key)` then get existing array and concat item, else set key to array containing item. Reopen and confirm.

009. In `tree_node.mod.fart`, add function `getContentOrEmpty(node, key)`. Body: if `node.content.has(key)` return it, else return empty array. Reopen and confirm.

010. In `tree_node.mod.fart`, add function `nodeHasShape(node, shapeName)`. Body: `node.content.has(shapeName)`. Reopen and confirm.

011. In `tree_node.mod.fart`, add function `findAncestorWithShape(node, shapeName)`. Body: if `node.content.has(shapeName)` return node, if `node.parent` recurse, else null. Reopen and confirm.

012. In `tree_node.mod.fart`, add function `nodePath(node)`. Body: return `node.path`. Reopen and confirm.

013. Verify `tree_node.mod.fart` line count is under 120 lines. If over, review for unnecessary complexity. Record line count in `reports/sections/s1_tree_node.md`.

014. Run `bash carts/claude-sweatshop/scripts/scan-drift.sh compiler/smith/intent/tree_node.mod.fart`. Confirm PASS (zero hard bans). Record result in `reports/sections/s1_tree_node.md`.

015. Write `s1_complete: true` to `reports/sections/s1_tree_node.md`. Update `state/current_step.txt` to 015. Record in `state/completed.txt`: "S1 001-015: TreeNode foundation module created with 11 functions."

---

## S2: Parse Attachment Migration (016-035)

Dual-write phase: parse files push to BOTH the flat array AND the tree node. Nothing breaks because flat arrays still exist. Tree builds in parallel.

016. Open `context.mod.fart`. In the context initialization function, after flat array creation, add: `ctx._treeRoot is createNode(entryName, entryType, null)`. This creates the tree root alongside the flat arrays. Reopen and confirm `_treeRoot` is set.

017. Open `context.mod.fart`. Add `ctx._currentNode is ctx._treeRoot` — a cursor tracking which tree node we're currently building content for. Reopen and confirm.

018. Open `collect_state.mod.fart`. Find every `ctx.stateSlots.push(slot)` or `ctx.stateSlots is ctx.stateSlots.concat(slot)`. After each one, add `pushContent(ctx._currentNode, 'stateSlots', slot)`. Reopen and confirm dual-write exists for each push site.

019. Open `collect_state.mod.fart`. Find every `ctx.objectArrays` push. After each, add `pushContent(ctx._currentNode, 'objectArrays', oa)`. Reopen and confirm.

020. Open `collect_state.mod.fart`. Find every `ctx.scriptFuncs` push. After each, add `pushContent(ctx._currentNode, 'scriptFuncs', fn)`. Reopen and confirm.

021. Open `parse_handler.mod.fart` and `attrs_handlers.mod.fart`. Find every `ctx.handlers` push. After each, add `pushContent(ctx._currentNode, 'handlers', handler)`. Reopen both files and confirm.

022. Open `conditional_blocks.mod.fart` and `parse_brace_ternary.mod.fart`. Find every `ctx.conditionals` push. After each, add `pushContent(ctx._currentNode, 'conditionals', cond)`. Reopen both and confirm.

023. Open `parse_map_for_loop.mod.fart`, `parse_map_for_loop_full.mod.fart`, `for_loop.mod.fart`. Find every `ctx.maps` push. After each, add `pushContent(ctx._currentNode, 'maps', map)`. Reopen all and confirm.

024. Open `parse_build_node.mod.fart` and `parse_children_text.mod.fart`. Find every `ctx.dynTexts` push. After each, add `pushContent(ctx._currentNode, 'dynTexts', dt)`. Reopen both and confirm.

025. Open `parse_attrs_style_value.mod.fart`. Find every `ctx.dynColors` push. After each, add `pushContent(ctx._currentNode, 'dynColors', dc)`. Reopen and confirm.

026. Open `parse_pending_style.mod.fart`. Find every `ctx.dynStyles` push. After each, add `pushContent(ctx._currentNode, 'dynStyles', ds)`. Reopen and confirm.

027. Open `parse_build_node.mod.fart`. Find every `ctx.variantBindings` push. After each, add `pushContent(ctx._currentNode, 'variantBindings', vb)`. Reopen and confirm.

028. Open `collect_components.mod.fart`. Find every `ctx.components` push. After each, add `pushContent(ctx._currentNode, 'components', comp)`. Reopen and confirm.

029. Identify where the parser enters a new scope (page, component, for-loop). In each location, add: `savedNode is ctx._currentNode`, `childNode is createNode(blockName, blockType, ctx._currentNode)`, `addChild(ctx._currentNode, childNode)`, `ctx._currentNode is childNode`. At scope exit: `ctx._currentNode is savedNode`. Record all locations in `reports/sections/s2_scope_sites.md`.

030. Verify dual-write: run `./scripts/build carts/conformance/d01_nested_maps.fart`. Confirm build succeeds. The flat arrays work as before. The tree builds in parallel. Record in `reports/sections/s2_dual_write.md`.

031. Run full conformance: `./scripts/conformance-report --fails`. Record pass count and any failures in `reports/sections/s2_dual_write.md`. If any failures, they are regressions from dual-write — fix before proceeding.

032. Add a temporary debug function `dumpTree(node, depth)` to `tree_node.mod.fart`. Prints indented node paths. Run on a test cart and verify the tree structure matches the expected block nesting. Record sample output in `reports/sections/s2_tree_dump.md`.

033. Verify tree content: for a test cart, compare `ctx._treeRoot` content collections against flat arrays. For each of the 12 arrays, confirm the tree's collected content has the same count. Record counts in `reports/sections/s2_content_parity.md`.

034. Run `bash carts/claude-sweatshop/scripts/scan-drift.sh` on all modified files. Confirm PASS. Record in `reports/sections/s2_drift.md`.

035. Write `s2_complete: true` to `reports/sections/s2_status.md`. Update `state/current_step.txt` to 035. Record in `state/completed.txt`: "S2 016-035: Dual-write parse attachment complete. Tree builds in parallel with flat arrays."

---

## S3: Resolve Unification (036-050)

036. Open `tree_node.mod.fart`. Add function `resolveWithKind(node, name)`. Body: walk up tree via `resolve`, but also return the kind based on what type of node contained the match. If node.type exact 'var' or node has 'stateSlots' content containing name → kind 'slot'. If node is a `<for>` and name matches itemParam → kind 'map_item'. If node is a component and name is in props → kind 'prop'. Etc. Returns `{kind, value, node}`. Reopen and confirm.

037. Open `identity.mod.fart`. Add a new function `resolveIdentityViaTree(name, currentNode)` that calls `resolveWithKind(currentNode, name)` and formats the result into the same `kind:zigExpr::type` string format that `resolveIdentity` returns. Reopen and confirm.

038. In `identity.mod.fart`, at the TOP of `resolveIdentity`, add: `<if ctx._treeRoot> treeResult is resolveIdentityViaTree(name, ctx._currentNode)`. Do NOT use the result yet — just compute it. Reopen and confirm.

039. Add a comparison: after computing both `treeResult` and the existing flat result, write a mismatch warning if they differ. This is the parity check — tree resolution must match flat resolution. Run on a test cart and record mismatches in `reports/sections/s3_resolve_parity.md`.

040. Fix all mismatches found in step 039. For each mismatch: open the file, identify whether the tree or flat path is wrong, fix the tree path (never change the flat path — it's the source of truth). Reopen and confirm each fix. Record fixes in `reports/sections/s3_resolve_fixes.md`.

041. Run full conformance with the parity check active. Record mismatch count. Target: zero mismatches across all conformance carts. Record in `reports/sections/s3_resolve_parity.md`.

042. Once parity is zero: in `resolveIdentity`, replace the flat-path body with the tree result. Keep the flat path as a commented fallback. Reopen and confirm.

043. Run full conformance. Confirm zero regressions. Record in `reports/sections/s3_resolve_final.md`.

044. Delete `resolve_state_access.mod.fart` — its functionality is now in `resolveWithKind`. Confirm no remaining imports/references. Reopen any file that referenced it and confirm the reference is gone.

045. Delete `field_access.mod.fart` — same. Confirm no references.

046. Delete `const_oa.mod.fart` — same. Confirm no references.

047. Run full conformance. Confirm zero regressions after resolution module deletion. Record in `reports/sections/s3_resolve_final.md`.

048. Run drift scanner on all modified files. Confirm PASS.

049. Run readability linter on modified files. Record tax count.

050. Write `s3_complete: true`. Update `state/current_step.txt` to 050. Record: "S3 036-050: Resolve unified to single tree traversal. 3 resolution modules deleted."

---

## S4: Contract Builder Migration (051-065)

051. Open `contract_build.mod.fart`. In `buildSourceContract`, after the existing flat-array copying, add: `contract.tree is ctx._treeRoot`. The contract now carries BOTH representations. Reopen and confirm.

052. Open `contract_schema.mod.fart`. In `validateContractSchema`, after existing checks, add: `<if contract.tree> treeOk is validateTreeShape(contract.tree)`. Add `validateTreeShape` function that walks the tree and checks each node has name, type, path, children. Reopen and confirm.

053. Run full conformance. Confirm zero regressions (additive only — flat arrays unchanged). Record in `reports/sections/s4_contract_parity.md`.

054. Open `contract_emit_contract.mod.fart`. In the JSON serialization for `--contract` mode, include `contract.tree` in the output. The JSON now contains both flat arrays and tree. Reopen and confirm.

055. Run `forge build --contract` on a test cart. Verify JSON output contains a `tree` field with nested nodes. Record sample in `reports/sections/s4_contract_json.md`.

056. Add `contract.tree.path` verification: the root node's path should match `contract.entry.name`. Add this check to `validateContractSchema`. Reopen and confirm.

057. Add tree content count verification: for each of the 12 flat arrays, the tree's total collected content for that key should match the flat array length. Add to `validateContractSchema` as a coherence check. Reopen and confirm.

058. Run full conformance with the new coherence checks active. Record any mismatches. Fix by correcting tree attachment in S2 parse files. Record in `reports/sections/s4_coherence.md`.

059. Target: zero tree/flat mismatches across all conformance carts. Record final count.

060. Open `contract_build.mod.fart`. Create new function `buildTreeContract(ctx, file)` that builds a contract from ONLY the tree: `contract.version is 'source-contract-v3'`, `contract.tree is ctx._treeRoot`, `contract.file is file`, `contract.tier is ctx._sourceTier`. No flat array copies. Reopen and confirm.

061. In `buildSourceContract`, at the end, add: `v3 is buildTreeContract(ctx, file)`. Compute both. Do not use v3 yet. Reopen and confirm.

062. Add parity verification: compare v3 tree content counts against v2 flat array lengths. Record in `reports/sections/s4_v3_parity.md`.

063. Run full conformance with v3 parity check. Target: zero mismatches.

064. Run drift scanner and readability linter on all S4 files.

065. Write `s4_complete: true`. Update `state/current_step.txt` to 065. Record: "S4 051-065: Contract carries both tree and flat arrays. v3 tree contract built and verified."

---

## S5: Emit Atom Migration (066-090)

Migrate atoms one at a time. Each atom switches from flat-array reads to tree walks. Byte-identical output verified per atom.

066. Choose the simplest atom that reads flat arrays: `a004_state_manifest.mod.fart` (reads `stateSlots`). Record current output for 3 test carts in `reports/sections/s5_a004_before.md`.

067. In a004, replace `ctx.stateSlots` reads with `collectFromTree(ctx._treeRoot, node.content.has('stateSlots'))` → flatten collected stateSlots. Reopen and confirm.

068. Run the same 3 test carts. Diff output against saved `s5_a004_before.md`. Confirm byte-identical. Record in `reports/sections/s5_a004_after.md`.

069. If not byte-identical: record exact diff, fix, re-verify. Do not proceed until parity is proven.

070. Repeat steps 066-069 for `a005_init_state_slots.mod.fart`. Record before/after in `reports/sections/s5_a005_*.md`.

071. Repeat for `a008_dynamic_text_buffers.mod.fart` (reads `dynTexts`).

072. Repeat for `a009_non_map_handlers.mod.fart` (reads `handlers`).

073. Repeat for `a013_oa_string_helpers.mod.fart` (reads `objectArrays`).

074. Repeat for `a036_conditional_updates.mod.fart` (reads `conditionals`). This atom also cross-references `condIdx` — the first atom where integer cross-references get replaced by tree-structural relationships.

075. After a036: verify that `condIdx` is no longer used in the migrated atom. Grep for `condIdx` in the file. Confirm zero matches. Record in `reports/sections/s5_condIdx_elimination.md`.

076. Repeat for `a035_dynamic_text_updates.mod.fart` (reads `dynTexts`, `dynColors`, `dynStyles`, `conditionals` — heaviest cross-referencer).

077. After a035: verify `dynBufId`, `dynColorId`, `dynStyleId` are no longer used. Grep each. Confirm zero matches.

078. Repeat for the map atoms: `a019_map_metadata.mod.fart` through `a032_lua_map_master_dispatch.mod.fart` (14 atoms). These are the most complex — they cross-reference `maps`, `objectArrays`, `handlers` via `mapIdx`, `oaIdx`. Migrate one at a time with byte-identical verification between each.

079. After each map atom: verify `mapIdx` and `oaIdx` integer references are replaced by tree-structural relationships (handler is a child of the map node, OA is content of the for-node).

080. Repeat for `a037_variant_updates.mod.fart` (reads `variantBindings`).

081. After a037: verify `variantBindingId` is eliminated.

082. Repeat for app atoms: `a039_app_init.mod.fart`, `a040_app_tick.mod.fart`, `a041_app_exports.mod.fart`.

083. Repeat for remaining atoms that read flat arrays: `a012_qjs_bridge.mod.fart`, `a033_js_logic_block.mod.fart`, `a034_lua_logic_block.mod.fart`.

084. Module atoms (`a047-a056`) already use module contract — verify they don't read from the 12 flat arrays. If they do, migrate. If they don't, mark as clean.

085. Preamble atoms (`a001-a003`) and tree atoms (`a006-a007`) and effect atoms (`a010-a011`) don't read flat arrays. Mark as clean.

086. Run FULL conformance suite: `./scripts/conformance-report`. Record total pass count. Compare to pre-migration pass count from S2.

087. Target: identical pass count. Zero regressions. If any failures, identify which atom migration caused it and fix.

088. Grep entire `compiler/smith/intent/` for remaining references to `condIdx`, `dynBufId`, `mapIdx`, `oaIdx`, `variantBindingId`. Target: zero. Record counts in `reports/sections/s5_crossref_elimination.md`.

089. Run drift scanner on all migrated atom files.

090. Write `s5_complete: true`. Update `state/current_step.txt` to 090. Record: "S5 066-090: All emit atoms migrated to tree reads. N integer cross-references eliminated."

---

## S6: Flat Array Severance (091-105)

091. Open `context.mod.fart`. Comment out all flat array initializations: `stateSlots`, `handlers`, `maps`, `conditionals`, `objectArrays`, `dynTexts`, `dynColors`, `dynStyles`, `scriptFuncs`, `variantBindings`. Do NOT delete — comment out. Reopen and confirm.

092. Build. It will fail. Record EVERY error in `reports/sections/s6_severance_errors.md` with file and line.

093. For each error: the file still reads from `ctx.flatArray`. Open the file. Replace the flat-array read with the equivalent tree read using `collectFromTree` or `resolve`. Reopen and confirm each fix.

094. Build again. Record remaining errors. Repeat 093 until build succeeds.

095. Run full conformance. Record pass count. Compare to pre-severance.

096. If regressions: identify which file's tree read produces different results than the flat read did. Fix. Re-run conformance. Repeat until identical pass count.

097. Open `contract_build.mod.fart`. Remove all flat-array copy lines (the 12 `<if ctx.thing> contract.thing is ctx.thing.slice()` blocks). The contract now uses ONLY `buildTreeContract`. Reopen and confirm the copy lines are gone.

098. Build and run full conformance. Record.

099. Open `emit.mod.fart`. In `buildMeta`, replace all flat-array-length flag derivations with tree content queries using `collectFromTree`. Reopen and confirm.

100. Build and run full conformance. Record.

101. Open `context.mod.fart`. Delete (not comment — delete) all flat array initializations. Reopen and confirm they're gone.

102. Open all parse files that were dual-writing (S2). Remove the flat-array push (keep only the tree push via `pushContent`). Reopen each and confirm.

103. Build and run full conformance. This is the moment of truth — the flat arrays are fully gone. Record pass count.

104. Run drift scanner and readability linter on all modified files.

105. Write `s6_complete: true`. Update `state/current_step.txt` to 105. Record: "S6 091-105: Flat arrays severed. Contract is tree-only. All conformance passes."

---

## S7: Schema & Coherence Migration (106-115)

106. Open `contract_schema.mod.fart`. Rewrite `validateContractSchema` to validate tree shape instead of flat array presence. Check: root has name, type, path. Walk tree and verify each node has valid children. Reopen and confirm.

107. Open `contract_schema.mod.fart`. Rewrite `_validateCoherence` to use tree walks: page selector resolution by name (not slot index), page routing by tree structure (not conditional count), scoped block collisions by tree sibling names. Reopen and confirm.

108. Run full conformance with new schema validation. Record.

109. Open `contract_app_contract.mod.fart`. Verify `buildAppContract` works with tree nodes for pages and components (they should already be tree children). If it still reads flat arrays, migrate. Reopen and confirm.

110. Open `contract_sanitize_for_lua.mod.fart`. Verify it operates on tree nodes. If it reads flat arrays, migrate.

111. Delete `contract_contract_build.mod.fart` if its functionality is now in `buildTreeContract`. Confirm no references remain.

112. Delete `contract_contract_schema.mod.fart` if its checks are now in the tree-based schema. Confirm no references.

113. Run full conformance. Record.

114. Update `CONTRACT_VERSION` from `'source-contract-v2'` to `'source-contract-v3'` in all contract files.

115. Write `s7_complete: true`. Update `state/current_step.txt` to 115. Record: "S7 106-115: Schema validates tree shape. Coherence checks use tree walks. Contract version v3."

---

## S8: Cleanup & Closure (116-125)

116. Grep for any remaining references to the 12 flat array names (`stateSlots`, `objectArrays`, `handlers`, `conditionals`, `maps`, `dynTexts`, `dynColors`, `dynStyles`, `scriptFuncs`, `variantBindings`, `components`, `pages`) as `ctx.` properties. Target: zero outside of `tree_node.mod.fart` content keys. Record counts.

117. Grep for any remaining integer cross-reference field names (`condIdx`, `ternaryCondIdx`, `dynBufId`, `dynColorId`, `dynStyleId`, `variantBindingId`, `mapIdx`, `oaIdx`, `parentMapIdx`). Target: zero. Record counts.

118. If any remain from 116-117: migrate them. Rebuild. Re-verify conformance.

119. Remove `dumpTree` debug function from `tree_node.mod.fart` (added in S2 step 032).

120. Run drift scanner on full codebase. Record.

121. Run readability linter on full codebase. Record.

122. Run full conformance suite one final time. Record pass count. This is the final number.

123. Compare final conformance pass count to the baseline from S2 step 031. They must be identical. Record both numbers in `reports/closure_summary.md`.

124. Write `reports/closure_summary.md`: baseline pass count, final pass count, files created, files deleted, files modified, total steps executed, integer cross-references eliminated (should be 10), flat arrays eliminated (should be 12), resolution modules deleted (should be 3).

125. Update control board: `all_steps_pass_integrity_check: true`. Write `s8_complete: true`. Final `state/current_step.txt`: 125.

---

## Step Count

| Section | Steps |
|---------|-------|
| S1: Tree Node Foundation | 15 |
| S2: Parse Attachment | 20 |
| S3: Resolve Unification | 15 |
| S4: Contract Builder | 15 |
| S5: Emit Atom Migration | 25 |
| S6: Flat Array Severance | 15 |
| S7: Schema & Coherence | 10 |
| S8: Cleanup & Closure | 10 |
| **Total** | **125** |
