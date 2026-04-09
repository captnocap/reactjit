# Rollback Plan — S459-492 Live Switch And Rollback

Timestamp: 2026-04-09
Step range: 459-492

## Boolean Gates

buildEmitMeta_exists_as_named_helper: true
buildEmitMeta_has_flat_maps_feature_flag: true
non_lua_tree_path_calls_legacy_orchestration_before_switch: true
emit_js_switch_line_present: true
lua_tree_path_returns_through_finalizeEmitOutput: true

## Rollback Instructions

To re-enable the legacy emit path:

1. In `smith_LOAD_ORDER.txt`: uncomment the 11 lines under "LEGACY EMIT ORCHESTRATION" (lines 310-320): preamble.js, state_manifest.js, node_tree.js, dyn_text.js, handlers.js, effects.js, object_arrays.js, map_pools.js, runtime_updates.js, entrypoints.js, logic_blocks.js.

2. In `smith/emit.js`: replace the atom-path block:
   ```
   var meta = buildEmitMeta(ctx, rootExpr, file);
   var out = runEmitAtoms(ctx, meta);
   ```
   with the original legacy orchestration that calls emitPreamble(), emitStateManifest(), emitNodeTree(), emitDynamicTextBuffers(), emitNonMapHandlers(), emitEffectRenders(), emitObjectArrayInfrastructure(), emitMapPoolDeclarations(), emitMapPoolRebuilds(), appendOrphanedMapArrays(), emitLogicBlocks(), emitInitState(), emitRuntimeSupportSections(), emitRuntimeEntrypoints() in sequence.

3. Rebuild forge: `zig build forge`

This is a reversible change, not a reconstruction — the commented files are intact and the atom path can be toggled by editing two files.

post_switch_reports_match_expected_output: true
