# Smith Emit Atom Manifest

Emit atoms are the output-side mirror of intake patterns.

The goal is the same: if a new emit shape appears, add one new atom file instead of swelling a monolith.

Unlike intake patterns, emit atoms are positive-only:

- atoms describe output we clearly know how to emit
- there are no "reject" atoms
- mapped content that is not cleanly OA-backed belongs in LuaJIT atoms, not new Zig map loops

Current live emit logic still lives under `smith/emit/*.js` and `smith/emit_split.js`.
This tree is the catalog and migration target for breaking that logic into additive atoms.

## File Format

Every emit atom file should follow this structure:

```js
// ── Emit Atom 019: Map metadata ─────────────────────────────────
// Index: 19
// Group: maps_zig
// Target: zig
// Status: catalog | partial | complete
// Current owner: emit/map_pools.js
//
// Trigger:
//   ctx.maps.length > 0
//
// Output target:
//   buildMapEmitOrder(), promoted-array metadata, handler field refs
//
// Notes:
//   OA-backed maps only. Non-OA / render-local maps go to maps_lua/*

function applies(ctx, meta) {
  void ctx;
  void meta;
  return false;
}

function emit(ctx, meta) {
  void ctx;
  void meta;
  return '';
}

module.exports = {
  id: 19,
  name: 'map_metadata',
  group: 'maps_zig',
  target: 'zig',
  status: 'catalog',
  currentOwner: 'emit/map_pools.js',
  applies: applies,
  emit: emit,
};
```

## Rules

1. One atom per file.
2. Atoms describe emitted output only. Intake acceptance/rejection logic stays in `patterns/`.
3. Every atom must declare its current live owner while migration is incomplete.
4. `maps_zig/*` is only for OA-backed map pools and rebuilds.
5. If mapped content is render-local, script-computed, chained runtime data, or otherwise not reducible to registered OA fields, route it to `maps_lua/*` and LuaJIT/zluajit instead of forcing new Zig map emission.
6. `logic_runtime/*` may target JS-in-Zig or Lua-in-Zig blocks when the emitted artifact is embedded script source.
7. `split_finalize/*` is allowed to target split-file post-processing rather than direct Zig snippets.
8. Until the live emitter is migrated, these atoms are reference scaffolding and should not change runtime behavior by themselves.

## Groups

- `preamble` — banner and imports
- `state_tree` — state manifest, init, static tree, root, buffers
- `handlers_effects` — non-map handlers and effect renderers
- `object_arrays` — QJS bridge, OA storage, OA unpackers, variant host setter
- `maps_zig` — OA-backed map declarations and Zig rebuilds
- `maps_lua` — LuaJIT detours for runtime/non-OA mapped content
- `logic_runtime` — embedded JS/Lua logic blocks and runtime updaters
- `entry` — init/tick/export/main scaffolding
- `split_finalize` — split-output partitioning and post-pass cleanup

## Atom Registry

