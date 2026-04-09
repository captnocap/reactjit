# Migration Single-Agent Execution Proposal

Generated: 2026-04-08

Purpose:
- This is a separate proposal from the multi-agent orchestration plan.
- This document describes what the work looks like if a **single agent** is put on a deterministic loop and executes the migration step by step.
- The bias here is against drift, against hidden handoffs, and against "good enough" phase jumps.
- This document is the current single-agent executable checklist.

Model:
- read one step
- do the step
- verify the step
- mark the step complete
- re-read the step
- re-read the changed line or file
- move to the next step

Core rule:
- do not skip ahead because a later step "will cover it"
- do not batch-edit three files if the step only names one
- do not treat a report as proof of change
- do not treat a grep result as proof of correctness
- do not trust input/output parity alone when the semantic middle has not been named
- `current_step.txt` is always `last_completed_step`, never `next_step_to_run`

Expected scale:
- 660 steps

Status:
- The file currently contains `660` numbered checklist steps.
- The numbering is continuous from `1` through `660`.
- The checklist is intended to be executed directly, not treated as a planning skeleton.
- Remaining judgment points are expressed as explicit boolean writes into status or report files.

Implication:
- This file should be treated as the current source of truth for the single-agent execution path.
- Any further expansion should preserve the same rule: one concrete action, one concrete artifact, one concrete verification.

## Step Integrity Rule

Definition:
- A **real step** tells the agent exactly what to open, exactly what to read, exactly what to copy/change, exactly where to place it, exactly what to verify, and exactly where to record the result.
- A **task-shaped row** tells the agent what to accomplish and leaves the how to the agent.

Examples of task-shaped rows:
- `Compare a004 to emitStateManifest()`
- `Check whether a005 matches dynamic text update emission`
- `Add the missing smith_log import somewhere in a003`

Those are not safe execution steps because they still require reconstruction and inference.

Execution rule:
- Before any section is executed in a strict one-agent loop, every task-shaped row in that section must be expanded into literal microsteps.
- A section is not runnable until its rows are transformed into real steps.

Expansion rule:
- Any step containing `compare`, `verify whether`, `decide whether`, `as needed`, `correct branch`, `equivalent`, `match exactly`, `patch it`, or similar inference-heavy language must be expanded before execution.

Boolean gate rule:
- Any step that says `confirm`, `verify`, `check`, `if needed`, `or verify`, `if missing`, `if exists`, or similar must be treated as a boolean gate, not a vague instruction.
- The agent must first write the boolean result into the relevant report or status file.
- If the boolean is `true`, the follow-up action in the step is executed.
- If the boolean is `false`, the step is recorded as a no-op or skip in the same report or status file.
- After any action, the changed file must be reopened and the exact line or symbol must be confirmed.

Practical consequence:
- The parity sections are the biggest under-expanded area.
- The current document is therefore best understood as the skeleton of the single-agent program.
- The next exacting pass on this document should expand the parity and cleanup sections into concrete microsteps with file paths, line ranges, exact insertion points, exact strings, and exact report writes.

## Middle Layer Rule

The compiler contract cannot stop at:
- source pattern in
- output bytes out

A strict execution loop also needs the semantic middle:
- what node or host was recognized
- what literals and normalized style facts were recorded
- what conditions, handlers, maps, variants, or runtime bridges were registered
- which emit sections are supposed to consume those facts

Implication:
- every expanded contract range should include `Pattern In`, `Middle Record`, and `Emit Out`
- any step that only says "compare legacy output to atom output" is still under-specified if it does not also say what semantic middle facts that slice is preserving

## Section Index

| Range | Section | Count |
|---|---|---|
| 001-020 | Loop Discipline | 20 |
| 021-050 | Workspace Scaffolding | 30 |
| 051-080 | Canonical Source Capture | 30 |
| 081-110 | Harness Scaffolding | 30 |
| 111-140 | Coverage And Live-Risk Baseline | 30 |
| 141-165 | Preamble Parity | 25 |
| 166-190 | State Tree Parity | 25 |
| 191-215 | Handlers / Effects Parity | 25 |
| 216-250 | Object Arrays Parity | 35 |
| 251-340 | Maps Zig Parity And Atom 26 | 90 |
| 341-370 | Maps Lua Parity | 30 |
| 371-410 | Logic / Runtime Parity | 40 |
| 411-458 | Entry / Split / Finalize Parity | 48 |
| 459-492 | Live Switch And Rollback | 34 |
| 493-517 | Legacy Emit Deletion | 25 |
| 518-547 | Duplicate / Global Cleanup | 30 |
| 548-587 | Structural Cleanup Foundation | 40 |
| 588-635 | Attrs Decomposition Extraction | 48 |
| 636-660 | Final Verification And Closure | 25 |

## 001-020 Loop Discipline

- [x] 1. Open this file and read the section index from top to bottom before changing any code.
- [x] 2. Create a rule for the run: never mark a step complete until the file change and the verification for that step both exist.
- [x] 3. Create a rule for the run: never use a downstream report as a substitute for re-reading the source file directly.
- [x] 4. Create a rule for the run: never batch-complete adjacent steps without re-reading each numbered line.
- [x] 5. Create a rule for the run: never edit a file that is not named by the current step unless the step explicitly permits it.
- [x] 6. Create a rule for the run: every edit must be followed by reopening the changed file and confirming the intended line is actually present.
- [x] 7. Create a rule for the run: every verification artifact must be written to disk, not held only in memory.
- [x] 8. Create a rule for the run: every blocker must be written to a blocked log with exact step id and exact reason.
- [x] 9. Create a rule for the run: every completed step must be written to a completed log with exact step id and short verification note.
- [x] 10. Create a rule for the run: if a step depends on an earlier step's artifact, open that artifact directly before proceeding.
- [x] 11. Create a rule for the run: if a step changes bundle load order, re-read `smith_LOAD_ORDER.txt` after the edit.
- [x] 12. Create a rule for the run: if a step changes emit output, rerun the smallest available parity check before moving on.
- [x] 13. Create a rule for the run: if a step changes split output, rerun split verification before moving on.
- [x] 14. Create a rule for the run: if a step changes runtime bridge code, rerun at least one Lua-map and one Zig-map fixture before moving on.
- [x] 15. Create a rule for the run: if a step changes a hub file, stop and verify that no pending unverified hub edit remains.
- [x] 16. Create a rule for the run: keep one current-step pointer on disk and update it after every successful step.
- [x] 17. Create a rule for the run: if the run stops mid-step, leave the current-step pointer unchanged.
- [x] 18. Create a rule for the run: every report file must include timestamp, step id, changed files, and verification status.
- [x] 19. Create a rule for the run: no commit is made until the section's own verification steps are satisfied, and every section-close commit message must follow `migration(single-agent): S<range> step-<nnn> <slug>`.
- [x] 20. Re-read steps 001-019 and write `loop_discipline_explicit: true|false` to `migration/control_board.md`.

## 021-050 Workspace Scaffolding

- [x] 21. Create `tsz/compiler/migration/` if it does not already exist.
- [x] 22. Create `tsz/compiler/migration/contracts/`.
- [x] 23. Create `tsz/compiler/migration/reports/`.
- [x] 24. Create `tsz/compiler/migration/reports/parity/`.
- [x] 25. Create `tsz/compiler/migration/reports/split/`.
- [x] 26. Create `tsz/compiler/migration/reports/live_risks/`.
- [x] 27. Create `tsz/compiler/migration/reports/coverage/`.
- [x] 28. Create `tsz/compiler/migration/reports/sections/`.
- [x] 29. Create `tsz/compiler/migration/state/`.
- [x] 30. Create `tsz/compiler/migration/state/completed.txt`.
- [x] 31. Create `tsz/compiler/migration/state/blocked.txt`.
- [x] 32. Create `tsz/compiler/migration/state/current_step.txt`.
- [x] 33. Write `0` to `tsz/compiler/migration/state/current_step.txt`.
- [x] 34. Create `tsz/compiler/migration/harness/`.
- [x] 35. Create `tsz/compiler/migration/harness/fixtures/`.
- [x] 36. Create `tsz/compiler/migration/harness/output/`.
- [x] 37. Create `tsz/compiler/migration/harness/output/parity/`.
- [x] 38. Create `tsz/compiler/migration/harness/output/split/`.
- [x] 39. Create `tsz/compiler/migration/harness/output/tmp/`.
- [x] 40. Create `tsz/compiler/migration/control_board.md`.
- [x] 41. Create `tsz/compiler/migration/MANIFEST.md`.
- [x] 42. Write the top-level purpose and the step-count table into `migration/MANIFEST.md`.
- [x] 43. Add a `Current Step` line to `migration/MANIFEST.md`.
- [x] 44. Add a `Blocked Steps` section to `migration/MANIFEST.md`.
- [x] 45. Add a `Completed Steps` section to `migration/MANIFEST.md`.
- [x] 46. Re-open `migration/MANIFEST.md` and write `manifest_names_proposal_as_source_of_truth: true|false` to `migration/control_board.md`.
- [x] 47. Append `021-046 scaffolded` to `migration/state/completed.txt` only after reopening all created files.
- [x] 48. Update `migration/state/current_step.txt` to `48`, then commit with message `migration(single-agent): S021-050 step-048 workspace-scaffolding`.
- [x] 49. Re-read the directory tree under `tsz/compiler/migration/` and write `all_scaffold_paths_exist: true|false` plus the full observed path list to `migration/control_board.md`.
- [x] 50. If `all_scaffold_paths_exist` is `false`, write every missing scaffold path to `blocked.txt`; if `true`, write `missing_scaffold_paths: none` to `migration/control_board.md`.

## 051-080 Canonical Source Capture

