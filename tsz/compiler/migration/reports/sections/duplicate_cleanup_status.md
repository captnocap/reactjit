# Duplicate / Global Cleanup Status — S518-547

Timestamp: 2026-04-09
Step range: 518-547

## Boolean Gates

effect_transpile_duplicate_has_canonical_winner: true
effect_transpile_canonical_winner: smith/emit/effect_transpile.js
effect_transpile_marked_for_deletion: smith/emit_ops/effect_transpile.js
effect_wgsl_duplicate_has_canonical_winner: true
effect_wgsl_canonical_winner: smith/emit/effect_wgsl.js
effect_wgsl_marked_for_deletion: smith/emit_ops/effect_wgsl.js
transforms_duplicate_emit_version_is_superset: true
emit_ops_transforms_marked_for_deletion: smith/emit_ops/transforms.js
js_expr_to_lua_canonical_winner_exists: true
js_expr_to_lua_canonical_winner: smith/emit_atoms/maps_lua/lua_map_subs.js (superset, loaded later, has render local expansion, prop stack, OA refs, state slots, nested index)
js_expr_to_lua_marked_for_deletion: smith/emit_ops/js_expr_to_lua.js (simpler version, overwritten at runtime by lua_map_subs.js)
js_expr_to_lua_porting_skipped: true
kept_jsExprToLua_signature_and_behavior_match_expected_contract: true
only_kept_jsExprToLua_definition_remains_in_active_load_path: true
post_cleanup_lua_map_parity: MATCH