| # | File | Atom | Target | Current owner |
|---|------|------|--------|---------------|
| 1 | `preamble/a001_compile_banner.js` | Compile banner | `zig` | `emit/preamble.js` |
| 2 | `preamble/a002_core_imports.js` | Core imports | `zig` | `emit/preamble.js` |
| 3 | `preamble/a003_runtime_imports.js` | Runtime imports | `zig` | `emit/preamble.js` |
| 4 | `state_tree/a004_state_manifest.js` | State manifest | `zig` | `emit/state_manifest.js` |
| 5 | `state_tree/a005_init_state_slots.js` | Init state slots | `zig` | `emit/state_manifest.js` |
| 6 | `state_tree/a006_static_node_arrays.js` | Static node arrays | `zig` | `emit/node_tree.js` |
| 7 | `state_tree/a007_root_node_init.js` | Root node init | `zig` | `emit/node_tree.js` |
| 8 | `state_tree/a008_dynamic_text_buffers.js` | Dynamic text buffers | `zig` | `emit/dyn_text.js` |
| 9 | `handlers_effects/a009_non_map_handlers.js` | Non-map handlers | `zig` | `emit/handlers.js` |
| 10 | `handlers_effects/a010_cpu_effect_renderers.js` | CPU effect renderers | `zig` | `emit/effects.js` |
| 11 | `handlers_effects/a011_wgsl_effect_shaders.js` | WGSL effect shaders | `zig` | `emit/effects.js`, `emit_split.js` |
| 12 | `object_arrays/a012_qjs_bridge.js` | QJS bridge | `zig` | `emit/object_arrays.js` |
| 13 | `object_arrays/a013_oa_string_helpers.js` | OA string helpers | `zig` | `emit/object_arrays.js` |
| 14 | `object_arrays/a014_oa_const_storage.js` | OA const storage | `zig` | `emit/object_arrays.js` |
| 15 | `object_arrays/a015_oa_dynamic_storage.js` | OA dynamic storage | `zig` | `emit/object_arrays.js` |
| 16 | `object_arrays/a016_oa_flat_unpack.js` | OA flat unpack | `zig` | `emit/object_arrays.js` |
| 17 | `object_arrays/a017_oa_nested_unpack.js` | OA nested unpack | `zig` | `emit/object_arrays.js` |
| 18 | `object_arrays/a018_variant_host_setter.js` | Variant host setter | `zig` | `emit/object_arrays.js` |
| 19 | `maps_zig/a019_map_metadata.js` | Map metadata | `zig` | `emit/map_pools.js` |
| 20 | `maps_zig/a020_flat_map_pool_decls.js` | Flat map pool declarations | `zig` | `emit/map_pools.js` |
| 21 | `maps_zig/a021_nested_map_pool_decls.js` | Nested map pool declarations | `zig` | `emit/map_pools.js` |
| 22 | `maps_zig/a022_inline_map_pool_decls.js` | Inline map pool declarations | `zig` | `emit/map_pools.js` |
| 23 | `maps_zig/a023_map_per_item_arrays.js` | Map per-item arrays | `zig` | `emit/map_pools.js` |
| 24 | `maps_zig/a024_map_dynamic_text_storage.js` | Map dynamic text storage | `zig` | `emit/map_pools.js` |
| 25 | `maps_zig/a025_map_handler_ptrs.js` | Map handler ptrs | `zig` | `emit/map_pools.js` |
| 26 | `maps_zig/a026_flat_map_rebuild.js` | Flat map rebuild | `zig` | `emit/map_pools.js` |
| 27 | `maps_zig/a027_nested_map_rebuild.js` | Nested map rebuild | `zig` | `emit/map_pools.js` |
| 28 | `maps_zig/a028_inline_map_rebuild.js` | Inline map rebuild | `zig` | `emit/map_pools.js` |
| 29 | `maps_lua/a029_lua_map_wrapper_registration.js` | Lua map wrapper registration | `zig` | `emit/entrypoints.js` |
| 30 | `maps_lua/a030_lua_map_rebuilder_functions.js` | Lua map rebuilder functions | `lua_in_zig` | `emit/lua_maps.js`, `emit_split.js` |
| 31 | `maps_lua/a031_lua_nested_helpers.js` | Lua nested helpers | `lua_in_zig` | `emit/lua_maps.js` |
| 32 | `maps_lua/a032_lua_map_master_dispatch.js` | Lua map master dispatch | `lua_in_zig` | `emit_split.js` |
| 33 | `logic_runtime/a033_js_logic_block.js` | JS logic block | `js_in_zig` | `emit_split.js` |
| 34 | `logic_runtime/a034_lua_logic_block.js` | Lua logic block | `lua_in_zig` | `emit_split.js` |
| 35 | `logic_runtime/a035_dynamic_text_updates.js` | Dynamic text updates | `zig` | `emit/runtime_updates.js` |
| 36 | `logic_runtime/a036_conditional_updates.js` | Conditional updates | `zig` | `emit/runtime_updates.js` |
| 37 | `logic_runtime/a037_variant_updates.js` | Variant updates | `zig` | `emit/runtime_updates.js` |
| 38 | `logic_runtime/a038_runtime_dirty_tick.js` | Runtime dirty tick | `zig` | `emit/entrypoints.js`, `emit/runtime_updates.js` |
| 39 | `entry/a039_app_init.js` | App init | `zig` | `emit/entrypoints.js` |
| 40 | `entry/a040_app_tick.js` | App tick | `zig` | `emit/entrypoints.js` |
| 41 | `entry/a041_app_exports.js` | App exports | `zig` | `emit/entrypoints.js` |
| 42 | `entry/a042_app_main.js` | App main | `zig` | `emit/entrypoints.js` |
| 43 | `split_finalize/a043_split_section_extraction.js` | Split section extraction | `split` | `emit_split.js` |
| 44 | `split_finalize/a044_split_namespace_prefixing.js` | Split namespace prefixing | `split` | `emit_split.js` |
| 45 | `split_finalize/a045_split_module_headers.js` | Split module headers | `split` | `emit_split.js` |
| 46 | `split_finalize/a046_finalize_postpass.js` | Finalize post-pass | `zig` | `emit/finalize.js` |