- [x] 51. Copy the current contents of `COMPILER_MANIFEST.md` into `migration/reports/canonical_manifest_snapshot.md`.
- [x] 52. Copy the current contents of `COMPILER_MANIFEST_FINAL_CUT.md` into `migration/reports/canonical_final_cut_snapshot.md`.
- [x] 53. Copy the current contents of `FRAGILE_FUNCTION_DECOMPOSITION_MAP.md` into `migration/reports/canonical_decomposition_snapshot.md`.
- [x] 54. Copy the current contents of `FRAGILE_FUNCTION_REUSE_MAP.md` into `migration/reports/canonical_reuse_snapshot.md`.
- [x] 55. Copy the current contents of `MIGRATION_AGENT_ORCHESTRATION_PLAN.md` into `migration/reports/canonical_orchestration_snapshot.md`.
- [x] 56. Record the current git status for the five planning docs into `migration/reports/canonical_git_status.txt`.
- [x] 57. Record the current date and time at the top of each canonical snapshot file.
- [x] 58. Create `migration/reports/source_index.md`.
- [x] 59. In `source_index.md`, list the canonical docs that define migration intent.
- [x] 60. In `source_index.md`, list the canonical code hubs that define current implementation state.
- [x] 61. Add `smith/emit.js` to `source_index.md`.
- [x] 62. Add `smith/emit/finalize.js` to `source_index.md`.
- [x] 63. Add `smith/emit/split.js` to `source_index.md`.
- [x] 64. Add `smith/emit_atoms/index.js` to `source_index.md`.
- [x] 65. Add `smith_LOAD_ORDER.txt` to `source_index.md`.
- [x] 66. Add `smith/emit_ops/rebuild_map.js` to `source_index.md`.
- [x] 67. Add `smith/emit_ops/transforms.js` to `source_index.md`.
- [x] 68. Add `smith/emit_ops/js_expr_to_lua.js` to `source_index.md`.
- [x] 69. Add `smith/emit_atoms/maps_lua/lua_map_subs.js` to `source_index.md`.
- [x] 70. Add `smith/attrs.js` to `source_index.md`.
- [x] 71. Add `smith/parse.js` to `source_index.md`.
- [x] 72. Add `smith/core.js` to `source_index.md`.
- [x] 73. Add `smith/parse/handlers/press.js` to `source_index.md`.
- [x] 74. Add a note in `source_index.md` that implementation intent must be read from canonical docs directly, not reconstructed from downstream reports.
- [x] 75. Re-open every canonical snapshot and write `canonical_snapshots_readable_and_complete: true|false` to `migration/control_board.md`.
- [x] 76. Re-open `source_index.md` and write `source_index_missing_hub_file: true|false` plus any missing file names to `migration/control_board.md`.
- [x] 77. Append `051-076 canonical source capture complete` to `completed.txt`.
- [x] 78. Update `current_step.txt` to `78`, then commit with message `migration(single-agent): S051-080 step-078 canonical-source-capture`.
- [x] 79. Re-read steps 051-078 and write `all_canonical_artifacts_exist: true|false` plus the checked file list to `migration/control_board.md`.
- [x] 80. If `all_canonical_artifacts_exist` is `false`, write every missing canonical artifact path to `blocked.txt`; if `true`, write `missing_canonical_artifacts: none` to `migration/control_board.md`.

## 081-110 Harness Scaffolding

- [x] 81. Create `migration/harness/parity_schema.json`.
- [x] 82. In `parity_schema.json`, define `cart_path`.
- [x] 83. In `parity_schema.json`, define `lane`.
- [x] 84. In `parity_schema.json`, define `legacy_hash`.
- [x] 85. In `parity_schema.json`, define `atom_hash`.
- [x] 86. In `parity_schema.json`, define `diff_status`.
- [x] 87. In `parity_schema.json`, define `first_diff_hunk`.
- [x] 88. In `parity_schema.json`, define `split_output`.
- [x] 89. In `parity_schema.json`, define `backend_tags`.
- [x] 90. In `parity_schema.json`, define `predicted_atoms`.
- [x] 91. In `parity_schema.json`, define `verification_time`.
- [x] 92. Create `migration/harness/run_parity.js`.
- [x] 93. In `run_parity.js`, add argument parsing for cart path.
- [x] 94. In `run_parity.js`, add argument parsing for output file path.
- [x] 95. In `run_parity.js`, add a path to invoke the legacy `emitOutput()` flow.
- [x] 96. In `run_parity.js`, add a path to invoke the atom `runEmitAtoms()` flow with shared meta.
- [x] 97. In `run_parity.js`, add string hashing for both outputs.
- [x] 98. In `run_parity.js`, add exact diff status generation.
- [x] 99. In `run_parity.js`, add first-diff-hunk capture.
- [x] 100. In `run_parity.js`, add split-output detection.
- [x] 101. In `run_parity.js`, add backend tag capture.
- [x] 102. In `run_parity.js`, add predicted atom capture if route plan is available.
- [x] 103. In `run_parity.js`, add schema-shaped JSON writing.
- [x] 104. Create `migration/harness/run_split_check.sh`.
- [x] 105. In `run_split_check.sh`, accept cart path and output directory.
- [x] 106. In `run_split_check.sh`, invoke forge in split mode.
- [x] 107. In `run_split_check.sh`, verify module files are produced.
- [x] 108. In `run_split_check.sh`, run `zig build` on the produced split output.
- [x] 109. In `run_split_check.sh`, emit a structured report into `reports/split/`.
- [x] 110. Re-open `parity_schema.json`, `run_parity.js`, and `run_split_check.sh`, write `harness_scaffold_complete: true|false` plus any missing surface names to `migration/control_board.md`, then commit with message `migration(single-agent): S081-110 step-110 harness-scaffolding`.

## 111-140 Coverage And Live-Risk Baseline

- [x] 111. Create `migration/reports/coverage/coverage_matrix.json`.
- [x] 112. Create `migration/reports/coverage/coverage_matrix.md`.
- [x] 113. Enumerate carts under `tsz/carts/conformance/` into `coverage_matrix.md`.
- [x] 114. Add lane column for each cart in `coverage_matrix.md`.
- [x] 115. Add `lua_map` column.
- [x] 116. Add `zig_map` column.
- [x] 117. Add `nested_map` column.
- [x] 118. Add `inline_map` column.
- [x] 119. Add `dyn_text` column.
- [x] 120. Add `handlers` column.
- [x] 121. Add `effects` column.
- [x] 122. Add `variants` column.
- [x] 123. Add `split_output` column.
- [x] 124. Create `migration/reports/live_risks/_jsExprToLua_collision.md`.
- [x] 125. Create `migration/reports/live_risks/evalLuaMapData_gap.md`.
- [x] 126. Create `migration/reports/live_risks/atom26_reachability.md`.
- [x] 127. Create `migration/reports/live_risks/split_finalize_handoff.md`.
- [x] 128. Search for `_jsExprToLua` definitions and write the result locations into `_jsExprToLua_collision.md`.
- [x] 129. Search `smith_LOAD_ORDER.txt` for the relative load order of `emit_ops/js_expr_to_lua.js` and `emit_atoms/maps_lua/lua_map_subs.js`.
- [x] 130. Record the likely winning `_jsExprToLua` definition in `_jsExprToLua_collision.md`.
- [x] 131. Search for `evalLuaMapData` references and write all current call sites into `evalLuaMapData_gap.md`.
- [x] 132. Search for `mapBackend` checks and write all Zig vs Lua backend branch points into `atom26_reachability.md`.
- [x] 133. Search for split handoff logic in `emit/finalize.js`, `emit/split.js`, and atoms 43-46 and summarize it in `split_finalize_handoff.md`.
- [x] 134. Re-open all four live-risk reports and write `all_live_risk_reports_have_concrete_findings: true|false` plus any empty report paths to `migration/control_board.md`.
- [x] 135. Append `111-134 coverage and live-risk baseline complete` to `completed.txt`.
- [x] 136. Update `current_step.txt` to `136`, then commit with message `migration(single-agent): S111-140 step-136 coverage-live-risk-baseline`.
- [x] 137. Re-open `coverage_matrix.md` and write `coverage_matrix_has_feature_columns_115_123: true|false` to `migration/control_board.md`.
- [x] 138. Re-open `_jsExprToLua_collision.md` and write `js_expr_to_lua_collision_names_both_files: true|false` to `migration/control_board.md`.
- [x] 139. Re-open `evalLuaMapData_gap.md` and write `eval_lua_map_data_gap_names_a003_a038_a039_a040: true|false` to `migration/control_board.md`.
- [x] 140. If any of the booleans from steps 134 and 137-139 are `false`, write the exact failing report path to `blocked.txt`; if all are `true`, write `live_risk_gate_clear: true` to `migration/control_board.md`.

## 141-165 Preamble Parity

- [ ] 141. Open `smith/emit/preamble.js`.
- [ ] 142. Open `smith/emit_atoms/preamble/a001_compile_banner.js`.
- [ ] 143. Open `smith/emit_atoms/preamble/a002_core_imports.js`.
- [ ] 144. Open `smith/emit_atoms/preamble/a003_runtime_imports.js`.
- [ ] 145. Re-read the known drift list in `ATOM_PARITY_REPORT.md` for a003 before editing.
- [ ] 146. Open a003 and write `smith_log_import_present_before_patch: true|false` to `reports/sections/preamble_status.md`.
- [ ] 147. If `smith_log_import_present_before_patch` is `false`, add the `smith_log` import to the exact legacy-equivalent branch in a003; if `true`, write `smith_log_import_patch_skipped: true` to `reports/sections/preamble_status.md`.
- [ ] 148. Re-open a003 and write `smith_log_import_present_after_patch: true|false` to `reports/sections/preamble_status.md`.
- [ ] 149. Open a003 and write `eval_lua_map_data_stub_present_before_patch: true|false` to `reports/sections/preamble_status.md`.
- [ ] 150. If `eval_lua_map_data_stub_present_before_patch` is `false`, add the `evalLuaMapData` stub to the IS_LIB fallback struct in a003; if `true`, write `eval_lua_map_data_stub_patch_skipped: true` to `reports/sections/preamble_status.md`.
- [ ] 151. Re-open a003 and write `eval_lua_map_data_stub_present_after_patch: true|false` to `reports/sections/preamble_status.md`.
- [ ] 152. Open a003 and write `a003_luajit_import_condition_matches_monolith: true|false` to `reports/sections/preamble_status.md`.
- [ ] 153. If `a003_luajit_import_condition_matches_monolith` is `false`, patch only a003 to match the monolith condition and write `a003_luajit_import_condition_patch_applied: true`; if `true`, write `a003_luajit_import_condition_patch_applied: false`.
- [ ] 154. Open a002/a003 and write `a002_a003_comptime_core_zig_order_matches_monolith: true|false` to `reports/sections/preamble_status.md`.
- [ ] 155. If `a002_a003_comptime_core_zig_order_matches_monolith` is `false`, move the line to the monolith-equivalent position and write `a002_a003_comptime_core_zig_order_patch_applied: true`; if `true`, write `a002_a003_comptime_core_zig_order_patch_applied: false`.
- [ ] 156. Run the parity harness on one cart that exercises the preamble and write the result to `reports/parity/preamble_smoke.json`.
- [ ] 157. Open `preamble_smoke.json` and verify the schema matches `parity_schema.json`.
- [ ] 158. If the preamble still drifts, record the exact diff hunk in `reports/sections/preamble_status.md`.
- [ ] 159. If the preamble matches, record `MATCH` in `reports/sections/preamble_status.md`.
- [ ] 160. Re-open `preamble_status.md` and write `preamble_status_names_exact_atom_and_monolith_files: true|false` to `migration/control_board.md`.
- [ ] 161. Append the exact changed file paths for preamble work to `completed.txt`.
- [ ] 162. Update `current_step.txt` to `162`, then commit with message `migration(single-agent): S141-165 step-162 preamble-parity`.
- [ ] 163. Re-open every changed preamble file and write `preamble_edit_scope_clean: true|false` plus any unrelated line notes to `reports/sections/preamble_status.md`.
- [ ] 164. Re-run the preamble smoke parity once more after the re-open check.
- [ ] 165. If the second preamble run does not match the first result, write the divergence to `blocked.txt` and stop.

## 166-190 State Tree Parity

- [ ] 166. Open `smith/emit/state_manifest.js`.
- [ ] 167. Open `smith/emit/node_tree.js`.
- [ ] 168. Open `smith/emit/dyn_text.js`.
- [ ] 169. Open atoms a004 through a008.
- [ ] 170. Compare a004 to `emitStateManifest()` and write `a004_matches_emitStateManifest: true|false` plus the first mismatch line if false to `reports/sections/state_tree_status.md`.
- [ ] 171. Compare a005 to `emitInitState()` and write `a005_matches_emitInitState: true|false` plus the first mismatch line if false to `reports/sections/state_tree_status.md`.
- [ ] 172. Compare a006 to the static array declaration path in `emitNodeTree()` and write `a006_matches_static_array_declarations: true|false` plus the first mismatch line if false to `reports/sections/state_tree_status.md`.
- [ ] 173. Compare a007 to the root node initialization path in `emitNodeTree()` and write `a007_matches_root_node_initialization: true|false` plus the first mismatch line if false to `reports/sections/state_tree_status.md`.
- [ ] 174. Compare a008 to `emitDynamicTextBuffers()` and write `a008_matches_emitDynamicTextBuffers: true|false` plus the first mismatch line if false to `reports/sections/state_tree_status.md`.
- [ ] 175. For any mismatch, patch the atom file rather than the monolith file.
- [ ] 176. Re-open each patched atom file after each patch.
- [ ] 177. Run parity on one state-heavy cart and write `reports/parity/state_tree_smoke.json`.
- [ ] 178. Open `state_tree_smoke.json` and inspect `diff_status`.
- [ ] 179. If `state_tree_smoke.json` reports drift, write the exact drifting atom number and first diff hunk to `reports/sections/state_tree_status.md`; if not, write `state_tree_smoke_drift: false`.
- [ ] 180. If `state_tree_smoke_drift` is `false`, write `MATCH` to `state_tree_status.md`; if `true`, write `MATCH: false`.
- [ ] 181. Re-open `state_tree_status.md` and write `state_tree_status_accounts_for_a004_a008: true|false` to `migration/control_board.md`.
- [ ] 182. Run a second state-heavy cart if the first cart did not hit dynamic text.
- [ ] 183. If dynamic text was not hit by either cart, write a coverage gap note into `coverage_matrix.md`.
- [ ] 184. Append the exact state-tree verification result paths to `completed.txt`.
- [ ] 185. Update `current_step.txt` to `185`, then commit with message `migration(single-agent): S166-190 step-185 state-tree-parity`.
- [ ] 186. Re-read steps 166-185 and write `state_tree_mismatches_fixed_in_atoms_only: true|false` to `reports/sections/state_tree_status.md`.
- [ ] 187. Re-open all changed state-tree atom files and write `state_tree_saved_changes_match_intended_mismatch: true|false` to `reports/sections/state_tree_status.md`.
- [ ] 188. Re-run the last successful state-tree parity case.
- [ ] 189. If the rerun result differs from the saved report, log it to `blocked.txt`.
- [ ] 190. Stop only if the rerun differs; otherwise continue.

## 191-215 Handlers / Effects Parity

- [ ] 191. Open `smith/emit/handlers.js`.
- [ ] 192. Open `smith/emit/effects.js`.
- [ ] 193. Open atoms a009, a010, and a011.
- [ ] 194. Compare a009 to non-map handler emission.
- [ ] 195. Compare a010 to CPU effect renderer emission.
- [ ] 196. Compare a011 to WGSL effect shader emission.
- [ ] 197. Compare the current a010/a011 output ordering to the monolith and write `a010_a011_ordering_difference_present: true|false` to `reports/sections/handlers_effects_status.md`.
- [ ] 198. Decide whether byte parity requires reordering effect output to match the monolith exactly.
- [ ] 199. If reordering is required, patch the atom files so the combined emitted order matches the monolith.
- [ ] 200. Re-open each changed effect atom file and write `effect_atom_ordering_matches_intended_patch: true|false` plus any bad line numbers to `reports/sections/handlers_effects_status.md`.
- [ ] 201. Run parity on one cart with handlers and write `reports/parity/handlers_smoke.json`.
- [ ] 202. Run parity on one cart with effects and write `reports/parity/effects_smoke.json`.
- [ ] 203. Open both reports and inspect `diff_status`.
- [ ] 204. If either drifts, write the exact mismatch to `reports/sections/handlers_effects_status.md`.
- [ ] 205. If both match, record `MATCH` for a009-a011 in `handlers_effects_status.md`.
- [ ] 206. Re-open `handlers_effects_status.md` and write `handlers_effects_status_separates_handler_and_effect_drift: true|false` to `migration/control_board.md`.
- [ ] 207. If the effects cart did not hit WGSL output, write `atom11_wgsl_coverage_gap: true` plus the cart list to `coverage_matrix.md`; if it did, write `atom11_wgsl_coverage_gap: false`.
- [ ] 208. Append the changed handler/effect file paths and report paths to `completed.txt`.
- [ ] 209. Update `current_step.txt` to `209`, then commit with message `migration(single-agent): S191-215 step-209 handlers-effects-parity`.
- [ ] 210. Re-open a009 and write `a009_contains_in_map_handler_logic: true|false` to `reports/sections/handlers_effects_status.md`.
- [ ] 211. Re-open a010 and write `a010_contains_wgsl_only_logic: true|false` to `reports/sections/handlers_effects_status.md`.
- [ ] 212. Re-open a011 and write `a011_contains_cpu_only_logic: true|false` to `reports/sections/handlers_effects_status.md`.
- [ ] 213. Re-run the last parity case that exercised both handlers and effects.
- [ ] 214. If the rerun differs, log the exact report path and changed file path to `blocked.txt`.
- [ ] 215. Write `handlers_effects_rerun_stable: true|false` to `reports/sections/handlers_effects_status.md`.

## 216-250 Object Arrays Parity

- [ ] 216. Open `smith/emit/object_arrays.js`.
- [ ] 217. Open atoms a012 through a018.
- [ ] 218. Compare a012 to the QJS bridge output in the monolith.
- [ ] 219. Compare a013 to the string helper output in the monolith.
- [ ] 220. Compare a014 to const OA storage emission.
- [ ] 221. Compare a015 to dynamic OA storage emission.
- [ ] 222. Compare a016 to flat unpack emission.
- [ ] 223. Compare a017 to nested unpack behavior.
- [ ] 224. Compare a018 to variant host setter emission.
- [ ] 225. Compare a017 to the monolith nested-unpack path and write `a017_intentional_no_op_with_logic_in_a016: true|false` to `reports/sections/object_arrays_status.md`.
- [ ] 226. Write the exact reason for the a017 result from step 225 into `reports/sections/object_arrays_status.md`.
- [ ] 227. Compare a015 and a016 output ordering to the monolith and write `oa_helper_extraction_changed_output_ordering: true|false` plus the first bad line if true to `reports/sections/object_arrays_status.md`.
- [ ] 228. If `oa_helper_extraction_changed_output_ordering` is `true`, patch the atom helper usage so emitted text matches legacy output; if `false`, write `oa_ordering_patch_skipped: true` to `reports/sections/object_arrays_status.md`.
- [ ] 229. Re-open each changed atom file and write `oa_ordering_fix_applied_cleanly: true|false` to `reports/sections/object_arrays_status.md`.
- [ ] 230. Run parity on one cart with const OA usage.
- [ ] 231. Write the report to `reports/parity/object_arrays_const.json`.
- [ ] 232. Run parity on one cart with dynamic OA usage.
- [ ] 233. Write the report to `reports/parity/object_arrays_dynamic.json`.
- [ ] 234. Run parity on one cart with nested OA usage if available.
- [ ] 235. Write the report to `reports/parity/object_arrays_nested.json`.
- [ ] 236. Open all three reports and inspect `diff_status`.
- [ ] 237. If any OA report drifts, write the exact atom id, cart, and first diff hunk to `object_arrays_status.md`; if none drift, write `oa_report_drift: false`.
- [ ] 238. If `oa_report_drift` is `false`, record `MATCH` for a012-a018; if `true`, record `MATCH: false`.
- [ ] 239. Re-open `object_arrays_status.md` and write `object_arrays_status_accounts_for_a012_a018: true|false` to `migration/control_board.md`.
- [ ] 240. If no nested OA cart exists, record `nested_oa_coverage_gap: true` in `coverage_matrix.md`; if one exists, record `nested_oa_coverage_gap: false`.
- [ ] 241. Append the exact object-array verification paths to `completed.txt`.
- [ ] 242. Update `current_step.txt` to `242`, then commit with message `migration(single-agent): S216-250 step-242 object-arrays-parity`.
- [ ] 243. Re-open a012 and write `a012_bridge_surface_matches_runtime_import_expectations: true|false` to `reports/sections/object_arrays_status.md`.
- [ ] 244. Re-open a016 and write `a016_flat_unpack_contains_expected_nested_child_handling: true|false` to `reports/sections/object_arrays_status.md`.
- [ ] 245. Re-open a018 and confirm variant host output was not altered accidentally.
- [ ] 246. Re-run the dynamic OA parity case.
- [ ] 247. Re-run the const OA parity case.
- [ ] 248. Compare rerun hashes to the saved hashes in the report files.
- [ ] 249. If either rerun hash differs, log the difference in `blocked.txt`.
- [ ] 250. Write `object_arrays_rerun_hashes_match: true|false` to `reports/sections/object_arrays_status.md`.

## 251-340 Maps Zig Parity And Atom 26

- [ ] 251. Open `smith/emit/map_pools.js`.
- [ ] 252. Open atoms a019 through a028.
- [ ] 253. Open `smith/emit_ops/rebuild_map.js`.
- [ ] 254. Open `smith/emit_ops/compute_map_meta.js`.
- [ ] 255. Open `smith/emit_ops/emit_pool_node.js`.
- [ ] 256. Open `smith/emit_ops/emit_dyn_text.js`.
- [ ] 257. Open `smith/emit_ops/emit_inner_array.js`.
- [ ] 258. Open `smith/emit_ops/emit_handler_fmt.js`.
- [ ] 259. Open `smith/emit_ops/replace_field_refs.js`.
- [ ] 260. Open `smith/emit_ops/wire_handler_ptrs.js`.
- [ ] 261. Open `smith/emit_ops/emit_lua_rebuild.js`.
- [ ] 262. Open `emit_atoms/index.js` and the load-order source and write `atom26_registered: true|false` to `reports/sections/maps_zig_status.md`.
- [ ] 263. If `atom26_registered` is `false`, record the exact missing registration point in `reports/sections/maps_zig_status.md`; if `true`, write `atom26_missing_registration_point: none`.
- [ ] 264. Open a026 and write `a026_applies_is_data_driven: true|false` to `reports/sections/maps_zig_status.md`.
- [ ] 265. If `_a026_applies` needs a meta-driven gate, patch it to use the correct feature flag or derived map predicate from `ctx._mapEmitMeta`.
- [ ] 266. Re-open a026 and confirm the applies gate reads as intended.
- [ ] 267. Open a026 and write `a026_emit_routes_to_rebuildMap_helper: true|false` to `reports/sections/maps_zig_status.md`.
- [ ] 268. If `_a026_emit` does not route correctly, patch it so the helper cluster is the active implementation and a026 is the sole top-level rebuild owner.
- [ ] 269. Re-open a026 and write `a026_helper_call_line_present_after_patch: true|false` to `reports/sections/maps_zig_status.md`.
- [ ] 270. Read the monolith `map_pools.js` body and write the exact promoted-to-per-item and map-order fields it assigns into `reports/sections/maps_zig_status.md`.
- [ ] 271. Compare a019 to map metadata output and write `a019_map_meta_fields_match_monolith: true|false` plus the first mismatch field to `reports/sections/maps_zig_status.md`.
- [ ] 272. Compare a020 to flat map pool declarations and confirm the declaration string sequence matches the monolith line-for-line.
- [ ] 273. Compare a021 to nested map pool declarations and confirm the declaration string sequence matches the monolith line-for-line.
- [ ] 274. Compare a022 to inline map pool declarations and confirm the declaration string sequence matches the monolith line-for-line.
- [ ] 275. Compare a023 to map per-item arrays and write `a023_array_names_and_ordering_match: true|false` to `reports/sections/maps_zig_status.md`.
- [ ] 276. Compare a024 to dynamic text storage and write `a024_dyn_text_storage_keys_and_order_match_monolith: true|false` plus the first mismatch key to `reports/sections/maps_zig_status.md`.
- [ ] 277. Compare a025 to map handler pointer storage and write `a025_handler_pointer_wiring_and_names_match_monolith: true|false` plus the first mismatch pointer name to `reports/sections/maps_zig_status.md`.
- [ ] 278. Compare a026 to flat map rebuild output and confirm the live path is only `rebuildMap(ctx, meta)`.
- [ ] 279. Compare a027 to nested map rebuild output and write `a027_body_is_empty_or_redirected_to_helper_cluster: true|false` to `reports/sections/maps_zig_status.md`.
- [ ] 280. Compare a028 to inline map rebuild output and write `a028_body_is_empty_or_redirected_to_helper_cluster: true|false` to `reports/sections/maps_zig_status.md`.
- [ ] 281. Open `compute_map_meta.js` and write `compute_map_meta_runs_before_all_promoted_to_per_item_consumers: true|false` to `reports/sections/maps_zig_status.md`.
- [ ] 282. If `compute_map_meta.js` timing is wrong relative to meta construction, record the exact ordering gap in `maps_zig_status.md` before editing.
- [ ] 283. Patch the meta construction path only after the timing issue is written down explicitly and `buildEmitMeta()` can pass the same meta object to all consumers.
- [ ] 284. Search carts for flat Zig-backed map usage and record exact cart paths in `atom26_reachability.md`.
- [ ] 285. Search carts for nested Zig-backed map usage and record exact cart paths in `atom26_reachability.md`.
- [ ] 286. Search carts for inline Zig-backed map usage and record exact cart paths in `atom26_reachability.md`.
- [ ] 287. Search carts for map handlers in Zig-backed maps and record exact cart paths in `atom26_reachability.md`.
- [ ] 288. Search carts for dynamic text in Zig-backed maps and record exact cart paths in `atom26_reachability.md`.
- [ ] 289. Run parity on one flat Zig-map cart and write `reports/parity/maps_zig_flat.json`.
- [ ] 290. Run parity on one nested Zig-map cart if available and write `reports/parity/maps_zig_nested.json`.
- [ ] 291. Run parity on one inline Zig-map cart if available and write `reports/parity/maps_zig_inline.json`.
- [ ] 292. Open the parity reports and inspect `diff_status`.
- [ ] 293. If no suitable cart exists for one Zig map subtype, record that subtype as uncovered in `coverage_matrix.md`; if a cart exists, write `zig_map_subtype_coverage_gap_<subtype>: false`.
- [ ] 294. If flat Zig-map parity drifts, isolate whether the drift is in metadata, declaration, or rebuild output.
- [ ] 295. Write the isolated drift category into `maps_zig_status.md`.
- [ ] 296. If the drift is metadata, patch a019 or the compute-map-meta path.
- [ ] 297. If the drift is declaration output, patch only the atom files explicitly named in the mismatch notes from `maps_zig_status.md` and write `declaration_drift_patch_targets_recorded: true`; if the drift is not declaration output, write `declaration_drift_patch_targets_recorded: false`.
- [ ] 298. If the drift is rebuild output, patch a026 or the helper cluster.
- [ ] 299. Re-open every changed map atom file after each patch and confirm the exact changed lines.
- [ ] 300. Re-open every changed helper file after each patch and confirm the exact changed lines.
- [ ] 301. Re-run flat Zig-map parity after every rebuild-cluster change.
- [ ] 302. If nested or inline parity drifts remain, patch a027 and a028 only after the flat path stabilizes.
- [ ] 303. Re-run nested Zig-map parity after any a027 change.
- [ ] 304. Re-run inline Zig-map parity after any a028 change.
- [ ] 305. Update `maps_zig_status.md` with exact final drift status for a019-a028 and the helper cluster.
- [ ] 306. Append all changed maps-zig file paths and report paths to `completed.txt`.
- [ ] 307. Update `current_step.txt` to `307`, then commit with message `migration(single-agent): S251-340 step-307 maps-zig-parity`.
- [ ] 308. Re-open a026, `rebuild_map.js`, and `compute_map_meta.js` together and write `atom26_active_path_coherent: true|false` to `reports/sections/maps_zig_status.md`.
- [ ] 309. Re-open `atom26_reachability.md` and write `atom26_reachability_records_real_path_or_explicit_absence: true|false` to `reports/sections/maps_zig_status.md`.
- [ ] 310. Re-run the strongest available flat Zig-map parity case one final time and log the saved hash pair.
- [ ] 311. Read the a019 body and note the exact shape of `ctx._mapEmitMeta`.
- [ ] 312. Read the monolith map metadata body and note the exact promoted and ordering fields it produces.
- [ ] 313. Compare the a019 field names to the monolith field names one by one.
- [ ] 314. If a019 is missing a field, patch only a019 and write `a019_field_patch_applied: true`; if not, write `a019_field_patch_applied: false`.
- [ ] 315. Read the a020 body and note the exact declaration strings it emits.
- [ ] 316. Read the monolith flat declaration body and note the exact declaration order.
- [ ] 317. Compare a020 declaration text to the monolith declaration text line by line.
- [ ] 318. If a020 diverges, patch only a020 and re-open it immediately after the patch.
- [ ] 319. Read the a021 body and note the exact nested declaration strings it emits.
- [ ] 320. Read the monolith nested declaration body and note the exact declaration order.
- [ ] 321. Compare a021 declaration text to the monolith declaration text line by line.
- [ ] 322. If a021 diverges, patch only a021 and re-open it immediately after the patch.
- [ ] 323. Read the a022 body and note the exact inline declaration strings it emits.
- [ ] 324. Read the monolith inline declaration body and note the exact declaration order.
- [ ] 325. Compare a022 declaration text to the monolith declaration text line by line.
- [ ] 326. If a022 diverges, patch only a022 and re-open it immediately after the patch.
- [ ] 327. Read the a023 body and note the exact per-item array names it emits.
- [ ] 328. Read the monolith per-item array body and note the exact array order.
- [ ] 329. Compare a023 array names to the monolith array names one by one.
- [ ] 330. If a023 diverges, patch only a023 and re-open it immediately after the patch.
- [ ] 331. Read the a024 body and note the exact dynamic-text storage keys it emits.
- [ ] 332. Read the monolith dynamic-text storage body and note the exact key order.
- [ ] 333. Compare a024 storage keys to the monolith storage keys one by one.
- [ ] 334. If a024 diverges, patch only a024 and re-open it immediately after the patch.
- [ ] 335. Read the a025 body and note the exact handler pointer wiring it emits.
- [ ] 336. Read the monolith handler-pointer body and note the exact pointer order.
- [ ] 337. Compare a025 pointer wiring to the monolith wiring one by one.
- [ ] 338. If a025 diverges, patch only a025 and re-open it immediately after the patch.
- [ ] 339. Read the a026 body and note the exact `rebuildMap(ctx, meta)` call shape.
- [ ] 340. Compare the a026 call shape to the helper call shape in `rebuild_map.js` and record the result.

## 341-370 Maps Lua Parity

- [ ] 341. Open `smith/emit/lua_maps.js` if present or the monolith call sites that feed Lua map logic.
- [ ] 342. Open atoms a029 through a032.
- [ ] 343. Open `smith/emit_atoms/maps_lua/lua_map_node.js`.
- [ ] 344. Open `smith/emit_atoms/maps_lua/lua_map_style.js`.
- [ ] 345. Open `smith/emit_atoms/maps_lua/lua_map_text.js`.
- [ ] 346. Open `smith/emit_atoms/maps_lua/lua_map_handler.js`.
- [ ] 347. Open `smith/emit_atoms/maps_lua/lua_map_subs.js`.
- [ ] 348. Open `smith/emit_atoms/maps_lua/lua_expr.js`.
- [ ] 349. Re-open `smith/compiler/smith/preflight/pattern_atoms.js` and write `has_lua_maps_maps_to_atoms_29_32: true|false` to `reports/sections/maps_lua_status.md`.
- [ ] 350. Compare a029 to Lua wrapper registration behavior and record the exact wrapper names and emitted registration order.
- [ ] 351. Open a029 and write `a029_nodes_prefix_conditional_mismatch_present: true|false` to `reports/sections/maps_lua_status.md`.
- [ ] 352. If the `nodes.` prefix mismatch remains, patch a029 to match monolith split vs monolith behavior exactly.
- [ ] 353. Re-open a029 and write `a029_conditional_path_explicit_and_nodes_branch_non_inferred: true|false` to `reports/sections/maps_lua_status.md`.
- [ ] 354. Compare a030 to Lua rebuilder function emission and write `a030_per_map_function_names_unchanged: true|false` to `reports/sections/maps_lua_status.md`.
- [ ] 355. Compare a031 to nested Lua helper emission and write `a031_helper_names_and_call_graph_unchanged: true|false` to `reports/sections/maps_lua_status.md`.
- [ ] 356. Compare a032 to Lua master dispatch emission and write `a032_dispatch_and_registration_order_unchanged: true|false` to `reports/sections/maps_lua_status.md`.
- [ ] 357. Read the a029 wrapper registry body and note the exact wrapper names before patching.
- [ ] 358. Read the monolith Lua wrapper registry body and note the exact wrapper names and conditional branches.
- [ ] 359. Compare a029 wrapper names and conditions to the monolith body line by line.
- [ ] 360. If a029 diverges, patch only a029 and re-open it immediately after the patch.
- [ ] 361. Read the a030 rebuilder body and note the exact per-map function names.
- [ ] 362. Read the monolith Lua rebuilder body and note the exact per-map function names and order.
- [ ] 363. Compare a030 function names and order to the monolith body line by line.
- [ ] 364. If a030 diverges, patch only a030 and re-open it immediately after the patch.
- [ ] 365. Read the a031 nested helper body and note the exact helper names.
- [ ] 366. Read the monolith nested helper body and note the exact helper names and call graph.
- [ ] 367. Compare a031 helper names and call graph to the monolith body line by line.
- [ ] 368. If a031 diverges, patch only a031 and re-open it immediately after the patch.
- [ ] 369. Read the a032 master dispatch body and note the exact dispatch order.
- [ ] 370. Read the monolith master dispatch body and note the exact registration order and dispatch order, then commit with message `migration(single-agent): S341-370 step-370 maps-lua-parity`.

## 371-410 Logic / Runtime Parity

- [ ] 371. Open `smith/emit/logic_blocks.js`.
- [ ] 372. Open `smith/emit/runtime_updates.js`.
- [ ] 373. Open atoms a033 through a038.
- [ ] 374. Re-read `ATOM_PARITY_REPORT.md` for a033, a034, and a038 before editing.
- [ ] 375. Open `logic_blocks.js` at the a033 emission function.
- [ ] 376. Read the exact a033 function body and note whether it returns an empty string, a stub, or a real body.
- [ ] 377. Open the monolith `logic_blocks.js` equivalent function and read the exact JS_LOGIC emission body.
- [ ] 378. Write the exact a033 versus monolith comparison to `reports/sections/logic_runtime_status.md`.
- [ ] 379. If a033 is a stub, patch only the a033 file so it emits the same JS_LOGIC body as the monolith.
- [ ] 380. Re-open a033 and write `a033_body_is_non_stub_after_patch: true|false` to `reports/sections/logic_runtime_status.md`.
- [ ] 381. Open `runtime_updates.js` at the a034 emission function.
- [ ] 382. Read the exact a034 function body and note whether it returns an empty string, a stub, or a real body.
- [ ] 383. Open the monolith `runtime_updates.js` equivalent function and read the exact LUA_LOGIC emission body.
- [ ] 384. Write the exact a034 versus monolith comparison to `reports/sections/logic_runtime_status.md`.
- [ ] 385. If a034 is a stub, patch only the a034 file so it emits the same LUA_LOGIC body as the monolith.
- [ ] 386. Re-open a034 and write `a034_body_is_non_stub_after_patch: true|false` to `reports/sections/logic_runtime_status.md`.
- [ ] 387. Open a035 and read the exact dynamic text update emission body.
- [ ] 388. Open the monolith dynamic text update path and compare the output ordering and helper calls line by line.
- [ ] 389. Write the exact a035 comparison result to `reports/sections/logic_runtime_status.md`.
- [ ] 390. Open a036 and read the exact conditional update emission body.
- [ ] 391. Open the monolith conditional update path and compare the output ordering and helper calls line by line.
- [ ] 392. Write the exact a036 comparison result to `reports/sections/logic_runtime_status.md`.
- [ ] 393. Open a037 and read the exact variant update emission body.
- [ ] 394. Open the monolith variant update path and compare the output ordering and helper calls line by line.
- [ ] 395. Write the exact a037 comparison result to `reports/sections/logic_runtime_status.md`.
- [ ] 396. Open a038 and read the exact dirty-tick body.
- [ ] 397. Read the monolith dirty-tick path and locate the `evalLuaMapData()` call sequence.
- [ ] 398. If a038 lacks the `evalLuaMapData()` bridge, patch only a038 to emit the same call sequence as the monolith.
- [ ] 399. Re-open a038 and write `a038_evalLuaMapData_calls_present_in_right_order: true|false` to `reports/sections/logic_runtime_status.md`.
- [ ] 400. Run parity on one cart with JS logic and write `reports/parity/logic_js.json`.
- [ ] 401. Run parity on one cart with Lua logic and write `reports/parity/logic_lua.json`.
- [ ] 402. Run parity on one cart with Lua-runtime maps and dirty tick behavior and write `reports/parity/runtime_dirty_tick.json`.
- [ ] 403. Open `logic_js.json` and inspect `diff_status`.
- [ ] 404. Open `logic_lua.json` and inspect `diff_status`.
- [ ] 405. Open `runtime_dirty_tick.json` and inspect `diff_status`.
- [ ] 406. If any logic/runtime report drifts, write the exact first diff hunk and atom id to `reports/sections/logic_runtime_status.md`; if none drift, write `logic_runtime_report_drift: false`.
- [ ] 407. If `logic_runtime_report_drift` is `false`, record `MATCH` for a033-a038 in `logic_runtime_status.md`; if `true`, record `MATCH: false`.
- [ ] 408. Re-open `logic_runtime_status.md` and write `logic_runtime_status_accounts_for_a033_a038: true|false` to `migration/control_board.md`.
- [ ] 409. Re-run the three logic/runtime parity cases after any patch and compare saved hashes to rerun hashes.
- [ ] 410. Write `logic_runtime_rerun_hashes_stable_and_report_paths_recorded: true|false` to `reports/sections/logic_runtime_status.md`, then commit with message `migration(single-agent): S371-410 step-410 logic-runtime-parity`.

## 411-458 Entry / Split / Finalize Parity

- [ ] 411. Open `smith/emit/entrypoints.js`.
- [ ] 412. Open `smith/emit/split.js`.
- [ ] 413. Open `smith/emit/finalize.js`.
- [ ] 414. Open atoms a039 through a046.
- [ ] 415. Re-read `ATOM_PARITY_REPORT.md` entries for a039, a040, and a046 before editing.
- [ ] 416. Read the a039 body in `entrypoints.js` and note the exact lines that register the host and initial Lua map rebuild.
- [ ] 417. Read the monolith `entrypoints.js` body and note the exact host registration and rebuild lines.
- [ ] 418. If a039 is missing either line, patch only the a039 file so the emitted lines match the monolith order exactly; if not, write `a039_host_registration_patch_applied: false` to `reports/sections/entry_split_status.md`.
- [ ] 419. Re-open a039 and write `a039_host_registration_and_initial_rebuild_present: true|false` to `reports/sections/entry_split_status.md`.
- [ ] 420. Read the a040 body in `entrypoints.js` and note the exact `evalLuaMapData()` calls and surrounding condition.
- [ ] 421. Read the monolith `entrypoints.js` body and note the exact `evalLuaMapData()` call sequence.
- [ ] 422. If a040 is missing the data bridge, patch only a040 so it emits the same `evalLuaMapData()` calls as the monolith; if not, write `a040_data_bridge_patch_applied: false` to `reports/sections/entry_split_status.md`.
- [ ] 423. Re-open a040 and write `a040_data_bridge_calls_present: true|false` to `reports/sections/entry_split_status.md`.
- [ ] 424. Read the a041 body and write the exact exported symbols to `entry_split_status.md`.
- [ ] 425. Read the monolith exports body and compare each symbol name and order against a041.
- [ ] 426. Re-open a041 and write `a041_exported_symbol_list_unchanged_after_comparison: true|false` to `reports/sections/entry_split_status.md`.
- [ ] 427. Read the a042 body and write the exact scaffold lines to `entry_split_status.md`.
- [ ] 428. Read the monolith main scaffold and compare its scaffold lines against a042.
- [ ] 429. Re-open a042 and write `a042_scaffold_lines_still_match_after_comparison: true|false` to `reports/sections/entry_split_status.md`.
- [ ] 430. Read the a043 body and write the exact split section-extraction lines to `entry_split_status.md`.
- [ ] 431. Read the monolith split extraction body and compare its section boundaries against a043.
- [ ] 432. Re-open a043 and write `a043_section_boundaries_unchanged_after_comparison: true|false` to `reports/sections/entry_split_status.md`.
- [ ] 433. Read the a044 body and write the exact namespace prefix lines to `entry_split_status.md`.
- [ ] 434. Read the monolith namespace prefix body and compare its prefix logic against a044.
- [ ] 435. Re-open a044 and write `a044_prefix_logic_remains_intact_after_comparison: true|false` to `reports/sections/entry_split_status.md`.
- [ ] 436. Read the a045 body and write the exact module header lines to `entry_split_status.md`.
- [ ] 437. Read the monolith module header body and compare its header order against a045.
- [ ] 438. Re-open a045 and write `a045_header_order_remains_intact_after_comparison: true|false` to `reports/sections/entry_split_status.md`.
- [ ] 439. Read the a046 body and write the exact finalize postpass and split handoff lines to `entry_split_status.md`.
- [ ] 440. Read the monolith finalize body and compare its handoff condition against a046.
- [ ] 441. If the a046 calling convention or handoff behavior is ambiguous, write the exact ambiguity to `reports/sections/entry_split_status.md` before patching.
- [ ] 442. Patch a046 only after the ambiguity is written down explicitly.
- [ ] 443. Re-open a046 and confirm the final handoff logic matches `emit/finalize.js`.
- [ ] 444. Run parity on one cart with entry/runtime behavior and write `reports/parity/entry_smoke.json`.
- [ ] 445. Run split verification on one cart and write `reports/split/split_smoke.md`.
- [ ] 446. Open `entry_smoke.json` and inspect `diff_status`.
- [ ] 447. Open `split_smoke.md` and inspect whether split modules were produced and built successfully.
- [ ] 448. If entry or split still drift, record exact file, atom, and first diff hunk in `entry_split_status.md`.
- [ ] 449. If entry and split match, record `MATCH` for a039-a046.
- [ ] 450. Re-open `entry_split_status.md` and write `entry_split_status_represents_all_atoms_a039_a046: true|false` to `migration/control_board.md`; then append the changed entry/split file paths and report paths to `completed.txt`.
- [ ] 451. Update `current_step.txt` to `451`, then commit with message `migration(single-agent): S411-458 step-451 entry-split-finalize-parity`.
- [ ] 452. Re-open a039 and confirm no Lua-backend map is incorrectly rebuilt by Zig init code.
- [ ] 453. Re-open a040 and write `a040_dirty_tick_respects_state_gating: true|false` to `reports/sections/entry_split_status.md`.
- [ ] 454. Re-open a046 and write `a046_split_handoff_delegates_to_splitOutput_when_splitOutput_eq_1: true|false` to `reports/sections/entry_split_status.md`.
- [ ] 455. Re-run the split smoke case one final time.
- [ ] 456. Compare the rerun report hash to the saved report hash and record both values in `entry_split_status.md`.
- [ ] 457. If the rerun split case differs from the saved report, write the exact difference to `blocked.txt`.
- [ ] 458. Write `entry_split_rerun_stable: true|false` to `reports/sections/entry_split_status.md`; if `false`, write `entry_split_rerun_stable: false` to `blocked.txt` and stop.

## 459-492 Live Switch And Rollback

- [ ] 459. Open `smith/emit.js` and locate the live meta assembly block.
- [ ] 460. Read the meta assembly block and list the exact fields it assigns.
- [ ] 461. Extract that block into a helper named `buildEmitMeta()` if it is still inline.
- [ ] 462. Re-open `emit.js` and write `buildEmitMeta_exists_as_named_helper: true|false` to `reports/sections/rollback_plan.md`.
- [ ] 463. Verify `buildEmitMeta()` computes `basename`.
- [ ] 464. Verify `buildEmitMeta()` computes `pfLane`.
- [ ] 465. Verify `buildEmitMeta()` computes `prefix`.
- [ ] 466. Verify `buildEmitMeta()` computes `hasState`.
- [ ] 467. Verify `buildEmitMeta()` computes `hasDynText`.
- [ ] 468. Verify `buildEmitMeta()` computes `fastBuild`.
- [ ] 469. Verify `buildEmitMeta()` computes `hasScriptRuntime`.
- [ ] 470. Verify `buildEmitMeta()` computes `rootExpr`.
- [ ] 471. Verify `buildEmitMeta()` computes `promotedToPerItem`.
- [ ] 472. Verify `buildEmitMeta()` computes `hasConds`.
- [ ] 473. Verify `buildEmitMeta()` computes `hasVariants`.
- [ ] 474. Verify `buildEmitMeta()` computes `hasDynStyles`.
- [ ] 475. Verify `buildEmitMeta()` computes `hasFlatMaps` and write `buildEmitMeta_has_flat_maps_feature_flag: true|false` to `reports/sections/rollback_plan.md`.
- [ ] 476. Re-open `emit.js` and write `non_lua_tree_path_calls_legacy_orchestration_before_switch: true|false` to `reports/sections/rollback_plan.md`.
- [ ] 477. Patch the non-lua-tree path in `emit.js` to call `runEmitAtoms(ctx, meta)` instead of the legacy orchestration only after the prior parity sections are green.
- [ ] 478. Re-open `emit.js` and write `emit_js_switch_line_present: true|false` to `reports/sections/rollback_plan.md`.
- [ ] 479. Verify that the lua-tree special case still short-circuits to `emitLuaTreeApp()`.
- [ ] 480. Re-open `emit.js` and write `lua_tree_path_returns_through_finalizeEmitOutput: true|false` to `reports/sections/rollback_plan.md`.
- [ ] 481. Open `smith_LOAD_ORDER.txt` and locate the legacy emit bundle entries.
- [ ] 482. Comment out the legacy emit bundle entries if the rollback plan says "loadable but not loaded" rather than deleted.
- [ ] 483. Re-open `smith_LOAD_ORDER.txt` and confirm the intended load entries are commented rather than removed.
- [ ] 484. Create `migration/reports/rollback_plan.md` if it does not already exist.
- [ ] 485. Record exactly how to re-enable the legacy path in `rollback_plan.md`.
- [ ] 486. Run one broad parity case after the switch and write `reports/parity/post_switch_smoke.json`.
- [ ] 487. Run one split-output case after the switch and write `reports/split/post_switch_smoke.md`.
- [ ] 488. Open both reports and write `post_switch_reports_match_expected_output: true|false` to `reports/sections/rollback_plan.md`.
- [ ] 489. Append changed switch/rollback file paths and report paths to `completed.txt`.
- [ ] 490. Update `current_step.txt` to `490`, then commit with message `migration(single-agent): S459-492 step-490 live-switch-rollback`.
- [ ] 491. Re-open `rollback_plan.md` and write `rollback_plan_describes_reversible_change_not_reconstruction: true|false` to `migration/control_board.md`.
- [ ] 492. If either post-switch smoke check fails, write the exact failure artifact path to `blocked.txt` and stop.

## 493-517 Legacy Emit Deletion

- [ ] 493. Re-open `rollback_plan.md` and write `rollback_posture_documented_before_deletion: true|false` to `reports/sections/legacy_emit_deletion_status.md`.
- [ ] 494. Open `smith/emit/preamble.js`.
- [ ] 495. Open `smith/emit/state_manifest.js`.
- [ ] 496. Open `smith/emit/node_tree.js`.
- [ ] 497. Open `smith/emit/dyn_text.js`.
- [ ] 498. Open `smith/emit/handlers.js`.
- [ ] 499. Open `smith/emit/effects.js`.
- [ ] 500. Open `smith/emit/object_arrays.js`.
- [ ] 501. Open `smith/emit/map_pools.js`.
- [ ] 502. Open `smith/emit/logic_blocks.js`.
- [ ] 503. Open `smith/emit/runtime_updates.js`.
- [ ] 504. Open `smith/emit/entrypoints.js`.
- [ ] 505. Verify each of the files from steps 494-504 is now unreachable from the live path and write `legacy_emit_files_unreachable_check_complete: true|false` to `reports/sections/legacy_emit_deletion_status.md`.
- [ ] 506. If any file is still live, record the exact import or load-order path in `blocked.txt`; if all are dead, write `legacy_emit_orchestration_unreachable: true` to `reports/sections/legacy_emit_deletion_status.md`.
- [ ] 507. Remove or archive the now-dead orchestration files only after confirming they are unreachable.
- [ ] 508. Keep `emit/transforms.js`, `emit/effect_transpile.js`, `emit/effect_wgsl.js`, `emit/lua_tree_emit.js`, `emit/split.js`, and `emit/finalize.js`.
- [ ] 509. Re-open the kept files and confirm they were not deleted by a broad cleanup.
- [ ] 510. Run one full smoke build after legacy deletion.
- [ ] 511. Write the result to `reports/sections/legacy_emit_deletion_status.md`.
- [ ] 512. Open `legacy_emit_deletion_status.md` and write `legacy_emit_deletion_status_names_deleted_and_kept_files: true|false` to `migration/control_board.md`.
- [ ] 513. Append deletion file paths and smoke report path to `completed.txt`.
- [ ] 514. Update `current_step.txt` to `514`, then commit with message `migration(single-agent): S493-517 step-514 legacy-emit-deletion`.
- [ ] 515. Re-open `emit.js` and confirm it no longer depends on any deleted emit orchestration file.
- [ ] 516. Re-open `smith_LOAD_ORDER.txt` and confirm deleted files are no longer loaded.
- [ ] 517. If any deleted file name still appears in load order or live imports, write it to `blocked.txt`; if none appear, write `deleted_emit_files_absent_from_load_order_and_live_imports: true` to `reports/sections/legacy_emit_deletion_status.md`.

## 518-547 Duplicate / Global Cleanup

- [ ] 518. Open `smith/emit_ops/effect_transpile.js`.
- [ ] 519. Open `smith/emit/effect_transpile.js`.
- [ ] 520. Compare the two effect transpile files and write `effect_transpile_duplicate_has_canonical_winner: true|false` plus the winner path to `reports/sections/duplicate_cleanup_status.md`.
- [ ] 521. Keep the canonical copy and mark the duplicate for deletion in `reports/sections/duplicate_cleanup_status.md`.
- [ ] 522. Open `smith/emit_ops/effect_wgsl.js`.
- [ ] 523. Open `smith/emit/effect_wgsl.js`.
- [ ] 524. Compare the two WGSL files and write `effect_wgsl_duplicate_has_canonical_winner: true|false` plus the winner path to `reports/sections/duplicate_cleanup_status.md`.
- [ ] 525. Keep the canonical copy and mark the duplicate for deletion.
- [ ] 526. Open `smith/emit_ops/transforms.js`.
- [ ] 527. Open `smith/emit/transforms.js`.
- [ ] 528. Compare the two transform files line by line and write `transforms_duplicate_emit_version_is_superset: true|false` to `reports/sections/duplicate_cleanup_status.md`.
- [ ] 529. If `transforms_duplicate_emit_version_is_superset` is `true`, mark `emit_ops/transforms.js` for deletion; if `false`, write `emit_ops_transforms_deletion_marked: false` to `reports/sections/duplicate_cleanup_status.md`.
- [ ] 530. Open `smith/emit_ops/js_expr_to_lua.js`.
- [ ] 531. Open `smith/emit_atoms/maps_lua/lua_map_subs.js`.
- [ ] 532. Compare `_jsExprToLua` signatures and behaviors directly and write `js_expr_to_lua_canonical_winner_exists: true|false` to `reports/sections/duplicate_cleanup_status.md`.
- [ ] 533. Record the winner and exact reason in `_jsExprToLua_collision.md`.
- [ ] 534. If `lua_map_subs.js` is the superset, delete `emit_ops/js_expr_to_lua.js`.
- [ ] 535. If `js_expr_to_lua.js` has required logic missing from `lua_map_subs.js`, port the missing behavior into the kept copy first; if not, write `js_expr_to_lua_porting_skipped: true` to `reports/sections/duplicate_cleanup_status.md`.
- [ ] 536. Re-open the kept `_jsExprToLua` file and write `kept_jsExprToLua_signature_and_behavior_match_expected_contract: true|false` to `reports/sections/duplicate_cleanup_status.md`.
- [ ] 537. Re-open `smith_LOAD_ORDER.txt` and write `only_kept_jsExprToLua_definition_remains_in_active_load_path: true|false` to `reports/sections/duplicate_cleanup_status.md`.
- [ ] 538. Run one Lua-map parity case after `_jsExprToLua` cleanup.
- [ ] 539. Write the result to `reports/parity/js_expr_to_lua_post_cleanup.json`.
- [ ] 540. Open that report and inspect `diff_status`.
- [ ] 541. If the cleanup regressed Lua maps, record the exact diff hunk in `duplicate_cleanup_status.md`.
- [ ] 542. If the cleanup is stable, record `MATCH` in `duplicate_cleanup_status.md`.
- [ ] 543. Append duplicate-cleanup file paths and report paths to `completed.txt`.
- [ ] 544. Update `current_step.txt` to `544`, then commit with message `migration(single-agent): S518-547 step-544 duplicate-global-cleanup`.
- [ ] 545. Re-open `duplicate_cleanup_status.md` and confirm all duplicate pairs are named explicitly.
- [ ] 546. Re-run the Lua-map parity case one final time.
- [ ] 547. If the rerun differs from the saved report, write the exact divergence to `blocked.txt` and stop.

## 548-587 Structural Cleanup Foundation

- [ ] 548. Create `reports/sections/structural_cleanup_status.md`.
- [ ] 549. Re-open `FRAGILE_FUNCTION_REUSE_MAP.md`.
- [ ] 550. Re-open `FRAGILE_FUNCTION_DECOMPOSITION_MAP.md`.
- [ ] 551. Re-open `COMPILER_MANIFEST_FINAL_CUT.md`.
- [ ] 552. Read the existing shared-resolution notes and write the exact function/file pairs into `reports/sections/resolve_contract.md`.
- [ ] 553. Read the existing shared-style notes and write the exact function/file pairs into `reports/sections/style_contract.md`.
- [ ] 554. Read the existing shared-handler notes and write the exact function/file pairs into `reports/sections/handler_contract.md`.
- [ ] 555. Read the existing runtime-eval notes and write the exact function/file pairs into `reports/sections/eval_contract.md`.
- [ ] 556. Create `smith/resolve/const_oa.js` if it does not already exist.
- [ ] 557. Create `smith/resolve/state_access.js` if it does not already exist.
- [ ] 558. Open `core.js` and locate `resolveConstOaAccess`.
- [ ] 559. Move `resolveConstOaAccess` from `core.js` to `resolve/const_oa.js`; if it is already there, write `resolveConstOaAccess_move_skipped_already_present: true` to `reports/sections/structural_cleanup_status.md`.
- [ ] 560. Open `core.js` and locate `resolveConstOaFieldFromRef`.
- [ ] 561. Move `resolveConstOaFieldFromRef` from `core.js` to `resolve/const_oa.js`; if it is already there, write `resolveConstOaFieldFromRef_move_skipped_already_present: true` to `reports/sections/structural_cleanup_status.md`.
- [ ] 562. Open `core.js` and locate `tryResolveObjectStateAccess`.
- [ ] 563. Move `tryResolveObjectStateAccess` from `core.js` to `resolve/state_access.js`; if it is already there, write `tryResolveObjectStateAccess_move_skipped_already_present: true` to `reports/sections/structural_cleanup_status.md`.
- [ ] 564. Re-open `core.js` and confirm only the intended exports remain.
- [ ] 565. Create `smith/parse/cursor.js` if it does not already exist.
- [ ] 566. Open `parse/utils.js` and locate the cursor helpers.
- [ ] 567. Open `parse/children/brace_util.js` and locate the remaining cursor helpers.
- [ ] 568. Move `parse/utils.js` and `parse/children/brace_util.js` helpers into `parse/cursor.js`; if the move already exists, write `cursor_helper_move_skipped_already_present: true` to `reports/sections/cursor_consolidation_status.md`.
- [ ] 569. Re-open `parse/cursor.js` and confirm the combined helper surface is explicit.
- [ ] 570. Update imports in consumer files that used `parse/utils.js` or `brace_util.js`.
- [ ] 571. Re-open each changed consumer file after updating imports.
- [ ] 572. Create `reports/sections/cursor_consolidation_status.md`.
- [ ] 573. Record the exact moved helpers in `cursor_consolidation_status.md`.
- [ ] 574. Run one parser smoke build after the resolve and cursor moves.
- [ ] 575. Write the result to `reports/parity/structural_foundation_smoke.json`.
- [ ] 576. Open the smoke report and inspect `diff_status`.
- [ ] 577. If the structural foundation smoke drifts, write the exact first diff hunk to `structural_cleanup_status.md`.
- [ ] 578. If it matches, record `MATCH` for the foundation moves.
- [ ] 579. Append changed resolve/cursor file paths and report paths to `completed.txt`.
- [ ] 580. Update `current_step.txt` to `580`, then commit with message `migration(single-agent): S548-587 step-580 structural-cleanup-foundation`.
- [ ] 581. Re-open `resolve_contract.md`, `style_contract.md`, `handler_contract.md`, and `eval_contract.md`.
- [ ] 582. Confirm each contract file names exact functions and exact owning files.
- [ ] 583. Re-open `structural_cleanup_status.md` and confirm the foundation moves are all represented.
- [ ] 584. Re-run the parser smoke build one final time.
- [ ] 585. If the rerun differs, write the exact report path and changed file path to `blocked.txt`.
- [ ] 586. Re-read steps 548-585 and write `shared_surface_documents_written_before_broad_decomposition_started: true|false` to `reports/sections/structural_cleanup_status.md`.
- [ ] 587. Write `foundation_smoke_stable: true|false` to `reports/sections/structural_cleanup_status.md`.

## 588-635 Attrs Decomposition Extraction

- [ ] 588. Create `smith/parse/attrs/` if it does not already exist.
- [ ] 589. Create `smith/parse/attrs/color.js`.
- [ ] 590. Move `parseColor` from `attrs.js` into `parse/attrs/color.js`.
- [ ] 591. Re-open `color.js` and write `parseColor_moved_cleanly: true|false` to `reports/sections/final_status.md`.
- [ ] 592. Create `smith/parse/attrs/style_value.js`.
- [ ] 593. Move `parseStyleValue` into `style_value.js`.
- [ ] 594. Re-open `style_value.js` and write `parseStyleValue_moved_cleanly: true|false` to `reports/sections/final_status.md`.
- [ ] 595. Create `smith/parse/attrs/style_block.js`.
- [ ] 596. Move `parseStyleBlock` into `style_block.js`.
- [ ] 597. Re-open `style_block.js` and write `parseStyleBlock_moved_cleanly: true|false` to `reports/sections/final_status.md`.
- [ ] 598. Create `smith/parse/attrs/style_ternary.js`.
- [ ] 599. Move `parseTernaryBranch` into `style_ternary.js`.
- [ ] 600. Re-open `style_ternary.js` and write `parseTernaryBranch_moved_cleanly: true|false` to `reports/sections/final_status.md`.
- [ ] 601. Create `smith/parse/attrs/style_normalize.js`.
- [ ] 602. Move `_normalizeStyleExprJs` and `_styleExprQuote` into `style_normalize.js`.
- [ ] 603. Re-open `style_normalize.js` and write `style_normalize_contains_both_helpers: true|false` to `reports/sections/final_status.md`.
- [ ] 604. Create `smith/parse/attrs/style_expr_tokenizer.js`.
- [ ] 605. Move `_readStyleAttrExpressionRaw`, `_tokenizeStyleExpr`, and `_makeStyleTokenStream` into `style_expr_tokenizer.js`.
- [ ] 606. Re-open `style_expr_tokenizer.js` and write `style_expr_tokenizer_contains_three_helpers: true|false` to `reports/sections/final_status.md`.
- [ ] 607. Create `smith/parse/attrs/style_expr_tokens.js`.
- [ ] 608. Move `_stylePeek`, `_styleMatch`, `_styleConsume`, `_styleLooksZigString`, and `_styleLooksZigExpr` into `style_expr_tokens.js`.
- [ ] 609. Re-open `style_expr_tokens.js` and confirm the helper set is complete.
- [ ] 610. Create `smith/parse/attrs/style_expr_spec.js`.
- [ ] 611. Move `_styleSpecToExpr` and `_styleSpecBoolExpr` into `style_expr_spec.js`.
- [ ] 612. Re-open `style_expr_spec.js` and write `style_expr_spec_contains_both_helpers: true|false` to `reports/sections/final_status.md`.
- [ ] 613. Create `smith/parse/attrs/style_expr_parser.js`.
- [ ] 614. Move `_styleParsePrimary`, `_styleParseUnary`, `_styleParseComparison`, `_styleParseAnd`, `_styleParseOr`, `_styleParseObjectValue`, `_styleParseObject`, `_styleParseIife`, `_styleParseBase`, and `_styleParseExpr` into `style_expr_parser.js`.
- [ ] 615. Re-open `style_expr_parser.js` and confirm the Pratt parser surface is complete.
- [ ] 616. Create `smith/parse/attrs/style_expr_entry.js`.
- [ ] 617. Move `_parseStyleExprFromRaw`, `parseStyleExpressionAttr`, `_styleExprCollectKeys`, and `_styleExprResolveField` into `style_expr_entry.js`.
- [ ] 618. Re-open `style_expr_entry.js` and confirm the entry surface is complete.
- [ ] 619. Create `smith/parse/attrs/pending_style.js`.
- [ ] 620. Move `_pendingStyleFieldMeta` through `applyPendingStyleExprs` into `pending_style.js`.
- [ ] 621. Re-open `pending_style.js` and confirm the deferred-style surface is complete.
- [ ] 622. Create `smith/parse/attrs/handler.js`.
- [ ] 623. Move `parseHandler` into `handler.js`.
- [ ] 624. Re-open `handler.js` and write `parseHandler_moved_cleanly: true|false` to `reports/sections/final_status.md`.
- [ ] 625. Create `smith/parse/attrs/handler_lua.js`.
- [ ] 626. Move `luaParseHandler` into `handler_lua.js`.
- [ ] 627. Re-open `handler_lua.js` and write `luaParseHandler_moved_cleanly: true|false` to `reports/sections/final_status.md`.
- [ ] 628. Create `smith/parse/attrs/value_expr.js`.
- [ ] 629. Open `attrs.js` and locate `parseValueExpr`.
- [ ] 630. Move `parseValueExpr` into `value_expr.js`.
- [ ] 631. Re-open `value_expr.js` and write `parseValueExpr_moved_cleanly: true|false` to `reports/sections/final_status.md`.
- [ ] 632. Create `smith/parse/attrs/value_expr_lua.js`.
- [ ] 633. Open `attrs.js` and locate `luaParseValueExpr`.
- [ ] 634. Move `luaParseValueExpr` into `value_expr_lua.js`.
- [ ] 635. Re-open `value_expr_lua.js`, write `luaParseValueExpr_moved_cleanly: true|false` to `reports/sections/final_status.md`, then commit with message `migration(single-agent): S588-635 step-635 attrs-decomposition-extraction`.

## 636-660 Final Verification And Closure

- [ ] 636. Update `smith/attrs.js` so it becomes a thin entry surface or compatibility layer after the extraction.
- [ ] 637. Re-open `attrs.js` and write `attrs_js_is_thin_and_explicit_after_extraction: true|false` to `reports/sections/final_status.md`.
- [ ] 638. Update imports in `parse/element/attrs_dispatch.js` to use the new `parse/attrs/*` files.
- [ ] 639. Re-open `attrs_dispatch.js` and confirm every imported helper path is correct.
- [ ] 640. Open `parse/template_literal.js`, write `template_literal_imports_attrs_js_directly_before_patch: true|false` to `reports/sections/final_status.md`, and replace the import if the boolean is `true`.
- [ ] 641. Re-open `parse/template_literal.js` and confirm the import path.
- [ ] 642. Open `parse/handlers/press.js`, write `press_imports_attrs_js_directly_before_patch: true|false` to `reports/sections/final_status.md`, and replace the import if the boolean is `true`.
- [ ] 643. Re-open `press.js` and confirm the import path.
- [ ] 644. Open `collect/classifiers.js`, write `collect_classifiers_imports_attrs_js_directly_before_patch: true|false` to `reports/sections/final_status.md`, and replace the import if the boolean is `true`.
- [ ] 645. Re-open `collect/classifiers.js` and confirm the import path.
- [ ] 646. Run one parser/style-heavy parity case and write `reports/parity/attrs_post_split.json`.
- [ ] 647. Run one handler-heavy parity case and write `reports/parity/handlers_post_split.json`.
- [ ] 648. Run one render-local/eval-heavy parity case and write `reports/parity/eval_post_split.json`.
- [ ] 649. Open all three reports and inspect `diff_status`.
- [ ] 650. If any final report drifts, write the exact first diff hunk and exact changed file to `reports/sections/final_status.md`; if none drift, write `final_report_drift: false`.
- [ ] 651. If `final_report_drift` is `false`, record `MATCH` in `final_status.md`; if `true`, record `MATCH: false`.
- [ ] 652. Re-open `final_status.md` and write `final_status_names_attrs_extraction_and_three_post_split_reports: true|false` to `migration/control_board.md`.
- [ ] 653. Re-open `completed.txt` and confirm every section range from 021 onward has at least one completion line.
- [ ] 654. Re-open `blocked.txt` and write `blocked_txt_empty_or_only_contains_resolved_entries: true|false` to `migration/control_board.md`.
- [ ] 655. Re-open `current_step.txt` and confirm it reflects the last completed step.
- [ ] 656. Update `current_step.txt` to `656` only after steps 599-608 are complete, then commit with message `migration(single-agent): S636-660 step-656 final-verification-closure`.
- [ ] 657. Re-read this entire proposal from 001 through 660 and write `proposal_full_span_reread_complete: true|false` to `reports/sections/final_status.md`.
- [ ] 658. Write `migration/reports/closure_summary.md` with exact changed files, exact kept files, exact deleted files, exact parity reports, and exact remaining gaps.
- [ ] 659. Re-open `closure_summary.md` and confirm it is specific enough that another reader can audit the run without re-deriving intent.
- [ ] 660. Stop the loop only after `closure_summary.md`, `final_status.md`, `completed.txt`, `blocked.txt`, and `current_step.txt` all agree on the same end state, then commit with message `migration(single-agent): S636-660 step-660 migration-closure`.
